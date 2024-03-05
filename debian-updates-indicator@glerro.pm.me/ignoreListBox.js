/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator
 *
 * ignoreListBox.js
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
 * SPDX-License-Identifier: GPL-3.0-or-later
 * SPDX-FileCopyrightText: 2023-2024 Gianni Lerro <glerro@pm.me>
 */

'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

const NewItem = GObject.registerClass(
class NewItem extends GObject.Object {
});

const NewItemModel = GObject.registerClass(
class NewItemModel extends GObject.Object {
    static [GObject.interfaces] = [Gio.ListModel];

    constructor() {
        super();

        this._item = new NewItem();
    }

    vfunc_get_item_type() {
        return NewItem;
    }

    vfunc_get_n_items() {
        return 1;
    }

    vfunc_get_item(_pos) {
        return this._item;
    }
});

const IgnoreListModel = GObject.registerClass(
class IgnoreListModel extends GObject.Object {
    static [GObject.interfaces] = [Gio.ListModel];

    constructor(extensionSettings) {
        super();

        this._extensionSettings = extensionSettings;

        this._names = this._extensionSettings.get_strv('ignore-list');
        this._items = Gtk.StringList.new(this._names);

        this._changedId = this._extensionSettings.connect('changed::ignore-list', () => {
            const removed = this._names.length;
            this._names = this._extensionSettings.get_strv('ignore-list');
            this._items.splice(0, removed, this._names);
            this.items_changed(0, removed, this._names.length);
        });
    }

    append() {
        const name = 'package-name-%d'.format(this._names.length + 1);
        this._names.push(name);

        // TODO: Order alphabetically and remove duplicates

        this._extensionSettings.block_signal_handler(this._changedId);
        this._extensionSettings.set_strv('ignore-list', this._names);
        this._extensionSettings.unblock_signal_handler(this._changedId);

        const pos = this._items.get_n_items();
        this._items.append(name);
        this.items_changed(pos, 0, 1);
    }

    remove(name) {
        const pos = this._names.indexOf(name);
        if (pos < 0)
            return;

        this._names.splice(pos, 1);

        this._extensionSettings.block_signal_handler(this._changedId);
        this._extensionSettings.set_strv('ignore-list', this._names);
        this._extensionSettings.unblock_signal_handler(this._changedId);

        this._items.remove(pos);
        this.items_changed(pos, 1, 0);
    }

    rename(oldName, newName) {
        const pos = this._names.indexOf(oldName);
        if (pos < 0)
            return;

        this._names.splice(pos, 1, newName);
        this._items.splice(pos, 1, [newName]);

        // TODO: Order alphabetically and remove duplicates

        this._extensionSettings.block_signal_handler(this._changedId);
        this._extensionSettings.set_strv('ignore-list', this._names);
        this._extensionSettings.unblock_signal_handler(this._changedId);
    }

    vfunc_get_item_type() {
        return Gtk.StringObject;
    }

    vfunc_get_n_items() {
        return this._items.get_n_items();
    }

    vfunc_get_item(pos) {
        return this._items.get_item(pos);
    }
});

const IgnoreListRow = GObject.registerClass(
class IgnoreListRow extends Adw.PreferencesRow {
    constructor(name) {
        super({name});

        const box = new Gtk.Box({
            spacing: 12,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 6,
            margin_end: 6,
        });

        const label = new Gtk.Label({
            hexpand: true,
            xalign: 0,
            max_width_chars: 25,
            ellipsize: Pango.EllipsizeMode.END,
        });

        this.bind_property('name', label, 'label',
            GObject.BindingFlags.SYNC_CREATE);
        box.append(label);

        const button = new Gtk.Button({
            action_name: 'ignore-list.remove',
            icon_name: 'edit-delete-symbolic',
            has_frame: false,
        });
        box.append(button);

        this.bind_property_full('name',
            button, 'action-target',
            GObject.BindingFlags.SYNC_CREATE,
            (bind, target) => [true, new GLib.Variant('s', target)],
            null);

        this._entry = new Gtk.Entry({
            max_width_chars: 25,
            secondary_icon_name: 'object-select-symbolic',
        });

        const controller = new Gtk.ShortcutController();
        controller.add_shortcut(new Gtk.Shortcut({
            trigger: Gtk.ShortcutTrigger.parse_string('Escape'),
            action: Gtk.CallbackAction.new(() => {
                this._stopEdit();
                return true;
            }),
        }));
        this._entry.add_controller(controller);

        this._stack = new Gtk.Stack();
        this._stack.add_named(box, 'display');
        this._stack.add_named(this._entry, 'edit');
        this.child = this._stack;

        this._entry.connect('activate', () => {
            if (this._entry.get_text_length() !== 0) {
                this.activate_action('ignore-list.rename',
                    new GLib.Variant('(ss)', [this.name, this._entry.text]));
                this.name = this._entry.text;
            }
            this._stopEdit();
        });
        this._entry.connect('notify::has-focus', () => {
            if (this._entry.has_focus)
                return;
            this._stopEdit();
        });
        this._entry.connect('icon-release', () => {
            this._entry.emit('activate');
        });
    }

    edit() {
        this._entry.text = this.name;
        this._entry.grab_focus();
        this._stack.visible_child_name = 'edit';
    }

    _stopEdit() {
        this.grab_focus();
        this._stack.visible_child_name = 'display';
    }
});

const NewItemRow = GObject.registerClass({
    GTypeName: 'NewItemRow',
}, class NewItemRow extends Adw.PreferencesRow {
    constructor() {
        super({
            action_name: 'ignore-list.add',
        });

        let imageAdd = new Gtk.Image({
            icon_name: 'list-add-symbolic',
            pixel_size: 16,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });
        this.set_child(imageAdd);
    }
});

export const IgnoreListBox = GObject.registerClass(
class IgnoreListBox extends Gtk.ListBox {
    constructor(extensionSettings) {
        super({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });

        this._extensionSettings = extensionSettings;

        let _ignoreListModel = new IgnoreListModel(this._extensionSettings);

        const store = new Gio.ListStore({item_type: Gio.ListModel});
        const listModel = new Gtk.FlattenListModel({model: store});
        store.append(_ignoreListModel);
        store.append(new NewItemModel());

        this.connect('row-activated', (l, row) => row.edit());
        this.bind_model(listModel, item => {
            return item instanceof NewItem
                ? new NewItemRow()
                : new IgnoreListRow(item.string);
        });

        let actionGroup = new Gio.SimpleActionGroup();

        let action1 = new Gio.SimpleAction({name: 'add'});
        action1.connect('activate', () => {
            _ignoreListModel.append();
        });
        actionGroup.add_action(action1);

        let action2 = new Gio.SimpleAction({name: 'remove', parameter_type: new GLib.VariantType('s')});
        action2.connect('activate', (name, param) => {
            _ignoreListModel.remove(param.unpack());
        });
        actionGroup.add_action(action2);

        let action3 = new Gio.SimpleAction({name: 'rename', parameter_type: new GLib.VariantType('(ss)')});
        action3.connect('activate', (name, param) => {
            _ignoreListModel.rename(...param.deepUnpack());
        });
        actionGroup.add_action(action3);

        this.insert_action_group('ignore-list', actionGroup);
    }
});

