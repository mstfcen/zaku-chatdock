#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

APP="$HOME/.local/share/zaku-chatdock"
NMH="$HOME/.mozilla/native-messaging-hosts"

echo "========================================"
echo " Zaku ChatDock installer"
echo "========================================"

missing=()

for cmd in python3 tmux ssh curl; do
  command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
done

if ((${#missing[@]})); then
  echo "Missing dependencies:"
  printf ' - %s\n' "${missing[@]}"
  echo
  echo "Ubuntu/Debian example:"
  echo "sudo apt install python3 tmux openssh-client curl"
  exit 1
fi

mkdir -p "$APP" "$NMH"

cp "$ROOT/native/chatdock_native.py" \
   "$APP/chatdock_native.py"

chmod 755 "$APP/chatdock_native.py"

cat > "$NMH/local.zaku.chatdock.json" <<JSON
{
  "name": "local.zaku.chatdock",
  "description": "Zaku ChatDock native terminal host",
  "path": "$APP/chatdock_native.py",
  "type": "stdio",
  "allowed_extensions": [
    "chatdock@zaku.local"
  ]
}
JSON

"$ROOT/scripts/build.sh"

echo
echo "Native host installed."
echo
echo "Now open Firefox Developer Edition:"
echo "  about:addons"
echo
echo "Gear -> Install Add-on From File"
echo
echo "Select:"
find "$ROOT/dist" -maxdepth 1 -name '*.xpi' -print
echo
echo "Optional remote machine:"
echo "Create an SSH alias named 'canavar' in ~/.ssh/config."
