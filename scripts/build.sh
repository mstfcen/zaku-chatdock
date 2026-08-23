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
print(
    json.load(
        open(
            "extension/manifest.json",
            encoding="utf-8",
        )
    )["version"]
)
PY
)"

DIST="$ROOT/dist"
WORK="$DIST/build"
UNPACKED="$DIST/unpacked"

mkdir -p \
  "$DIST" \
  "$WORK" \
  "$UNPACKED"

rm -rf \
  "$WORK/firefox-dev" \
  "$WORK/firefox-stable" \
  "$WORK/chromium" \
  "$UNPACKED/firefox-dev" \
  "$UNPACKED/firefox-stable" \
  "$UNPACKED/chromium"

echo "Preparing @xterm/xterm 6.0.0 from npm..."

npm ci \
  --ignore-scripts \
  --no-audit \
  --no-fund

XTERM_ROOT="$ROOT/node_modules/@xterm/xterm"

test -s "$XTERM_ROOT/lib/xterm.js"
test -s "$XTERM_ROOT/css/xterm.css"

prepare_tree() {
  local target="$1"

  mkdir -p \
    "$WORK/$target"

  cp -a \
    "$ROOT/extension/." \
    "$WORK/$target/"

  rm -f \
    "$WORK/$target"/*.bak \
    "$WORK/$target"/*.backup \
    "$WORK/$target"/*.pre-* \
    2>/dev/null || true

  mkdir -p \
    "$WORK/$target/vendor"

  cp \
    "$XTERM_ROOT/lib/xterm.js" \
    "$WORK/$target/vendor/xterm.js"

  cp \
    "$XTERM_ROOT/css/xterm.css" \
    "$WORK/$target/vendor/xterm.css"
}

prepare_tree firefox-dev
prepare_tree firefox-stable
prepare_tree chromium

python3 - \
  "$WORK/firefox-dev/manifest.json" \
  "$WORK/firefox-stable/manifest.json" \
  "$WORK/chromium/manifest.json" \
  "$ROOT/config/chromium-dev-public-key.txt" <<'PY'
from pathlib import Path
import json
import sys

dev_path = Path(sys.argv[1])
stable_path = Path(sys.argv[2])
chromium_path = Path(sys.argv[3])
chromium_key_path = Path(sys.argv[4])

base = json.loads(
    dev_path.read_text(
        encoding="utf-8"
    )
)

# --------------------------------------------------
# Firefox dev/self-hosted:
# keeps gecko.update_url.
# --------------------------------------------------
dev = json.loads(
    json.dumps(base)
)

dev_path.write_text(
    json.dumps(
        dev,
        indent=2,
        ensure_ascii=False,
    )
    + "\n",
    encoding="utf-8",
)

# --------------------------------------------------
# Firefox stable/AMO Listed:
# AMO owns extension updates, therefore no update_url.
# --------------------------------------------------
stable = json.loads(
    json.dumps(base)
)

gecko = (
    stable
    .get(
        "browser_specific_settings",
        {}
    )
    .get(
        "gecko",
        {}
    )
)

gecko.pop(
    "update_url",
    None,
)

stable_path.write_text(
    json.dumps(
        stable,
        indent=2,
        ensure_ascii=False,
    )
    + "\n",
    encoding="utf-8",
)

# --------------------------------------------------
# Chromium / Opera development build.
# Common extension logic; Chromium MV3 service worker.
# Fixed public key gives unpacked builds a deterministic
# development extension id for Native Messaging.
# --------------------------------------------------
chromium = json.loads(
    json.dumps(base)
)

chromium.pop(
    "browser_specific_settings",
    None,
)

chromium["background"] = {
    "service_worker":
        "background.js"
}

chromium["key"] = (
    chromium_key_path
    .read_text(
        encoding="utf-8"
    )
    .strip()
)

chromium_path.write_text(
    json.dumps(
        chromium,
        indent=2,
        ensure_ascii=False,
    )
    + "\n",
    encoding="utf-8",
)
PY

# Copy unpacked development trees for browser testing.
cp -a \
  "$WORK/firefox-dev/." \
  "$UNPACKED/firefox-dev/"

cp -a \
  "$WORK/firefox-stable/." \
  "$UNPACKED/firefox-stable/"

cp -a \
  "$WORK/chromium/." \
  "$UNPACKED/chromium/"

FIREFOX_DEV="$DIST/Zaku-ChatDock-Firefox-Dev-v${VERSION}.xpi"
FIREFOX_STABLE="$DIST/Zaku-ChatDock-Firefox-Stable-v${VERSION}.xpi"
CHROMIUM="$DIST/Zaku-ChatDock-Chromium-v${VERSION}.zip"

# Backward-compatible filename used by the current
# self-hosted signing workflow.
LEGACY="$DIST/Zaku-ChatDock-v${VERSION}.xpi"

rm -f \
  "$FIREFOX_DEV" \
  "$FIREFOX_STABLE" \
  "$CHROMIUM" \
  "$LEGACY"

(
  cd "$WORK/firefox-dev"
  zip -qr \
    "$FIREFOX_DEV" \
    . \
    -x '*.DS_Store'
)

(
  cd "$WORK/firefox-stable"
  zip -qr \
    "$FIREFOX_STABLE" \
    . \
    -x '*.DS_Store'
)

(
  cd "$WORK/chromium"
  zip -qr \
    "$CHROMIUM" \
    . \
    -x '*.DS_Store'
)

cp \
  "$FIREFOX_DEV" \
  "$LEGACY"

test -s "$FIREFOX_DEV"
test -s "$FIREFOX_STABLE"
test -s "$CHROMIUM"
test -s "$LEGACY"

echo "BUILT:"
echo "  Firefox dev:    $FIREFOX_DEV"
echo "  Firefox stable: $FIREFOX_STABLE"
echo "  Chromium/Opera: $CHROMIUM"
echo "  Legacy alias:   $LEGACY"
echo
echo "UNPACKED:"
echo "  $UNPACKED/firefox-dev"
echo "  $UNPACKED/firefox-stable"
echo "  $UNPACKED/chromium"
