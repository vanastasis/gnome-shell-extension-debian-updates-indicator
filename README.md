# Debian APT Updates Indicator

**Maintained by [vanastasis](https://github.com/vanastasis)**

A GNOME Shell panel extension for monitoring and managing APT package updates on Debian and Debian-based Linux distributions.

**Version:** `2.7.0.9` | **GNOME Shell:** 48–51 | **Licence:** GPL-3.0-or-later

## What's new in 2.7.0.9

- Fix PackageKit executable detection, report refresh failures, and update the last-check timestamp only after a successful refresh and scan.
- Cancel obsolete read-only scans and guard asynchronous callbacks, monitors, notifications and main-loop sources on disable.
- Prevent overlapping extension-managed package operations; track built-in terminal completion independently of a detached launcher.
- Move generated package lists to the user cache; use locale-independent, failure-aware scans and handle missing optional dependencies.
- Start the first local scan after two seconds; retain GNOME Shell 48–51 and all existing preferences.
- Require explicit Nala cleanup confirmation even when system defaults request automatic confirmation; retain old and new Nala CLI option detection.
- Add release validation for JavaScript, shell scripts, schemas, translations, simulated Nala commands and Shexli reports.

## Features

- Available updates and optional critical-update notifications.
- New packages in repositories, local/obsolete packages, residual configuration files and autoremovable packages.
- Manual and automatic update checks with hourly, daily or weekly intervals.
- Configurable refresh commands, ignore list and last-check timestamp.
- GNOME Shell 48–51 panel-layout compatibility and corrected timer lifecycle.
- Existing settings and translations retained; new strings may appear in English until translated.

## Advanced settings

| Method | Apply updates | Remove unused packages |
| --- | --- | --- |
| APT – Default Terminal | `apt full-upgrade -o APT::Get::AutomaticRemove=false` | `apt autoremove` |
| APT-get – Default Terminal | `apt-get dist-upgrade -o APT::Get::AutomaticRemove=false` | `apt-get autoremove` |
| Nala – XFCE Terminal | `nala full-upgrade --assume-yes` plus the detected no-autoremove option | `nala autoremove` |
| Custom | User-defined | User-defined |
| GNOME Software, Synaptic, PackageKit, Ubuntu Update Manager | GUI update methods | — |

Built-in terminal commands use `pkexec`. Install Nala and `xfce4-terminal` to use the Nala presets. Full upgrades can still remove conflicting packages to resolve dependencies; disabling autoremove is not a guarantee against all removals. Automatic checks do not automatically install upgrades or run cleanup. The Nala update preset detects `--no-autoremove` or `--no-auto-remove` from the installed command help; the residual cleanup preset detects `--config` or `--remove-config`. If detection fails, the corresponding transaction is not started.

**Optional residual purge:** enable **Also purge residual configuration files** in Advanced settings. Nala uses `nala autoremove --purge` with the detected `--config` (0.16.0) or `--remove-config` (0.18.1) option in a single interactive transaction, including when only residual configurations remain. APT and APT-get use `autoremove --purge` followed by a freshly detected list of remaining `rc` packages for explicit confirmation. Custom commands remain unchanged, with APT-get used for the extra purge. The switch is off by default; disabling it retains ordinary cleanup behaviour.

Package-list cache: `$XDG_CACHE_HOME/debian-updates-indicator@vanastasis.github.com/` (normally under `~/.cache`). The default refresh requires `pkcon` or `pkgcli`; if neither exists, install PackageKit or configure a custom refresh command. Obsolete-package detection is optional and requires `apt-show-versions`. Built-in terminal commands track completion via a private marker; arbitrary GUI/custom commands may still detach. A forcibly killed terminal can leave tracking pending until the extension is restarted; do not restart it during a package transaction.

## Compatibility

GNOME Shell 48, 49, 50 and 51 are the declared compatibility targets. GNOME Shell 51 has been exercised by the maintainer; live runtime testing of this release on GNOME Shell 48–50 is still required. Earlier versions and unreleased future versions are not declared supported. Build and schema validation do not establish live runtime compatibility for every terminal or distribution.

## Installation

Download the installable ZIP from [GitHub Releases](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/releases):

`debian-updates-indicator@vanastasis.github.com.shell-extension.zip`

Do not use GitHub's automatically generated source archive as an installable extension. The GitHub release asset includes compiled schemas and translations.

```bash
gnome-extensions install --force "debian-updates-indicator@vanastasis.github.com.shell-extension.zip"
```

Alternatively, manually extract the GitHub release ZIP into `~/.local/share/gnome-shell/extensions/debian-updates-indicator@vanastasis.github.com/`.

If replacing the upstream extension, disable the old UUID first; both share a GSettings schema. On Wayland, log out and back in if the old JavaScript is still cached, then enable the extension:

```bash
gnome-extensions enable debian-updates-indicator@vanastasis.github.com
gnome-extensions info debian-updates-indicator@vanastasis.github.com
```

A separate GNOME Extensions submission archive omits the compiled GSettings schema. Publication on extensions.gnome.org is subject to review; GitHub publication does not automatically update that listing.

## Build from source

```bash
sudo apt install git meson ninja-build gettext libglib2.0-bin
git clone --branch main https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator.git
cd gnome-shell-extension-debian-updates-indicator
meson setup --prefix="$HOME/.local" _build
meson compile -C _build
meson install -C _build
```

## Publish a release (maintainers)

From the repository root, run `./publish-release.sh VERSION release-notes.md` after reviewing local changes. The script stages tracked edits and builds from the staged source, installs locally, pushes to GitHub and creates a release with the GitHub ZIP and checksum. Stage any new source files explicitly first. The separate EGO ZIP is generated for manual submission.

Publishing requires Node.js, gettext, GLib schema utilities and Shexli (on PATH or in `~/.venvs/shexli`). The publisher saves validation reports under `zip-files/validation/`. It blocks on non-allowlisted Shexli errors; any other findings require explicit acknowledgment. The known `EGO-M-004` finding must be reviewed rather than automatically ignored.

## Changes and support

- [Changelog](CHANGELOG.md)
- [GitHub releases](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/releases)
- [Report an issue](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/issues)
- [Contribute a change](https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator/pulls)

The maintained branch is `main`. Other imported branches are historical.

## Attribution and licence

Derived from the [original Debian Linux Updates Indicator](https://gitlab.gnome.org/glerro/gnome-shell-extension-debian-updates-indicator) by Gianni Lerro, copyright 2023–2026, with contributions and original work by Fran Glais and Raphael Rochet. Original copyright, author, translation and SPDX notices remain intact.

Modifications by vanastasis, 2026-11-26.

Licensed under the GNU General Public License, version 3 or later (GPL-3.0-or-later). See [COPYING](COPYING) for full terms. Provided without warranty.
