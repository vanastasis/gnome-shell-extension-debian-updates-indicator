/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Debian Linux Updates Indicator.
 * https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
 * Modified for vanastasis, 2026-11-26.
 *
 * monitors.js
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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const NetworkMonitor = class NetworkMonitor {
    constructor(updateManager) {
        this._updateManager = updateManager;
        this._network_monitor = Gio.network_monitor_get_default();
        this._sourceId = 0;
    }

    networkTimeout() {
        // Let the actual repository refresh determine reachability.
        // A hard-coded Debian mirror is not a valid test for every distribution.
        if (this._sourceId)
            GLib.source_remove(this._sourceId);
        this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._sourceId = 0;
            if (this._updateManager) {
                if (this._network_monitor.network_available)
                    this._updateManager.checkUpdates();
                else
                    this._updateManager.networkFailed();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        if (this._sourceId) {
            GLib.source_remove(this._sourceId);
            this._sourceId = 0;
        }
        this._updateManager = null;
        this._network_monitor = null;
    }
};

export const DirectoryMonitor = class DirectoryMonitor {
    constructor(updateManager) {
        this._updateManager = updateManager;

        this.start();
    }

    start() {
        this.stop();
        // Missing directories on a non-Debian host must not crash GNOME Shell.
        this._monitors = [];
        for (const path of ['/var/lib/apt/lists', '/var/lib/dpkg']) {
            try {
                const monitor = Gio.File.new_for_path(path).monitor_directory(Gio.FileMonitorFlags.NONE, null);
                const id = monitor.connect('changed', this._onFolderChanged.bind(this));
                this._monitors.push([monitor, id]);
            } catch (error) {
                // Manual refresh remains available.
            }
        }
    }

    stop() {
        for (const [monitor, id] of this._monitors || []) {
            monitor.disconnect(id);
            monitor.cancel();
        }
        this._monitors = [];
        if (this._folderMonitorId) {
            GLib.source_remove(this._folderMonitorId);
            this._folderMonitorId = null;
        }
    }

    _onFolderChanged() {
        // Apt cache has changed! Let's schedule a check in a few seconds
        if (this._folderMonitorId)
            GLib.source_remove(this._folderMonitorId);
        let timeout = 10;
        this._folderMonitorId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            timeout,
            () => {
                this._folderMonitorId = null;
                if (this._updateManager)
                    this._updateManager._launchScript(0);
                return GLib.SOURCE_REMOVE;
            });
    }

    destroy() {
        this.stop();
        this._updateManager = null;
    }
};

