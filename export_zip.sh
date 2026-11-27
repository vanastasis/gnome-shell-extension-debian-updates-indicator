#!/bin/bash
##################################################################################
# This helper is maintained for Debian APT Updates Indicator (vanastasis fork).
# https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
#
# export_zip.sh
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
##################################################################################
# Original Authors: Florian Müllner <fmuellner@gnome.org>
##################################################################################
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2023-2026 Gianni Lerro <glerro@pm.me>
##################################################################################

srcdir=`dirname $0`
srcdir=`(cd $srcdir && pwd)`

builddir=`mktemp -p $srcdir -d _build.XXXXXX` || exit 1
installdir=`mktemp -p $srcdir -d _install.XXXXXX` || exit 1

meson setup --prefix=$installdir $srcdir $builddir
meson install -C $builddir

if [ ! -d $srcdir/zip-files ]; then
    mkdir $srcdir/zip-files
fi

extensiondir=$installdir/share/gnome-shell/extensions/debian-updates-indicator@vanastasis.github.com/

sources=(locale scripts ui `(ls $extensiondir/*.js)`)

gnome-extensions pack --force --out-dir=$srcdir/zip-files ${sources[@]/#/--extra-source=} $extensiondir

rm -rf $builddir
rm -rf $installdir

