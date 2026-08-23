#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT"

TAG="${1:-}"

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <git-tag>"
  exit 2
fi

VERSION="$(
python3 - <<'PY'
import re
from pathlib import Path

text = Path(
    "native/chatdock_native.py"
).read_text(
    encoding="utf-8"
)

match = re.search(
    r'CHATDOCK_NATIVE_VERSION\s*=\s*"([^"]+)"',
    text,
)

if not match:
    raise SystemExit(
        "CHATDOCK_NATIVE_VERSION not found"
    )

print(match.group(1))
PY
)"

SHA="$(
  sha256sum native/chatdock_native.py |
  awk '{print $1}'
)"

URL="https://raw.githubusercontent.com/mstfcen/zaku-chatdock/${TAG}/native/chatdock_native.py"

python3 - \
  "$VERSION" \
  "$URL" \
  "$SHA" <<'PY'
from pathlib import Path
import json
import sys

version, url, sha = sys.argv[1:]

Path("native-update.json").write_text(
    json.dumps(
        {
            "version": version,
            "url": url,
            "sha256": sha,
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
PY

python3 -m json.tool \
  native-update.json \
  >/dev/null

echo "NATIVE_UPDATE_VERSION=$VERSION"
echo "NATIVE_UPDATE_TAG=$TAG"
echo "NATIVE_UPDATE_SHA256=$SHA"
