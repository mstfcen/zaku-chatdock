#!/usr/bin/env bash
set -euo pipefail

DEFAULT_CHROMIUM_ID="kfammjcbikfhjgamhmgndekklondeefc"
FIREFOX_ID="chatdock@zaku.local"

CHROMIUM_ID="${CHATDOCK_CHROMIUM_ID:-$DEFAULT_CHROMIUM_ID}"
HOST_PATH="${CHATDOCK_HOST_PATH:-/usr/bin/zaku-chatdock-companion}"

INSTALL_FIREFOX=1
INSTALL_CHROMIUM=1

usage() {
  cat <<TXT
Zaku ChatDock Native Messaging registrar

Usage:
  zaku-chatdock-register
  zaku-chatdock-register --chromium-id EXTENSION_ID
  zaku-chatdock-register --firefox-only
  zaku-chatdock-register --chromium-only
  zaku-chatdock-register --host-path /absolute/path

Default Chromium / Opera id:
  $DEFAULT_CHROMIUM_ID
TXT
}

while (($#)); do
  case "$1" in
    --chromium-id)
      test $# -ge 2 || {
        echo "Missing value for --chromium-id" >&2
        exit 2
      }

      CHROMIUM_ID="$2"
      shift 2
      ;;

    --host-path)
      test $# -ge 2 || {
        echo "Missing value for --host-path" >&2
        exit 2
      }

      HOST_PATH="$2"
      shift 2
      ;;

    --firefox-only)
      INSTALL_FIREFOX=1
      INSTALL_CHROMIUM=0
      shift
      ;;

    --chromium-only)
      INSTALL_FIREFOX=0
      INSTALL_CHROMIUM=1
      shift
      ;;

    --all-browsers)
      INSTALL_FIREFOX=1
      INSTALL_CHROMIUM=1
      shift
      ;;

    -h|--help)
      usage
      exit 0
      ;;

    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$HOST_PATH" != /* ]]; then
  echo "Native host path must be absolute:" >&2
  echo "  $HOST_PATH" >&2
  exit 2
fi

if [[ "$INSTALL_CHROMIUM" -eq 1 ]]    && [[ ! "$CHROMIUM_ID" =~ ^[a-p]{32}$ ]]
then
  echo "Invalid Chromium / Opera extension id:" >&2
  echo "  $CHROMIUM_ID" >&2
  exit 2
fi

if [[ "$INSTALL_FIREFOX" -eq 1 ]]; then
  FIREFOX_DIR="$HOME/.mozilla/native-messaging-hosts"

  mkdir -p "$FIREFOX_DIR"

  cat > "$FIREFOX_DIR/local.zaku.chatdock.json" <<JSON
{
  "name": "local.zaku.chatdock",
  "description": "Zaku ChatDock Companion",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_extensions": [
    "$FIREFOX_ID"
  ]
}
JSON

  python3 -m json.tool     "$FIREFOX_DIR/local.zaku.chatdock.json"     >/dev/null

  echo "Firefox: registered"
fi

if [[ "$INSTALL_CHROMIUM" -eq 1 ]]; then
  CHROMIUM_DIRS=(
    "$HOME/.config/chromium/NativeMessagingHosts"
    "$HOME/.config/google-chrome/NativeMessagingHosts"
    "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
    "$HOME/.config/google-chrome-unstable/NativeMessagingHosts"
    "$HOME/.config/opera/NativeMessagingHosts"
    "$HOME/.config/opera-beta/NativeMessagingHosts"
    "$HOME/.config/opera-developer/NativeMessagingHosts"
    "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "$HOME/.config/vivaldi/NativeMessagingHosts"
    "$HOME/.config/microsoft-edge/NativeMessagingHosts"
    "$HOME/.config/microsoft-edge-beta/NativeMessagingHosts"
    "$HOME/.config/microsoft-edge-dev/NativeMessagingHosts"
  )

  for dir in "${CHROMIUM_DIRS[@]}"; do
    mkdir -p "$dir"

    cat > "$dir/local.zaku.chatdock.json" <<JSON
{
  "name": "local.zaku.chatdock",
  "description": "Zaku ChatDock Companion",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$CHROMIUM_ID/"
  ]
}
JSON

    python3 -m json.tool       "$dir/local.zaku.chatdock.json"       >/dev/null
  done

  echo "Chromium / Chrome / Opera / Brave / Vivaldi / Edge: registered"
  echo "Extension id: $CHROMIUM_ID"
fi

echo "REGISTER_RESULT=PASS"
