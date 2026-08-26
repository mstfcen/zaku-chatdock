#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT"

VERSION="$(
python3 - <<'PY'
import re
from pathlib import Path

text=Path("native/chatdock_native.py").read_text(encoding="utf-8")

m=re.search(
    r'CHATDOCK_NATIVE_VERSION\s*=\s*["\']([^"\']+)["\']',
    text,
)

if not m:
    raise SystemExit("native version not found")

print(m.group(1))
PY
)"

EXT_ID="$(
  tr -d '[:space:]' \
    < config/chromium-dev-extension-id.txt
)"

if [[ ! "$EXT_ID" =~ ^[a-p]{32}$ ]]; then
  echo "Invalid Chromium extension id: $EXT_ID" >&2
  exit 1
fi

OUT_DIR="$ROOT/dist/companion"
mkdir -p "$OUT_DIR"

WORK="$(
  mktemp -d \
    "${TMPDIR:-/tmp}/zaku-chatdock-deb.XXXXXXXX"
)"

trap 'rm -rf "$WORK"' EXIT

PKG="$WORK/pkg"

mkdir -p \
  "$PKG/DEBIAN" \
  "$PKG/usr/bin" \
  "$PKG/usr/lib/zaku-chatdock" \
  "$PKG/usr/share/zaku-chatdock" \
  "$PKG/usr/share/doc/zaku-chatdock-companion" \
  "$PKG/etc/opt/chrome/native-messaging-hosts" \
  "$PKG/etc/chromium/native-messaging-hosts" \
  "$PKG/usr/lib/mozilla/native-messaging-hosts"

install -m 0755 \
  native/chatdock_native.py \
  "$PKG/usr/lib/zaku-chatdock/chatdock_native.py"

install -m 0755 \
  packaging/linux/companion-wrapper.sh \
  "$PKG/usr/bin/zaku-chatdock-companion"

install -m 0755 \
  packaging/linux/register-native-hosts.sh \
  "$PKG/usr/bin/zaku-chatdock-register"

if [[ -f config/config.example.json ]]; then
  install -m 0644 \
    config/config.example.json \
    "$PKG/usr/share/zaku-chatdock/config.example.json"
else
  printf '{}\n' \
    > "$PKG/usr/share/zaku-chatdock/config.example.json"
fi

cat > "$PKG/etc/opt/chrome/native-messaging-hosts/local.zaku.chatdock.json" <<JSON
{
  "name": "local.zaku.chatdock",
  "description": "Zaku ChatDock Companion",
  "path": "/usr/bin/zaku-chatdock-companion",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
JSON

cp \
  "$PKG/etc/opt/chrome/native-messaging-hosts/local.zaku.chatdock.json" \
  "$PKG/etc/chromium/native-messaging-hosts/local.zaku.chatdock.json"

cat > "$PKG/usr/lib/mozilla/native-messaging-hosts/local.zaku.chatdock.json" <<'JSON'
{
  "name": "local.zaku.chatdock",
  "description": "Zaku ChatDock Companion",
  "path": "/usr/bin/zaku-chatdock-companion",
  "type": "stdio",
  "allowed_extensions": [
    "chatdock@zaku.local"
  ]
}
JSON

for M in \
  "$PKG/etc/opt/chrome/native-messaging-hosts/local.zaku.chatdock.json" \
  "$PKG/etc/chromium/native-messaging-hosts/local.zaku.chatdock.json" \
  "$PKG/usr/lib/mozilla/native-messaging-hosts/local.zaku.chatdock.json"
do
  python3 -m json.tool "$M" >/dev/null
done

cat > "$PKG/usr/share/doc/zaku-chatdock-companion/README" <<TXT
Zaku ChatDock Companion $VERSION
=================================

This package installs the Linux Native Messaging bridge used by
Zaku ChatDock.

System host:
  /usr/bin/zaku-chatdock-companion

Chromium / Opera extension id:
  $EXT_ID

After installation restart the browser.

If an Opera Store build ever receives a different extension id:
  zaku-chatdock-register --chromium-id EXTENSION_ID

The runtime Python bridge is copied to:
  ~/.local/share/zaku-chatdock/chatdock_native.py

This intentionally keeps the native bridge user-writable so the
signed ChatDock native updater can continue to update it.

User config:
  ~/.config/zaku-chatdock/config.json
TXT

cat > "$PKG/DEBIAN/control" <<EOF_CONTROL
Package: zaku-chatdock-companion
Version: $VERSION
Section: utils
Priority: optional
Architecture: all
Maintainer: Zaku ChatDock <mstfcen@users.noreply.github.com>
Depends: python3, tmux, openssh-client
Homepage: https://github.com/mstfcen/zaku-chatdock
Description: Native Messaging companion for Zaku ChatDock
 Provides the local terminal and SSH bridge used by the Zaku ChatDock
 browser extension on Firefox and Chromium-family browsers including Opera.
EOF_CONTROL

cat > "$PKG/DEBIAN/postinst" <<'EOF_POSTINST'
#!/bin/sh
set -e

echo
echo "Zaku ChatDock Companion installed."
echo "Restart Firefox / Chromium / Chrome / Opera after installation."
echo

exit 0
EOF_POSTINST

chmod 0755 "$PKG/DEBIAN/postinst"

DEB="$OUT_DIR/zaku-chatdock-companion_${VERSION}_all.deb"

rm -f "$DEB" "$DEB.sha256"

dpkg-deb \
  --build \
  --root-owner-group \
  "$PKG" \
  "$DEB" \
  >/dev/null

(
  cd "$OUT_DIR"

  sha256sum \
    "$(basename "$DEB")" \
    > "$(basename "$DEB").sha256"
)

SHA="$(
  sha256sum "$DEB" \
    | awk '{print $1}'
)"

python3 - \
  "$OUT_DIR/latest.json" \
  "$VERSION" \
  "$DEB" \
  "$SHA" \
  "$EXT_ID" <<'PY'
import json
import sys
from pathlib import Path

out,version,deb,sha,ext_id=sys.argv[1:]

Path(out).write_text(
    json.dumps(
        {
            "version": version,
            "asset": Path(deb).name,
            "sha256": sha,
            "chromium_extension_id": ext_id,
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
PY

echo "VERSION=$VERSION"
echo "EXTENSION_ID=$EXT_ID"
echo "DEB=$DEB"
echo "SHA256=$SHA"
echo "BUILD_RESULT=PASS"
