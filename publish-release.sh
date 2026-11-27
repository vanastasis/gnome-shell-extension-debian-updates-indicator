#!/usr/bin/env bash
set -Eeuo pipefail
UUID='debian-updates-indicator@vanastasis.github.com'
usage() {
    printf 'Usage: %s VERSION [RELEASE_NOTES_FILE]\n' "${0##*/}"
    printf 'Example: %s 2.7.0.4 ./release-notes.md\n' "${0##*/}"
    printf 'For the first 2.7.0.3 release, built-in feature notes are available.\n'
    printf 'For future releases, provide a notes file or add a matching CHANGELOG.md heading.\n'
}
if [[ ${1:-} == --help || ${1:-} == -h ]]; then usage; exit 0; fi
[[ $# -ge 1 && $# -le 2 ]] || { usage >&2; exit 2; }
VERSION=$1
[[ $VERSION =~ ^[0-9]+(\.[0-9]+)+$ ]] || { echo 'Use a numeric dot-separated version.' >&2; exit 2; }
NOTES_FILE=''
if [[ $# == 2 ]]; then
    NOTES_FILE=$(realpath "$2")
    [[ -s "$NOTES_FILE" ]] || { echo 'Release notes file is missing or empty.' >&2; exit 2; }
fi
TAG="v$VERSION"
REPO='vanastasis/gnome-shell-extension-debian-updates-indicator'
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel)
ZIP="$UUID.shell-extension.zip"
cd "$ROOT"
for cmd in git gh python3 meson glib-compile-schemas zip unzip sha256sum gnome-extensions msgfmt bash; do
    command -v "$cmd" >/dev/null || { echo "Required command missing: $cmd" >&2; exit 1; }
done
[[ $(git branch --show-current) == main ]] || { echo 'Expected main branch.' >&2; exit 1; }
case "$(git remote get-url github)" in
    git@github.com:vanastasis/gnome-shell-extension-debian-updates-indicator.git|https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator.git) ;;
    *) echo 'Unexpected github remote; refusing to publish.' >&2; exit 1;;
esac
gh auth status --hostname github.com
git fetch github main --tags
[[ $(git rev-parse HEAD) == $(git rev-parse github/main) ]] || { echo 'Local HEAD and remote main differ. Resolve before publishing.' >&2; exit 1; }
# Existing staged changes are deliberately included; review them below.
[[ -z $(git ls-files -- zip-files _build) ]] || { echo 'Generated files are tracked; remove them from the index before publishing.' >&2; exit 1; }
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then echo "Tag $TAG already exists; refusing to overwrite." >&2; exit 1; fi
if [[ -n $(git ls-remote --tags github "refs/tags/$TAG") ]]; then echo "Remote tag $TAG already exists; refusing to overwrite." >&2; exit 1; fi
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then echo "Release $TAG already exists; refusing to overwrite." >&2; exit 1; fi
WORK=$(mktemp -d)
trap 'rm -rf -- "$WORK"' EXIT
BACKUP="$HOME/.cache/debian-updates-indicator-backups/release-$VERSION-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$BACKUP"
for f in README.md CHANGELOG.md meson.build "$UUID/metadata.json"; do cp --parents "$f" "$BACKUP"; done
export UUID VERSION TAG NOTES_FILE
python3 - <<'PY'
import json, os, pathlib, re
u, v, tag = (os.environ[x] for x in ('UUID','VERSION','TAG'))
root=pathlib.Path(u)
if v == '2.7.0.3':
    m=(root/'updateManager.js').read_text()
    p=(root/'prefs.js').read_text()
    i=(root/'indicator.js').read_text()
    ui=(root/'ui/prefs_advanced_adw1.ui').read_text()
    for marker in ('_defaultPackageTerminal()', '_removeUnusedPackages()', 'full-upgrade', '--no-auto-remove', 'xdg-terminal-exec', 'x-terminal-emulator', 'Press any key to exit', 'autoremove'):
        if marker not in m: raise SystemExit(f'Expected local feature missing: {marker}')
    for marker in ('APT - Default Terminal','Nala - XFCE Terminal','APT-get - Default Terminal','cleanup_cmd_options'):
        if marker not in ui: raise SystemExit(f'Expected settings missing: {marker}')
    assert 'removeUnusedMenuItem' in i and 'cleanup-cmd-options' in p, 'Cleanup action/preferences missing'
meta=root/'metadata.json'; d=json.loads(meta.read_text()); assert d['uuid']==u
assert isinstance(d.get('shell-version'),list) and d['shell-version'], 'Missing GNOME compatibility list'
d['name']='Debian APT Updates Indicator'; d['version-name']=v
# GNOME assigns its own numeric version during publication.
d.pop('version',None)
if v == '2.7.0.3':
    d['description']='Monitor APT package updates on Debian and Debian-based distributions.\n\nFeatures:\n• Available updates and optional critical-update notifications.\n• New, local/obsolete, residual configuration and autoremovable packages.\n• Manual and automatic update checks with hourly, daily or weekly intervals.\n• Apply updates and Remove unused packages as separate menu actions.\n• Built-in APT and APT-get presets using the default terminal.\n• Nala presets using XFCE Terminal, graphical authentication and a press-any-key exit prompt.\n• Nala upgrades confirm automatically without automatic autoremove; cleanup remains interactive.\n• Custom update and cleanup commands, ignore list and last-check timestamp.\n\nMaintained by vanastasis. GNOME Shell 51.'
meson=pathlib.Path('meson.build'); ms,n=re.subn(r"(?m)^(\s*version:\s*)'[^']+'",lambda x:x[1]+repr(v),meson.read_text(),count=1); assert n==1
readme=pathlib.Path('README.md'); old=readme.read_text()
ch=pathlib.Path('CHANGELOG.md'); c=ch.read_text(); assert c.startswith('# Changelog\n')
from datetime import date
release_date=date.today().isoformat()
if v == '2.7.0.3':
    attribution=old[old.index('## Attribution and licence'):]
    base='https://github.com/vanastasis/gnome-shell-extension-debian-updates-indicator'
    r=f'''# Debian APT Updates Indicator

**Maintained by [vanastasis](https://github.com/vanastasis)**

A GNOME Shell panel extension for monitoring and managing APT package updates on Debian and Debian-based Linux distributions.

**Version:** `{v}` | **GNOME Shell:** 51 | **Licence:** GPL-3.0-or-later

## What's new in {v}

- **Remove unused packages:** separate, manually triggered menu action immediately below Apply updates.
- **APT and APT-get presets:** use the desktop-configured terminal (`xdg-terminal-exec`) or Debian's `x-terminal-emulator` alternative.
- **Nala – XFCE Terminal:** presets for both updates and cleanup, with graphical Polkit authentication.
- Nala full upgrades automatically confirm prompts and disable automatic autoremove. Cleanup requires manual package confirmation; no automatic `-y` is supplied.
- Built-in terminal presets display an exit status and a press-any-key prompt before closing. Package lists refresh when the launcher finishes; a terminal that detaches may finish tracking earlier.
- Independent custom commands and terminal preferences, operation guards and error notifications.

## Features

- Available updates and optional critical-update notifications.
- New packages in repositories, local/obsolete packages, residual configuration files and autoremovable packages.
- Manual and automatic update checks with hourly, daily or weekly intervals.
- Configurable refresh commands, ignore list and last-check timestamp.
- GNOME Shell 51 panel-layout compatibility and corrected timer lifecycle.
- Existing settings and translations retained; new strings may appear in English until translated.

## Advanced settings

| Method | Apply updates | Remove unused packages |
| --- | --- | --- |
| APT – Default Terminal | `apt full-upgrade -o APT::Get::AutomaticRemove=false` | `apt autoremove` |
| APT-get – Default Terminal | `apt-get dist-upgrade -o APT::Get::AutomaticRemove=false` | `apt-get autoremove` |
| Nala – XFCE Terminal | `nala full-upgrade --assume-yes --no-auto-remove` | `nala autoremove` |
| Custom | User-defined | User-defined |
| GNOME Software, Synaptic, PackageKit, Ubuntu Update Manager | GUI update methods | — |

Built-in terminal commands use `pkexec`. Install Nala and `xfce4-terminal` to use the Nala presets. Full upgrades can still remove conflicting packages to resolve dependencies; disabling autoremove is not a guarantee against all removals. Automatic checks do not automatically install upgrades or run cleanup.

## Compatibility

GNOME Shell 51 is the declared compatibility target. Earlier versions are not declared supported by this release. Build and schema validation do not establish live runtime compatibility for every terminal or distribution.

## Installation

Download the installable ZIP from [GitHub Releases]({base}/releases):

`{u}.shell-extension.zip`

Do not use GitHub's automatically generated source archive as an installable extension. The GitHub release asset includes compiled schemas and translations.

```bash
gnome-extensions install --force "{u}.shell-extension.zip"
```

Alternatively, manually extract the GitHub release ZIP into `~/.local/share/gnome-shell/extensions/{u}/`.

If replacing the upstream extension, disable the old UUID first; both share a GSettings schema. On Wayland, log out and back in if the old JavaScript is still cached, then enable the extension:

```bash
gnome-extensions enable {u}
gnome-extensions info {u}
```

A separate GNOME Extensions submission archive omits the compiled GSettings schema. Publication on extensions.gnome.org is subject to review; GitHub publication does not automatically update that listing.

## Build from source

```bash
sudo apt install git meson ninja-build gettext libglib2.0-bin
git clone --branch main {base}.git
cd gnome-shell-extension-debian-updates-indicator
meson setup --prefix="$HOME/.local" _build
meson compile -C _build
meson install -C _build
```

## Changes and support

- [Changelog](CHANGELOG.md)
- [GitHub releases]({base}/releases)
- [Report an issue]({base}/issues)
- [Contribute a change]({base}/pulls)

The maintained branch is `main`. Other imported branches are historical.

'''+attribution
    notes=f'''## {v} — {release_date}

- Add a separate Remove unused packages panel action and independent cleanup preferences.
- Add APT and APT-get presets using desktop/default Debian terminal detection, and Nala presets using XFCE Terminal, for both updates and cleanup.
- Use graphical Polkit authentication, exit-status reporting and a press-any-key prompt for built-in terminal presets.
- Automatically confirm Nala full upgrades without automatic autoremove; keep cleanup manually initiated and interactive.
- Improve package operation guards, command argument parsing, completion refresh and error notifications.
- Update README, extension description and release packaging; retain GNOME Shell 51 as the declared target.
- Use dot-separated version names for GNOME Extensions compatibility.

'''
else:
    r,n=re.subn(r'(?m)^(\*\*Version:\*\*\s*)`[^`]+`',lambda m:m[1]+'`'+v+'`',old,count=1)
    if n!=1: raise SystemExit('README version marker missing; update README before release.')
    notes=None
if os.environ['NOTES_FILE']:
    body=pathlib.Path(os.environ['NOTES_FILE']).read_text().strip()
    notes=f'## {v} — {release_date}\n\n{body}\n\n'
heading=re.compile(r'(?m)^## '+re.escape(v)+r'(?:[^\S\n][^\n]*)?$')
if not heading.search(c):
    if notes is None: raise SystemExit('Add release notes to CHANGELOG.md or pass a notes file.')
    c=c.replace('# Changelog\n\n','# Changelog\n\n'+notes,1)
if v != '2.7.0.3' or os.environ['NOTES_FILE']:
    section=heading.search(c)
    body=c[section.end():].split('\n## ',1)[0].strip()
    if not body: raise SystemExit('Release notes are empty.')
    new_section=f"## What's new in {v}\n\n{body}\n\n"
    r,n=re.subn(r"(?ms)^## What's new in [^\n]+\n.*?(?=^## |\Z)",lambda _:new_section,r,count=1)
    if n==0:
        match=re.search(r'(?m)^## ',r)
        if not match: raise SystemExit('README has no section heading.')
        r=r[:match.start()]+new_section+r[match.start():]
if '## Publish a release' not in r:
    section='''## Publish a release (maintainers)

From the repository root, run `./publish-release.sh VERSION release-notes.md` after reviewing local changes. The script stages tracked edits and builds from the staged source, installs locally, pushes to GitHub and creates a release with the GitHub ZIP and checksum. Stage any new source files explicitly first. The separate EGO ZIP is generated for manual submission.

'''
    r=r.replace('## Changes and support',section+'## Changes and support',1)
meta.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n'); meson.write_text(ms); readme.write_text(r); ch.write_text(c)
PY
echo "Documentation and version updated. Backup: $BACKUP"
git diff --check
# Include tracked edits and this reusable script; stage additional new source files manually first.
git add -u -- .
git add -- publish-release.sh
if git diff --cached --quiet; then
    echo 'No staged changes: packaging the already committed source.'
fi
if [[ -n $(git ls-files -- zip-files _build) ]]; then echo 'Generated output must not be staged.' >&2; exit 1; fi
git diff --cached --check
git diff --cached --stat
printf '\nReview staged changes above. Untracked files will not be published:\n'
git ls-files --others --exclude-standard
read -r -p "Build and publish $TAG to GitHub main? [y/N] " answer
[[ $answer == y || $answer == Y ]] || { echo 'Cancelled. Local changes remain staged.'; exit 1; }
mkdir -p "$WORK/source"
STAGED_TREE=$(git write-tree)
git checkout-index --all --prefix="$WORK/source/"
cd "$WORK/source"
# Static validation; do not execute package operations.
python3 - "$UUID" <<'PY'
import pathlib, sys, xml.etree.ElementTree as ET
r=pathlib.Path(sys.argv[1]);
for f in [*r.glob('schemas/*.xml'),*r.glob('ui/*.ui')]: ET.parse(f)
PY
glib-compile-schemas --strict --dry-run "$UUID/schemas"
if command -v node >/dev/null || command -v nodejs >/dev/null; then
    NODE=$(command -v node || command -v nodejs)
    for f in "$UUID"/*.js; do cp "$f" "$WORK/check.mjs"; "$NODE" --check "$WORK/check.mjs"; done
else
    echo 'Node.js is required for strict JavaScript validation. Install nodejs and retry.' >&2
    exit 1
fi
for script in ./*.sh "$UUID"/scripts/*.sh; do bash -n "$script"; done
for catalog in po/*.po; do msgfmt --check-format -o /dev/null "$catalog"; done
python3 tests/validate-release.py "$UUID"
"$NODE" tests/validate-refresh.cjs "$UUID"
meson setup "$WORK/build" "$WORK/source" --prefix="$WORK/install" --datadir=share
meson compile -C "$WORK/build"
meson install -C "$WORK/build"
EXT="$WORK/install/share/gnome-shell/extensions/$UUID"
cp COPYING "$EXT/"
[[ -s "$EXT/schemas/gschemas.compiled" ]]
[[ -s "$EXT/metadata.json" && -s "$EXT/extension.js" ]]
mkdir -p "$WORK/github" "$WORK/ego" "$ROOT/zip-files/ego"
(cd "$EXT"; zip -qr "$WORK/github/$ZIP" .)
cp "$WORK/github/$ZIP" "$WORK/ego/$ZIP"
zip -dq "$WORK/ego/$ZIP" schemas/gschemas.compiled
python3 - "$WORK" "$ZIP" "$VERSION" <<'PY'
import json, pathlib, sys, zipfile
root=pathlib.Path(sys.argv[1]); name,version=sys.argv[2:]
with zipfile.ZipFile(root/'github'/name) as g, zipfile.ZipFile(root/'ego'/name) as e:
    assert g.testzip() is None and e.testzip() is None
    assert json.loads(g.read('metadata.json'))['version-name']==version
    assert set(g.namelist())-set(e.namelist())=={'schemas/gschemas.compiled'}
    assert not set(e.namelist())-set(g.namelist())
    assert all(g.read(n)==e.read(n) for n in e.namelist())
    assert any(n.endswith('.mo') for n in g.namelist())
    assert all(n in g.namelist() for n in ('COPYING','extension.js','updateManager.js','prefs.js','indicator.js','metadata.json'))
print('Both ZIPs verified; only compiled schema differs.')
PY
REPORT="$ROOT/zip-files/validation/$VERSION"
mkdir -p "$REPORT"
rm -f -- "$REPORT/review.txt" "$REPORT/validation.txt"
if command -v shexli >/dev/null; then
    SHEXLI=$(command -v shexli)
elif [[ -x "$HOME/.venvs/shexli/bin/shexli" ]]; then
    SHEXLI="$HOME/.venvs/shexli/bin/shexli"
else
    echo 'Shexli is required. Install it in a virtual environment or put it on PATH.' >&2
    exit 1
fi
SHEXLI_RC=0
"$SHEXLI" "$WORK/ego/$ZIP" --format json > "$REPORT/shexli.json" 2> "$REPORT/shexli.stderr" || SHEXLI_RC=$?
python3 - "$REPORT/shexli.json" "$SHEXLI_RC" <<'PY'
import json, pathlib, sys
report = json.loads(pathlib.Path(sys.argv[1]).read_text())
findings = report['findings']
if not isinstance(findings, list) or report.get('summary', {}).get('status') not in ('clean', 'ok', 'issues_found', 'passed', 'no_issues'):
    raise SystemExit('Unrecognized Shexli report; inspect validation directory.')
for f in findings:
    print(f"{f['rule_id']} [{f['severity']}]: {f['message']}")
if any(f['severity'] == 'error' and f['rule_id'] != 'EGO-M-004' for f in findings):
    raise SystemExit('Shexli found blocking errors. Correct them before publishing.')
if int(sys.argv[2]) != 0 and not findings:
    raise SystemExit('Shexli failed without findings.')
PY
if python3 - "$REPORT/shexli.json" <<'PY'
import json, sys
sys.exit(0 if json.load(open(sys.argv[1]))['findings'] else 1)
PY
then
    printf '\nReview Shexli findings in %s. Only proceed after verifying them.\n' "$REPORT"
    read -r -p 'Type REVIEWED to acknowledge the findings: ' reviewed
    [[ $reviewed == REVIEWED ]] || { echo 'Release blocked by unreviewed findings.' >&2; exit 1; }
    printf 'Findings explicitly acknowledged.\n' > "$REPORT/review.txt"
fi
printf 'Version %s\nSource tree %s\nJavaScript, Bash, XML, GSettings, translation format, Nala simulations, refresh regression tests and ZIP checks passed.\n' "$VERSION" "$STAGED_TREE" > "$REPORT/validation.txt"
for variant in github ego; do (cd "$WORK/$variant"; sha256sum "$ZIP" > "$ZIP.sha256"); done
cp "$WORK/github/$ZIP" "$WORK/github/$ZIP.sha256" "$ROOT/zip-files/"
cp "$WORK/ego/$ZIP" "$WORK/ego/$ZIP.sha256" "$ROOT/zip-files/ego/"
# Install the exact staged source locally. GNOME Wayland may retain cached modules.
if gnome-extensions list --enabled | grep -Fxq "$UUID"; then gnome-extensions disable "$UUID"; fi
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
mkdir -p "$DEST"
cp -a "$EXT/." "$DEST/"
gnome-extensions enable "$UUID"
cd "$ROOT"
# Refuse to publish if index or tracked files changed during the build.
[[ $(git write-tree) == "$STAGED_TREE" ]] || { echo 'Index changed during build; refusing to publish.' >&2; exit 1; }
git diff --quiet || { echo 'Tracked files changed during build; refusing to publish.' >&2; exit 1; }
if ! git diff --cached --quiet; then
    git commit -m "Release $VERSION"
fi
git push github main
# gh creates the tag at the exact pushed commit and uploads the verified assets.
if ! gh release create "$TAG" "$ROOT/zip-files/$ZIP" "$ROOT/zip-files/$ZIP.sha256" --repo "$REPO" --target "$(git rev-parse HEAD)" --title "Debian APT Updates Indicator $VERSION" --notes-file <(python3 - "$VERSION" <<'PY'
import pathlib,sys
import re
c=pathlib.Path('CHANGELOG.md').read_text(); m=re.search(r'(?m)^## '+re.escape(sys.argv[1])+r'(?:[^\S\n][^\n]*)?$',c); print(c[m.end():].split('\n## ',1)[0].strip())
PY
); then
    printf 'Git push succeeded, but release creation/upload failed. Inspect GitHub before retrying; do not run the full publisher again for this version.\n' >&2
    exit 1
fi
gh release view "$TAG" --repo "$REPO" --json url,tagName,assets
git status --short
printf '\nGitHub ZIP: %s\nGNOME upload ZIP: %s\n' "$ROOT/zip-files/$ZIP" "$ROOT/zip-files/ego/$ZIP"
echo 'GNOME Extensions upload and review are separate. No APT/Nala operation was executed.'
