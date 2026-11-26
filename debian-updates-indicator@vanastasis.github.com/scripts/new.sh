#!/bin/bash
##################################################################################
# This file is part of Debian Linux Updates Indicator.
# https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator
# Modified for JAVA Computers (Thinker), 2026-11-26.
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

ONLY_PRINT=$1
TEMP_FOLDER=$2
# Paths and files
path=${TEMP_FOLDER}

first_run=false

file_all=${path}all-packages.list
file=${path}new-packages.list
temporary=${path}temporary.list

# Create the directory if it doesn't exist
mkdir -p ${path}

# If only printing, exit immediately after
if [ "$ONLY_PRINT" -gt 0 ]; then
  if [ -f ${file} ]; then
    num=`cat ${file} | wc -l`
    if [ "$num" -gt 499 ]; then
      echo "* Too many! Showing only 500 *"
    fi
    head -500 $file
  fi
  exit 0
fi

#Prepare
if [ -f ${file_all} ]; then
  mv ${file_all} ${file_all}.old
else
  first_run=true
fi

apt-cache pkgnames --generate | sort > ${file_all}
if [ "$first_run" = true ]; then
  exit 0
fi
# checks for differences         | prints 2d output | remove empty lines
diff ${file_all} ${file_all}.old | awk '{print $2}' | grep -v -e '^$' > ${temporary}

# Check that the difference doesn't come from the `.old` file
touch ${file}.test
rm ${file}.test
touch ${file}.test
for line in $(cat ${temporary})
do
  if grep -Fxq $line ${file_all}
  then
    echo $line >> ${file}.test
  fi
done

#Erase the file if there are new packages
num=`cat ${file}.test | wc -l`

if [ "$num" -gt 0 ]; then
  mv ${file}.test ${file}
fi

if [ ! -f ${file} ]; then
  touch ${file}
fi

# Print!
num=`cat ${file} | wc -l`
if [ "$num" -gt 499 ]; then
  echo "* Too many! Showing only 500 *"
fi
head -500 $file

