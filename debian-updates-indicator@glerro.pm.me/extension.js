/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator
 *
 * extension.js
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

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as UpdateManager from './updateManager.js';

export default class DebianUpdatesExtension extends Extension {
    enable() {
        console.log(`Enabling ${this.metadata.name} - Version ${this.metadata.version}`);

        this._updateManager = new UpdateManager.UpdateManager(this);
    }

    disable() {
        console.log(`Disabling ${this.metadata.name} - Version ${this.metadata.version}`);

        if (this._updateManager !== null) {
            this._updateManager.destroy();
            this._updateManager = null;
        }
    }
}

