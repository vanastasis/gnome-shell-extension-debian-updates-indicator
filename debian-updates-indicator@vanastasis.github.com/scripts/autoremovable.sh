#!/bin/bash
##################################################################################
# This file is part of Debian Linux Updates Indicator.
# https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
# Modified for vanastasis, 2026-11-26.
#
# autoremoval.sh
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
#   Check for obsolete packages      #
#                                    #
######################################

set -euo pipefail
export LC_ALL=C
apt-get --simulate autoremove | awk '/^Remv / {print $2}' | awk 'NR <= 500 {print}'
