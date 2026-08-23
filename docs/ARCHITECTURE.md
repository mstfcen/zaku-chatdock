# Architecture

Zaku ChatDock is intentionally small.

~~~text
chatgpt.com
    │
    ▼
content script + xterm.js
    │
    ▼
WebExtension background
    │
    ▼
Firefox Native Messaging
    │
    ▼
Python native host
    │
    ├── local tmux
    │
    └── SSH → remote tmux
~~~

## Conversation layer

The content script identifies the current ChatGPT conversation and stores
its terminal metadata in WebExtension local storage.

The internal host IDs from early versions are kept for storage
compatibility, while the UI exposes them as **Local** and **Remote**.

## Persistence layer

The shell workspace itself lives in `tmux`.

The browser extension attaches and detaches tmux clients. Closing the UI
does not intentionally kill the underlying tmux session.

## Native bridge

`native/chatdock_native.py` uses Firefox Native Messaging over stdin/stdout.

It handles:

- PTY allocation
- terminal resize/input/output
- local tmux attachment
- optional SSH remote tmux attachment
- command execution
- output streaming
- exit codes
- session enumeration

Remote SSH target configuration is read from:

~~~text
~/.config/zaku-chatdock/config.json
~~~

## Run + Send

~~~text
assistant code block
       │
       ▼
explicit click
       │
       ▼
native exec worker
       │
       ├── live terminal output
       │
       └── captured stdout/stderr
                    │
                    ▼
              ChatGPT composer
~~~

The user must explicitly click the execution control.
