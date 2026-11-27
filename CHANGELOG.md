# Changelog

## 2.7.0.7 — 2026-11-28

- Extend declared GNOME Shell compatibility to versions 48, 49, 50 and 51. The existing version-aware panel layout already uses the orientation API introduced in GNOME Shell 48.
- Retain APT, APT-get and Nala update and cleanup presets, optional residual configuration purging and existing preferences.
- Refresh translation catalog and build helper documentation using the neutral project identity; retain original licence and attribution.
- GNOME Shell 51 has been exercised by the maintainer; live testing of this release on GNOME Shell 48–50 remains outstanding.

## 2.7.0.6 — 2026-11-27

- Fix Nala residual configuration cleanup: use native `nala autoremove --purge --remove-config` instead of separately purging already-uninstalled packages.
- Run the Nala cleanup transaction even when no unused dependencies remain but residual configuration files exist.
- Retain the optional residual purge setting (disabled by default), manual cleanup confirmation, graphical authentication, XFCE Terminal integration and press-any-key exit.
- Retain APT/APT-get residual purge and default terminal detection, plus independent custom commands and package-list refresh.
- Update extension metadata, settings descriptions and documentation. Ordinary upgrades and automatic checks do not trigger cleanup.

## 2.7.0.5 — 2026-11-27

- Add **Also purge residual configuration files** in Advanced settings, disabled by default.
- Keep a single Remove unused packages action; enable it for residual-only cleanup when the option is on, even if the residual list is hidden.
- APT, APT-get and Nala autoremove presets add `--purge` when enabled. Existing residual configurations are detected again from dpkg and offered for explicit confirmation in the same terminal.
- Custom commands are not modified; additional residual purging uses APT-get. Automatic checks and upgrades do not trigger cleanup.
- Refresh package lists after the terminal operation finishes. GNOME Shell 51 runtime testing remains required.

## 2.7.0.4 — 2026-11-26

### Improvements

- Clarify cleanup menu availability when no unused packages are detected.
- Document independent update and cleanup operations.
- Retain APT, APT-get and Nala terminal integration.
- Include the latest local source improvements.
- Refresh project documentation and extension metadata.
- Retain GNOME Shell 51 compatibility.

### Distribution

- Installable GitHub release ZIP and SHA256 checksum.
- Separate GNOME Extensions submission ZIP.

## 2.7.0.3 — 2026-11-26

- Add a separate Remove unused packages panel action and independent cleanup preferences.
- Add APT and APT-get presets using desktop/default Debian terminal detection, and Nala presets using XFCE Terminal, for both updates and cleanup.
- Use graphical Polkit authentication, exit-status reporting and a press-any-key prompt for built-in terminal presets.
- Automatically confirm Nala full upgrades without automatic autoremove; keep cleanup manually initiated and interactive.
- Improve package operation guards, command argument parsing, completion refresh and error notifications.
- Update README, extension description and release packaging; retain GNOME Shell 51 as the declared target.
- Use dot-separated version names for GNOME Extensions compatibility.

## 2.7.0-1 — 2026-11-26

### Functional changes from upstream 2.7.0

- `indicator.js`: use `Clutter.Orientation.HORIZONTAL` for `St.BoxLayout` on GNOME Shell 48+ (GNOME 51 removes the legacy `vertical` property); retain `vertical: false` on GNOME 45–47.
- `updateManager.js`: initialise distinct `_initTimeoutId` and `_checkTimeoutId` instead of the unused `_TimeoutId`; cancel and clear both when rescheduling; use a one-shot initial callback (`GLib.SOURCE_REMOVE`) and a repeating periodic callback (`GLib.SOURCE_CONTINUE`).
- `updateManager.js`: apply the configured hours/days/weeks unit to recurring checks instead of always treating the interval as hours; guard network checks and timer callbacks against a destroyed indicator/monitor.
- `metadata.json`: add GNOME Shell 51 to the declared 45–51 compatibility range; set version-name `2.7.0-1`.
- Eighteen other runtime source files matched the imported upstream Git blobs exactly before branding changes. No APT scripts, preference UI or schema behavior changed.

### Fork identity and packaging

- New UUID `debian-updates-indicator@vanastasis.github.com`; existing GSettings schema ID/path and gettext domain retained. Disable the upstream UUID before enabling this fork.
- Update project name, project URLs, issue tracker, installation instructions and translation source paths to the GitHub fork. Remove upstream donation link from active metadata and README. Preserve original copyright and licence notices, original authors and translator credit.
- Align Meson project version with the fork release; remove the installed archive's generated numeric extension version (not present in upstream source). Exclude generated package lists, compiled schemas and translations from the source package; build these locally.
- Update project maintainer metadata and AUTHORS; retire the upstream GitLab-specific CI configuration on this GitHub fork.
- Report GNOME Shell 51 as maintainer-tested on Debian; GNOME 45–50 are declared compatible but not retested. GNOME 44 and earlier are not supported by this release.

### Verification

- The supplied working archive was compared to the GitHub-imported upstream `main` source. The two functional JavaScript changes were reconstructed against exact upstream Git blob hashes.
- JavaScript module syntax, Bash syntax, JSON and XML parsing passed for the rebranded payload. Live GNOME runtime and Meson build require verification on the maintainer's machine. The UUID rename has not been runtime-tested.
