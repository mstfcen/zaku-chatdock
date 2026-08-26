# Changelog

## 0.12.5 — Mission Engine and terminal polish

- add Mission Engine v1 for autonomous inspect → act → verify workflows
- persist per-chat mission state and Mission Auto controls
- add Native / Zaku / Canavar health indicators
- preserve dedicated per-chat tmux sessions across browser restarts
- improve terminal attach geometry and tmux redraw handling
- start terminal PTYs in raw/no-echo mode before tmux attach
- fix terminal line drift with corrected xterm line handling
- load official xterm.css synchronously inside ChatDock Shadow DOM
- isolate xterm renderer box-model rules from ChatDock UI CSS
- eliminate visible helper/accessibility glyph artifacts
- retain Native Messaging as the sole active terminal transport
- preserve explicit safety gates for destructive or human-required actions

## 0.9.0 — public-release candidate

- add persistent missing-Companion detection and install affordance
- validate Firefox 155 end-to-end with Native Messaging and dedicated tmux
- validate Chromium-family MV3 end-to-end with deterministic extension ID
- validate clean terminal startup in Firefox and Chromium-family runtimes
- prepare manual AMO Listed stable release channel
- keep self-hosted Firefox development channel separate
- add Linux Companion installation for Firefox and Chromium-family browsers
- preserve v0.8.2 as the pre-release rollback point

## 0.8.3 — product architecture

- isolate local ChatDock terminals on a dedicated tmux server
- fix streamed UTF-8 decoding across PTY chunk boundaries
- remove synthetic terminal startup banner
- add Firefox stable and development build targets
- add Chromium/Opera Manifest V3 development target
- add Linux ChatDock Companion installer
- add Firefox AMO Listed stable release workflow
- retain separate self-hosted development release channel
- update Mozilla reproducible-source packaging and documentation

## 0.6.0

First public alpha.

- persistent terminal per ChatGPT conversation
- multiple terminal tabs
- local and optional SSH remote terminals
- tmux session browser
- Run + Send workflow
- automatic result handoff
- compact sidebar mode
- Firefox Native Messaging bridge
