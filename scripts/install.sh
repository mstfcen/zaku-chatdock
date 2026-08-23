#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

echo "========================================"
echo " Zaku ChatDock developer installer"
echo "========================================"
echo

"$ROOT/scripts/install-companion.sh" "$@"

echo
echo "Building browser packages..."
"$ROOT/scripts/build.sh"

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

echo
echo "========================================"
echo " Browser packages ready"
echo "========================================"
echo
echo "Firefox development XPI:"
echo "  $ROOT/dist/Zaku-ChatDock-Firefox-Dev-v${VERSION}.xpi"
echo
echo "Firefox AMO-listed candidate:"
echo "  $ROOT/dist/Zaku-ChatDock-Firefox-Stable-v${VERSION}.xpi"
echo
echo "Chromium / Opera development ZIP:"
echo "  $ROOT/dist/Zaku-ChatDock-Chromium-v${VERSION}.zip"
echo
echo "Unpacked Chromium / Opera extension:"
echo "  $ROOT/dist/unpacked/chromium"
