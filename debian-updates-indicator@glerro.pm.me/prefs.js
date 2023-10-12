/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator
 *
 * prefs.js
 *
 * Copyright (c) 2023 Gianni Lerro {glerro} ~ <glerro@pm.me>
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
 * SPDX-FileCopyrightText: 2023 Gianni Lerro <glerro@pm.me>
 */

'use strict';

import GObject from 'gi://GObject';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {IgnoreListBox} from './ignoreListBox.js';

const DebianUpdatesBasicPrefsPage = GObject.registerClass({
    GTypeName: 'DebianUpdatesBasicPrefsPage',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_basic_adw1.ui'),
    InternalChildren: ['check_updates_group', 'interval', 'interval_unit', 'updates_menu_group',
         'strip_versions_switch', 'urgent_updates_switch', 'indicator_group', 'always_visible',
         'show_count', 'auto_expand_list', 'notifications_group', 'notifications', 'transient_notifications',
         'verbosity', 'shortcut_group', 'shortcut_entry', 'use_shortcut'],
}, class DebianUpdatesBasicPrefsPage extends Adw.PreferencesPage {
    constructor(settings, params = {}) {
        super(params);

        this._settings = settings;

        // Basic settings tab:
        // Check updates
        this._settings.bind('check-interval', this._interval,
            'value', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('strip-versions', this._strip_versions_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('show-critical-updates', this._urgent_updates_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );

        // Hours, days or weeks
        settings.bind('interval-unit', this._interval_unit,
            'selected', Gio.SettingsBindFlags.DEFAULT
        );

        // Indicator settings
        this._settings.bind('always-visible', this._always_visible,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('show-count', this._show_count,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('auto-expand-list', this._auto_expand_list,
            'value', Gio.SettingsBindFlags.DEFAULT
        );

        // Notification settings
        this._settings.bind('notify', this._notifications,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('transient', this._transient_notifications,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('verbosity', this._verbosity,
            'selected', Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind('notify', this._transient_notifications,
            'sensitive', Gio.SettingsBindFlags.DEFAULT
        );
        settings.bind('notify', this._verbosity,
            'sensitive', Gio.SettingsBindFlags.DEFAULT
        );

        // Shortcut
        this._settings.bind('shortcut-text', this._shortcut_entry,
            'text', Gio.SettingsBindFlags.DEFAULT
        );
        // We need to update the shortcut 'strv' when the text is modified
        this._settings.connect('changed::shortcut-text', () => {
            this._setShortcut(settings);
        });
        this._settings.bind('use-shortcut', this._use_shortcut,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('use-shortcut', this._shortcut_entry,
            'sensitive', Gio.SettingsBindFlags.DEFAULT
        );
    }

    /**
     * This function set Shortcut.
     *
     * @function setShortcut
     * @param {Gio.Settings} settings - Extrension Settings.
     * @returns {void}
     */
    _setShortcut(settings) {
        let shortcutText = settings.get_string('shortcut-text');
        let key, mods;

        [, key, mods] = Gtk.accelerator_parse(shortcutText);

        if (Gtk.accelerator_valid(key, mods)) {
            let shortcut = Gtk.accelerator_name(key, mods);
            settings.set_strv('debian-updates-indicator-shortcut', [shortcut]);
        } else {
            settings.set_strv('debian-updates-indicator-shortcut', []);
        }
    }
});

const DebianUpdatesAdvancedPrefsPage = GObject.registerClass({
    GTypeName: 'DebianUpdatesAdvancedPrefsPage',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_advanced_adw1.ui'),
    InternalChildren: ['update_cmd_options', 'update_cmd_button', 'output_on_terminal_switch',
        'terminal_entry', 'field_updatecmd', 'use_custom_cmd_switch', 'field_checkcmd_custom',
        'reset_button'],
}, class DebianUpdatesAdvancedPrefsPage extends Adw.PreferencesPage {
    constructor(settings, params = {}) {
        super(params);

        this._settings = settings;

        // Advanced settings tab:
        // Update method
        settings.bind('update-cmd-options', this._update_cmd_options,
            'selected', Gio.SettingsBindFlags.DEFAULT
        );

        if (this._settings.get_int('update-cmd-options') !== 4)
            this._update_cmd_button.set_enable_expansion(false);

        this._settings.connect('changed::update-cmd-options', () => {
            if (this._settings.get_int('update-cmd-options') === 4)
                this._update_cmd_button.set_enable_expansion(true);
            else
                this._update_cmd_button.set_enable_expansion(false);
        });

        // Custom command for updating
        this._settings.bind('output-on-terminal', this._output_on_terminal_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('terminal', this._terminal_entry,
            'text', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('update-cmd', this._field_updatecmd,
            'text', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('output-on-terminal', this._terminal_entry,
            'sensitive', Gio.SettingsBindFlags.GET
        );

        // Check commands
        this._settings.bind('use-custom-cmd', this._use_custom_cmd_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('check-cmd-custom', this._field_checkcmd_custom,
            'text', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('use-custom-cmd', this._field_checkcmd_custom,
            'sensitive', Gio.SettingsBindFlags.DEFAULT
        );

        // Reset button
        this._reset_button.connect('clicked', () => {
            // restore default settings for the relevant keys
            let keys = [
                'terminal',
                'output-on-terminal',
                'update-cmd',
                'update-cmd-options',
                'use-custom-cmd',
                'check-cmd-custom',
            ];
            keys.forEach(val => {
                this._settings.set_value(val, this._settings.get_default_value(val));
            });
            // This one needs to be refreshed manually
            this._update_cmd_options.set_active(settings.get_enum('update-cmd-options'));
        });
    }
});

const DebianUpdatesPackagesStatusPrefsPage = GObject.registerClass({
    GTypeName: 'DebianUpdatesPackagesStatusPrefsPage',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_packages_status_adw1.ui'),
    InternalChildren: ['new_packages_switch', 'obsolete_packages_switch', 'residual_packages_switch',
        'autoremovable_packages_switch'],
}, class DebianUpdatesPackagesStatusPrefsPage extends Adw.PreferencesPage {
    constructor(settings, params = {}) {
        super(params);

        this._settings = settings;

        this._settings.bind('new-packages', this._new_packages_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('obsolete-packages', this._obsolete_packages_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('residual-packages', this._residual_packages_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('autoremovable-packages', this._autoremovable_packages_switch,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const DebianUpdatesIgnoreListPrefsPage = GObject.registerClass({
    GTypeName: 'DebianUpdatesIgnoreListPrefsPage',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_ignore_list_adw1.ui'),
    InternalChildren: ['ignore_list_group'],
}, class DebianUpdatesIgnoreListPrefsPage extends Adw.PreferencesPage {
    constructor(settings, params = {}) {
        super(params);

        this._settings = settings;

        this._ignoreListGroup = this._ignore_list_group;
        this._ignoreListBox = new IgnoreListBox(settings);
        this._ignoreListGroup.add(this._ignoreListBox);
    }
});

export default class DebianUpdatesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        let settings = this.getSettings();

        let basicSettingsPage = new DebianUpdatesBasicPrefsPage(settings);
        window.add(basicSettingsPage);

        let advancedSettingsPage = new DebianUpdatesAdvancedPrefsPage(settings);
        window.add(advancedSettingsPage);

        let packagesStatusPage = new DebianUpdatesPackagesStatusPrefsPage(settings);
        window.add(packagesStatusPage);

        let ignoreListPage = new DebianUpdatesIgnoreListPrefsPage(settings);
        window.add(ignoreListPage);

        window.search_enabled = true;
        window.set_default_size(580, 580);
    }
}

