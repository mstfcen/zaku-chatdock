#!/usr/bin/env bash
set -euo pipefail

MANIFESTS=(
  "$HOME/.mozilla/native-messaging-hosts/local.zaku.chatdock.json"
  "$HOME/.config/chromium/NativeMessagingHosts/local.zaku.chatdock.json"
  "$HOME/.config/google-chrome/NativeMessagingHosts/local.zaku.chatdock.json"
  "$HOME/.config/google-chrome-beta/NativeMessagingHosts/local.zaku.chatdock.json"
  "$HOME/.config/opera/NativeMessagingHosts/local.zaku.chatdock.json"
  "$HOME/.config/opera-beta/NativeMessagingHosts/local.zaku.chatdock.json"
  "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/local.zaku.chatdock.json"
)

for manifest in "${MANIFESTS[@]}"; do
  rm -f "$manifest"
done

rm -f \
  "$HOME/.local/share/zaku-chatdock/chatdock_native.py"

echo "ChatDock Companion removed."
echo
echo "Preserved intentionally:"
echo "  ~/.config/zaku-chatdock/"
echo "  tmux sessions"
echo
echo "Remove browser extensions separately from the browser."
