#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/mstfcen/zaku-chatdock.git"
DEST="${XDG_CACHE_HOME:-$HOME/.cache}/zaku-chatdock-companion"

command -v git >/dev/null 2>&1 || {
  echo "git is required."
  exit 1
}

rm -rf "$DEST"

git clone \
  --depth 1 \
  "$REPO_URL" \
  "$DEST"

exec \
  "$DEST/scripts/install-companion.sh" \
  "$@"
