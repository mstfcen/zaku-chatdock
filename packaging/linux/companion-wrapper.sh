#!/usr/bin/env bash
set -euo pipefail

SYSTEM_ROOT="${CHATDOCK_SYSTEM_ROOT:-}"

PAYLOAD="$SYSTEM_ROOT/usr/lib/zaku-chatdock/chatdock_native.py"
EXAMPLE="$SYSTEM_ROOT/usr/share/zaku-chatdock/config.example.json"
REGISTER="$SYSTEM_ROOT/usr/bin/zaku-chatdock-register"

APP="$HOME/.local/share/zaku-chatdock"
CFG="$HOME/.config/zaku-chatdock"
RUNTIME="$APP/chatdock_native.py"
CONFIG="$CFG/config.json"

native_version() {
  python3 - "$1" <<'PY'
import re
import sys
from pathlib import Path

p=Path(sys.argv[1])

try:
    text=p.read_text(encoding="utf-8")
except Exception:
    print("")
    raise SystemExit(0)

m=re.search(
    r'CHATDOCK_NATIVE_VERSION\s*=\s*["\']([^"\']+)["\']',
    text,
)

print(m.group(1) if m else "")
PY
}

version_gt() {
  python3 - "$1" "$2" <<'PY'
import re
import sys

def key(v):
    parts=[]

    for x in re.split(r'[.+_-]', v):
        if x.isdigit():
            parts.append((0,int(x)))
        else:
            parts.append((1,x))

    return tuple(parts)

raise SystemExit(
    0 if key(sys.argv[1]) > key(sys.argv[2]) else 1
)
PY
}

ensure_runtime() {
  if [[ ! -f "$PAYLOAD" ]]; then
    echo "ChatDock packaged payload missing:" >&2
    echo "  $PAYLOAD" >&2
    exit 1
  fi

  mkdir -p "$APP" "$CFG"

  local packaged_version user_version

  packaged_version="$(native_version "$PAYLOAD")"
  user_version=""

  if [[ -f "$RUNTIME" ]]; then
    user_version="$(native_version "$RUNTIME")"
  fi

  if [[ ! -f "$RUNTIME" ]]; then
    install -m 0755 "$PAYLOAD" "$RUNTIME"

  elif [[ -n "$packaged_version" ]] \
       && [[ -n "$user_version" ]] \
       && version_gt "$packaged_version" "$user_version"
  then
    install -m 0755 "$PAYLOAD" "$RUNTIME"
  fi

  if [[ ! -f "$CONFIG" ]] && [[ -f "$EXAMPLE" ]]; then
    install -m 0644 "$EXAMPLE" "$CONFIG"
  fi
}

case "${1:-}" in
  --version)
    native_version "$PAYLOAD"
    exit 0
    ;;

  --runtime-path)
    echo "$RUNTIME"
    exit 0
    ;;

  --register)
    shift

    if [[ ! -x "$REGISTER" ]]; then
      echo "Registrar not found: $REGISTER" >&2
      exit 1
    fi

    exec "$REGISTER" "$@"
    ;;

  --self-test)
    test -f "$PAYLOAD"

    python3 - "$PAYLOAD" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])

source=path.read_text(encoding="utf-8")

compile(
    source,
    str(path),
    "exec",
)

print("PYTHON_COMPILE=PASS")
PY

    ensure_runtime

    echo "PAYLOAD=$PAYLOAD"
    echo "RUNTIME=$RUNTIME"
    echo "VERSION=$(native_version "$PAYLOAD")"
    echo "SELF_TEST=PASS"
    exit 0
    ;;
esac

ensure_runtime

exec python3 "$RUNTIME"
