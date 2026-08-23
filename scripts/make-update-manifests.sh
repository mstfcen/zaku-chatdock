#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT"

VERSION="$(
python3 - <<'PY'
import json
print(
    json.load(
        open(
            "extension/manifest.json"
        )
    )["version"]
)
PY
)"

TAG="v$VERSION"

SIGNED_XPI="${1:-}"

if [[ -z "$SIGNED_XPI" ]]; then
    echo "Usage:"
    echo "  $0 /path/to/signed.xpi"
    exit 2
fi

test -s "$SIGNED_XPI"

XPI_SHA="$(
    sha256sum \
        "$SIGNED_XPI" \
        | awk '{print $1}'
)"

NATIVE_SHA="$(
    sha256sum \
        native/chatdock_native.py \
        | awk '{print $1}'
)"

cat > updates.json <<JSON
{
  "addons": {
    "chatdock@zaku.local": {
      "updates": [
        {
          "version": "$VERSION",
          "update_link": "https://github.com/mstfcen/zaku-chatdock/releases/download/$TAG/zaku-chatdock-firefox.xpi",
          "update_hash": "sha256:$XPI_SHA"
        }
      ]
    }
  }
}
JSON

cat > native-update.json <<JSON
{
  "version": "$VERSION",
  "url": "https://raw.githubusercontent.com/mstfcen/zaku-chatdock/$TAG/native/chatdock_native.py",
  "sha256": "$NATIVE_SHA"
}
JSON

echo "version     : $VERSION"
echo "xpi sha256  : $XPI_SHA"
echo "native sha256: $NATIVE_SHA"
