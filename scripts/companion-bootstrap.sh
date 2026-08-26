#!/usr/bin/env bash
set -euo pipefail

REPO="mstfcen/zaku-chatdock"
VERSION=""
LOCAL_DEB=""
DRY_RUN=0

usage() {
  cat <<'TXT'
Zaku ChatDock Companion bootstrap

Usage:
  companion-bootstrap.sh
  companion-bootstrap.sh --version 0.12.5
  companion-bootstrap.sh --local ./zaku-chatdock-companion_0.12.5_all.deb
  companion-bootstrap.sh --dry-run [--local FILE]

Default:
  downloads the latest zaku-chatdock-companion_*_all.deb
  asset from the GitHub Releases page and installs it.
TXT
}

while (($#)); do
  case "$1" in
    --version)
      test $# -ge 2 || {
        echo "Missing version" >&2
        exit 2
      }

      VERSION="${2#v}"
      shift 2
      ;;

    --local)
      test $# -ge 2 || {
        echo "Missing .deb path" >&2
        exit 2
      }

      LOCAL_DEB="$2"
      shift 2
      ;;

    --dry-run)
      DRY_RUN=1
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

for cmd in curl python3; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Missing dependency: $cmd" >&2
    exit 1
  }
done

TMP=""

cleanup() {
  if [[ -n "$TMP" ]]; then
    rm -rf "$TMP"
  fi
}

trap cleanup EXIT

if [[ -n "$LOCAL_DEB" ]]; then
  DEB="$LOCAL_DEB"

  [[ -f "$DEB" ]] || {
    echo "Local package not found: $DEB" >&2
    exit 1
  }

  SOURCE="local"

else
  TMP="$(mktemp -d)"
  DEB="$TMP/zaku-chatdock-companion.deb"

  if [[ -n "$VERSION" ]]; then
    ASSET="zaku-chatdock-companion_${VERSION}_all.deb"
    URL="https://github.com/$REPO/releases/download/v${VERSION}/${ASSET}"

  else
    RELEASE_JSON="$TMP/release.json"

    curl -fsSL \
      -H 'Accept: application/vnd.github+json' \
      "https://api.github.com/repos/$REPO/releases/latest" \
      -o "$RELEASE_JSON"

    URL="$(
      python3 - "$RELEASE_JSON" <<'PY'
import json
import re
import sys

data=json.load(open(sys.argv[1],encoding="utf-8"))

for asset in data.get("assets",[]):
    name=asset.get("name","")

    if re.fullmatch(
        r"zaku-chatdock-companion_[^/]+_all\.deb",
        name,
    ):
        print(asset["browser_download_url"])
        break
else:
    raise SystemExit(
        "Latest release has no ChatDock Companion .deb asset"
    )
PY
    )"
  fi

  SOURCE="$URL"

  echo "Downloading:"
  echo "  $URL"

  curl -fL \
    --retry 3 \
    --connect-timeout 15 \
    "$URL" \
    -o "$DEB"

  SHA_URL="${URL}.sha256"

  if curl -fsL \
    --retry 2 \
    --connect-timeout 10 \
    "$SHA_URL" \
    -o "$TMP/package.sha256"
  then
    EXPECTED="$(
      awk 'NR==1 {print $1}' \
        "$TMP/package.sha256"
    )"

    ACTUAL="$(
      sha256sum "$DEB" \
        | awk '{print $1}'
    )"

    if [[ "$EXPECTED" != "$ACTUAL" ]]; then
      echo "SHA256 verification failed." >&2
      exit 1
    fi

    echo "SHA256: verified"
  else
    echo "SHA256 sidecar not available; continuing with HTTPS download."
  fi
fi

echo
echo "Package:"
echo "  $DEB"
echo "Source:"
echo "  $SOURCE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "Would install with:"
  echo "  sudo apt install ./$(basename "$DEB")"
  echo "BOOTSTRAP_DRY_RUN=PASS"
  exit 0
fi

if command -v apt >/dev/null 2>&1; then
  sudo apt install -y "$DEB"

elif command -v dpkg >/dev/null 2>&1; then
  sudo dpkg -i "$DEB"

else
  echo "This installer currently supports Debian/Ubuntu-family Linux." >&2
  exit 1
fi

echo
echo "========================================"
echo " ChatDock Companion installation ready"
echo "========================================"
echo
echo "Restart Opera / Chrome / Chromium / Firefox."
echo
echo "If an Opera Store build has a different extension id:"
echo "  zaku-chatdock-register --chromium-id EXTENSION_ID"
