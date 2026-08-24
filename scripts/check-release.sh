#!/usr/bin/env bash
set -euo pipefail

ROOT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT"

echo "[release 1/8] source validation"
./scripts/check.sh

echo "[release 2/8] build"
./scripts/build.sh

VERSION="$(
python3 - <<'PY'
import json

with open(
    "extension/manifest.json",
    encoding="utf-8",
) as f:
    print(
        json.load(f)["version"]
    )
PY
)"

echo "version=$VERSION"

echo "[release 3/8] generated manifests"
python3 - <<'PY'
from pathlib import Path
import json

dev = json.loads(
    Path(
        "dist/unpacked/firefox-dev/manifest.json"
    ).read_text()
)

stable = json.loads(
    Path(
        "dist/unpacked/firefox-stable/manifest.json"
    ).read_text()
)

chromium = json.loads(
    Path(
        "dist/unpacked/chromium/manifest.json"
    ).read_text()
)

versions = {
    dev["version"],
    stable["version"],
    chromium["version"],
}

if len(versions) != 1:
    raise SystemExit(
        f"target version mismatch: {versions}"
    )

assert (
    "update_url"
    in dev[
        "browser_specific_settings"
    ]["gecko"]
)

assert (
    "update_url"
    not in stable[
        "browser_specific_settings"
    ]["gecko"]
)

assert (
    chromium["manifest_version"]
    == 3
)

assert (
    chromium["background"][
        "service_worker"
    ]
    == "background.js"
)

assert (
    "browser_specific_settings"
    not in chromium
)

assert (
    "nativeMessaging"
    in chromium["permissions"]
)

assert "key" in chromium

print(
    "GENERATED_MANIFESTS=PASS"
)
PY

echo "[release 4/8] API portability"
python3 - <<'PY'
from pathlib import Path
import re

for name in (
    "extension/background.js",
    "extension/content.js",
):
    s = Path(name).read_text(
        encoding="utf-8"
    )

    if not re.search(
        r'globalThis\.browser\s*\?\?\s*'
        r'globalThis\.chrome',
        s,
    ):
        raise SystemExit(
            f"EXT abstraction missing: {name}"
        )

    # globalThis.browser is the intended compatibility probe.
    stripped = s.replace(
        "globalThis.browser",
        "",
    )

    if re.search(
        r'\bbrowser\.',
        stripped,
    ):
        raise SystemExit(
            f"Firefox-only browser.* call: {name}"
        )

print(
    "WEBEXTENSION_API=PASS"
)
PY

echo "[release 5/8] Companion UX"
grep -q \
  'companion_required: true' \
  extension/background.js

grep -q \
  'id="companion-help"' \
  extension/content.js

grep -q \
  'msg?.companion_required' \
  extension/content.js

echo "COMPANION_UX=PASS"

echo "[release 6/8] Mozilla source"
./scripts/make-amo-source.sh

SOURCE="dist/zaku-chatdock-v${VERSION}-source.zip"
test -s "$SOURCE"

LIST="$(
  unzip -Z1 "$SOURCE"
)"

for REQUIRED in \
  extension/manifest.json \
  extension/background.js \
  extension/content.js \
  scripts/build.sh \
  scripts/install-companion.sh \
  package.json \
  package-lock.json \
  MOZILLA_REVIEW.md \
  config/chromium-dev-public-key.txt
do
  printf '%s\n' "$LIST" |
    grep -Fxq "$REQUIRED"
done

if printf '%s\n' "$LIST" |
   grep -Eq \
     '(^|/)node_modules/|(^|/)vendor/|\.bak$|(^|/)\.git/'
then
  echo "Reviewer source contains generated/private content"
  exit 1
fi

echo "MOZILLA_SOURCE=PASS"

echo "[release 7/8] workflow contract"
python3 - <<'PY'
from pathlib import Path
import re

dev = Path(
    ".github/workflows/release-firefox.yml"
).read_text()

stable = Path(
    ".github/workflows/release-firefox-stable.yml"
).read_text()

required = [
    (
        "dev tag",
        "dev-v*" in dev,
    ),
    (
        "dev unlisted",
        "--channel unlisted" in dev,
    ),
    (
        "dev tree",
        "dist/unpacked/firefox-dev"
        in dev,
    ),
    (
        "stable manual",
        "workflow_dispatch:"
        in stable,
    ),
    (
        "stable listed",
        "--channel listed"
        in stable,
    ),
    (
        "stable tree",
        "dist/unpacked/firefox-stable"
        in stable,
    ),
    (
        "AMO metadata",
        "--amo-metadata config/amo-metadata.json"
        in stable,
    ),
]

failed = [
    name
    for name, ok in required
    if not ok
]

if failed:
    raise SystemExit(
        f"workflow checks failed: {failed}"
    )

if re.search(
    r'push:\s*\n\s*tags:',
    stable,
):
    raise SystemExit(
        "AMO Listed publication must remain manual"
    )

print(
    "WORKFLOW_CONTRACT=PASS"
)
PY

echo "[release 8/8] optional Mozilla lint"

NODE_BIN="$(
  find "$HOME/.nvm/versions/node" \
    -path '*/bin/node' \
    -type f \
    -perm -u+x \
    2>/dev/null |
  sort -V |
  tail -1 \
  || true
)"

WEBEXT_JS="$HOME/.cache/zaku-chatdock-tools/web-ext/node_modules/web-ext/bin/web-ext.js"

if [[ -x "$NODE_BIN" ]] &&
   [[ -s "$WEBEXT_JS" ]]
then
  "$NODE_BIN" "$WEBEXT_JS" lint \
    --source-dir dist/unpacked/firefox-dev \
    --self-hosted \
    --warnings-as-errors

  "$NODE_BIN" "$WEBEXT_JS" lint \
    --source-dir dist/unpacked/firefox-stable \
    --warnings-as-errors

  echo "MOZILLA_LINT=PASS"
else
  echo "MOZILLA_LINT=SKIP_NO_LOCAL_WEBEXT"
fi

echo "RELEASE_AUDIT=PASS"
