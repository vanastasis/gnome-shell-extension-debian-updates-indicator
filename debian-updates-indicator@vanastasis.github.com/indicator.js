/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
 * Modified for vanastasis, 2026-11-26.
 *
 * indicator.js
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
 * Original Author: Fran Glais ~ <https://github.com/franglais125>
 * *****************************************************************************
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * SPDX-FileCopyrightText: 2023-2026 Gianni Lerro <glerro@pm.me>
 */

'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {gettext as _, ngettext as n_} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import * as Utils from './utils.js';

/* Gnome Shell Version */
const SHELL_MAJOR = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

/* For error checking */
export const STATUS = {
    UNKNOWN: -1,
    ERROR: -2,
    NO_INTERNET: -3,
    INITIALIZING: -4,
};

/* Variables we want to keep when extension is disabled (eg during screen lock) */
let UPDATES_PENDING = STATUS.UNKNOWN;
let UPDATES_LIST    = [];

/* Various packages statuses */
export const SCRIPT = {
    UPGRADES: 0,
    NEW: 1,
    OBSOLETE: 2,
    RESIDUAL: 3,
    AUTOREMOVABLE: 4,
};

export const DebianUpdatesIndicator = GObject.registerClass({
    GTypeName: 'DebianUpdatesIndicator',
}, class DebianUpdatesIndicator extends PanelMenu.Button {
    _init(updateManager) {
        this._upgradeProcess_sourceId = null;

        this._updateList = [];
        this._urgentList = [];
        this._newPackagesList = [];
        this._obsoletePackagesList = [];
        this._residualPackagesList = [];
        this._autoremovablePackagesList = [];

        this._updateManager = updateManager;

        this._extension = this._updateManager._extension;
        this._extensionName = this._extension.metadata.name;

        super._init(0.0, `${this._extensionName}`, false);

        this._updateIcon = new St.Icon({
            icon_name: 'package-x-generic-symbolic',
            style_class: 'system-status-icon',
        });

        // GNOME compatibility patch: GNOME Shell 51 removed St.BoxLayout.vertical.
        // GNOME 48+ supports orientation; retain the legacy property for 45-47.
        this._box = new St.BoxLayout({
            ...(SHELL_MAJOR >= 48
                ? {orientation: Clutter.Orientation.HORIZONTAL}
                : {vertical: false}),
            style_class: 'panel-status-menu-box',
        });

        this._label = new St.Label({
            text: '',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._label.visible = false;

        this._box.add_child(this._updateIcon);
        this._box.add_child(this._label);
        this.add_child(this._box);

        // Prepare to track connections
        this._signalsHandler = new Utils.GlobalSignalsHandler(this._extensionName);

        // Assemble the menu
        this._assembleMenu();

        // Load settings
        this._extensionSettings = this._extension.getSettings();
        this._bindSignals();

        Main.panel.addToStatusArea(`${this._extensionName} Indicator`, this);

        this._shortcutIsSet = false;
        this._toggleShortcut();
    }

    _openSettings() {
        this._extension.openPreferences();
    }

    _bindSignals() {
        // Bind settings
        this._signalsHandler.add([
            this._extensionSettings,
            'changed::show-count',
            this._checkShowHideIndicator.bind(this),
        ], [
            this._extensionSettings,
            'changed::always-visible',
            this._checkShowHideIndicator.bind(this),
        ], [
            this._extensionSettings,
            'changed::use-shortcut',
            this._toggleShortcut.bind(this),
        ], [
        // Bind some events
            this.menu,
            'open-state-changed',
            this._onMenuOpened.bind(this),
        ], [
            this.settingsMenuItem,
            'activate',
            this._openSettings.bind(this),
        ]);
    }

    _assembleMenu() {
        // Prepare the special menu : a submenu for updates list that will look like a regular menu item when disabled
        // Scrollability will also be taken care of by the popupmenu
        this.updatesExpander = new PopupMenu.PopupSubMenuMenuItem('');

        this.newPackagesExpander = new PopupMenu.PopupSubMenuMenuItem(_('New in repository'));
        this.newPackagesExpander.visible = false;

        this.obsoletePackagesExpander = new PopupMenu.PopupSubMenuMenuItem(_('Local/Obsolete packages'));
        this.obsoletePackagesExpander.visible = false;

        this.residualPackagesExpander = new PopupMenu.PopupSubMenuMenuItem(_('Residual config files'));
        this.residualPackagesExpander.visible = false;

        this.autoremovablePackagesExpander = new PopupMenu.PopupSubMenuMenuItem(_('Autoremovable'));
        this.autoremovablePackagesExpander.visible = false;

        // "Apply updates", Check now" and "Last Check" menu items
        this.applyUpdatesMenuItem = new PopupMenu.PopupMenuItem(_('Apply updates'));
        this.removeUnusedMenuItem = new PopupMenu.PopupMenuItem(_('Remove unused packages'));
        this.removeUnusedMenuItem.setSensitive(false);
        this.checkNowMenuItem = new PopupMenu.PopupMenuItem(_('Check now'));
        this.lastCheckMenuItem = new PopupMenu.PopupMenuItem('');
        this.lastCheckMenuItem.reactive = false;
        this.lastCheckMenuItem.visible = false;

        // Settings menu item
        this.settingsMenuItem = new PopupMenu.PopupMenuItem(_('Settings'));

        // Assemble all menu items into the popup menu
        this.menu.addMenuItem(this.updatesExpander);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.newPackagesExpander);
        this.menu.addMenuItem(this.obsoletePackagesExpander);
        this.menu.addMenuItem(this.residualPackagesExpander);
        this.menu.addMenuItem(this.autoremovablePackagesExpander);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.applyUpdatesMenuItem);
        this.menu.addMenuItem(this.removeUnusedMenuItem);
        this.menu.addMenuItem(this.checkNowMenuItem);
        this.menu.addMenuItem(this.lastCheckMenuItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.settingsMenuItem);
    }

    destroy() {
        // Disconnect global signals
        this._signalsHandler.destroy();
        this._notifySource?.destroy();
        this._notifySource = null;

        this._box.destroy();

        this._disableShortcut();

        if (this._extensionSettings !== null)
            this._extensionSettings = null;

        super.destroy();
    }

    /* Menu functions:
     *     _checkShowHideIndicator
     *     _onMenuOpened
     *     _checkAutoExpandList
     *     showChecking
     *     updateStatus
     *     updatePackagesStatus
     *     _updateNewPackagesStatus
     *     _updateObsoletePackagesStatus
     *     _updateResidualPackagesStatus
     *     _updateAutoremovablePackagesStatus
     *     _updateMenuExpander
     */

    _checkShowHideIndicator() {
        if (this._updateManager._operationBusy())
            return;

        if (!this._extensionSettings.get_boolean('always-visible') && this._updateList.length < 1)
            this.visible = false;
        else
            this.visible = true;

        this._label.visible = this._extensionSettings.get_boolean('show-count') &&
                              this._updateList.length > 0;
    }

    _onMenuOpened() {
        // This event is fired when menu is shown or hidden
        // Only open the submenu if the menu is being opened and there is something to show
        this._checkAutoExpandList();
    }

    _checkAutoExpandList() {
        let count = this._updateList.length;
        if (this.menu.isOpen && count > 0 && count <= this._extensionSettings.get_int('auto-expand-list'))
            this.updatesExpander.setSubmenuShown(true);
        else
            this.updatesExpander.setSubmenuShown(false);
    }

    showChecking(isChecking) {
        if (isChecking === true) {
            this._updateIcon.set_icon_name('emblem-synchronizing-symbolic');
            this.checkNowMenuItem.reactive = false;
            this.checkNowMenuItem.label.set_text(_('Checking'));
        } else {
            this.checkNowMenuItem.reactive = true;
            this.checkNowMenuItem.label.set_text(_('Check now'));
        }
    }

    updateStatus(updatesCount) {
        updatesCount = typeof updatesCount === 'number' ? updatesCount : this._updateList.length;
        if (updatesCount > 0) {
            // Destroy existing labels to ensure correct display
            this.updatesExpander.menu.removeAll();

            // Update the menu look:
            this._cleanUpgradeLists();

            let iconName = this._urgentList.length > 0
                ? 'software-update-urgent-symbolic'
                : 'software-update-available-symbolic';
            let menuUpdateList = this._urgentList.length > 0
                ? this._updateList.filter(pkg => {
                    return this._urgentList.indexOf(pkg) < 0;
                }) : this._updateList;

            if (this._urgentList.length > 0) {
                let header = new PopupMenu.PopupMenuItem('Important/Security');
                header.add_style_class_name('debian-updates-indicator-urgent-item-header');
                this.updatesExpander.menu.addMenuItem(header);

                for (let i = 0; i < this._urgentList.length; i++) {
                    let text = this._urgentList[i];
                    let item = this._createItem(text);
                    item.remove_style_class_name('debian-updates-indicator-item');
                    item.add_style_class_name('debian-updates-indicator-urgent-item');
                    this.updatesExpander.menu.addMenuItem(item);
                }
            }

            // Update indicator look:
            this._updateIcon.set_icon_name(iconName);
            this._label.set_text(updatesCount.toString());

            if (menuUpdateList.length > 0) {
                // If there are urgent updates we need to add a section title
                if (this._urgentList.length > 0) {
                    let separator = new PopupMenu.PopupSeparatorMenuItem();
                    separator.add_style_class_name('debian-updates-indicator-separator');
                    this.updatesExpander.menu.addMenuItem(separator);

                    let updatesListMenuLabel = new PopupMenu.PopupMenuItem('');
                    updatesListMenuLabel.add_style_class_name('debian-updates-indicator-item-header');
                    updatesListMenuLabel.label.set_text('Regular');
                    this.updatesExpander.menu.addMenuItem(updatesListMenuLabel);
                }

                for (let i = 0; i < menuUpdateList.length; i++) {
                    let text = menuUpdateList[i];
                    let item = this._createItem(text);
                    this.updatesExpander.menu.addMenuItem(item);
                }
            }

            this._updateMenuExpander(true, n_('%d update pending',
                '%d updates pending', updatesCount).format(updatesCount));

            // Emit a notification if necessary
            if (this._extensionSettings.get_boolean('notify') && UPDATES_PENDING < updatesCount)
                this._notify(updatesCount);

            // Store the new list
            UPDATES_LIST = this._updateList;
        } else {
            // Update the indicator look:
            this._label.set_text('');

            // Update the menu look:
            if (this.updatesListMenuLabel) {
                this.updatesListMenuLabel.destroy();
                this.updatesListMenuLabel = null;
            }
            if (this.urgentListMenuLabel) {
                this.urgentListMenuLabel.destroy();
                this.urgentListMenuLabel = null;
            }

            if (updatesCount === STATUS.UNKNOWN) {
                // This is the value of UPDATES_PENDING at initialization.
                // For some reason, the update process didn't work at all
                this._updateIcon.set_icon_name('dialog-warning-symbolic');
                this._updateMenuExpander(false, '');
            } else if (updatesCount === STATUS.ERROR) {
                // Error
                this._updateIcon.set_icon_name('dialog-warning-symbolic');
                this._updateMenuExpander(false, _('Error'));
            } else if (updatesCount === STATUS.NO_INTERNET) {
                // Error
                this._updateIcon.set_icon_name('dialog-warning-symbolic');
                this._updateMenuExpander(false, _('No internet'));
            } else if (updatesCount === STATUS.INITIALIZING) {
                this._updateIcon.set_icon_name('package-x-generic-symbolic');
                this._updateMenuExpander(false, _('Initializing'));
            } else {
                // Up to date
                this._updateIcon.set_icon_name('package-x-generic-symbolic');
                this._updateMenuExpander(false, _('Up to date'));
                UPDATES_LIST = []; // Reset stored list
            }
        }

        UPDATES_PENDING = updatesCount;
        this._checkAutoExpandList();
        this._checkShowHideIndicator();
    }

    _notify(updatesCount) {
        if (this._extensionSettings.get_int('verbosity') > 0) {
            let updateList = [];
            if (this._extensionSettings.get_int('verbosity') > 1) {
                updateList = this._updateList;
            } else {
                // Keep only packets that was not in the previous notification
                updateList = this._updateList.filter(pkg => {
                    return UPDATES_LIST.indexOf(pkg) < 0;
                });
            }

            // Replace tab(s) with one space
            updateList = this._updateList.map(p => {
                p = p.replace('\t', ' ');
                return p.replace(/\s\s+/g, ' '); // Removes double spaces (\s)
            });

            if (updateList.length > 50)
                // We show a maximum of 50 updates on the notification, as it can
                // freeze the shell if the text is too long
                updateList = updateList.slice(0, 50);

            if (updateList.length > 0) {
                // Show notification only if there's new updates
                this._showNotification(
                    n_('New Update', 'New Updates', updateList.length),
                    updateList.join(', ')
                );
            }
        } else {
            this._showNotification(
                n_('New Update', 'New Updates', updatesCount),
                n_('There is %d update pending', 'There are %d updates pending',
                    updatesCount).format(updatesCount)
            );
        }
    }

    _cleanUpgradeLists() {
        // We first find the longest entry in both lists
        let maxWidth = 0;
        this._updateList.forEach(line => {
            // example: firefox [tab] 50.0-1
            let name = line.split('\t', 2)[0];
            maxWidth = name.length > maxWidth ? name.length : maxWidth;
        });
        this._urgentList.forEach(line => {
            // example: firefox [tab] 50.0-1
            let name = line.split('\t', 2)[0];
            maxWidth = name.length > maxWidth ? name.length : maxWidth;
        });
        this._updateList = this._cleanUpgradeList(this._updateList, maxWidth);
        this._urgentList = this._cleanUpgradeList(this._urgentList, maxWidth);
    }

    _cleanUpgradeList(list, maxWidth) {
        if (this._extensionSettings.get_boolean('strip-versions') === true) {
            return list.map(p => {
                // example: firefox 50.0-1
                // chunks[0] is the package name
                // chunks[1] is the version
                let chunks = p.split('\t', 2);
                return chunks[0];
            });
        } else {
            let tabWidth = 8;
            let widthNeeded = tabWidth * (Math.floor(maxWidth / tabWidth) + 1) - 2;
            return list.map(p => {
                let chunks = p.split('\t', 2);
                let difference = widthNeeded - chunks[0].length;
                let nTabs = Math.floor(difference / tabWidth);
                let spacing = '\t';
                for (let i = 0; i < nTabs; i++)
                    spacing += '\t';
                return chunks[0] + spacing + chunks[1];
            });
        }
    }

    updatePackagesStatus(index) {
        // Subprocess callbacks already execute on the Shell main loop.
        // Avoid untracked idle sources that could outlive this indicator.
        switch (index) {
        case SCRIPT.UPGRADES:
            this.updateStatus(this._updateList.length);
            break;
        case SCRIPT.NEW:
            this._updateNewPackagesStatus();
            break;
        case SCRIPT.OBSOLETE:
            this._updateObsoletePackagesStatus();
            break;
        case SCRIPT.RESIDUAL:
            this._updateResidualPackagesStatus();
            break;
        case SCRIPT.AUTOREMOVABLE:
            this._updateAutoremovablePackagesStatus();
            break;
        }
    }

    _updateNewPackagesStatus() {
        this.newPackagesExpander.menu.removeAll();
        if (this._newPackagesList.length === 0 || !this._extensionSettings.get_boolean('new-packages')) {
            this.newPackagesExpander.visible = false;
        } else {
            for (let i = 0; i < this._newPackagesList.length; i++) {
                let text = this._newPackagesList[i];
                let item = this._createItem(text);
                this.newPackagesExpander.menu.addMenuItem(item);
            }
            this.newPackagesExpander.visible = true;
        }
    }

    _updateObsoletePackagesStatus() {
        this.obsoletePackagesExpander.menu.removeAll();
        if (this._obsoletePackagesList.length === 0 || !this._extensionSettings.get_boolean('obsolete-packages')) {
            this.obsoletePackagesExpander.visible = false;
        } else {
            for (let i = 0; i < this._obsoletePackagesList.length; i++) {
                let text = this._obsoletePackagesList[i];
                let item = this._createItem(text);
                this.obsoletePackagesExpander.menu.addMenuItem(item);
            }
            this.obsoletePackagesExpander.visible = true;
        }
    }

    _updateCleanupSensitivity() {
        const hasUnused = this._autoremovablePackagesList.length > 0;
        const hasResidual = this._extensionSettings.get_boolean('cleanup-purge-residual') &&
            this._residualPackagesList.length > 0;
        this.removeUnusedMenuItem.setSensitive((hasUnused || hasResidual) &&
            !this._updateManager._operationBusy() &&
            !this._updateManager._scanProcesses.has(SCRIPT.RESIDUAL) &&
            !this._updateManager._scanProcesses.has(SCRIPT.AUTOREMOVABLE));
    }

    _updateResidualPackagesStatus() {
        this._updateCleanupSensitivity();
        this.residualPackagesExpander.menu.removeAll();
        if (this._residualPackagesList.length === 0 || !this._extensionSettings.get_boolean('residual-packages')) {
            this.residualPackagesExpander.visible = false;
        } else {
            for (let i = 0; i < this._residualPackagesList.length; i++) {
                let text = this._residualPackagesList[i];
                let item = this._createItem(text);
                this.residualPackagesExpander.menu.addMenuItem(item);
            }
            this.residualPackagesExpander.visible = true;
        }
    }

    _updateAutoremovablePackagesStatus() {
        const hasUnused = this._autoremovablePackagesList.length > 0;
        this._updateCleanupSensitivity();
        this.autoremovablePackagesExpander.menu.removeAll();
        if (!hasUnused || !this._extensionSettings.get_boolean('autoremovable-packages')) {
            this.autoremovablePackagesExpander.visible = false;
        } else {
            for (let i = 0; i < this._autoremovablePackagesList.length; i++) {
                let text = this._autoremovablePackagesList[i];
                let item = this._createItem(text);
                this.autoremovablePackagesExpander.menu.addMenuItem(item);
            }
            this.autoremovablePackagesExpander.visible = true;
        }
    }

    _createItem(text) {
        let item = new PopupMenu.PopupMenuItem('');
        item.add_style_class_name('debian-updates-indicator-item');
        item.label.set_text(text);

        return item;
    }

    _updateMenuExpander(enabled, label) {
        if (label === '') {
            // No text, hide the menuitem
            this.updatesExpander.visible = false;
        } else {
        // We make our expander look like a regular menu label if disabled
            this.updatesExpander.reactive = enabled;
            this.updatesExpander._triangle.visible = enabled;
            this.updatesExpander.label.set_text(label);
            this.updatesExpander.visible = true;
        }

        // 'Update now' visibility is linked so let's save a few lines and set it here
        this.applyUpdatesMenuItem.setSensitive(enabled && !this._updateManager._operationBusy());
    }

    /*
     * Notifications
     * */

    _showNotification(title, message) {
        if (this._notifySource === undefined || this._notifySource === null) {
            // We have to prepare this only once
            if (SHELL_MAJOR > 45) {
                this._notifySource = new MessageTray.Source({
                    title: 'Gnome Shell Extension',
                    iconName: 'org.gnome.Shell.Extensions-symbolic',
                });
            } else {
                this._notifySource = new MessageTray.Source('Gnome Shell Extension', 'package-x-generic-symbolic');
            }

            // Take care of not leaving unneeded sources
            this._notifySource.connectObject('destroy', () => (this._notifySource = null), this);
            Main.messageTray.add(this._notifySource);
        }
        let notification = null;
        // We do not want to have multiple notifications stacked
        // instead we will update previous
        if (this._notifySource.notifications.length === 0) {
            if (SHELL_MAJOR > 45) {
                notification = new MessageTray.Notification({
                    source: this._notifySource,
                    title,
                    body: message,
                    iconName: 'package-x-generic-symbolic',
                    isTransient: this._extensionSettings.get_boolean('transient'),
                    resident: false,
                });
            } else {
                notification = new MessageTray.Notification(this._notifySource, title, message);
                notification.setTransient(this._extensionSettings.get_boolean('transient'));
            }
            notification.addAction(_('Update now'), () => {
                this._updateManager._applyUpdates();
            });
        } else {
            notification = this._notifySource.notifications[0];
            if (SHELL_MAJOR > 45) {
                notification.title = title;
                notification.body = message;
            } else {
                notification.update(title, message, {clear: true});
            }
        }

        if (SHELL_MAJOR > 45)
            this._notifySource.addNotification(notification);
        else
            this._notifySource.showNotification(notification);
    }

    _toggleShortcut() {
        if (this._extensionSettings.get_boolean('use-shortcut'))
            this._enableShortcut();
        else
            this._disableShortcut();
    }

    _enableShortcut() {
        if (!this._shortcutIsSet) {
            Main.wm.addKeybinding('debian-updates-indicator-shortcut',
                this._extensionSettings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
                this.menu.toggle.bind(this.menu)
            );
            this._shortcutIsSet = true;
        }
    }

    _disableShortcut() {
        if (this._shortcutIsSet) {
            Main.wm.removeKeybinding('debian-updates-indicator-shortcut');
            this._shortcutIsSet = false;
        }
    }
});

