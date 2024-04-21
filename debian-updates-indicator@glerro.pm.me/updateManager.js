/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator
 *
 * updateManager.js
 *
 * Copyright (c) 2023-2024 Gianni Lerro {glerro} ~ <glerro@pm.me>
 *
 * Debian Linux Updates Indicator is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Debian Linux Updates Indicator is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with Debian Linux Updates Indicator. If not, see <https://www.gnu.org/licenses/>.
 *
 * *****************************************************************************
 * Original Authors: Fran Glais ~ <https://github.com/franglais125>
 *                   Raphael Rochet ~ <https://github.com/RaphaelRochet>
 * *****************************************************************************
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * SPDX-FileCopyrightText: 2023-2024 Gianni Lerro <glerro@pm.me>
 */

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {formatDateWithCFormatString} from 'resource:///org/gnome/shell/misc/dateUtils.js';

import * as Indicator from './indicator.js';
import * as Monitors from './monitors.js';
import * as Utils from './utils.js';

/* Options */
const STOCK_CHECK_CMD  = '/usr/bin/pkcon refresh';
const STOCK_UPDATE_CMD = '/usr/bin/gnome-software --mode updates';
let CHECK_CMD          = STOCK_CHECK_CMD;
let UPDATE_CMD         = STOCK_UPDATE_CMD;

/* Various packages statuses */
const SCRIPT = Indicator.SCRIPT;

/* For error checking */
const STATUS = Indicator.STATUS;

