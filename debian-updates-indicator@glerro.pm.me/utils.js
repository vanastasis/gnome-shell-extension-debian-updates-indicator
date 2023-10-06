/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator
 *
 * utils.js
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
 * Original Author: Fran Glais ~ <https://github.com/franglais125>
 * *****************************************************************************
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * SPDX-FileCopyrightText: 2023 Gianni Lerro <glerro@pm.me>
 */

'use strict';

import GObject from 'gi://GObject';

const SignalsHandlerFlags = {
    NONE: 0,
    CONNECT_AFTER: 1,
};

/**
 * Simplify global signals and function injections handling
 * abstract class
 */
const BasicHandler = class BasicHandler {
    constructor(extensionName) {
        this._storage = {};
        this._extensionName = extensionName;
    }

    add(...args /* unlimited 3-long array arguments */) {
        // Convert arguments object to array, concatenate with generic
        // Call addWithLabel with args as if they were passed arguments
        this.addWithLabel('generic', ...args);
    }

    addWithLabel(label, ...args /* plus unlimited 3-long array arguments*/) {
        if (this._storage[label] === undefined)
            this._storage[label] = [];

        // Skip first element of the arguments
        for (let i = 1; i < args.length; i++) {
            let item = this._storage[label];
            try {
                item.push(this._create(args[i]));
            } catch (err) {
                console.log(`${this._extensionName} - Add signal - ${err.message}`);
            }
        }
    }

    removeWithLabel(label) {
        if (this._storage[label]) {
            for (let i = 0; i < this._storage[label].length; i++)
                this._remove(this._storage[label][i]);

            delete this._storage[label];
        }
    }

    destroy() {
        for (let label in this._storage)
            this.removeWithLabel(label);
    }

    // Virtual methods to be implemented by subclass

    /**
     * Create single element to be stored in the storage structure
     *
     * @param {?} _item - ?.
     */
    _create(_item) {
        throw new GObject.NotImplementedError(`_create in ${this.constructor.name}`);
    }

    /**
     * Correctly delete single element
     *
     * @param {?} _item - ?.
     */
    _remove(_item) {
        throw new GObject.NotImplementedError(`_remove in ${this.constructor.name}`);
    }
};

/**
 * Manage global signals
 */
export const GlobalSignalsHandler = class GlobalSignalsHandler extends BasicHandler {
    _create(item) {
        let object = item[0];
        let event = item[1];
        let callback = item[2];
        let flags = item.length > 3 ? item[3] : SignalsHandlerFlags.NONE;

        if (!object)
            throw new Error('Impossible to connect to an invalid object');

        let after = flags === SignalsHandlerFlags.CONNECT_AFTER;
        let connector = after ? object.connect_after : object.connect;

        if (!connector) {
            throw new Error(`Requested to connect to signal '${event}', ` +
                `but no implementation for 'connect${after ? '_after' : ''}' ` +
                `found in ${object.constructor.name}`);
        }

        let id = connector.call(object, event, callback);

        return [object, id];
    }

    _remove(item) {
        item[0].disconnect(item[1]);
    }
};

