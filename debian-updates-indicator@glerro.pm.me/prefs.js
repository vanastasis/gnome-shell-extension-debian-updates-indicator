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

/* exported init, buildPrefsWidget, fillPreferencesWindow */

'use strict';

const Gettext = imports.gettext;

const {Gio, Gtk} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Domain = Gettext.domain(Me.metadata['gettext-domain']);
const {
    gettext: _,
} = Domain;

const TEMPLATE_GTK = 'prefs_gtk4.ui';
const TEMPLATE_ADW = 'prefs_adw1.ui';

let Adw = null;
try {
    Adw = imports.gi.Adw;
} catch (e) { /* Do Nothing */ }

const IgnoreListBox = Adw != null ? Me.imports.ignoreListBox.IgnoreListBox : null;

/**
 * This function connect Dialogs Windows (GTK4 - GS < 42).
 *
 * @function connectDialogs
 * @param {Gtk.Builder} builder - Builder prefs widgets.
 * @param {Gtk.Notebook} notebook - Builder prefs notebook.
 * @returns {void}
 */
function connectDialogs(builder, notebook) {
    // Create dialog for the indicator settings
    builder.get_object('indicator_button').connect('clicked', () => {
        let dialog = new Gtk.Dialog({
            title: _('Indicator options'),
            transient_for: notebook.get_root(),
            use_header_bar: true,
            modal: true,
        });

        let subBox = builder.get_object('indicator_dialog');
        dialog.get_content_area().append(subBox);

        dialog.connect('response', () => {
            // remove the settings box so it doesn't get destroyed;
            dialog.get_content_area().remove(subBox);
            dialog.destroy();
        });

        dialog.show();
    });

    // Create dialog for the notification settings
    builder.get_object('notifications_button').connect('clicked', () => {
        let dialog = new Gtk.Dialog({
            title: _('Notification options'),
            transient_for: notebook.get_root(),
            use_header_bar: true,
            modal: true,
        });

        let subBox = builder.get_object('notifications_dialog');
        dialog.get_content_area().append(subBox);

        dialog.connect('response', () => {
            // remove the settings box so it doesn't get destroyed;
            dialog.get_content_area().remove(subBox);
            dialog.destroy();
        });

        dialog.show();
    });

    // Create dialog for custom command for updating
    builder.get_object('update_cmd_button').connect('clicked', () => {
        let dialog = new Gtk.Dialog({
            title: _('Custom command for updates'),
            transient_for: notebook.get_root(),
            use_header_bar: true,
            modal: true,
        });

        let subBox = builder.get_object('custom_command_dialog');
        dialog.get_content_area().append(subBox);

        dialog.connect('response', () => {
            // remove the settings box so it doesn't get destroyed;
            dialog.get_content_area().remove(subBox);
            dialog.destroy();
        });

        dialog.show();
    });
}

/**
 * This function setup IgnoreList (GTK4 - GS < 42).
 *
 * @function setupIgnoreList
 * @param {Gtk.Builder} builder - Builder prefs widgets.
 * @param {Gtk.Notebook} notebook - Builder prefs notebook.
 * @param {Gio.Settings} settings - Extension settings.
 * @returns {void}
 */
