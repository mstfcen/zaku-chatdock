# Zaku ChatDock — Mozilla reviewer build notes

Zaku ChatDock is a Manifest V3 Firefox extension plus an optional
Linux Native Messaging companion.

The browser extension itself does not download or execute remote
JavaScript.

## Build requirements

- Linux/macOS shell environment
- Python 3
- Node.js 18 or newer
- npm
- zip

CI uses Node.js 24.

## Third-party dependency

The only bundled browser dependency is pinned in package.json:

- @xterm/xterm 6.0.0

npm ci reproduces the exact dependency tree from package-lock.json.

During the build:

- node_modules/@xterm/xterm/lib/xterm.js becomes vendor/xterm.js
- node_modules/@xterm/xterm/css/xterm.css becomes vendor/xterm.css

No CDN is used by the browser extension.

## Reproduce browser packages

Run these commands from the source archive root:

    npm ci --ignore-scripts --no-audit --no-fund
    ./scripts/build.sh

The build creates Firefox development, Firefox AMO stable, and
Chromium/Opera packages under dist/.

The AMO Listed generated tree is:

    dist/unpacked/firefox-stable/

Its manifest intentionally contains no update_url because AMO and
Firefox own extension updates for Listed releases.

The self-hosted development generated tree is:

    dist/unpacked/firefox-dev/

Its manifest retains the project's self-hosted update_url.

## First-party source

First-party JavaScript is readable and is not intentionally
minified, obfuscated, bundled, or transpiled.

extension/content.js contains the ChatGPT UI integration.

extension/background.js contains the WebExtension background
bridge to Native Messaging.

## Native companion

native/chatdock_native.py is a separate local Native Messaging
application providing terminal, tmux and optional SSH integration.

The extension connects to the installed host named:

    local.zaku.chatdock

The native application is not downloaded or executed as browser
extension code.

The companion has a separate GitHub metadata based updater. That
updater runs in the native application rather than the browser
extension JavaScript environment.

## Source archive exclusions

The Mozilla source archive intentionally excludes generated or
local content:

- node_modules/
- dist/
- extension/vendor/
- .git/
- local secrets and configuration

Run scripts/build.sh to regenerate browser artifacts.
