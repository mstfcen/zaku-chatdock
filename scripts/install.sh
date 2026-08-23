#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

APP="$HOME/.local/share/zaku-chatdock"
CFG="$HOME/.config/zaku-chatdock"
NMH="$HOME/.mozilla/native-messaging-hosts"

echo "========================================"
echo " Zaku ChatDock"
echo "========================================"
echo
echo "Installing the local terminal bridge..."
echo

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
  "$NMH"

cp \
  "$ROOT/native/chatdock_native.py" \
  "$APP/chatdock_native.py"

chmod 755 \
  "$APP/chatdock_native.py"

if [[ ! -f "$CFG/config.json" ]]; then
  cp \
    "$ROOT/config/config.example.json" \
    "$CFG/config.json"
fi

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

echo "Getting Firefox extension..."

mkdir -p "$ROOT/dist"

XPI="$ROOT/dist/zaku-chatdock-firefox.xpi"

if curl -fL --retry 3 \
  "https://github.com/mstfcen/zaku-chatdock/releases/latest/download/zaku-chatdock-firefox.xpi" \
  -o "$XPI"
then
  echo "Signed release downloaded."
else
  echo "No signed release yet; building development XPI."

  "$ROOT/scripts/build.sh"

  XPI="$(
    find "$ROOT/dist" \
      -maxdepth 1 \
      -type f \
      -name '*.xpi' \
      | sort \
      | tail -1
  )"
fi

echo
echo "Native bridge: OK"
echo "Config:"
echo "  $CFG/config.json"
echo
echo "Extension:"
echo "  $XPI"
echo
echo "Almost done:"
echo
echo "1) Open Firefox Developer Edition"
echo "2) Go to: about:addons"
echo "3) Gear icon -> Install Add-on From File"
echo "4) Select the XPI printed above"
echo "5) Open or reload chatgpt.com"
echo
echo "Local terminal works immediately."
echo
echo "Remote terminal is optional."
echo "See config/ssh-config.example if you want it."
