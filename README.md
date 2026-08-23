# Zaku ChatDock

**Conversation-bound terminal workspaces for ChatGPT.**

Zaku ChatDock adds a real Linux terminal directly to ChatGPT and binds
terminal state to the current conversation.

Each chat gets its own persistent `tmux` workspace. Switch conversations,
and your terminal context switches with you. Return later and the same
terminal is still there.

> Current status: **public alpha / hobby project**

## Why?

A common AI-assisted terminal workflow looks like this:

1. Ask ChatGPT for a command.
2. Copy the command.
3. Find the correct terminal.
4. Paste it.
5. Run it.
6. Copy the output.
7. Find the correct ChatGPT conversation.
8. Paste the output back.

ChatDock collapses that loop.

~~~text
ChatGPT
   │
   │  Run + Send
   ▼
chat-specific terminal
   │
   ├── Zaku / local
   └── Canavar / optional SSH remote
   │
   ▼
stdout + stderr
   │
   ▼
ChatGPT automatically
~~~

## Features

- persistent `tmux` workspace per ChatGPT conversation
- multiple terminal tabs per conversation
- local shell support
- optional SSH remote shell
- session browser for existing tmux sessions
- `Run + Send` button on assistant code blocks
- live stdout/stderr in the terminal
- command exit-code capture
- automatic result handoff back into ChatGPT
- compact sidebar mode
- Firefox Native Messaging bridge
- no network-facing shell server

## Screenshot

Coming soon.

## Requirements

Current alpha target:

- Linux
- Firefox Developer Edition
- Python 3
- tmux
- OpenSSH client
- curl

The Firefox extension is currently unsigned, so Developer Edition is
recommended during the alpha phase.

## Install

Clone:

~~~bash
git clone https://github.com/mstfcen/zaku-chatdock.git
cd zaku-chatdock
~~~

Install the native bridge and build the extension:

~~~bash
./scripts/install.sh
~~~

Then open Firefox Developer Edition:

~~~text
about:addons
~~~

Choose:

~~~text
Gear
→ Install Add-on From File
~~~

Select the generated XPI under:

~~~text
dist/
~~~

Reload `chatgpt.com`.

## Optional remote machine

Local terminals work without SSH.

The current alpha uses an SSH alias named `canavar` for its optional
remote host.

Example `~/.ssh/config`:

~~~text
Host canavar
    HostName 192.168.1.50
    User your-user
    IdentityFile ~/.ssh/id_ed25519
~~~

The remote computer needs `tmux`.

A configurable multi-host manager is planned.

## Run + Send

Assistant code blocks receive a:

~~~text
▶ Run + Send
~~~

control.

When clicked:

1. the command runs on the active ChatDock terminal host,
2. output streams into the terminal,
3. ChatDock waits for completion,
4. captures stdout/stderr and the exit code,
5. sends the result back to the same ChatGPT conversation.

## Conversation isolation

Conceptually:

~~~text
Chat A
└── tmux workspace A

Chat B
└── tmux workspace B

Chat C
└── tmux workspace C
~~~

Switching back to Chat A reconnects to workspace A.

## Security

ChatDock can execute shell commands.

Read commands before running them.

The local browser-to-shell bridge uses Firefox Native Messaging rather
than exposing a TCP shell server.

Remote execution uses your normal SSH configuration and credentials.

## Build

~~~bash
./scripts/build.sh
~~~

Output:

~~~text
dist/Zaku-ChatDock-v0.6.0.xpi
~~~

## Roadmap

- polished Opera-style drawer/sidebar UX
- configurable local/remote host manager
- better automatic terminal naming
- safer approval modes
- signed Firefox release
- easier one-command installation
- Chromium investigation
- richer execution status UI

## License

MIT.

## Disclaimer

Zaku ChatDock is an independent hobby project.

It is not affiliated with or endorsed by OpenAI, ChatGPT, Mozilla, or
Firefox.
