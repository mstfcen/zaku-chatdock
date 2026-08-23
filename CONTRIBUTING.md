# Contributing

Zaku ChatDock is an early-stage hobby project.

Useful contribution areas include:

- Firefox/WebExtension compatibility
- terminal and sidebar UX
- tmux lifecycle handling
- Native Messaging hardening
- configurable host management
- Linux installers
- documentation

Before submitting changes:

~~~bash
python3 -m py_compile native/chatdock_native.py
node --check extension/background.js
node --check extension/content.js
./scripts/build.sh
~~~
