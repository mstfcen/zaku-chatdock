# Architecture

Zaku ChatDock has three layers.

## Content script

Runs on `chatgpt.com`.

Responsibilities:

- identify the current conversation
- map conversations to terminal workspaces
- render xterm.js
- render the sidebar
- add Run + Send controls
- manage terminal tabs
- transfer command results back to ChatGPT

## Background script

The WebExtension background process owns the Firefox Native Messaging
connection.

~~~text
ChatGPT content script
        │
        ▼
WebExtension background
        │
        ▼
Firefox Native Messaging
        │
        ▼
Python native host
~~~

## Native host

`native/chatdock_native.py` provides:

- PTY allocation
- tmux attach/create
- terminal input/output streaming
- command execution
- exit-code reporting
- tmux session enumeration
- optional SSH remote attachment

## Persistence

The browser UI is disposable.

The real terminal state lives in tmux.

That means refreshing ChatGPT or closing the browser does not need to
destroy the underlying shell workspace.

## Run + Send

~~~text
assistant code block
        │
        ▼
explicit user click
        │
        ▼
native exec worker
        │
        ▼
stdout / stderr
        │
        ├── terminal display
        │
        └── captured result
                 │
                 ▼
            ChatGPT composer
~~~
