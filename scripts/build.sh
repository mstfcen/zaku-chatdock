#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

EXT="$ROOT/extension"
DIST="$ROOT/dist"
TMP="$(mktemp -d)"

trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/vendor" "$DIST"

cp "$EXT/manifest.json" "$TMP/"
cp "$EXT/background.js" "$TMP/"
cp "$EXT/content.js" "$TMP/"

VERSION="$(
python3 - "$EXT/manifest.json" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))["version"])
PY
)"

echo "Downloading xterm.js 6.0.0..."

curl -fsSL --retry 3 \
  "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/lib/xterm.js" \
  -o "$TMP/vendor/xterm.js"

curl -fsSL --retry 3 \
  "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.css" \
  -o "$TMP/vendor/xterm.css"

OUT="$DIST/Zaku-ChatDock-v${VERSION}.xpi"

rm -f "$OUT"

python3 - "$TMP" "$OUT" <<'PY'
from pathlib import Path
import zipfile, sys

src = Path(sys.argv[1])
dst = Path(sys.argv[2])

with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(src.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(src))

print("BUILT:", dst)
PY
