# Debian Linux Updates Indicator
------------------------------

![Screenshot_01](https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator/-/raw/main/assets/Screenshot_01.webp)

![Screenshot_02](https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator/-/raw/main/assets/Screenshot_02.webp)

This extension add an indicator to Gnome Shell for monitoring Debian Linux based distributions packages update.

## Features
* Check for updates and show in the linked menu the following package status (as in Synaptic):
  * Updates available.
  * New packages in the repository.
  * Local/obsolete packages (Require apt-show-versions).
  * Residual configuration files.
  * Self-removable packages.
* In the menu it is also possible check for updates, apply the updates and see when the last check was made.
* It is customizable in many parts via extension settings.
* Show a notification when there are new updates.
* Support Gnome Shell Versions 40, 41, 42, 43, 44, 45.
* Translatable.

## Installation
Normal users are recommended to get the extension from

[![Get it on GNOME Extensions](https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true){height=100px}](https://extensions.gnome.org/extension/6322/debian-linux-updates-indicator/)

## Manual Installation
You can check out the latest version with git, build and install it with [Meson](https://mesonbuild.com/).

You must install git, meson, ninja and xgettext.

For a regular use and local installation these are the steps:

```bash
git clone https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator.git
cd gnome-shell-extension-debian-updates-indicator
meson setup --prefix=$HOME/.local _build
meson install -C _build
```

Otherwise you can run the `./local_install.sh` script, it performs the build steps specified in the
previous section.

You may need to restart GNOME Shell (<kbd>Alt</kbd>+<kbd>F2</kbd>, <kbd>r</kbd>, <kbd>⏎</kbd>)
after that, or logout and login again.

Finally after restarting Gnome Shell or logging in, you need to enable the extension:
```bash
gnome-extensions enable debian-updates-indicator@glerro.pm.me
```

## Export extension ZIP file
To create a ZIP file with the extension, just run:

```bash
git clone https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator.git
cd gnome-shell-extension-debian-updates-indicator
./export-zip.sh
```

This will create the file `debian-updates-indicator@glerro.pm.me.shell-extension.zip` with the extension, you can install it with this steps:

```bash
gnome-extensions install debian-updates-indicator@glerro.pm.me.shell-extension.zip
```

You may need to restart GNOME Shell (<kbd>Alt</kbd>+<kbd>F2</kbd>, <kbd>r</kbd>, <kbd>⏎</kbd>) after that, or logout and login again.

Finally after restarting Gnome Shell or logging in, you need to enable the extension:

```bash
gnome-extensions enable debian-updates-indicator@glerro.pm.me
```

## Translating

To contribute translations you will need a Gnome GitLab account, git, meson, ninja, xgettext and a translation program like Gtranslator.

Start by creating a fork on Gnome GitLab.

Clone your fork with git and setup a project with meson:

```bash
git clone https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator.git
cd gnome-shell-extension-debian-updates-indicator
meson setup --prefix=$HOME/.local _build
meson compile -C _build
```

Ensure the translation template is updated:

```bash
meson compile -C _build gnome-shell-extension-debian-updates-indicator-pot
```

Add the [language code](https://www.gnu.org/software/gettext/manual/html_node/Language-Codes.html) for your translation in /po/LINGUAS file.

Create the /po/<language code.po> file:

```bash
meson compile -C _build gnome-shell-extension-debian-updates-indicator-update-po
```

Open /po/<language code>.po whith Gtranslator or a similar program, translate all messages and save.

To test your translation, install the extension and restart GNOME Shell:

```bash
meson setup --prefix=$HOME/.local _build --reconfigure
meson install -C _build
```

You may need to restart GNOME Shell (<kbd>Alt</kbd>+<kbd>F2</kbd>, <kbd>r</kbd>, <kbd>⏎</kbd>)
after that, or logout and login again.

When you're happy with your translation, commit the changes and push them to your fork:

```bash
git commit -a -m "New translations (<language>)"
git push
```

Finally, open a New Merge Request from your fork at https://gitlab.gnome.org/<your_username>/gnome-shell-extension-wifiqrcode.

## Acknowledgments
This extension is based on APT Update Indicator by Fran Glais.

[APT Update Indicator on Gnome Extensions](https://extensions.gnome.org/extension/1139/apt-update-indicator/)

[APT Update Indicator on GitHub](https://github.com/franglais125/apt-update-indicator)

Many thanks go out to them for their work.

## License
Debian Updates Indicator - Copyright (c) 2023 Gianni Lerro {glerro} ~ <glerro@pm.me>

Debian Updates Indicator is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Debian Updates Indicator is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with Debian Updates Indicator. If not, see <https://www.gnu.org/licenses/>.

