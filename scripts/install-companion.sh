#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

APP="$HOME/.local/share/zaku-chatdock"
CFG="$HOME/.config/zaku-chatdock"

FIREFOX_NMH="$HOME/.mozilla/native-messaging-hosts"

CHROMIUM_NMHS=(
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
  "$HOME/.config/opera/NativeMessagingHosts"
  "$HOME/.config/opera-beta/NativeMessagingHosts"
  "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
)

FIREFOX_ID="chatdock@zaku.local"

DEFAULT_CHROMIUM_ID="$(
  cat \
    "$ROOT/config/chromium-dev-extension-id.txt" \
    2>/dev/null \
  || true
)"

CHROMIUM_ID="$DEFAULT_CHROMIUM_ID"
INSTALL_CHROMIUM=0

usage() {
  cat <<TXT
Zaku ChatDock Companion installer

Usage:
  ./scripts/install-companion.sh
  ./scripts/install-companion.sh --all-browsers
  ./scripts/install-companion.sh --chromium-id EXTENSION_ID

Default:
  installs the Firefox Native Messaging host.

Options:
  --all-browsers
      Also installs Chromium/Chrome/Opera/Brave manifests.

  --chromium-id ID
      Chromium/Opera extension id to allow.
      Implies --all-browsers.

For the repository development build the deterministic id is:
  ${DEFAULT_CHROMIUM_ID:-unknown}
TXT
}

while (($#)); do
  case "$1" in
    --all-browsers)
      INSTALL_CHROMIUM=1
      shift
      ;;

    --chromium-id)
      test $# -ge 2 || {
        echo "Missing value for --chromium-id"
        exit 2
      }

      CHROMIUM_ID="$2"
      INSTALL_CHROMIUM=1
      shift 2
      ;;

    -h|--help)
      usage
      exit 0
      ;;

    *)
      echo "Unknown argument: $1"
      usage
      exit 2
      ;;
  esac
done

missing=()

for cmd in \
  python3 \
  tmux \
  ssh \
  curl
do
  command -v "$cmd" >/dev/null 2>&1 \
    || missing+=("$cmd")
done

if ((${#missing[@]})); then
  echo "Missing dependencies:"
  printf '  - %s\n' "${missing[@]}"
  echo

  if command -v apt >/dev/null 2>&1; then
    echo "Ubuntu/Debian:"
    echo "  sudo apt install python3 tmux openssh-client curl"
  fi

  exit 1
fi

mkdir -p \
  "$APP" \
  "$CFG" \
  "$FIREFOX_NMH"

cp \
  "$ROOT/native/chatdock_native.py" \
  "$APP/chatdock_native.py"

chmod 755 \
  "$APP/chatdock_native.py"

python3 -m py_compile \
  "$APP/chatdock_native.py"

if [[ ! -f "$CFG/config.json" ]]; then
  cp \
    "$ROOT/config/config.example.json" \
    "$CFG/config.json"
fi

cat > "$FIREFOX_NMH/local.zaku.chatdock.json" <<JSON
{
  "name": "local.zaku.chatdock",
  "description": "Zaku ChatDock Companion",
  "path": "$APP/chatdock_native.py",
  "type": "stdio",
  "allowed_extensions": [
    "$FIREFOX_ID"
  ]
}
JSON

python3 -m json.tool \
  "$FIREFOX_NMH/local.zaku.chatdock.json" \
  >/dev/null

echo "Firefox Companion manifest: OK"

if [[ "$INSTALL_CHROMIUM" -eq 1 ]]; then
  if [[ ! "$CHROMIUM_ID" =~ ^[a-p]{32}$ ]]; then
    echo "Invalid Chromium extension id:"
    echo "  $CHROMIUM_ID"
    exit 2
  fi

  for dir in "${CHROMIUM_NMHS[@]}"; do
    mkdir -p "$dir"

    cat > "$dir/local.zaku.chatdock.json" <<JSON
{
  "name": "local.zaku.chatdock",
  "description": "Zaku ChatDock Companion",
  "path": "$APP/chatdock_native.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$CHROMIUM_ID/"
  ]
}
JSON

    python3 -m json.tool \
      "$dir/local.zaku.chatdock.json" \
      >/dev/null
  done

  echo "Chromium/Opera Companion manifests: OK"
  echo "Chromium extension id: $CHROMIUM_ID"
fi

echo
echo "========================================"
echo " ChatDock Companion installed"
echo "========================================"
echo "Native host:"
echo "  $APP/chatdock_native.py"
echo
echo "Config:"
echo "  $CFG/config.json"
echo
echo "Firefox:"
echo "  ready"
echo

if [[ "$INSTALL_CHROMIUM" -eq 1 ]]; then
  echo "Chromium / Opera:"
  echo "  ready for extension id $CHROMIUM_ID"
  echo
fi

echo "The native host contains its own signed-metadata"
echo "update check, so future Companion updates can be"
echo "delivered without repeating this installation."
