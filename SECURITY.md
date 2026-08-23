# Security

Zaku ChatDock is capable of executing shell commands with the
permissions of the current Unix user.

## Current alpha model

- command execution requires an explicit user click
- no TCP shell service is exposed
- browser/native communication uses Firefox Native Messaging
- remote execution uses the user's existing SSH configuration
- no SSH private keys, browser profiles, tokens, passwords, or cookies
  should ever be committed to this repository

Review commands before running them.

Do not include secrets in GitHub issues.
