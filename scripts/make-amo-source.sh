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

with open(
    "extension/manifest.json",
    encoding="utf-8",
) as f:
    print(json.load(f)["version"])
PY
)"

OUT="$ROOT/dist/zaku-chatdock-v${VERSION}-source.zip"

mkdir -p "$ROOT/dist"
rm -f "$OUT"

INCLUDE=(
  extension
  native
  scripts
  config
  .github
  docs
  package.json
  package-lock.json
  README.md
  FRIENDS_TR.md
  MOZILLA_REVIEW.md
  LICENSE
  SECURITY.md
  CONTRIBUTING.md
  CHANGELOG.md
  .gitignore
)

EXISTING=()

for item in "${INCLUDE[@]}"; do
  if [[ -e "$item" ]]; then
    EXISTING+=("$item")
  fi
done

zip -qr \
  "$OUT" \
  "${EXISTING[@]}" \
  -x \
    'extension/vendor/*' \
    'node_modules/*' \
    'dist/*' \
    '.git/*' \
    '*.pyc' \
    '__pycache__/*' \
    '*.bak' \
    '*.backup' \
    '*.pre-*' \
    '.env'

test -s "$OUT"

echo "SOURCE: $OUT"
