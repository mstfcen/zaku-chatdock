# Zaku ChatDock architecture

## Components

### WebExtension

Shared first-party code:

- `extension/content.js`
- `extension/background.js`

The source uses:

    globalThis.browser ?? globalThis.chrome

to share the implementation across Firefox and Chromium-family
browsers.

### Firefox targets

The source manifest is Firefox-oriented.

`scripts/build.sh` derives two Firefox trees:

- `dist/unpacked/firefox-dev`
- `dist/unpacked/firefox-stable`

The development target retains `gecko.update_url`.

The stable AMO target removes `gecko.update_url` so Firefox/AMO owns
updates.

### Chromium/Opera target

The build derives:

- `dist/unpacked/chromium`

Differences include:

- Firefox-only `browser_specific_settings` removed
- MV3 `background.service_worker` used
- deterministic development public key included

### Native Messaging Companion

`native/chatdock_native.py` is installed outside the extension.

Default Linux location:

    ~/.local/share/zaku-chatdock/chatdock_native.py

Firefox uses `allowed_extensions`.

Chromium-family manifests use `allowed_origins`.

### Local tmux

Starting with 0.8.3, ChatDock local sessions use the named tmux socket:

    tmux -L chatdock

This isolates ChatDock from the user's default tmux server.

ChatDock server options include:

- `escape-time=500`
- `assume-paste-time=0`
- `default-terminal=tmux-256color`
- status disabled

Legacy ChatDock sessions on the default tmux server remain discoverable
during migration.

### Terminal byte transport

PTY output may divide a Unicode code point between reads.

The native host therefore uses Python incremental UTF-8 decoders rather
than decoding every `os.read()` chunk independently.

### Remote terminal

Remote terminal support remains optional.

The native host launches SSH and attaches to tmux on the configured
remote host.

Remote tmux isolation is not yet migrated to the dedicated local
ChatDock socket model.

## Release channels

### Development

Trigger:

    dev-v*

Pipeline:

1. validation
2. multi-target build
3. Mozilla source archive
4. Mozilla self-hosted lint
5. unlisted signing
6. GitHub prerelease
7. self-hosted Firefox/native update metadata

### Stable Firefox

Trigger:

    workflow_dispatch

Pipeline:

1. checkout an existing stable tag
2. validate tag/version
3. build
4. Mozilla source archive
5. AMO Listed lint
6. AMO Listed submission
7. stable Companion metadata publication

External store publication is intentionally explicit/manual.

## Secrets

AMO credentials belong in GitHub Actions secrets:

- `AMO_JWT_ISSUER`
- `AMO_JWT_SECRET`

They must not appear in repository files, terminal logs or generated
packages.
