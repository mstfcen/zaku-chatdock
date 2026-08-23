#!/usr/bin/env bash
set -euo pipefail

rm -f \
  "$HOME/.mozilla/native-messaging-hosts/local.zaku.chatdock.json"

rm -rf \
  "$HOME/.local/share/zaku-chatdock"

echo "Native ChatDock components removed."
echo "Remove the browser extension separately from about:addons."
