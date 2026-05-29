#!/bin/bash
##################################################################################
# This file is part of Debian Linux Updates Indicator.
# https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator
#
# local:install.sh
#
# Copyright (c) 2023-2026 Gianni Lerro {glerro} ~ <glerro@pm.me>
#
# Debian Linux Updates Indicator is free software: you can redistribute it and/or
# modify it under the terms of the GNU General Public License as published by the
# Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Debian Linux Updates Indicator is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along
# with Debian Linux Updates Indicator. If not, see <https://www.gnu.org/licenses/>.
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2023-2026 Gianni Lerro <glerro@pm.me>
##################################################################################

rm -rf _build
meson setup --prefix=$HOME/.local _build
meson install -C _build
rm -rf _build