export const UpdateManager = class UpdateManager {
    constructor(extension) {
        this._extension = extension;
        this._extensionName = this._extension.metadata.name;
        this._extensionPath = this._extension.path;

        this._TimeoutId = null;
        this._initialTimeoutId = null;

        // Create a Gio.Cancellable for use with Gio.SubProcess
        this._cancellable = new Gio.Cancellable();

        // Create indicator on the panel and initialize it
        this._indicator = new Indicator.DebianUpdatesIndicator(this);
        this._indicator.updateStatus(STATUS.INITIALIZING);

        // Prepare to track connections
        this._signalsHandler = new Utils.GlobalSignalsHandler(this._extensionName);

        // The first run is initialization only: we only read the existing files
        this._initializing = true;

        // We don't update the date in some cases:
        //  - updates check comes from a folder change
        //  - after applying updates
        this._dontUpdateDate = false;

        // Load settings
        this._extensionSettings = this._extension.getSettings();
        this._applySettings();

        // Start network and directory monitors
        this._netMonitor = new Monitors.NetworkMonitor(this);
        this._dirMonitor = new Monitors.DirectoryMonitor(this);

        // Initial run. We wait 30 seconds before listing the upgrades, this:
        //  - allows a smoother initialization
        //  - lets the async calls finish in case of a quick disable/enable loop
        let initialRunTimeout = 30;
        this._initialTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            initialRunTimeout,
            () => {
                this._launchScript(SCRIPT.UPGRADES);
                this._initialTimeoutId = null;
                return false;
            });

        this._ignoreListTimeoutId = 0;
    }

    _applySettings() {
        // Parse the various commands
        this._updateCMD();
        this._checkCMD();

        // Add a check at intervals
        this._initializeInterval();

        this._bindSettings();
    }

    _updateCMD() {
        let option = this._extensionSettings.get_int('update-cmd-options');
        if (option === 1) {
            // Synaptic package manager
            UPDATE_CMD = '/usr/bin/synaptic-pkexec';
        } else if (option === 2) {
            // Gnome Update Viewer: depends on pacakge-kit
            UPDATE_CMD = '/usr/bin/gpk-update-viewer';
        } else if (option === 3) {
            // Update manager, Ubuntu only
            UPDATE_CMD = '/usr/bin/update-manager';
        } else if (option === 4 && this._extensionSettings.get_string('update-cmd') !== '') {
            // Custom command
            if (this._extensionSettings.get_boolean('output-on-terminal')) {
                UPDATE_CMD = `/usr/bin/${this._extensionSettings.get_string('terminal')}` +
                             ` "echo ${this._extensionSettings.get_string('update-cmd')}` +
                             `; ${this._extensionSettings.get_string('update-cmd')}` +
                             '; echo Press any key to continue' +
                             '; read -n1 key"';
            } else {
                UPDATE_CMD = `/usr/bin/${this._extensionSettings.get_string('update-cmd')}`;
            }
        }  else {
            // Default, or in case the command is empty, Gnome-Software
            UPDATE_CMD = STOCK_UPDATE_CMD;
        }
    }

    _checkCMD() {
        if (this._extensionSettings.get_boolean('use-custom-cmd') &&
            this._extensionSettings.get_string('check-cmd-custom') !== '')
            CHECK_CMD = `/usr/bin/${this._extensionSettings.get_string('check-cmd-custom')}`;
        else
            CHECK_CMD = STOCK_CHECK_CMD;
    }

    _initializeInterval() {
        this._isAutomaticCheck = false;

        // Remove the periodic check before adding a new one
        if (this._TimeoutId)
            GLib.source_remove(this._TimeoutId);

        // Interval in hours from settings, convert to seconds
        let unit = this._extensionSettings.get_int('interval-unit');
        let conversion = 0;

        switch (unit) {
        case 0: // Hours
            conversion = 60 * 60;
            break;
        case 1: // Days
            conversion = 60 * 60 * 24;
            break;
        case 2: // Weeks
            conversion = 60 * 60 * 24 * 7;
            break;
        }

        let CHECK_INTERVAL = conversion * this._extensionSettings.get_int('check-interval');

        if (CHECK_INTERVAL) {
            // This has to be relative to the last check!
            // Date is in milliseconds, convert to seconds
            let lastCheck = this._extensionSettings.get_double('last-check-date-automatic-double');
            let now = new Date();
            let elapsed = (now - lastCheck) / 1000; // In seconds

            CHECK_INTERVAL -= elapsed;
            if (CHECK_INTERVAL < 0) {
                if (this._initializing)
                    // Wait 2 minutes if just initialized, i.e. after boot or
                    // unlock screen
                    CHECK_INTERVAL = 120;
                else
                    CHECK_INTERVAL = 10;
            }

            this._initTimeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                CHECK_INTERVAL,
                () => {
                    this._isAutomaticCheck = true;
                    this._checkNetwork();
                    this._checkInterval();
                    return true;
                });
        }
    }

    _checkInterval() {
        // Remove the periodic check before adding a new one
        if (this._TimeoutId)
            GLib.source_remove(this._TimeoutId);

        let CHECK_INTERVAL = this._extensionSettings.get_int('check-interval') * 60 * 60;
        if (CHECK_INTERVAL) {
            this._checkTimeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                CHECK_INTERVAL,
                () => {
                    this._isAutomaticCheck = true;
                    this._checkNetwork();
                    return true;
                });
        }
    }

    _newPackagesBinding() {
        if (this._extensionSettings.get_boolean('new-packages')) {
            this._launchScript(SCRIPT.NEW);
        } else {
            this._indicator._newPackagesList = [];
            this._indicator._updateNewPackagesStatus();
        }
    }

    _obsoletePackagesBinding() {
        if (this._extensionSettings.get_boolean('obsolete-packages')) {
            this._launchScript(SCRIPT.OBSOLETE);
        } else {
            this._indicator._obsoletePackagesList = [];
            this._indicator._updateObsoletePackagesStatus();
        }
    }

    _residualPackagesBinding() {
        if (this._extensionSettings.get_boolean('residual-packages')) {
            this._launchScript(SCRIPT.RESIDUAL);
        } else {
            this._indicator._residualPackagesList = [];
            this._indicator._updateResidualPackagesStatus();
        }
    }

    _autoremovablePackagesBinding() {
        if (this._extensionSettings.get_boolean('autoremovable-packages')) {
            this._launchScript(SCRIPT.AUTOREMOVABLE);
        } else {
            this._indicator._autoremovablePackagesList = [];
            this._indicator._updateAutoremovablePackagesStatus();
        }
    }

    _bindSettings() {
        this._signalsHandler.add([
        // Apply updates
            this._extensionSettings,
            'changed::update-cmd-options',
            this._updateCMD.bind(this),
        ], [
            this._extensionSettings,
            'changed::terminal',
            this._updateCMD.bind(this),
        ], [
            this._extensionSettings,
            'changed::output-on-terminal',
            this._updateCMD.bind(this),
        ], [
            this._extensionSettings,
            'changed::update-cmd',
            this._updateCMD.bind(this),
        ], [
        // Checking for updates
            this._extensionSettings,
            'changed::check-cmd-custom',
            this._checkCMD.bind(this),
        ], [
            this._extensionSettings,
            'changed::use-custom-cmd',
            this._checkCMD.bind(this),
        ], [
        // Basic settings
            this._extensionSettings,
            'changed::check-interval',
            this._initializeInterval.bind(this),
        ], [
        // Basic settings
            this._extensionSettings,
            'changed::interval-unit',
            this._initializeInterval.bind(this),
        ], [
            this._extensionSettings,
            'changed::strip-versions',
            () => {
                this._launchScript(SCRIPT.UPGRADES);
            },
        ], [
            this._extensionSettings,
            'changed::show-critical-updates',
            () => {
                this._launchScript(SCRIPT.UPGRADES);
            },
        ], [
            this._extensionSettings,
            'changed::ignore-list',
            () => {
                // We add a timeout in case many entries are deleted
                if (this._ignoreListTimeoutId) {
                    GLib.source_remove(this._ignoreListTimeoutId);
                    this._ignoreListTimeoutId = 0;
                }

                this._ignoreListTimeoutId = GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT,
                    5,
                    () => {
                        this._launchScript(SCRIPT.UPGRADES);
                        this._ignoreListTimeoutId = 0;
                        return false;
                    });
            },
        ], [
            // Synaptic like features
            this._extensionSettings,
            'changed::new-packages',
            this._newPackagesBinding.bind(this),
        ], [
            this._extensionSettings,
            'changed::obsolete-packages',
            this._obsoletePackagesBinding.bind(this),
        ], [
            this._extensionSettings,
            'changed::residual-packages',
            this._residualPackagesBinding.bind(this),
        ], [
            this._extensionSettings,
            'changed::autoremovable-packages',
            this._autoremovablePackagesBinding.bind(this),
        ], [
            // Indicator buttons
            this._indicator.checkNowMenuItem,
            'activate',
            this._checkNetwork.bind(this),
        ], [
            this._indicator.applyUpdatesMenuItem,
            'activate',
            this._applyUpdates.bind(this),
        ]);
    }

    /* Upgrade functions:
     *     _applyUpdates
     *     _applyUpdatesEnd
     */

    _applyUpdates() {
        if (this._upgradeProcess_sourceId) {
            // A check is running ! Maybe we should kill it and run another one ?
            return;
        }

        // Parse check command line
        let [parseok, argvp] = GLib.shell_parse_argv(UPDATE_CMD);
        if (!parseok)
            throw new Error('Update cmd parse error');

        let proc = new Gio.Subprocess({argv: argvp, flags: Gio.SubprocessFlags.STDOUT_PIPE});
        proc.init(this._cancellable);

        let cancelId = 0;
        if (this._cancellable instanceof Gio.Cancellable)
            cancelId = this._cancellable.connect(() => proc.force_exit());

        try {
            // Asynchronously call the output handler when script output is ready
            proc.communicate_utf8_async(null, this._cancellable, this._applyUpdatesEnd.bind(this));

            this._upgradeProcess_sourceId = 1;

            GLib.strfreev(argvp);
        } catch (err) {
            console.log(`${this._extensionName} - ${err.message}`);
        } finally {
            if (cancelId > 0)
                this._cancellable.disconnect(cancelId);
        }
    }

    _applyUpdatesEnd() {
        // Free resources
        this._upgradeProcess_sourceId = null;

        // Check if updates are available
        this._dontUpdateDate = true;
        this._launchScript(SCRIPT.UPGRADES);
    }

    /* Update functions:
     *     _checkNetwork
     *     networkFailed
     *     checkUpdates
     *     _checkUpdatesEnd
     */

    _checkNetwork() {
        this._indicator.showChecking(true);
        this._netMonitor.networkTimeout();
    }

    networkFailed() {
        this._indicator.showChecking(false);
        this._indicator.updateStatus(STATUS.NO_INTERNET);
    }

    checkUpdates() {
        // Stop the dir monitor to prevent it from updating again right after
        // the update
        this._dirMonitor.stop();

        if (this._upgradeProcess_sourceId) {
            // A check is already running ! Maybe we should kill it and run another one ?
            return;
        }

        // Run asynchronously, to avoid  shell freeze - even for a 1s check
        // Parse check command line
        let [parseok, argvp] = GLib.shell_parse_argv(CHECK_CMD);
        if (!parseok)
            throw new Error('Check cmd parse error');

        let proc = new Gio.Subprocess({argv: argvp, flags: Gio.SubprocessFlags.STDOUT_PIPE});
        proc.init(this._cancellable);

        let cancelId = 0;
        if (this._cancellable instanceof Gio.Cancellable)
            cancelId = this._cancellable.connect(() => proc.force_exit());

        try {
            // Asynchronously call the output handler when script output is ready
            proc.communicate_utf8_async(null, this._cancellable, this._checkUpdatesEnd.bind(this));

            this._upgradeProcess_sourceId = 1;
        } catch (err) {
            console.log(`${this._extensionName} - ${err.message}`);
            this._indicator.showChecking(false);
            this._indicator.updateStatus(STATUS.ERROR);
        } finally {
            if (cancelId > 0)
                this._cancellable.disconnect(cancelId);
        }
    }

    _checkUpdatesEnd() {
        // Free resources
        this._upgradeProcess_sourceId = null;

        // Update indicator
        this._launchScript(SCRIPT.UPGRADES);
    }

    /* Extra packages functions:
     *     _launchScript
     *     _packagesRead
     *     _packagesEnd
     *     _lastCheck
     */

    _launchScript(index) {
        let scriptNames = [
            'get-updates',
            'new',
            'obsolete',
            'residual',
            'autoremovable',
        ];

        // Run asynchronously, to avoid shell freeze - even for a 1s check

        let path = this._extensionPath;
        let script = [
            '/bin/bash',
            `${path}/scripts/${scriptNames[index]}.sh`,
            this._initializing ? '1' : '0',
            `${path}/Temp/`,
        ];

        let proc = new Gio.Subprocess({argv: script, flags: Gio.SubprocessFlags.STDOUT_PIPE});
        proc.init(this._cancellable);

        let cancelId = 0;
        if (this._cancellable instanceof Gio.Cancellable)
            cancelId = this._cancellable.connect(() => proc.force_exit());

        try {
            // Asynchronously call the output handler when script output is ready
            proc.communicate_utf8_async(null, this._cancellable, this._packagesRead.bind(this, index));
        } catch (err) {
            console.log(`${this._extensionName} - Failed to run ${scriptNames[index]}.sh - ${err.message}`);
            if (index === SCRIPT.UPGRADES) {
                this._indicator.showChecking(false);
                this._indicator.updateStatus(STATUS.ERROR);
            }
        } finally {
            if (cancelId > 0)
                this._cancellable.disconnect(cancelId);
        }
    }

    _packagesRead(index, proc, result) {
        // Reset the new packages list
        let [, output] = proc.communicate_utf8_finish(result);
        let packagesList = output.split('\n');
        packagesList.pop(); // Last item is empty

        // Since this runs async, the indicator might have been destroyed!
        if (this._indicator) {
            if (index === SCRIPT.UPGRADES) {
                packagesList = this._filterList(packagesList);
                this._indicator._updateList = packagesList;
            } else if (index === SCRIPT.NEW) {
                this._indicator._newPackagesList = packagesList;
            } else if (index === SCRIPT.OBSOLETE) {
                this._indicator._obsoletePackagesList = packagesList;
            } else if (index === SCRIPT.RESIDUAL) {
                this._indicator._residualPackagesList = packagesList;
            } else if (index === SCRIPT.AUTOREMOVABLE) {
                this._indicator._autoremovablePackagesList = packagesList;
            }
        }

        this._packagesEnd(index);
    }

    _packagesEnd(index) {
        // Since this runs async, the indicator might have been destroyed!
        if (this._indicator) {
            // Update indicator
            // TODO: check
            if (index === SCRIPT.UPGRADES /* && this._extensionSettings.get_boolean('show-critical-updates') */) {
                this._filterHeldPackages();
                // this._checkUrgency();
            } else {
                this._indicator.updatePackagesStatus(index);
                this._indicator._urgentList = [];
            }

            if (index === SCRIPT.UPGRADES) {
                // Update indicator
                this._indicator.showChecking(false);

                // Update time on menu
                this._lastCheck();

                // Launch other checks
                if (this._extensionSettings.get_boolean('new-packages'))
                    this._launchScript(SCRIPT.NEW);
                if (this._extensionSettings.get_boolean('obsolete-packages'))
                    this._launchScript(SCRIPT.OBSOLETE);
                if (this._extensionSettings.get_boolean('residual-packages'))
                    this._launchScript(SCRIPT.RESIDUAL);
                if (this._extensionSettings.get_boolean('autoremovable-packages'))
                    this._launchScript(SCRIPT.AUTOREMOVABLE);
                this._initializing = false;

                this._dirMonitor.start();
            }
        }
    }

    _checkUrgency() {
        let path = this._extensionPath;
        let script = ['/bin/bash', `${path}/scripts/urgency.sh`];

        let proc = new Gio.Subprocess({argv: script, flags: Gio.SubprocessFlags.STDOUT_PIPE});
        proc.init(this._cancellable);

        let cancelId = 0;
        if (this._cancellable instanceof Gio.Cancellable)
            cancelId = this._cancellable.connect(() => proc.force_exit());

        try {
            // Asynchronously call the output handler when script output is ready
            proc.communicate_utf8_async(null, this._cancellable, this._checkUrgencyRead.bind(this));
        } catch (err) {
            console.log(`${this._extensionName} - Failed to run urgency.sh - ${err.message}`);
        } finally {
            if (cancelId > 0)
                this._cancellable.disconnect(cancelId);
        }
    }

    _checkUrgencyRead(proc, result) {
        // Reset the new packages list
        let [, output] = proc.communicate_utf8_finish(result);
        let urgencyList = output.split('\n');
        urgencyList.pop(); // Last item is empty

        let cleanUrgentList = this._indicator._updateList.filter(pkg => {
            for (let i = 0; i < urgencyList.length; i++) {
                // Only get the package name, in case the version is included
                let pkgName = pkg.split('\t', 2)[0];
                if (urgencyList[i].indexOf(`${pkgName}-`) !== -1)
                    return true;
            }
            return false;
        });

        this._indicator._urgentList = cleanUrgentList;
        this._indicator.updatePackagesStatus(SCRIPT.UPGRADES);
    }

    _lastCheck() {
        if (this._dontUpdateDate) {
            this._dontUpdateDate = false;
            return;
        }
        let date;
        let dateFormat = '%a %b %d, %H:%M';

        if (this._initializing) {
            let lastCheck = new Date(this._extensionSettings.get_double('last-check-date-double'));
            date = formatDateWithCFormatString(lastCheck, dateFormat);
        } else {
            let now = new Date();
            date = formatDateWithCFormatString(now, dateFormat);
            this._extensionSettings.set_double('last-check-date-double', now);
            if (this._isAutomaticCheck) {
                this._extensionSettings.set_double('last-check-date-automatic-double', now);
                this._isAutomaticCheck = false;
            }
        }

        if (date !== '') {
            this._indicator.lastCheckMenuItem.label.set_text(_('Last check: ') + date);
            this._indicator.lastCheckMenuItem.visible = true;
        }
    }

    _filterList(packagesList) {
        let ignoreList = this._extensionSettings.get_strv('ignore-list');

        return packagesList.filter(pkg => {
            // only get the package name, in case the version is included
            let pkgname = pkg.split('\t', 2)[0];
            if (ignoreList.indexOf(pkgname) !== -1)
                return false;
            return true;
        });
    }

    _filterHeldPackages() {
        console.log(`${this._extensionName} - Get Held Packages`);
        let heldPackagesList = [];
        let outputList;

        let script = [
            'apt-mark',
            'showhold',
        ];

        let cancelId = 0;

        // TODO: Use promise catch
        try {
            let proc = new Gio.Subprocess({argv: script, flags: Gio.SubprocessFlags.STDOUT_PIPE});
            proc.init(this._cancellable);

            if (this._cancellable instanceof Gio.Cancellable)
                cancelId = this._cancellable.connect(() => proc.force_exit());

            outputList = new Promise((resolve, reject) => {
                proc.communicate_utf8_async(null, this._cancellable, (process, result) => {
                    try {
                        let [, output] = process.communicate_utf8_finish(result);
                        resolve(output);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        } catch (err) {
            console.log(`${this._extensionName} - Failed to run apt-mark showhold - ${err.message}`);
            this._indicator.showChecking(false);
            this._indicator.updateStatus(STATUS.ERROR);
        } finally {
            if (cancelId > 0)
                this._cancellable.disconnect(cancelId);

            outputList.then(outL => {
                heldPackagesList = outL.split('\n');
                heldPackagesList.pop(); // Last item is empty

                this._indicator._updateList = this._indicator._updateList.filter(pkg => {
                    // only get the package name, in case the version is included
                    let pkgname = pkg.split('\t', 2)[0];
                    if (heldPackagesList.indexOf(pkgname) !== -1)
                        return false;
                    return true;
                });

                // TODO: To remove
                heldPackagesList.forEach(entry => {
                    log(entry);
                });

                this._indicator.updatePackagesStatus(SCRIPT.UPGRADES);
                if (this._extensionSettings.get_boolean('show-critical-updates'))
                    this._checkUrgency();
            });
        }
    }

    destroy() {
        // Remove timeouts
        if (this._initTimeoutId) {
            GLib.source_remove(this._initTimeoutId);
            this._initTimeoutId = null;
        }

        if (this._checkTimeoutId) {
            GLib.source_remove(this._checkTimeoutId);
            this._checkTimeoutId = null;
        }

        if (this._ignoreListTimeoutId) {
            GLib.source_remove(this._ignoreListTimeoutId);
            this._ignoreListTimeoutId = null;
        }

        if (this._initialTimeoutId) {
            GLib.source_remove(this._initialTimeoutId);
            this._initialTimeoutId = null;
        }

        // Null settings
        if (this._extensionSettings !== null)
            this._extensionSettings = null;

        // Disconnect global signals
        if (this._signalsHandler !== null) {
            this._signalsHandler.destroy();
            this._signalsHandler = null;
        }

        // Destroy monitors
        if (this._netMonitor !== null) {
            this._netMonitor.destroy();
            this._netMonitor = null;
        }
        if (this._dirMonitor !== null) {
            this._dirMonitor.destroy();
            this._dirMonitor = null;
        }

        // Destroy indicator
        if (this._indicator !== null) {
            this._indicator.destroy();
            this._indicator = null;
        }

        // Cancel all connected cancellable
        if (this._cancellable !== null) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
    }
};

