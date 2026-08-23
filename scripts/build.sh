#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT"

VERSION="$(
python3 - <<'PY'
import json
with open("extension/manifest.json", encoding="utf-8") as f:
    print(json.load(f)["version"])
PY
)"

DIST="$ROOT/dist"
VENDOR="$ROOT/extension/vendor"

mkdir -p \
  "$DIST" \
  "$VENDOR"

echo "Preparing @xterm/xterm 6.0.0 from npm..."

npm ci \
  --ignore-scripts \
  --no-audit \
  --no-fund

XTERM_ROOT="$ROOT/node_modules/@xterm/xterm"

test -s "$XTERM_ROOT/lib/xterm.js"
test -s "$XTERM_ROOT/css/xterm.css"

cp \
  "$XTERM_ROOT/lib/xterm.js" \
  "$VENDOR/xterm.js"

cp \
  "$XTERM_ROOT/css/xterm.css" \
  "$VENDOR/xterm.css"

OUT="$DIST/Zaku-ChatDock-v${VERSION}.xpi"

rm -f "$OUT"

(
  cd extension

  zip -qr \
    "$OUT" \
    . \
    -x '*.DS_Store'
)

test -s "$OUT"

echo "BUILT: $OUT"
