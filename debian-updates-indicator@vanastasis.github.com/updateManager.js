/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
 * Modified for vanastasis, 2026-11-26.
 *
 * updateManager.js
 *
 * Copyright (c) 2023-2026 Gianni Lerro {glerro} ~ <glerro@pm.me>
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
 * SPDX-FileCopyrightText: 2023-2026 Gianni Lerro <glerro@pm.me>
 */

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {formatDateWithCFormatString} from 'resource:///org/gnome/shell/misc/dateUtils.js';

import * as Indicator from './indicator.js';
import * as Monitors from './monitors.js';
import * as Utils from './utils.js';

/* Options */
const STOCK_CHECK_CMD_OLD = '/usr/bin/pkcon refresh';
const STOCK_CHECK_CMD_NEW = '/usr/bin/pkgcli refresh';
const STOCK_UPDATE_CMD    = '/usr/bin/gnome-software --mode updates';

let STOCK_CHECK_CMD = STOCK_CHECK_CMD_OLD;
let CHECK_CMD       = STOCK_CHECK_CMD;
let UPDATE_CMD      = STOCK_UPDATE_CMD;

/* Various packages statuses */
const SCRIPT = Indicator.SCRIPT;

/* For error checking */
const STATUS = Indicator.STATUS;

export const UpdateManager = class UpdateManager {
    constructor(extension) {
        this._extension = extension;
        this._extensionName = this._extension.metadata.name;
        this._extensionPath = this._extension.path;

        this._initTimeoutId = null;
        this._checkTimeoutId = null;
        this._initialTimeoutId = null;
        this._cleanupProcess = null;

        this._destroyed = false;
        this._scanProcesses = new Map();
        this._refreshProcess = null;
        this._terminalState = null;
        this._upgradeProcess_sourceId = null;
        this._cachePath = GLib.build_filenamev([GLib.get_user_cache_dir(), extension.uuid]);
        this._initializing = true;
        STOCK_CHECK_CMD = GLib.find_program_in_path('pkcon') ? STOCK_CHECK_CMD_OLD :
            GLib.find_program_in_path('pkgcli') ? STOCK_CHECK_CMD_NEW : '';
        CHECK_CMD = STOCK_CHECK_CMD;

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

        // Read local package state promptly without refreshing repositories.
        let initialRunTimeout = 2;
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
        // Presets and custom commands are resolved on activation, not at enable time.
        const option = this._extensionSettings.get_int('update-cmd-options');
        UPDATE_CMD = ({
            1: '/usr/bin/synaptic-pkexec',
            2: '/usr/bin/gpk-update-viewer',
            3: '/usr/bin/update-manager',
        })[option] || STOCK_UPDATE_CMD;
    }

    _checkCMD() {
        if (this._extensionSettings.get_boolean('use-custom-cmd') &&
            this._extensionSettings.get_string('check-cmd-custom') !== '')
            CHECK_CMD = this._extensionSettings.get_string('check-cmd-custom').trim();
        else
            CHECK_CMD = STOCK_CHECK_CMD;
    }

    _initializeInterval() {
        this._isAutomaticCheck = false;

        // Remove the periodic check before adding a new one
        if (this._initTimeoutId) {
            GLib.source_remove(this._initTimeoutId);
            this._initTimeoutId = null;
        }
        if (this._checkTimeoutId) {
            GLib.source_remove(this._checkTimeoutId);
            this._checkTimeoutId = null;
        }

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
                    this._initTimeoutId = null;
                    if (!this._indicator)
                        return GLib.SOURCE_REMOVE;
                    if (!this._operationBusy()) {
                        this._isAutomaticCheck = true;
                        this._checkNetwork();
                    }
                    this._checkInterval();
                    return GLib.SOURCE_REMOVE;
                });
        }
    }

    _checkInterval() {
        // Remove the periodic check before adding a new one
        if (this._checkTimeoutId) {
            GLib.source_remove(this._checkTimeoutId);
            this._checkTimeoutId = null;
        }

        let unit = this._extensionSettings.get_int('interval-unit');
        let conversion = unit === 1 ? 60 * 60 * 24 : unit === 2 ? 60 * 60 * 24 * 7 : 60 * 60;
        let CHECK_INTERVAL = this._extensionSettings.get_int('check-interval') * conversion;
        if (CHECK_INTERVAL) {
            this._checkTimeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                CHECK_INTERVAL,
                () => {
                    if (!this._indicator) {
                        this._checkTimeoutId = null;
                        return GLib.SOURCE_REMOVE;
                    }
                    if (!this._operationBusy()) {
                        this._isAutomaticCheck = true;
                        this._checkNetwork();
                    }
                    return GLib.SOURCE_CONTINUE;
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
        // List visibility is independent of cleanup availability.
        this._indicator._updateResidualPackagesStatus();
        this._launchScript(SCRIPT.RESIDUAL);
    }

    _autoremovablePackagesBinding() {
        // This preference controls list visibility, not cleanup availability.
        this._indicator._updateAutoremovablePackagesStatus();
        this._launchScript(SCRIPT.AUTOREMOVABLE);
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
            'changed::cleanup-purge-residual',
            () => {
                this._indicator._updateCleanupSensitivity();
                this._launchScript(SCRIPT.RESIDUAL);
            },
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
        ], [
            this._indicator.removeUnusedMenuItem,
            'activate',
            this._removeUnusedPackages.bind(this),
        ]);
    }

    /* Upgrade functions:
     *     _applyUpdates
     *     _applyUpdatesEnd
     */

    _parsePackageCommand(value) {
        const [ok, argv] = GLib.shell_parse_argv(value.trim());
        if (!ok || !argv.length)
            throw new Error(_('Invalid or empty package command.'));
        return argv;
    }

    _defaultPackageTerminal() {
        // Honour the desktop preference first, then Debian alternatives.
        if (GLib.find_program_in_path('xdg-terminal-exec'))
            return ['xdg-terminal-exec', '--'];
        if (GLib.find_program_in_path('x-terminal-emulator'))
            return ['x-terminal-emulator', '-e'];
        throw new Error(_('No default terminal found. Install xdg-terminal-exec or x-terminal-emulator.'));
    }

    _packageTerminal(command, xfce = false, customPrefix = '') {
        let prefix;
        if (customPrefix)
            prefix = this._parsePackageCommand(customPrefix);
        else if (xfce) {
            if (!GLib.find_program_in_path('xfce4-terminal'))
                throw new Error(_('XFCE Terminal is not installed.'));
            prefix = ['xfce4-terminal', '--disable-server', '-x'];
        } else {
            prefix = this._defaultPackageTerminal();
        }
        if (!GLib.find_program_in_path(command[0]))
            throw new Error(_('Package command not found: %s').format(command[0]));
        if (command[0] === 'pkexec' && !GLib.find_program_in_path(command[1]))
            throw new Error(_('Package manager not found: %s').format(command[1]));
        // A private completion marker tracks the terminal child even if the
        // desktop terminal launcher exits immediately (e.g. D-Bus activation).
        const state = this._prepareTerminalState();
        const script = [
            'state=$1; shift',
            '[[ -d "$state" ]] || exit 125',
            'umask 077',
            ': > "$state/started" || exit 125',
            'finish() { status=$?; if [[ -d "$state" ]]; then if (( status == 0 )); then : > "$state/done"; else : > "$state/failed"; fi; fi; }',
            'trap finish EXIT',
            'trap "exit 129" HUP',
            'trap "exit 143" TERM',
            '"$@"; status=$?',
            'printf "\\n%s\\n" "Exit status: $status"',
            'printf "Press any key to exit..."; read -r -n 1 -s',
            'exit "$status"',
        ].join('\n');
        return [...prefix, 'bash', '-c', script, 'package-operation', state.path, ...command];
    }

    _prepareTerminalState() {
        const path = GLib.dir_make_tmp('debian-apt-operation-XXXXXX');
        const state = {path, monitor: null, signal: 0, timeout: 0, started: false};
        this._terminalState = state;
        try {
            state.monitor = Gio.File.new_for_path(path).monitor_directory(Gio.FileMonitorFlags.NONE, null);
            state.signal = state.monitor.connect('changed', (monitor, file) => {
                if (this._destroyed || this._terminalState !== state)
                    return;
                const name = file.get_basename();
                if (name === 'started')
                    state.started = true;
                if (name === 'done' || name === 'failed')
                    this._finishPackageOperation(name === 'failed' ? new Error(_('Package operation failed or was cancelled.')) : null);
            });
            state.timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
                state.timeout = 0;
                if (this._terminalState === state && !state.started)
                    this._finishPackageOperation(new Error(_('Terminal did not start the package command.')));
                return GLib.SOURCE_REMOVE;
            });
            return state;
        } catch (error) {
            this._clearTerminalState();
            throw error;
        }
    }

    _clearTerminalState() {
        const state = this._terminalState;
        this._terminalState = null;
        if (!state)
            return;
        if (state.timeout)
            GLib.source_remove(state.timeout);
        if (state.monitor) {
            if (state.signal)
                state.monitor.disconnect(state.signal);
            state.monitor.cancel();
        }
        // Never terminate a package transaction when disabling the extension.
        for (const name of ['started', 'done', 'failed'])
            GLib.unlink(GLib.build_filenamev([state.path, name]));
        GLib.rmdir(state.path);
    }

    // Probe the installed CLI in the terminal before elevation. Never retry a
    // failed package transaction or upgrade without disabling automatic removal.
    _nalaCompatibleCommand(action, purge = false) {
        if (!GLib.find_program_in_path('/usr/bin/nala') || !GLib.find_program_in_path('pkexec'))
            throw new Error(_('Nala or pkexec is not installed.'));
        const script = [
            "action=$1",
            "purge=$2",
            "help=$(LC_ALL=C TERM=dumb NO_COLOR=1 COLUMNS=200 MANWIDTH=200 MANPAGER=cat PAGER=cat /usr/bin/nala \"$action\" --help 2>&1) || { printf '%s\\n' \"$help\" >&2; exit 2; }",
            "has_option() { grep -Eq -- \"(^|[^[:alnum:]_-])$1([^[:alnum:]_-]|$)\" <<< \"$help\"; }",
            "case \"$action\" in",
            "    full-upgrade)",
            "        if has_option --no-auto-remove; then flag=--no-auto-remove",
            "        elif has_option --no-autoremove; then flag=--no-autoremove",
            "        else printf '%s\\n' 'Cannot detect the Nala option to disable automatic removal. No upgrade started.' >&2; exit 2",
            "        fi",
            "        exec pkexec /usr/bin/nala full-upgrade --assume-yes \"$flag\"",
            "        ;;",
            "    autoremove)",
            "        args=()",
            "        if [[ $purge == true ]]; then",
            "            if has_option --remove-config; then flag=--remove-config",
            "            elif has_option --config; then flag=--config",
            "            else printf '%s\\n' 'Cannot detect the Nala residual configuration option. No cleanup started.' >&2; exit 2",
            "            fi",
            "            args+=(--purge \"$flag\")",
            "        fi",
            "        printf '%s\\n' 'APT simulation of unused packages (Nala may resolve differently):'",
            "        /usr/bin/apt-get --simulate autoremove || exit 2",
            "        if [[ $purge == true ]]; then dpkg-query -W -f='${db:Status-Abbrev}\\t${binary:Package}\\n' | awk '$1 == \"rc\" {print $2}'; fi",
            "        read -r -p 'Start Nala cleanup? [y/N] ' answer || exit 1",
            "        [[ $answer == [yY] || $answer == [yY][eE][sS] ]] || exit 0",
            "        exec pkexec /usr/bin/nala autoremove --option Nala::assume_yes=false \"${args[@]}\"",
            "        ;;",
            "    *) exit 2 ;;",
            "esac",
        ].join('\n');
        return ['bash', '-c', script, 'nala-compat', action, String(purge)];
    }

    _applyUpdates() {
        if (!this._indicator || !this._extensionSettings || this._operationBusy())
            return;
        try {
            const option = this._extensionSettings.get_int('update-cmd-options');
            let argv;
            switch (option) {
            case 5:
                argv = this._packageTerminal(['pkexec', '/usr/bin/apt', 'full-upgrade', '-o', 'APT::Get::AutomaticRemove=false']);
                break;
            case 6:
                argv = this._packageTerminal(this._nalaCompatibleCommand('full-upgrade'), true);
                break;
            case 7:
                argv = this._packageTerminal(['pkexec', '/usr/bin/apt-get', 'dist-upgrade', '-o', 'APT::Get::AutomaticRemove=false']);
                break;
            case 4: {
                const custom = this._extensionSettings.get_string('update-cmd').trim();
                if (!custom) {
                    argv = this._parsePackageCommand(STOCK_UPDATE_CMD);
                } else if (this._extensionSettings.get_boolean('output-on-terminal')) {
                    // Legacy custom terminal setting already includes its shell invocation.
                    const terminal = this._extensionSettings.get_string('terminal').trim();
                    const script = custom + String.raw` ; status=$?; printf "\nPress any key to exit..."; read -r -n 1 -s; exit "$status"`;
                    argv = terminal ? [...this._parsePackageCommand(terminal), script]
                        : [...this._defaultPackageTerminal(), 'bash', '-c', script];
                } else {
                    argv = this._parsePackageCommand(custom);
                }
                break;
            }
            default:
                this._updateCMD();
                argv = this._parsePackageCommand(UPDATE_CMD);
                break;
            }
            this._runPackageOperation(argv);
        } catch (err) {
            Main.notifyError(this._extensionName, err.message);
        }
    }

    // Query dpkg again after autoremove. Never use the truncated display list
    // as a purge target, and never interpolate package names into shell source.
    _cleanupWithResiduals(command, manager) {
        const script = [
            "manager=$1; shift",
            "\"$@\" || exit \"$?\"",
            "rows=$(dpkg-query -W -f='${db:Status-Abbrev}\\t${binary:Package}\\n') || exit \"$?\"",
            "packages=()",
            "while IFS=$'\\t' read -r state package; do",
            "    if [[ $state == \"rc \" && $package =~ ^[a-z0-9][a-z0-9+.-]*(:[a-z0-9][a-z0-9-]*)?$ ]]; then",
            "        packages+=(\"$package\")",
            "    fi",
            "done <<< \"$rows\"",
            "if ((${#packages[@]} == 0)); then",
            "    printf \"\\nNo residual configuration files found.\\n\"",
            "    exit 0",
            "fi",
            "printf \"\\nResidual configuration packages:\\n\"",
            "printf \"  %s\\n\" \"${packages[@]}\"",
            "read -r -p \"Purge these retained system configuration files? [y/N] \" answer || exit 1",
            "[[ $answer == [yY] || $answer == [yY][eE][sS] ]] || exit 0",
            "pkexec \"$manager\" -o APT::Get::AutomaticRemove=false -o APT::Get::Assume-Yes=false purge \"${packages[@]}\"",
        ].join('\n');
        return ['bash', '-c', script, 'cleanup-residual', manager, ...command];
    }

    // Cleanup never runs as part of the update presets.
    _removeUnusedPackages() {
        if (!this._indicator || !this._extensionSettings ||
            this._scanProcesses.has(SCRIPT.RESIDUAL) || this._scanProcesses.has(SCRIPT.AUTOREMOVABLE))
            return;
        const purge = this._extensionSettings.get_boolean('cleanup-purge-residual');
        const hasUnused = this._indicator._autoremovablePackagesList.length > 0;
        const hasResidual = this._indicator._residualPackagesList.length > 0;
        if (!hasUnused && !(purge && hasResidual))
            return;
        if (this._operationBusy()) {
            Main.notify(this._extensionName, _('Another package operation is running.'));
            return;
        }
        try {
            const option = this._extensionSettings.get_int('cleanup-cmd-options');
            let command, manager, xfce = false, customPrefix = '';
            switch (option) {
            case 0:
                manager = '/usr/bin/apt';
                command = ['pkexec', manager, 'autoremove', '-o', 'APT::Get::Assume-Yes=false', '-o', 'APT::Get::Assume-No=false'];
                break;
            case 1:
                manager = '/usr/bin/apt-get';
                command = ['pkexec', manager, 'autoremove', '-o', 'APT::Get::Assume-Yes=false', '-o', 'APT::Get::Assume-No=false'];
                break;
            case 2:
                // Custom commands are not rewritten; use APT-get for residuals.
                manager = '/usr/bin/apt-get';
                command = this._parsePackageCommand(this._extensionSettings.get_string('cleanup-cmd'));
                customPrefix = this._extensionSettings.get_string('cleanup-terminal').trim();
                break;
            case 3:
                manager = '/usr/bin/nala';
                command = this._nalaCompatibleCommand('autoremove');
                xfce = true;
                break;
            default:
                throw new Error(_('Unknown cleanup method.'));
            }
            if (purge) {
                if (option === 3) {
                    // Nala handles unused dependencies and already-removed
                    // packages in config state in a single native transaction.
                    // Run even when there are only residual configurations.
                    command = this._nalaCompatibleCommand('autoremove', true);
                } else {
                    if (option !== 2)
                        command.push('--purge');
                    // If only residuals exist, skip the unused-package operation.
                    if (!hasUnused)
                        command = ['true'];
                    command = this._cleanupWithResiduals(command, manager);
                }
            }
            this._runPackageOperation(this._packageTerminal(command, xfce, customPrefix));
        } catch (err) {
            Main.notifyError(this._extensionName, err.message);
        }
    }

    _operationBusy() {
        return this._destroyed || !!this._networkPending || !!this._refreshProcess || !!this._cleanupProcess;
    }

    _cancelScans() {
        for (const proc of this._scanProcesses.values()) {
            try {
                proc.force_exit();
            } catch (error) {
                // Process may have exited already.
            }
        }
        this._scanProcesses.clear();
    }

    _runPackageOperation(argv) {
        this._cancelScans();
        let proc;
        try {
            proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (error) {
            this._clearTerminalState();
            this._launchScript(SCRIPT.UPGRADES);
            throw error;
        }
        this._cleanupProcess = proc; // Shared manual-operation guard.
        this._upgradeProcess_sourceId = 1;
        this._indicator.removeUnusedMenuItem.setSensitive(false);
        this._indicator.applyUpdatesMenuItem.setSensitive(false);
        this._indicator.checkNowMenuItem.setSensitive(false);
        this._dirMonitor.stop();
        proc.wait_check_async(this._cancellable, (child, result) => {
            let error = null;
            try {
                child.wait_check_finish(result);
            } catch (err) {
                error = err;
            }
            if (!this._indicator || this._cleanupProcess !== proc)
                return;
            if (this._terminalState) {
                // Terminal wrappers write their own completion status. A
                // successful detached launcher is not a completed transaction.
                if (!error || this._terminalState.started)
                    return;
            }
            this._finishPackageOperation(error);
        });
    }

    _finishPackageOperation(error = null) {
        if (this._destroyed || !this._cleanupProcess)
            return;
        this._clearTerminalState();
        this._cleanupProcess = null;
        this._upgradeProcess_sourceId = null;
        this._indicator.showChecking(false);
        this._indicator.checkNowMenuItem.setSensitive(true);
        if (error)
            Main.notifyError(this._extensionName, error.message);
        this._dirMonitor.start();
        this._launchScript(SCRIPT.UPGRADES);
    }

    /* Update functions:
     *     _checkNetwork
     *     networkFailed
     *     checkUpdates
     *     _checkUpdatesEnd
     */

    _checkNetwork() {
        if (this._operationBusy() || !this._netMonitor)
            return;
        this._networkPending = true;
        this._indicator.showChecking(true);
        this._indicator.applyUpdatesMenuItem.setSensitive(false);
        this._indicator.removeUnusedMenuItem.setSensitive(false);
        this._netMonitor.networkTimeout();
    }

    networkFailed() {
        if (this._destroyed || !this._networkPending)
            return;
        this._networkPending = false;
        this._isAutomaticCheck = false;
        this._indicator.showChecking(false);
        this._indicator.updateStatus(STATUS.NO_INTERNET);
        this._indicator._updateCleanupSensitivity();
    }

    checkUpdates() {
        if (this._destroyed || !this._networkPending)
            return;
        this._networkPending = false;
        this._cancelScans();
        this._dirMonitor.stop();
        try {
            if (!CHECK_CMD)
                throw new Error(_('Install PackageKit or configure a custom refresh command in Advanced settings.'));
            const argv = this._parsePackageCommand(CHECK_CMD);
            const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDERR_PIPE);
            this._refreshProcess = proc;
            this._upgradeProcess_sourceId = 1;
            proc.communicate_utf8_async(null, this._cancellable, (child, result) => {
                let error = null;
                try {
                    const [, , stderr] = child.communicate_utf8_finish(result);
                    if (!child.get_successful())
                        throw new Error(stderr?.trim() || _('Package refresh failed.'));
                } catch (err) {
                    error = err;
                }
                if (this._destroyed || this._refreshProcess !== proc)
                    return;
                this._refreshProcess = null;
                this._upgradeProcess_sourceId = null;
                this._dirMonitor.start();
                if (error)
                    this._refreshFailed(error);
                else
                    this._launchScript(SCRIPT.UPGRADES, true);
            });
        } catch (error) {
            this._refreshProcess = null;
            this._upgradeProcess_sourceId = null;
            this._dirMonitor.start();
            this._refreshFailed(error);
        }
    }

    _refreshFailed(error) {
        if (this._destroyed)
            return;
        this._isAutomaticCheck = false;
        this._indicator.showChecking(false);
        this._indicator.updateStatus(STATUS.ERROR);
        this._indicator._updateCleanupSensitivity();
        Main.notifyError(this._extensionName, error.message);
    }

    /* Extra packages functions:
     *     _launchScript
     *     _packagesRead
     *     _packagesEnd
     *     _lastCheck
     */

    _launchScript(index, refreshed = false) {
        if (this._operationBusy())
            return;
        if (this._scanProcesses.has(index)) {
            if (!refreshed)
                return;
            this._scanProcesses.get(index).force_exit();
            this._scanProcesses.delete(index);
        }
        if (index === SCRIPT.AUTOREMOVABLE || index === SCRIPT.RESIDUAL)
            this._indicator.removeUnusedMenuItem.setSensitive(false);
        const names = ['get-updates', 'new', 'obsolete', 'residual', 'autoremovable', 'urgency'];
        const name = names[index];
        if (index === SCRIPT.OBSOLETE && !GLib.find_program_in_path('apt-show-versions')) {
            this._indicator._obsoletePackagesList = [];
            this._indicator.updatePackagesStatus(index);
            return;
        }
        const script = ['/bin/bash', `${this._extensionPath}/scripts/${name}.sh`, '0', `${this._cachePath}/`];
        try {
            const proc = Gio.Subprocess.new(script,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            this._scanProcesses.set(index, proc);
            proc.communicate_utf8_async(null, this._cancellable, (child, result) => {
                let output = '', error = null;
                try {
                    const [, stdout, stderr] = child.communicate_utf8_finish(result);
                    if (!child.get_successful())
                        throw new Error(stderr?.trim() || _('Package list scan failed.'));
                    output = stdout || '';
                } catch (err) {
                    error = err;
                }
                if (this._destroyed || this._scanProcesses.get(index) !== proc)
                    return;
                this._scanProcesses.delete(index);
                if (this._operationBusy())
                    return;
                if (error) {
                    if (index === SCRIPT.UPGRADES)
                        this._refreshFailed(error);
                    else if (index === 5) {
                        this._indicator._urgentList = [];
                        this._indicator.updatePackagesStatus(SCRIPT.UPGRADES);
                    } else {
                        this._setPackageList(index, []);
                        this._indicator.updatePackagesStatus(index);
                    }
                    return;
                }
                const list = output.split('\n').filter(line => line.trim());
                if (index === 5) {
                    this._indicator._urgentList = this._indicator._updateList.filter(pkg =>
                        list.some(line => line.includes(`${pkg.split('\t', 2)[0]}-`)));
                    this._indicator.updatePackagesStatus(SCRIPT.UPGRADES);
                    return;
                }
                this._setPackageList(index, list);
                if (index === SCRIPT.UPGRADES) {
                    this._indicator._urgentList = [];
                    if (this._extensionSettings.get_boolean('show-critical-updates') &&
                        GLib.find_program_in_path('pkcon'))
                        this._launchScript(5);
                    else
                        this._indicator.updatePackagesStatus(index);
                    this._indicator.showChecking(false);
                    if (refreshed)
                        this._lastCheck();
                    else if (this._initializing)
                        this._restoreLastCheck();
                    this._initializing = false;
                    this._dontUpdateDate = false;
                    if (this._extensionSettings.get_boolean('new-packages'))
                        this._launchScript(SCRIPT.NEW);
                    if (this._extensionSettings.get_boolean('obsolete-packages'))
                        this._launchScript(SCRIPT.OBSOLETE);
                    this._launchScript(SCRIPT.RESIDUAL);
                    this._launchScript(SCRIPT.AUTOREMOVABLE);
                } else {
                    this._indicator.updatePackagesStatus(index);
                }
            });
        } catch (error) {
            this._scanProcesses.delete(index);
            if (index === SCRIPT.UPGRADES)
                this._refreshFailed(error);
            else if (index === 5)
                this._indicator.updatePackagesStatus(SCRIPT.UPGRADES);
            else {
                this._setPackageList(index, []);
                this._indicator.updatePackagesStatus(index);
            }
        }
    }

    _setPackageList(index, list) {
        const fields = ['_updateList', '_newPackagesList', '_obsoletePackagesList',
            '_residualPackagesList', '_autoremovablePackagesList'];
        this._indicator[fields[index]] = index === SCRIPT.UPGRADES ? this._filterList(list) : list;
    }

    _restoreLastCheck() {
        const time = this._extensionSettings.get_double('last-check-date-double');
        if (time > 0) {
            const date = formatDateWithCFormatString(new Date(time), '%a %b %d, %H:%M');
            this._indicator.lastCheckMenuItem.label.set_text(_('Last check: ') + date);
            this._indicator.lastCheckMenuItem.visible = true;
        }
    }

    _lastCheck() {
        const now = new Date();
        const date = formatDateWithCFormatString(now, '%a %b %d, %H:%M');
        this._extensionSettings.set_double('last-check-date-double', now.getTime());
        if (this._isAutomaticCheck)
            this._extensionSettings.set_double('last-check-date-automatic-double', now.getTime());
        this._isAutomaticCheck = false;
        this._indicator.lastCheckMenuItem.label.set_text(_('Last check: ') + date);
        this._indicator.lastCheckMenuItem.visible = true;
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

    destroy() {
        this._destroyed = true;
        this._clearTerminalState();
        this._cancelScans();
        // Do not terminate an already authorized package transaction.
        this._refreshProcess = null;
        this._cleanupProcess = null;
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

