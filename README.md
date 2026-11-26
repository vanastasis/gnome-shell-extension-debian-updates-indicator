# Debian Linux Updates Indicator — JAVA Computers

Maintained by **JAVA Computers — by Thinker** ([vanastasis](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator)).

A GNOME Shell extension for monitoring APT package updates on Debian and Debian-based distributions.

## Compatibility

- **GNOME Shell 51:** reported working by the maintainer on Debian sid/forky (Thinker).
- **GNOME Shell 45–50:** declared compatible; not independently retested for this fork release.
- GNOME Shell 44 and earlier: not supported by this release.
- Version: `2.7.0-JAVA.1`.

## Features

- Available updates and optional critical-update notifications.
- New repository packages, obsolete/local packages, residual configuration and autoremovable packages.
- Manual or scheduled checks, configurable commands and an ignore list.
- Existing translations and GSettings preferences retained.

## Installation from source

Install the build tools and required package-management utilities on Debian:

```bash
sudo apt install git meson ninja-build gettext libglib2.0-bin packagekit apt-show-versions
```

```bash
git clone --branch main https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator.git
cd gnome-shell-extension-debian-updates-indicator
meson setup --prefix="$HOME/.local" _build
meson install -C _build
```

Disable any previous installation of the upstream extension before enabling this fork. Both use the same settings schema, so existing user preferences can be reused. Do not enable both extensions at once. Log out and back in on Wayland, then run:

```bash
gnome-extensions enable debian-updates-indicator@vanastasis.github.com
```

## Changes and support

See [CHANGELOG.md](CHANGELOG.md). Report issues or submit changes at [https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/issues](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/issues).

## Attribution and licence

Derived from the [original Debian Linux Updates Indicator](https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator) by Gianni Lerro, copyright 2023–2026, with contributions and original work by Fran Glais and Raphael Rochet. Original copyright, author, translation and SPDX notices remain intact. This fork contains modifications by JAVA Computers (Thinker), 2026-11-26.

Licensed under the GNU General Public License, version 3 or later (GPL-3.0-or-later). See the repository licence for the full terms. Provided without warranty.
