# Zaku ChatDock — Mozilla Review Build Instructions

## Requirements

- Linux
- Python 3
- Node.js 18 or newer + npm
- zip

## First-party extension source

- `extension/manifest.json`
- `extension/background.js`
- `extension/content.js`

The first-party JavaScript is readable and is not intentionally minified,
obfuscated, or transpiled.

## Native Messaging host

- `native/chatdock_native.py`

This Python program is installed separately on the user's machine and
communicates with the Firefox extension through Native Messaging.

## Third-party dependency

Zaku ChatDock uses:

- `@xterm/xterm` version `6.0.0`

npm package:

https://www.npmjs.com/package/@xterm/xterm

Upstream source:

https://github.com/xtermjs/xterm.js

The exact dependency is pinned in `package.json` and `package-lock.json`.

## Reproduce the extension

From the root of the submitted source archive:

~~~bash
npm ci --ignore-scripts --no-audit --no-fund
./scripts/build.sh
~~~

The resulting package is:

~~~text
dist/Zaku-ChatDock-v0.8.0.xpi
~~~

The build copies the official npm-distributed xterm JavaScript and CSS
into `extension/vendor/`, then packages the extension.

No CDN is required by the reproducible build.

## Validation

~~~bash
./scripts/check.sh
~~~

## Functionality

Zaku ChatDock provides a terminal workspace next to chatgpt.com.

The extension communicates with a locally installed Python process using
Firefox Native Messaging.

The local native process runs with the permissions of the current
operating-system user.

Optional remote terminal support uses the user's normal SSH
configuration.