function setupIgnoreList(builder, notebook, settings) {
    // Ignore list tab:
    // Set up the List of packages
    let column = new Gtk.TreeViewColumn();
    column.set_title(_('Package name'));
    builder.get_object('ignore_list_treeview').append_column(column);

    let renderer = new Gtk.CellRendererText();
    column.pack_start(renderer, null);

    column.set_cell_data_func(renderer, (_column, cell, model, iter) => {
        cell.markup = model.get_value(iter, 0);
    });

    let listStore = builder.get_object('ignore_list_store');
    let treeView  = builder.get_object('ignore_list_treeview');
    refreshUI(listStore, treeView, settings);
    settings.connect(
        'changed::ignore-list',
        () => {
            refreshUI(listStore, treeView, settings);
        }
    );

    builder.get_object('treeview_selection').connect(
        'changed',
        (selection, liststore) => {
            selectionChanged(selection, liststore);
        }
    );

    // Toolbar
    builder.get_object('ignore_list_toolbutton_add').connect(
        'clicked',
        () => {
            let dialog = new Gtk.Dialog({
                title: _('Add entry to ignore list'),
                transient_for: notebook.get_root(),
                use_header_bar: true,
                modal: true,
            });

            let subBox = builder.get_object('ignore_list_add_dialog');
            dialog.get_content_area().append(subBox);

            // Objects
            let entry = builder.get_object('ignore_list_add_entry');
            let saveButton = builder.get_object('ignore_list_add_button_save');
            let cancelButton = builder.get_object('ignore_list_add_button_cancel');

            // Clean the entry in case it was already used
            entry.set_text('');
            entry.connect('icon-release', () => {
                entry.set_text('');
            });

            let saveButtonId = saveButton.connect(
                'clicked',
                () => {
                    let name = entry.get_text();
                    let entries = settings.get_strv('ignore-list');
                    entries.push(name);

                    // Order alphabetically and remove duplicates
                    entries.sort();
                    entries = entries.filter((item, pos, ary) => {
                        return !pos || item !== ary[pos - 1];
                    });

                    settings.set_strv('ignore-list', entries);

                    close();
                }
            );

            let cancelButtonId = cancelButton.connect(
                'clicked',
                close
            );

            dialog.connect('response', () => {
                close();
            });

            dialog.show();

            /**
             * Add Entry Dialog - Close function.
             *
             * @function close
             */
            function close() {
                builder.get_object('ignore_list_add_button_save').disconnect(saveButtonId);
                builder.get_object('ignore_list_add_button_cancel').disconnect(cancelButtonId);

                // remove the settings box so it doesn't get destroyed
                dialog.get_content_area().remove(subBox);
                dialog.destroy();
            }
        }
    );

    builder.get_object('ignore_list_toolbutton_remove').connect(
        'clicked',
        () => {
            removeEntry(settings);
        }
    );

    builder.get_object('ignore_list_toolbutton_edit').connect(
        'clicked',
        () => {
            if (selectedEntry < 0)
                return;

            let dialog = new Gtk.Dialog({
                title: _('Edit entry'),
                transient_for: notebook.get_root(),
                use_header_bar: true,
                modal: true,
            });

            let subBox = builder.get_object('ignore_list_edit_dialog');
            dialog.get_content_area().append(subBox);

            // Objects
            let entries = settings.get_strv('ignore-list');
            if (!entries.length)
                return;

            let entry = builder.get_object('ignore_list_edit_entry');
            let saveButton = builder.get_object('ignore_list_edit_button_save');
            let cancelButton = builder.get_object('ignore_list_edit_button_cancel');

            // Clean the entry in case it was already used
            entry.set_text(entries[selectedEntry]);
            entry.connect('icon-release', () => {
                entry.set_text('');
            });

            let saveButtonId = saveButton.connect(
                'clicked',
                () => {
                    let name = entry.get_text();
                    entries = settings.get_strv('ignore-list');
                    entries.push(name);

                    // Order alphabetically and remove duplicates
                    entries.splice(selectedEntry, 1);
                    entries.sort();
                    entries = entries.filter((item, pos, ary) => {
                        return !pos || item !== ary[pos - 1];
                    });

                    settings.set_strv('ignore-list', entries);

                    close();
                }
            );

            let cancelButtonId = cancelButton.connect(
                'clicked',
                close
            );

            dialog.connect('response', () => {
                close();
            });

            dialog.show();

            /**
             * Edit Entry Dialog - Close function.
             *
             * @function close
             */
            function close() {
                builder.get_object('ignore_list_edit_button_save').disconnect(saveButtonId);
                builder.get_object('ignore_list_edit_button_cancel').disconnect(cancelButtonId);

                // remove the settings box so it doesn't get destroyed
                dialog.get_content_area().remove(subBox);
                dialog.destroy();
            }
        }
    );
}

let selectedEntry = 0;

/**
 * This function is executed when Selection Changed IgnoreList (GTK4 - GS < 42).
 *
 * @function selectionChanged
 * @param {Gtk.Treeselection} selection - Selected Entry.
 * @param {Gtk.ListStore} liststore - Ignore Entry List.
 * @returns {void}
 */
function selectionChanged(selection, liststore) {
    let a = selection.get_selected_rows(liststore)[0][0];

    if (a !== undefined)
        selectedEntry = parseInt(a.to_string());
}

