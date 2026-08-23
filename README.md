# Zaku ChatDock

Zaku ChatDock adds persistent terminal workspaces to ChatGPT.

Each conversation can own its own terminal session. Local sessions
survive drawer/browser navigation through tmux, and optional remote
sessions can use SSH.

Current development version: **0.8.3**

## What it provides

- one persistent tmux workspace per ChatGPT conversation
- Local and optional Remote terminals
- multiple terminal tabs per conversation
- Sessions picker for existing workspaces
- Run + Send
- structured `CHATDOCK_RESULT` execution results
- Mission Mode
- Opera-style right rail and overlay terminal drawer
- Firefox support
- Chromium/Opera development build
- Linux ChatDock Companion for Native Messaging

## Architecture

The browser extension does not expose a network shell.

It communicates with a local companion through WebExtension Native
Messaging:

    ChatGPT page
        |
        v
    ChatDock extension
        |
        v
    Native Messaging
        |
        v
    ChatDock Companion
        |
        +-- dedicated ChatDock tmux server
        |
        +-- optional SSH -> remote tmux

The local ChatDock tmux server uses its own socket and does not change
the user's normal tmux configuration.

## Firefox distribution model

There are two Firefox build targets.

### Stable / public

The stable build is designed for an **AMO Listed** release.

AMO/Firefox owns extension updates, so the generated stable manifest
does not contain a custom `update_url`.

Generated tree:

    dist/unpacked/firefox-stable/

Package:

    dist/Zaku-ChatDock-Firefox-Stable-v<VERSION>.xpi

The AMO publication workflow is deliberately manual-dispatch because
publishing to the external store is an explicit release action.

### Development / self-hosted

Development releases retain the GitHub-hosted Firefox update manifest.

Generated tree:

    dist/unpacked/firefox-dev/

Package:

    dist/Zaku-ChatDock-Firefox-Dev-v<VERSION>.xpi

Development tags use the form:

    dev-v<VERSION>

## ChatDock Companion

Browser extensions cannot install Native Messaging applications
themselves.

Linux therefore requires a one-time ChatDock Companion installation.

From a source checkout:

    ./scripts/install-companion.sh

For Firefox plus Chromium/Opera development manifests:

    ./scripts/install-companion.sh --all-browsers

The companion installs:

    ~/.local/share/zaku-chatdock/chatdock_native.py

and the required per-browser Native Messaging manifests.

User configuration remains under:

    ~/.config/zaku-chatdock/

The native host has its own update mechanism using version metadata
and SHA-256 verification from this repository.

## Developer build

Requirements:

- Python 3
- tmux
- OpenSSH client
- curl
- Node.js 18+
- npm
- zip

Build all targets:

    ./scripts/build.sh

This creates Firefox development, Firefox stable, and Chromium/Opera
artifacts under `dist/`.

Run repository validation:

    ./scripts/check.sh

Build the Mozilla reviewer source package:

    ./scripts/make-amo-source.sh

## Chromium / Opera

ChatDock now has a Chromium Manifest V3 development target using the
same first-party JavaScript through a small `browser` / `chrome`
runtime abstraction.

Generated unpacked extension:

    dist/unpacked/chromium/

Generated package:

    dist/Zaku-ChatDock-Chromium-v<VERSION>.zip

The repository development build has a deterministic extension ID so
the Native Messaging manifest can permit that unpacked extension.

A future Opera Store release will need its real store extension ID in
the installed Companion manifest.

## Terminal integrity

Version 0.8.3 changes the terminal transport substantially:

- streamed UTF-8 is decoded incrementally
- local ChatDock sessions use a dedicated tmux server/socket
- ChatDock does not modify the user's normal tmux settings
- fast browser terminal capability responses are not treated as pasted
  pane input
- the synthetic terminal startup banner was removed

Legacy v0.8 default-server tmux sessions are preserved during migration.

## Security model

- no public shell server
- local browser/native communication uses Native Messaging
- remote terminal support is optional and uses the user's SSH setup
- generated artifacts, local configuration and secrets are excluded
  from Git
- AMO credentials are expected only as repository CI secrets
- first-party extension JavaScript remains readable and unbundled

## Status

0.8.3 is currently a product-development build.

The Firefox AMO Listed workflow is prepared but public store
publication is intentionally not performed automatically.

The Chromium/Opera package is a development target until interactive
browser verification and store submission are completed.

## Project

Repository:

    https://github.com/mstfcen/zaku-chatdock

This is an independent open-source project and is not affiliated with
OpenAI, Mozilla, Firefox, Opera or Google.
