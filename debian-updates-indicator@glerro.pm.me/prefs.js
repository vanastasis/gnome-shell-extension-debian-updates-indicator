/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator
 *
 * prefs.js
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

import GObject from 'gi://GObject';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {IgnoreListBox} from './ignoreListBox.js';

const DebianUpdatesAddShortcutsWindow = GObject.registerClass({
    GTypeName: 'DebianUpdatesAddShortcutsWindow',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_add_shortcuts_adw1.ui'),
}, class DebianUpdatesAddShortcutsWindow extends Adw.Window {
    constructor(settings, params = {}) {
        super(params);

        this._settings = settings;

        const eventController = new Gtk.EventControllerKey();
        this.add_controller(eventController);

        eventController.connect('key-pressed', this._onKeyPressed.bind(this));
    }

    _onKeyPressed(_eck, keyval, keycode, state) {
        let mask = state & Gtk.accelerator_get_default_mod_mask() & ~Gdk.ModifierType.LOCK_MASK;
        if (!mask && keyval === Gdk.KEY_Escape) {
            this.close();
            return Gdk.EVENT_STOP;
        }

        if (!mask && keyval === Gdk.KEY_BackSpace) {
            this._settings.set_strv('debian-updates-indicator-shortcut', ['']);
            this.close();
            return Gdk.EVENT_STOP;
        }

        if (!this._isValidBinding(mask, keycode, keyval) || !this._isValidAccel(mask, keyval))
            return Gdk.EVENT_STOP;

        this._settings.set_strv('debian-updates-indicator-shortcut', [
            Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask),
        ]);

        this.destroy();
        return Gdk.EVENT_STOP;
    }

    // Functions from https://gitlab.gnome.org/GNOME/gnome-control-center/-/blob/main/panels/keyboard/keyboard-shortcuts.c
    _keyvalIsForbidden(keyval) {
        return [Gdk.KEY_Home, Gdk.KEY_Left, Gdk.KEY_Up, Gdk.KEY_Right, Gdk.KEY_Down, Gdk.KEY_Page_Up,
            Gdk.KEY_Page_Down, Gdk.KEY_End, Gdk.KEY_Tab, Gdk.KEY_KP_Enter, Gdk.KEY_Return, Gdk.KEY_Mode_switch].includes(keyval);
    }

    _isValidBinding(mask, keycode, keyval) {
        return !(mask === 0 || mask === Gdk.SHIFT_MASK && keycode !== 0 &&
            ((keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z) ||
                (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z) ||
                (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9) ||
                (keyval >= Gdk.KEY_kana_fullstop && keyval <= Gdk.KEY_semivoicedsound) ||
                (keyval >= Gdk.KEY_Arabic_comma && keyval <= Gdk.KEY_Arabic_sukun) ||
                (keyval >= Gdk.KEY_Serbian_dje && keyval <= Gdk.KEY_Cyrillic_HARDSIGN) ||
                (keyval >= Gdk.KEY_Greek_ALPHAaccent && keyval <= Gdk.KEY_Greek_omega) ||
                (keyval >= Gdk.KEY_hebrew_doublelowline && keyval <= Gdk.KEY_hebrew_taf) ||
                (keyval >= Gdk.KEY_Thai_kokai && keyval <= Gdk.KEY_Thai_lekkao) ||
                (keyval >= Gdk.KEY_Hangul_Kiyeog && keyval <= Gdk.KEY_Hangul_J_YeorinHieuh) ||
                (keyval === Gdk.KEY_space && mask === 0) || this._keyvalIsForbidden(keyval))
        );
    }

    _isValidAccel(mask, keyval) {
        return Gtk.accelerator_valid(keyval, mask) || (keyval === Gdk.KEY_Tab && mask !== 0);
    }
});

const DebianUpdatesBasicPrefsPage = GObject.registerClass({
    GTypeName: 'DebianUpdatesBasicPrefsPage',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_basic_adw1.ui'),
    InternalChildren: ['interval', 'interval_unit', 'strip_versions_switch', 'urgent_updates_switch',
        'always_visible', 'show_count', 'auto_expand_list', 'notifications', 'transient_notifications',
        'verbosity', 'shortcut_row', 'shortcut_label', 'use_shortcut'],
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
        this._settings.bind('notify', this._transient_notifications,
            'sensitive', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('notify', this._verbosity,
            'sensitive', Gio.SettingsBindFlags.DEFAULT
        );

        // Shortcut
        this._shortcut_label.set_accelerator(this._settings.get_strv('debian-updates-indicator-shortcut')[0]);
        this._settings.connect('changed::debian-updates-indicator-shortcut', () => {
            this._shortcut_label.set_accelerator(this._settings.get_strv('debian-updates-indicator-shortcut')[0]);
        });

        this._settings.bind('use-shortcut', this._use_shortcut,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('use-shortcut', this._shortcut_row,
            'sensitive', Gio.SettingsBindFlags.DEFAULT
        );

        this._shortcut_row.connect('activated', () => {
            this._addShortcutWindow = new DebianUpdatesAddShortcutsWindow(this._settings, {transient_for: this.get_root()});
            this._addShortcutWindow.present();
        });
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
        this._settings.bind('update-cmd-options', this._update_cmd_options,
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
            this._update_cmd_options.set_active(this._settings.get_enum('update-cmd-options'));
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
        this._ignoreListBox = new IgnoreListBox(this._settings);
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
        window.set_default_size(585, 625);
    }
}