/**
 * This function remove Entry from IgnoreList (GTK4 - GS < 42).
 *
 * @function removeEntry
 * @param {Gio.Settings} settings - Extension settings.
 * @returns {void}
 */
function removeEntry(settings) {
    let entries = settings.get_strv('ignore-list');

    if (!entries.length || selectedEntry < 0)
        return 0;

    if (entries.length > 0)
        entries.splice(selectedEntry, 1);

    settings.set_strv('ignore-list', entries);

    return 0;
}

let list = null;

/**
 * This function Refresh IgnoreList (GTK4 - GS < 42).
 *
 * @function refreshUI
 * @param {Gtk.ListStore} listStore - Ignore Entry List.
 * @param {Gtk.TreeView} treeView - Widget that visualize Ignore Entries List.
 * @param {Gio.Settings} settings - Extension Settings.
 * @returns {void}
 */
function refreshUI(listStore, treeView, settings) {
    let restoreForced = selectedEntry;
    let entries = settings.get_strv('ignore-list');

    if (list !== entries) {
        if (listStore !== undefined)
            listStore.clear();

        if (entries.length > 0) {
            if (entries && typeof entries == 'string')
                entries = [entries];

            let current = listStore.get_iter_first();

            for (let i in entries) {
                current = listStore.append();
                listStore.set_value(current, 0, entries[i]);
            }
        }

        list = entries;
    }

    selectedEntry = restoreForced;
    changeSelection(treeView, entries);
}

/**
 * This Change the selected Entry row (GTK4 - GS < 42).
 *
 * @function changeSelection
 * @param {Gtk.TreeView} treeview - Widget that visualize Ignore Entries List.
 * @param {Gtk.Builder} entries - Array of Entries.
 * @returns {void}
 */
function changeSelection(treeview, entries) {
    if (selectedEntry < 0 || !entries.length)
        return;

    let max = entries.length - 1;
    if (selectedEntry > max)
        selectedEntry = max;

    let path = selectedEntry;
    path = Gtk.TreePath.new_from_string(String(path));
    treeview.get_selection().select_path(path);
}

/**
 * This function setup Preferences binding (GTK4 - ADW1).
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
        Adw != null ? 'selected' : 'active',
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
        builder.get_object('update_cmd_button')[Adw != null ? 'set_enable_expansion' : 'set_sensitive'](false);

    settings.connect('changed::update-cmd-options', () => {
        if (settings.get_enum('update-cmd-options') === 4)
            builder.get_object('update_cmd_button')[Adw != null ? 'set_enable_expansion' : 'set_sensitive'](true);
        else
            builder.get_object('update_cmd_button')[Adw != null ? 'set_enable_expansion' : 'set_sensitive'](false);
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
 * This function set Shortcut (GTK4 - ADW1).
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

/**
 * This function is called once when the Preferencs Windows is loaded.
 *
 * @function init
 */
function init() {
    ExtensionUtils.initTranslations();
}

/**
 * This function build the Preferencs Windows for Gnome Shell < 42
 *
 * @function buildPrefsWidget
 * @returns {Gtk.Widget} - the prefs widget
 */
function buildPrefsWidget() {
    const settings = ExtensionUtils.getSettings();

    // Prepare labels and controls
    let builder = new Gtk.Builder();
    builder.add_from_file(`${Me.dir.get_path()}/${TEMPLATE_GTK}`);
    let notebook = builder.get_object('prefs_widget');

    connectDialogs(builder, notebook);
    setupIgnoreList(builder, notebook, settings);
    bindPrefs(builder, settings);

    return notebook;
}

/**
 * This function build Preferences Window {Adw.PreferencesWindow} and have higher priority to builPrefsWidget().
 * Work with Gnome Shell >= 42
 *
 * @function fillPreferencesWindow
 * @param {Adw.PreferencesWindow} window - the prefs window.
 * @returns {void}
 */
function fillPreferencesWindow(window) {
    if (Adw) {
        const settings = ExtensionUtils.getSettings();

        let builder = Gtk.Builder.new();
        builder.add_from_file(`${Me.dir.get_path()}/${TEMPLATE_ADW}`);

        if (Adw.get_minor_version() >= 2) {
            let shortcutRow = builder.get_object('shortcut_row');
            shortcutRow.set_use_markup(false);
        }

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

