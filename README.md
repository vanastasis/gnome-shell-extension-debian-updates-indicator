# Debian Linux Updates Indicator — JAVA Computers

**Maintained by JAVA Computers — by Thinker** ([vanastasis](https://github.com/vanastasis))

A GNOME Shell panel extension for monitoring APT package updates on Debian and Debian-based Linux distributions.

**Version:** `2.7.0-JAVA.1` | **Licence:** GPL-3.0-or-later

## Compatibility

| GNOME Shell version | Status |
| --- | --- |
| 51 | Original modified extension tested and working on Thinker (Debian sid/forky); renamed fork requires runtime verification |
| 45–50 | Declared compatible; not retested for this release |
| 44 and earlier | Not supported by the maintained release |

## Features

- Available package updates and optional critical-update notifications.
- New packages in repositories, local/obsolete packages, residual configuration and autoremovable packages.
- Manual and automatic update checks with hourly, daily or weekly intervals.
- Configurable refresh and update commands, ignore list and last-check timestamp.
- Existing preferences and translations retained.
- GNOME Shell 51 panel-layout compatibility and corrected timer lifecycle.

## Manual installation only — no compilation required for release ZIPs

This fork is distributed through GitHub only, not the GNOME Extensions website.

Visit [GitHub Releases](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/releases) and download the following installable asset when a release is published:

`debian-updates-indicator@vanastasis.github.com.shell-extension.zip`

**Do not use GitHub's automatically generated Source code (zip) archive for direct installation.** The installable release ZIP includes compiled schemas and translations. At the time of this documentation update, the first packaged release has not yet been published.

### Option 1 — Install the release ZIP

Run from the directory containing the downloaded ZIP:

```bash
gnome-extensions install --force "debian-updates-indicator@vanastasis.github.com.shell-extension.zip"
```

### Option 2 — Extract the release ZIP manually

```bash
UUID="debian-updates-indicator@vanastasis.github.com"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
mkdir -p "$DEST"
unzip -o "$UUID.shell-extension.zip" -d "$DEST"
```

The archive must contain `metadata.json`, `extension.js`, `schemas/gschemas.compiled`, `scripts/`, `ui/` and the available compiled translations at the correct relative paths.

### Enable the extension

If replacing the upstream extension, disable the old UUID first. Both extensions share the same GSettings schema; do not enable both at the same time.

Log out and log back in on Wayland, then run:

```bash
gnome-extensions enable debian-updates-indicator@vanastasis.github.com
gnome-extensions info debian-updates-indicator@vanastasis.github.com
```

The installed extension is located in:

`~/.local/share/gnome-shell/extensions/debian-updates-indicator@vanastasis.github.com/`

The release ZIP requires no Git, Meson, Ninja or compiler. Normal runtime utilities such as APT and the configured refresh/update command are still required. Optional obsolete-package checks use `apt-show-versions`; the default refresh command uses PackageKit.

## Build from source (developers and maintainers)

```bash
sudo apt install git meson ninja-build gettext libglib2.0-bin
git clone --branch main https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator.git
cd gnome-shell-extension-debian-updates-indicator
meson setup --prefix="$HOME/.local" _build
meson compile -C _build
meson install -C _build
```

Alternatively, run `./local_install.sh` for a local build and installation.

## Package a release (maintainers)

The repository contains `export_zip.sh` for packaging the extension. Before publishing, verify that the archive contains the compiled schema, translations and all runtime files.

Expected release filename:

`zip-files/debian-updates-indicator@vanastasis.github.com.shell-extension.zip`

Upload the verified ZIP as a release asset on GitHub under the tag `v2.7.0-JAVA.1`. Do not publish the source ZIP as the installable asset.

## Changes and support

- [Changelog](CHANGELOG.md)
- [GitHub releases](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/releases)
- [Report an issue](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/issues)
- [Contribute a change](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/pulls)

The maintained branch is `main`. The other imported branches are historical and are not current JAVA Computers releases.

## Attribution and licence

Derived from the [original Debian Linux Updates Indicator](https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator) by Gianni Lerro, copyright 2023–2026, with contributions and original work by Fran Glais and Raphael Rochet. Original copyright, author, translation and SPDX notices remain intact.

Modifications by JAVA Computers (Thinker), 2026-11-26.

Licensed under the GNU General Public License, version 3 or later (GPL-3.0-or-later). See [COPYING](COPYING) for full terms. Provided without warranty.
