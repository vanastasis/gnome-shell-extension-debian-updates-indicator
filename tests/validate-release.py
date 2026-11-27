#!/usr/bin/env python3
"""Read-only release checks. Package manager and elevation are always mocked."""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

root = pathlib.Path(sys.argv[1])
meta = json.loads((root / "metadata.json").read_text())
assert meta["uuid"] == root.name
assert meta["shell-version"] == ["48", "49", "50", "51"]
assert re.fullmatch(r"\d+(?:\.\d+)+", meta["version-name"])
for p in [*root.rglob("*.js"), *root.rglob("*.sh"), *root.rglob("*.ui"),
          *root.rglob("*.xml"), root / "metadata.json", pathlib.Path("README.md")]:
    assert not re.search(r"java[\s._-]*computers|2\.7\.0-JAVA", p.read_text(), re.I), p

source = (root / "updateManager.js").read_text()
body = source.split("_nalaCompatibleCommand(action, purge = false) {", 1)[1]
body = body.split("const script = [", 1)[1].split("].join(", 1)[0]
script = "\n".join(json.loads(line.strip().rstrip(",")) for line in body.splitlines() if line.strip())
with tempfile.TemporaryDirectory() as tmp:
    d = pathlib.Path(tmp)
    for name, contents in {
        "nala": '#!/bin/bash\nprintf "%s\\n" "$FAKE_HELP"; exit "\${FAKE_HELP_RC:-0}"\n',
        "apt-get": '#!/bin/bash\nprintf "simulation\\n"\n',
        "dpkg-query": '#!/bin/bash\nprintf "rc \\tlibexample:amd64\\n"\n',
        "pkexec": '#!/bin/bash\nprintf "%s\\n" "$@" > "$CALL_LOG"; exit "\${FAKE_EXIT:-0}"\n',
    }.items():
        path = d / name
        path.write_text(contents.replace(r"\$", "$"))
        path.chmod(0o700)
    for name in ("nala", "apt-get"):
        script = script.replace("/usr/bin/" + name, str(d / name))
    subprocess.run(["bash", "-n", "-c", script], check=True)
    def run(action, purge, help_text, expected, answer="y\n", rc=0, help_rc=0, exit_rc=0):
        log = d / "called"
        log.unlink(missing_ok=True)
        env = dict(os.environ, PATH=str(d) + ":/usr/bin:/bin", FAKE_HELP=help_text,
                   FAKE_HELP_RC=str(help_rc), FAKE_EXIT=str(exit_rc), CALL_LOG=str(log))
        p = subprocess.run(["bash", "-c", script, "test", action, str(purge).lower()],
                           input=answer, text=True, capture_output=True, env=env, timeout=10)
        assert p.returncode == rc, (p.returncode, p.stdout, p.stderr)
        actual = log.read_text().splitlines()[1:] if log.exists() else None
        assert actual == expected, (actual, expected)
    for flag in ("--no-autoremove", "--no-auto-remove"):
        run("full-upgrade", False, flag, ["full-upgrade", "--assume-yes", flag])
    for flag in ("--config", "--remove-config"):
        run("autoremove", True, flag, ["autoremove", "--option", "Nala::assume_yes=false", "--purge", flag])
    run("autoremove", False, "", ["autoremove", "--option", "Nala::assume_yes=false"])
    run("autoremove", True, "--config-file", None, rc=2)
    run("full-upgrade", False, "--auto-remove", None, rc=2)
    run("autoremove", True, "--config", None, answer="n\n")
    run("full-upgrade", False, "--no-auto-remove", None, rc=2, help_rc=1)
    run("full-upgrade", False, "--no-auto-remove",
        ["full-upgrade", "--assume-yes", "--no-auto-remove"], rc=7, exit_rc=7)
print("Metadata, active branding and 10 mocked Nala command cases passed.")
