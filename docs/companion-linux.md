# Zaku ChatDock Companion — Linux

Current package version: **0.9.0**

## Easiest installation

Download:

`zaku-chatdock-companion_0.9.0_all.deb`

Then either double-click it in Ubuntu/Debian's package installer or run:

```bash
sudo apt install ./zaku-chatdock-companion_0.9.0_all.deb
```

Restart the browser afterwards.

The package registers Native Messaging system hosts for:

- Opera
- Chrome
- Chromium
- compatible Chromium-family browsers
- Firefox

The current deterministic Chromium / Opera extension id is:

`kfammjcbikfhjgamhmgndekklondeefc`

## Opera Store id fallback

If an Opera Store submission receives a different extension id:

```bash
zaku-chatdock-register --chromium-id YOUR_EXTENSION_ID
```

Then restart Opera.

## One-line installer

Once the Companion .deb is attached to a GitHub Release, this becomes available:

```bash
curl -fsSL https://raw.githubusercontent.com/mstfcen/zaku-chatdock/main/scripts/companion-bootstrap.sh | bash
```

The bootstrap discovers the latest Companion .deb asset and installs it.

## What gets installed

System package:

- `/usr/bin/zaku-chatdock-companion`
- `/usr/bin/zaku-chatdock-register`
- `/usr/lib/zaku-chatdock/chatdock_native.py`

Per-user runtime:

- `~/.local/share/zaku-chatdock/chatdock_native.py`
- `~/.config/zaku-chatdock/config.json`

The user runtime model keeps ChatDock's signed native self-update path usable.
