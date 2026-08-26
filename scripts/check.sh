#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT"

echo "[1/6] manifest"

python3 -m json.tool \
  extension/manifest.json \
  >/dev/null

echo "[2/6] python"

python3 -m py_compile \
  native/chatdock_native.py

echo "[3/6] javascript"

if command -v node >/dev/null 2>&1; then

  node --check \
    extension/background.js

  node --check \
    extension/content.js

else

  echo "node not installed; JS syntax check skipped"

fi

echo "[4/6] shell"

bash -n scripts/build.sh
bash -n scripts/install.sh
bash -n scripts/bootstrap.sh
bash -n scripts/uninstall.sh
bash -n scripts/check.sh
bash -n scripts/build-companion-deb.sh
bash -n scripts/companion-bootstrap.sh
bash -n scripts/install-companion.sh
bash -n packaging/linux/companion-wrapper.sh
bash -n packaging/linux/register-native-hosts.sh

echo "[5/6] git whitespace"

git diff --check

echo "[6/6] private-data scan"

python3 - <<'PY'
from pathlib import Path
import re
import sys


ROOT = Path(".")


# Patterns are intentionally assembled from fragments so the scanner
# does not match its own source text.
patterns = [
    (
        "private key",
        re.compile(
            "BEGIN "
            + r"[A-Z ]*"
            + "PRIVATE KEY"
        ),
    ),
    (
        "classic GitHub token",
        re.compile(
            "gh"
            + "p_"
            + r"[A-Za-z0-9]{20,}"
        ),
    ),
    (
        "fine-grained GitHub token",
        re.compile(
            "github"
            + "_pat_"
            + r"[A-Za-z0-9_]{20,}"
        ),
    ),
    (
        "possible API secret",
        re.compile(
            "s"
            + "k-"
            + r"[A-Za-z0-9]{20,}"
        ),
    ),
    (
        "personal absolute home path",
        re.compile(
            "/home/"
            + "mst"
            + "f(?:/|$)"
        ),
    ),
    (
        "personal Tailscale IP",
        re.compile(
            r"100\."
            + r"101\."
            + r"72\."
            + r"61"
        ),
    ),
    (
        "personal tailnet name",
        re.compile(
            "tail"
            + "27239e"
        ),
    ),
]


skip_dirs = {
    ".git",
    "__pycache__",
    "dist",
}


findings = []


for path in ROOT.rglob("*"):

    if not path.is_file():
        continue

    if any(
        part in skip_dirs
        for part in path.parts
    ):
        continue

    try:
        text = path.read_text(
            encoding="utf-8"
        )

    except (
        UnicodeDecodeError,
        OSError,
    ):
        continue

    for label, pattern in patterns:

        for match in pattern.finditer(text):

            line = (
                text.count(
                    "\n",
                    0,
                    match.start(),
                )
                + 1
            )

            findings.append(
                (
                    str(path),
                    line,
                    label,
                )
            )


if findings:

    print()
    print(
        "Possible private data found:"
    )

    for path, line, label in findings:
        print(
            f"  {path}:{line}: {label}"
        )

    sys.exit(1)


print(
    "Private-data scan clean."
)
PY

echo
echo "All checks passed."
