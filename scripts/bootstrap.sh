#!/usr/bin/env bash
set -euo pipefail

SOURCE="$HOME/.local/src/zaku-chatdock"
TMP="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP"
}

trap cleanup EXIT

echo "========================================"
echo " Zaku ChatDock quick installer"
echo "========================================"
echo

command -v curl >/dev/null 2>&1 || {
  echo "curl is required."
  exit 1
}

command -v tar >/dev/null 2>&1 || {
  echo "tar is required."
  exit 1
}

echo "Downloading the latest public version..."

curl -fsSL --retry 3 \
  "https://github.com/mstfcen/zaku-chatdock/archive/refs/heads/main.tar.gz" \
  -o "$TMP/chatdock.tar.gz"

tar -xzf \
  "$TMP/chatdock.tar.gz" \
  -C "$TMP"

rm -rf "$SOURCE"
mkdir -p "$(dirname "$SOURCE")"

mv \
  "$TMP/zaku-chatdock-main" \
  "$SOURCE"

trap - EXIT
rm -rf "$TMP"

exec \
  "$SOURCE/scripts/install.sh"
