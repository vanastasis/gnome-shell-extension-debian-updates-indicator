#!/bin/bash
##################################################################################
# This file is part of Debian Linux Updates Indicator.
# https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
# Modified for vanastasis, 2026-11-26.
#
# new.sh
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
# Original Authors: Fran Glais ~ <https://github.com/franglais125>
##################################################################################
#
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2023-2026 Gianni Lerro <glerro@pm.me>
##################################################################################

######################################
#                                    #
#   Check for new packages           #
#                                    #
######################################

set -euo pipefail
export LC_ALL=C
cache=$2
umask 077
mkdir -p -- "$cache"
all="$cache/all-packages.list"
new="$cache/new-packages.list"
if (( $1 > 0 )); then
    [[ ! -f "$new" ]] || head -n 500 -- "$new"
    exit 0
fi
tmp=$(mktemp "$cache/packages.XXXXXX")
diff_tmp=$(mktemp "$cache/new.XXXXXX")
trap 'rm -f -- "$tmp" "$diff_tmp"' EXIT
apt-cache pkgnames --generate | sort -u > "$tmp"
if [[ -f "$all" ]]; then
    comm -13 "$all" "$tmp" > "$diff_tmp"
    if [[ -s "$diff_tmp" ]]; then mv -f -- "$diff_tmp" "$new"; fi
fi
mv -f -- "$tmp" "$all"
[[ ! -f "$new" ]] || head -n 500 -- "$new"
