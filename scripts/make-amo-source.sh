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
with open("extension/manifest.json", encoding="utf-8") as f:
    print(json.load(f)["version"])
PY
)"

OUT="$ROOT/dist/zaku-chatdock-v${VERSION}-source.zip"

mkdir -p dist
rm -f "$OUT"

zip -qr "$OUT" \
  extension \
  native \
  config \
  scripts \
  docs \
  package.json \
  package-lock.json \
  README.md \
  SECURITY.md \
  LICENSE \
  MOZILLA_REVIEW.md \
  .github/workflows \
  -x \
  'extension/vendor/*' \
  '*/__pycache__/*' \
  '*.pyc' \
  '*.xpi'

test -s "$OUT"

echo "SOURCE: $OUT"
