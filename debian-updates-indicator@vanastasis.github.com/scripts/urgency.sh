#!/bin/bash
##################################################################################
# This file is part of Debian Linux Updates Indicator.
# https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
# Modified for vanastasis, 2026-11-26.
#
# urgency.sh
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
#           List updates and         #
#        check for their urgency     #
#                                    #
######################################

# List updates               | Print "Results" section | Keep only urgent ones
LANG=en pkcon -p get-updates | sed '1,/Results/d'      | grep 'Security\|Important'

# Urgent statuses:
#     Security, Important

# Low priority:
#     Bug fix, Normal, Trivial, Enhancement

# Source: https://github.com/hughsie/PackageKit/blob/master/po/en_GB.po

