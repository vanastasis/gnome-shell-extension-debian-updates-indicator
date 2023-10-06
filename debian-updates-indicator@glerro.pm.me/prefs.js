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

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {IgnoreListBox} from './ignoreListBox.js';

const TEMPLATE_ADW = 'prefs_adw1.ui';

/**
 * This function setup Preferences binding.
 *
 * @function bindPrefs
 * @param {Gtk.Builder} builder - Builder prefs widgets.
 * @param {Gio.Settings} settings - Extension settings.
 * @returns {void}
 */
function bindPrefs(builder, settings) {
    // Basic settings tab:
    // Check updates
    settings.bind('check-interval',
        builder.get_object('interval'),
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('strip-versions',
        builder.get_object('strip_versions_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('show-critical-updates',
        builder.get_object('urgent_updates_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Hours, days or weeks
    builder.get_object('interval_unit_combo').connect('changed', widget => {
        settings.set_enum('interval-unit', widget.get_active());
    });
    builder.get_object('interval_unit_combo').set_active(settings.get_enum('interval-unit'));

    // Indicator settings
    settings.bind('always-visible',
        builder.get_object('always_visible'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('show-count',
        builder.get_object('show_count'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('auto-expand-list',
        builder.get_object('auto_expand_list'),
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Notification settings
    settings.bind('notify',
        builder.get_object('notifications'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('transient',
        builder.get_object('transient_notifications'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('verbosity',
        builder.get_object('verbosity'),
        'selected',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('notify',
        builder.get_object('transient_notifications'),
        'sensitive',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('notify',
        builder.get_object('verbosity'),
        'sensitive',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Shortcut
    settings.bind('shortcut-text',
        builder.get_object('shortcut_entry'),
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );
    // We need to update the shortcut 'strv' when the text is modified
    settings.connect('changed::shortcut-text', () => {
        setShortcut(settings);
    });
    settings.bind('use-shortcut',
        builder.get_object('use_shortcut'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('use-shortcut',
        builder.get_object('shortcut_entry'),
        'sensitive',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Advanced settings tab:
    // Update method
    builder.get_object('update_cmd_options').connect('changed', widget => {
        settings.set_enum('update-cmd-options', widget.get_active());
    });

    builder.get_object('update_cmd_options').set_active(settings.get_enum('update-cmd-options'));

    if (settings.get_enum('update-cmd-options') !== 4)
        builder.get_object('update_cmd_button').set_enable_expansion(false);

    settings.connect('changed::update-cmd-options', () => {
        if (settings.get_enum('update-cmd-options') === 4)
            builder.get_object('update_cmd_button').set_enable_expansion(true);
        else
            builder.get_object('update_cmd_button').set_enable_expansion(false);
    });

    // Custom command for updating
    settings.bind('output-on-terminal',
        builder.get_object('output_on_terminal_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('terminal',
        builder.get_object('terminal_entry'),
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('update-cmd',
        builder.get_object('field_updatecmd'),
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('output-on-terminal',
        builder.get_object('terminal_entry'),
        'sensitive',
        Gio.SettingsBindFlags.GET
    );

    // Check commands
    settings.bind('use-custom-cmd',
        builder.get_object('use_custom_cmd_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('check-cmd-custom',
        builder.get_object('field_checkcmd_custom'),
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('use-custom-cmd',
        builder.get_object('field_checkcmd_custom'),
        'sensitive',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Reset button
    builder.get_object('reset_button').connect('clicked', () => {
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
            settings.set_value(val, settings.get_default_value(val));
        });
        // This one needs to be refreshed manually
        builder.get_object('update_cmd_options').set_active(settings.get_enum('update-cmd-options'));
    });


    // Package status tab:
    settings.bind('new-packages',
        builder.get_object('new_packages_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('obsolete-packages',
        builder.get_object('obsolete_packages_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('residual-packages',
        builder.get_object('residual_packages_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind('autoremovable-packages',
        builder.get_object('autoremovable_packages_switch'),
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
}

/**
 * This function set Shortcut.
 *
 * @function setShortcut
 * @param {Gio.Settings} settings - Extrension Settings.
 * @returns {void}
 */
function setShortcut(settings) {
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

export default class DebianUpdatesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        let settings = this.getSettings();

        let builder = Gtk.Builder.new();
        builder.add_from_file(`${this.path}/${TEMPLATE_ADW}`);

        let basicSettingsPage = builder.get_object('basic_settings_page');
        window.add(basicSettingsPage);
        let advancedSettingsPage = builder.get_object('advanced_settings_page');
        window.add(advancedSettingsPage);
        let packagesStatusPage = builder.get_object('packages_status_page');
        window.add(packagesStatusPage);
        let ignoreListPage = builder.get_object('ignore_list_page');
        window.add(ignoreListPage);

        window.search_enabled = true;
        window.set_default_size(580, 580);

        bindPrefs(builder, settings);

        let ignoreListGroup = builder.get_object('ignore_list_group');
        let ignoreListBox = new IgnoreListBox(builder, settings);
        ignoreListGroup.add(ignoreListBox);
    }
}

