# Zaku ChatDock

**A terminal that follows your ChatGPT conversation.**

Zaku ChatDock is a small Linux + Firefox hobby project.

It puts a real terminal next to ChatGPT and gives every conversation its
own persistent `tmux` workspace.

Change chats → terminal changes with it.

Come back later → your terminal is still there.

## The nice part

Normally the loop is:

~~~text
ask ChatGPT
→ copy command
→ find terminal
→ paste
→ run
→ copy output
→ find ChatGPT again
→ paste output
~~~

With ChatDock:

~~~text
ChatGPT code block
       │
       ▼
  Run + Send
       │
       ▼
chat-specific tmux terminal
       │
       ▼
 command output
       │
       ▼
back to the same ChatGPT chat
~~~

## What it can do

- one persistent terminal workspace per ChatGPT conversation
- multiple terminal tabs per chat
- local Linux terminals
- optional SSH remote terminals
- existing `tmux` session browser
- Run + Send on assistant code blocks
- live stdout/stderr
- exit-code reporting
- automatic command-result handoff to ChatGPT
- compact sidebar mode
- Firefox Native Messaging instead of a network shell server

## Quick install

For now the alpha version targets:

- Linux
- Firefox Developer Edition
- Python 3
- tmux
- OpenSSH
- curl

### Ubuntu / Debian

Install the few dependencies:

~~~bash
sudo apt install python3 tmux openssh-client curl
~~~

Then run:

~~~bash
curl -fsSL https://raw.githubusercontent.com/mstfcen/zaku-chatdock/main/scripts/bootstrap.sh | bash
~~~

The installer prints the generated `.xpi` path.

In Firefox Developer Edition:

~~~text
about:addons
→ gear icon
→ Install Add-on From File
→ choose the generated XPI
~~~

Reload ChatGPT and the terminal should appear.

## Prefer cloning it?

~~~bash
git clone https://github.com/mstfcen/zaku-chatdock.git
cd zaku-chatdock
./scripts/install.sh
~~~

## Optional remote machine

Local mode needs no extra configuration.

For a remote terminal, edit:

~~~text
~/.config/zaku-chatdock/config.json
~~~

Default:

~~~json
{
  "remote_host": "chatdock-remote"
}
~~~

Then create the matching SSH alias in `~/.ssh/config`:

~~~text
Host chatdock-remote
    HostName 192.168.1.50
    User your-user
~~~

The remote machine also needs `tmux`.

## Why tmux?

The browser panel is only the view.

The real shell state lives in `tmux`, so refreshing ChatGPT or reopening
the conversation does not have to destroy the terminal workspace.

## Security

ChatDock executes commands as your current Unix user.

Read a command before clicking Run + Send.

The browser talks to the local Python bridge through Firefox Native
Messaging. ChatDock does not intentionally expose a shell server on a
TCP port.

Remote mode uses your normal SSH configuration.

## Development

Run all local checks:

~~~bash
./scripts/check.sh
~~~

Build the extension:

~~~bash
./scripts/build.sh
~~~

Output:

~~~text
dist/Zaku-ChatDock-v0.7.0.xpi
~~~

## Current status

This is still an alpha hobby project.

The interface and installer will change.

## Roadmap

- polished Opera-style drawer
- nicer conversation-derived terminal names
- multiple configurable remote hosts
- safer approval modes
- Firefox signing
- easier updates
- Chromium investigation

## License

MIT.

## Disclaimer

Independent hobby project. Not affiliated with or endorsed by OpenAI,
ChatGPT, Mozilla, or Firefox.
