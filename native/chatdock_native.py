#!/usr/bin/env python3

"""Firefox Native Messaging bridge for Zaku ChatDock."""

from __future__ import annotations

import base64
import codecs
import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import termios
import tty
import threading
import hashlib
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any


LOCAL_HOST = "zaku"
REMOTE_HOST = "canavar"

CONFIG_PATH = (
    Path.home()
    / ".config"
    / "zaku-chatdock"
    / "config.json"
)

DEFAULT_REMOTE_SSH_HOST = "chatdock-remote"

CHATDOCK_NATIVE_VERSION = "0.12.5"

CHATDOCK_TMUX_SOCKET = "chatdock"

NATIVE_UPDATE_MANIFEST = (
    "https://raw.githubusercontent.com/"
    "mstfcen/zaku-chatdock/main/native-update.json"
)

NATIVE_UPDATE_INTERVAL = 6 * 60 * 60

INPUT = sys.stdin.buffer
OUTPUT = sys.stdout.buffer

WRITE_LOCK = threading.Lock()
SESSIONS_LOCK = threading.Lock()

SESSIONS: dict[str, dict[str, Any]] = {}


def load_config() -> dict[str, Any]:
    try:
        with CONFIG_PATH.open(
            encoding="utf-8"
        ) as f:
            value = json.load(f)

        return (
            value
            if isinstance(value, dict)
            else {}
        )

    except (
        FileNotFoundError,
        json.JSONDecodeError,
        OSError,
    ):
        return {}


CONFIG = load_config()

REMOTE_SSH_HOST = str(
    os.environ.get(
        "CHATDOCK_REMOTE_HOST"
    )
    or CONFIG.get("remote_host")
    or DEFAULT_REMOTE_SSH_HOST
)


def send(message: dict[str, Any]) -> None:
    data = json.dumps(
        message,
        ensure_ascii=False,
    ).encode("utf-8")

    with WRITE_LOCK:
        OUTPUT.write(
            struct.pack(
                "<I",
                len(data),
            )
        )
        OUTPUT.write(data)
        OUTPUT.flush()


def read_exact(size: int) -> bytes | None:
    chunks: list[bytes] = []

    while size:
        chunk = INPUT.read(size)

        if not chunk:
            return None

        chunks.append(chunk)
        size -= len(chunk)

    return b"".join(chunks)


def receive() -> dict[str, Any] | None:
    header = read_exact(4)

    if not header:
        return None

    size = struct.unpack(
        "<I",
        header,
    )[0]

    if size > 8 * 1024 * 1024:
        raise ValueError(
            "native message is too large"
        )

    body = read_exact(size)

    if body is None:
        return None

    return json.loads(
        body.decode("utf-8")
    )


def safe_name(
    value: Any,
    fallback: str = "chatdock",
) -> str:
    cleaned = re.sub(
        r"[^A-Za-z0-9_-]",
        "_",
        str(value),
    )[:100]

    return cleaned or fallback


def set_terminal_size(
    fd: int,
    rows: Any,
    cols: Any,
) -> None:
    try:
        window = struct.pack(
            "HHHH",
            max(5, int(rows)),
            max(20, int(cols)),
            0,
            0,
        )

        fcntl.ioctl(
            fd,
            termios.TIOCSWINSZ,
            window,
        )

    except (
        OSError,
        TypeError,
        ValueError,
    ):
        pass


def ssh_command(
    *args: str,
    timeout: int | None = None,
) -> list[str]:
    command = [
        "ssh",
        "-o",
        "BatchMode=yes",
    ]

    if timeout:
        command += [
            "-o",
            f"ConnectTimeout={timeout}",
        ]

    command.append(
        REMOTE_SSH_HOST
    )

    command.extend(args)

    return command



def local_tmux_command(
    *args: str,
) -> list[str]:
    """
    ChatDock owns a dedicated tmux server.

    This isolates terminal negotiation/server options from the
    user's normal tmux server and ~/.tmux.conf state.
    """
    return [
        "tmux",
        "-L",
        CHATDOCK_TMUX_SOCKET,
        *args,
    ]


def legacy_local_tmux_cwd(
    tmux_name: str,
) -> str | None:
    """
    During the v0.8 -> v0.9 migration, preserve the working
    directory of an existing ChatDock session on the legacy
    default tmux server. The legacy session itself is not killed.
    """
    try:
        result = subprocess.run(
            [
                "tmux",
                "display-message",
                "-p",
                "-t",
                tmux_name,
                "#{pane_current_path}",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
            check=False,
        )

        cwd = result.stdout.strip()

        if (
            result.returncode == 0
            and cwd
            and os.path.isdir(cwd)
        ):
            return cwd

    except (
        OSError,
        subprocess.SubprocessError,
    ):
        pass

    return None


def configure_local_tmux_server() -> None:
    """
    Configure only the ChatDock tmux server.

    assume-paste-time=0 is important for browser terminals:
    xterm.js may answer several terminal capability queries in
    one fast burst. Those bytes must be parsed as terminal
    responses rather than guessed to be pasted pane input.
    """
    commands = [
        (
            "set-option",
            "-s",
            "escape-time",
            "500",
        ),
        (
            "set-option",
            "-s",
            "assume-paste-time",
            "0",
        ),
        (
            "set-option",
            "-g",
            "default-terminal",
            "tmux-256color",
        ),
        (
            "set-option",
            "-g",
            "status",
            "off",
        ),
    ]

    for args in commands:
        result = subprocess.run(
            local_tmux_command(*args),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=3,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                "could not configure ChatDock tmux: "
                + " ".join(args)
            )


def ensure_local_tmux_session(
    tmux_name: str,
) -> None:
    """
    Ensure a persistent ChatDock-owned local session exists.

    Existing v0.8 sessions are migrated non-destructively:
    the old session stays on the default tmux server while the
    new ChatDock server starts the replacement at the same cwd.
    """
    exists = subprocess.run(
        local_tmux_command(
            "has-session",
            "-t",
            tmux_name,
        ),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=2,
        check=False,
    )

    if exists.returncode != 0:
        cwd = (
            legacy_local_tmux_cwd(
                tmux_name
            )
            or str(Path.home())
        )

        created = subprocess.run(
            local_tmux_command(
                "new-session",
                "-d",
                "-s",
                tmux_name,
                "-c",
                cwd,
            ),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5,
            check=False,
        )

        if created.returncode != 0:
            raise RuntimeError(
                "could not create ChatDock tmux session: "
                + created.stderr.strip()
            )

    configure_local_tmux_server()


def terminal_reader(
    session_id: str,
    fd: int,
    pid: int,
) -> None:
    decoder = codecs.getincrementaldecoder(
        "utf-8"
    )(
        errors="replace"
    )

    try:
        while True:
            ready, _, _ = select.select(
                [fd],
                [],
                [],
                0.5,
            )

            if fd in ready:
                try:
                    data = os.read(
                        fd,
                        65536,
                    )
                except OSError:
                    break

                if not data:
                    break

                text = decoder.decode(
                    data
                )

                if text:
                    send(
                        {
                            "type": "output",
                            "session": session_id,
                            "data": text,
                        }
                    )

            try:
                done, status = os.waitpid(
                    pid,
                    os.WNOHANG,
                )

                if done:
                    send(
                        {
                            "type": "exit",
                            "session": session_id,
                            "code":
                                os.waitstatus_to_exitcode(
                                    status
                                ),
                        }
                    )
                    break

            except ChildProcessError:
                break

    finally:
        tail = decoder.decode(
            b"",
            final=True,
        )

        if tail:
            try:
                send(
                    {
                        "type": "output",
                        "session": session_id,
                        "data": tail,
                    }
                )
            except Exception:
                pass

        with SESSIONS_LOCK:
            current = SESSIONS.get(
                session_id
            )

            if (
                current
                and current["fd"] == fd
            ):
                SESSIONS.pop(
                    session_id,
                    None,
                )

        try:
            os.close(fd)
        except OSError:
            pass


# CHATDOCK_V0124_GEOMETRY_PREFLIGHT
def preflight_tmux_geometry(
    host: str,
    tmux_name: str,
    rows: Any,
    cols: Any,
) -> None:
    """
    Match the tmux window to the browser client's final geometry
    BEFORE attaching the new client.

    Why:
    tmux draws viewport boundary markers when an attaching client
    is temporarily smaller than the existing window. ChatDock was
    attaching at ~51x41 and settling at ~51x43 milliseconds later.
    Those temporary marker rows were the visual garbage seen at the
    top of xterm even though capture-pane itself stayed clean.
    """

    try:
        r=max(5, int(rows))
        c=max(20, int(cols))
    except (TypeError, ValueError):
        return

    try:
        if host == LOCAL_HOST:
            command=local_tmux_command(
                "resize-window",
                "-t",
                tmux_name,
                "-x",
                str(c),
                "-y",
                str(r),
            )
        else:
            command=ssh_command(
                "tmux",
                "resize-window",
                "-t",
                tmux_name,
                "-x",
                str(c),
                "-y",
                str(r),
                timeout=3,
            )

        subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=4,
            check=False,
        )

    except (
        OSError,
        subprocess.SubprocessError,
    ):
        pass


def open_session(
    message: dict[str, Any],
) -> None:
    session_id = safe_name(
        message.get(
            "session",
            "chatdock",
        )
    )

    host = message.get(
        "host",
        LOCAL_HOST,
    )

    tmux_name = safe_name(
        message.get("tmux")
        or session_id
    )

    rows = message.get(
        "rows",
        24,
    )

    cols = message.get(
        "cols",
        80,
    )

    if host not in (
        LOCAL_HOST,
        REMOTE_HOST,
    ):
        send(
            {
                "type": "error",
                "session": session_id,
                "error": "invalid host",
            }
        )
        return

    with SESSIONS_LOCK:
        existing = SESSIONS.get(
            session_id
        )

    if existing:
        set_terminal_size(
            existing["fd"],
            rows,
            cols,
        )

        send(
            {
                "type": "opened",
                "session": session_id,
                "host": host,
                "tmux": existing["tmux"],
                "reused": True,
            }
        )
        return

    if host == LOCAL_HOST:
        try:
            ensure_local_tmux_session(
                tmux_name
            )
        except Exception as exc:
            send(
                {
                    "type": "error",
                    "session": session_id,
                    "error":
                        "ChatDock tmux setup failed: "
                        + str(exc),
                }
            )
            return

    # v0.12.4: tmux window and new xterm client must have
    # identical geometry from the very first paint.
    preflight_tmux_geometry(
        host,
        tmux_name,
        rows,
        cols,
    )

    pid, fd = pty.fork()

    if pid == 0:
        environment = os.environ.copy()

        environment["TERM"] = (
            "xterm-256color"
        )
        environment["COLORTERM"] = (
            "truecolor"
        )

        # CHATDOCK_V0123_RAW_BEFORE_TMUX
        #
        # IMPORTANT:
        #
        # xterm.js immediately answers tmux capability queries
        # (DA/secondary-DA/OSC colour queries).
        #
        # pty.fork() initially inherits normal tty line discipline.
        # If ECHO is still enabled during those first milliseconds,
        # terminal-response bytes can be echoed back to xterm before
        # tmux has switched the client tty to raw mode.
        #
        # Those bytes never enter the tmux pane buffer, which is why
        # they appear as visual CCCC/~~~~ garbage in the browser while
        # capture-pane remains perfectly clean.
        #
        # Put the client slave in raw/no-echo mode BEFORE exec(tmux).
        try:
            tty.setraw(
                0,
                when=termios.TCSANOW,
            )
        except Exception:
            # tmux will still attempt its own tty setup; failure here
            # must not make the terminal unusable.
            pass

        # CHATDOCK_V0112_CHILD_WINSIZE
        #
        # pty.fork() gives the child its controlling terminal.
        # Set its final geometry BEFORE tmux starts so tmux never
        # paints an initial 80x24 frame that is immediately reflowed.
        set_terminal_size(
            0,
            rows,
            cols,
        )

        try:
            if host == LOCAL_HOST:
                os.execvpe(
                    "tmux",
                    local_tmux_command(
                        "attach-session",
                        "-t",
                        tmux_name,
                    ),
                    environment,
                )

            remote_command = (
                "TERM=xterm-256color "
                "tmux new-session "
                f"-A -s {tmux_name}"
            )

            os.execvpe(
                "ssh",
                [
                    "ssh",
                    "-tt",
                    REMOTE_SSH_HOST,
                    remote_command,
                ],
                environment,
            )

        except Exception as exc:
            os.write(
                2,
                (
                    "ChatDock terminal "
                    f"failed: {exc}\n"
                ).encode()
            )
            os._exit(127)

    set_terminal_size(
        fd,
        rows,
        cols,
    )

    with SESSIONS_LOCK:
        SESSIONS[session_id] = {
            "pid": pid,
            "fd": fd,
            "host": host,
            "tmux": tmux_name,
        }

    threading.Thread(
        target=terminal_reader,
        args=(
            session_id,
            fd,
            pid,
        ),
        daemon=True,
    ).start()

    send(
        {
            "type": "opened",
            "session": session_id,
            "host": host,
            "tmux": tmux_name,
            "reused": False,
        }
    )


# CHATDOCK_V0122_REDRAW
def redraw_session(
    message: dict[str, Any],
) -> None:
    """
    Force tmux to repaint the complete client screen.

    The browser resets its xterm before requesting this redraw.
    tmux's pane buffer therefore remains the source of truth and
    transient terminal-capability garbage cannot remain visible.
    """

    session_id = safe_name(
        message.get(
            "session",
            "",
        )
    )

    with SESSIONS_LOCK:
        session = SESSIONS.get(
            session_id
        )

    if not session:
        send(
            {
                "type": "redrawn",
                "session": session_id,
                "ok": False,
                "error":
                    "terminal session is not attached",
            }
        )
        return

    host = session["host"]
    tmux_name = session["tmux"]

    try:
        if host == LOCAL_HOST:
            list_cmd = local_tmux_command(
                "list-clients",
                "-F",
                "#{client_name}\t#{session_name}",
            )
        else:
            list_cmd = ssh_command(
                "tmux",
                "list-clients",
                "-F",
                "#{client_name}\t#{session_name}",
                timeout=3,
            )

        result = subprocess.run(
            list_cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=4,
            check=False,
        )

        client = ""

        if result.returncode == 0:
            for line in result.stdout.splitlines():
                parts = line.split(
                    "\t",
                    1,
                )

                if (
                    len(parts) == 2
                    and parts[1] == tmux_name
                ):
                    client = parts[0]
                    break

        if not client:
            raise RuntimeError(
                "tmux client not found for session "
                + tmux_name
            )

        if host == LOCAL_HOST:
            refresh_cmd = local_tmux_command(
                "refresh-client",
                "-t",
                client,
                "-S",
            )
        else:
            refresh_cmd = ssh_command(
                "tmux",
                "refresh-client",
                "-t",
                client,
                "-S",
                timeout=3,
            )

        refreshed = subprocess.run(
            refresh_cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            timeout=4,
            check=False,
        )

        if refreshed.returncode != 0:
            raise RuntimeError(
                refreshed.stderr.strip()
                or
                f"tmux refresh-client exit {refreshed.returncode}"
            )

        send(
            {
                "type": "redrawn",
                "session": session_id,
                "host": host,
                "tmux": tmux_name,
                "ok": True,
            }
        )

    except Exception as exc:
        send(
            {
                "type": "redrawn",
                "session": session_id,
                "host": host,
                "tmux": tmux_name,
                "ok": False,
                "error": str(exc),
            }
        )


def detach_session(
    session_id: str,
) -> None:
    session_id = safe_name(
        session_id
    )

    with SESSIONS_LOCK:
        session = SESSIONS.pop(
            session_id,
            None,
        )

    if not session:
        return

    # Kill only the tmux client.
    # The tmux server/session survives.
    try:
        os.kill(
            session["pid"],
            signal.SIGHUP,
        )
    except OSError:
        pass

    try:
        os.close(
            session["fd"]
        )
    except OSError:
        pass


def tmux_cwd(
    host: str,
    tmux_name: str,
) -> str:
    try:
        tmux_args = [
            "tmux",
            "display-message",
            "-p",
            "-t",
            tmux_name,
            "#{pane_current_path}",
        ]

        if host == LOCAL_HOST:
            command = local_tmux_command(
                *tmux_args[1:]
            )
            timeout = 4
        else:
            command = ssh_command(
                *tmux_args,
                timeout=5,
            )
            timeout = 7

        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=timeout,
            check=False,
        )

        cwd = result.stdout.strip()

        if (
            result.returncode == 0
            and cwd
        ):
            return cwd

    except (
        OSError,
        subprocess.SubprocessError,
    ):
        pass

    return (
        str(Path.home())
        if host == LOCAL_HOST
        else "~"
    )


def exec_worker(
    message: dict[str, Any],
) -> None:
    session_id = safe_name(
        message.get(
            "session",
            "",
        )
    )

    run_id = safe_name(
        message.get(
            "run_id",
            "run",
        )
    )

    script = str(
        message.get(
            "script",
            "",
        )
    )

    with SESSIONS_LOCK:
        session = SESSIONS.get(
            session_id
        )

    if not session:
        send(
            {
                "type": "exec_done",
                "session": session_id,
                "run_id": run_id,
                "code": 125,
                "error":
                    "terminal session "
                    "is not attached",
            }
        )
        return

    host = session["host"]
    tmux_name = session["tmux"]

    cwd = tmux_cwd(
        host,
        tmux_name,
    )

    send(
        {
            "type": "exec_started",
            "session": session_id,
            "run_id": run_id,
            "host": host,
            "cwd": cwd,
        }
    )

    try:
        if host == LOCAL_HOST:
            local_cwd = (
                cwd
                if os.path.isdir(cwd)
                else str(Path.home())
            )

            command = [
                "bash",
                "-c",
                script,
            ]

            process_cwd = local_cwd

        else:
            script64 = base64.b64encode(
                script.encode()
            ).decode()

            cwd64 = base64.b64encode(
                cwd.encode()
            ).decode()

            remote_command = (
                'CWD="$(printf %s '
                f'{cwd64} '
                '| base64 -d)"; '
                'cd -- "$CWD" '
                '2>/dev/null || cd ~; '
                'printf %s '
                f'{script64} '
                '| base64 -d | bash'
            )

            command = ssh_command(
                remote_command,
                timeout=8,
            )

            process_cwd = None

        process = subprocess.Popen(
            command,
            cwd=process_cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
        )

        assert process.stdout is not None

        exec_decoder = (
            codecs.getincrementaldecoder(
                "utf-8"
            )(
                errors="replace"
            )
        )

        while True:
            chunk = process.stdout.read(
                4096
            )

            if not chunk:
                break

            text = exec_decoder.decode(
                chunk
            )

            if text:
                send(
                    {
                        "type": "exec_output",
                        "session": session_id,
                        "run_id": run_id,
                        "data": text,
                    }
                )

        tail = exec_decoder.decode(
            b"",
            final=True,
        )

        if tail:
            send(
                {
                    "type": "exec_output",
                    "session": session_id,
                    "run_id": run_id,
                    "data": tail,
                }
            )

        code = process.wait()

        send(
            {
                "type": "exec_done",
                "session": session_id,
                "run_id": run_id,
                "host": host,
                "code": code,
            }
        )

    except Exception as exc:
        send(
            {
                "type": "exec_done",
                "session": session_id,
                "run_id": run_id,
                "host": host,
                "code": 125,
                "error": str(exc),
            }
        )


def list_sessions() -> None:
    sessions: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def collect(
        host: str,
        command: list[str],
        timeout: int,
    ) -> None:
        try:
            result = subprocess.run(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=timeout,
                check=False,
            )

            if result.returncode != 0:
                return

            for name in (
                result.stdout.splitlines()
            ):
                name = name.strip()

                key = (
                    host,
                    name,
                )

                if (
                    name
                    and key not in seen
                ):
                    seen.add(key)
                    sessions.append(
                        {
                            "host": host,
                            "tmux": name,
                        }
                    )

        except (
            OSError,
            subprocess.SubprocessError,
        ):
            pass

    # Current ChatDock-owned local sessions.
    collect(
        LOCAL_HOST,
        local_tmux_command(
            "list-sessions",
            "-F",
            "#{session_name}",
        ),
        4,
    )

    # Legacy v0.8/default-server sessions stay visible so users
    # can reopen/migrate them without losing discoverability.
    collect(
        LOCAL_HOST,
        [
            "tmux",
            "list-sessions",
            "-F",
            "#{session_name}",
        ],
        4,
    )

    # Remote currently keeps its existing/default tmux server.
    collect(
        REMOTE_HOST,
        ssh_command(
            "tmux",
            "list-sessions",
            "-F",
            "#{session_name}",
            timeout=5,
        ),
        7,
    )

    send(
        {
            "type": "sessions_list",
            "sessions": sessions,
        }
    )



def health_worker() -> None:
    """
    Return a lightweight host-health snapshot.

    Canavar SSH probing is isolated in a worker thread so an
    unavailable remote host cannot block terminal I/O.
    """

    remote_ok = False
    remote_error = ""

    try:
        result = subprocess.run(
            ssh_command(
                "hostname",
                timeout=2,
            ),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=4,
            check=False,
        )

        remote_ok = (
            result.returncode == 0
        )

        remote_hostname = (
            result.stdout.strip()
            if remote_ok
            else REMOTE_SSH_HOST
        )

        if not remote_ok:
            remote_error = (
                result.stderr.strip()
                or
                f"SSH exit {result.returncode}"
            )

    except subprocess.TimeoutExpired:
        remote_hostname = REMOTE_SSH_HOST
        remote_error = (
            "Canavar SSH zaman aşımı"
        )

    except (
        OSError,
        subprocess.SubprocessError,
    ) as exc:
        remote_hostname = REMOTE_SSH_HOST
        remote_error = str(exc)

    send(
        {
            "type": "health",

            "native": {
                "ok": True,
                "version":
                    CHATDOCK_NATIVE_VERSION,
            },

            "zaku": {
                "ok": True,
                "host":
                    os.uname().nodename,
            },

            "canavar": {
                "ok": remote_ok,
                "host":
                    remote_hostname,
                "error":
                    remote_error[:240],
            },

            "checked_at":
                time.time(),
        }
    )


def handle(
    message: dict[str, Any],
) -> None:
    message_type = message.get(
        "type"
    )

    session_id = safe_name(
        message.get(
            "session",
            "",
        )
    )

    if message_type == "ping":
        send(
            {
                "type": "pong",
                "remote_host":
                    REMOTE_SSH_HOST,
            }
        )
        return

    if message_type == "health":
        threading.Thread(
            target=health_worker,
            daemon=True,
        ).start()
        return

    if message_type == "open":
        open_session(message)
        return

    if message_type == "input":
        with SESSIONS_LOCK:
            session = SESSIONS.get(
                session_id
            )

        if session:
            try:
                os.write(
                    session["fd"],
                    str(
                        message.get(
                            "data",
                            "",
                        )
                    ).encode("utf-8"),
                )

            except OSError as exc:
                send(
                    {
                        "type": "error",
                        "session":
                            session_id,
                        "error": str(exc),
                    }
                )
        return

    if message_type == "redraw":
        threading.Thread(
            target=redraw_session,
            args=(message,),
            daemon=True,
        ).start()
        return

    if message_type == "resize":
        with SESSIONS_LOCK:
            session = SESSIONS.get(
                session_id
            )

        if session:
            set_terminal_size(
                session["fd"],
                message.get(
                    "rows",
                    24,
                ),
                message.get(
                    "cols",
                    80,
                ),
            )
        return

    if message_type == "close":
        detach_session(
            session_id
        )
        return

    if message_type == "exec":
        threading.Thread(
            target=exec_worker,
            args=(message,),
            daemon=True,
        ).start()
        return

    if message_type == "list_sessions":
        threading.Thread(
            target=list_sessions,
            daemon=True,
        ).start()



def version_tuple(value: str) -> tuple[int, ...]:
    parts = []

    for part in str(value).split("."):
        number = ""

        for char in part:
            if char.isdigit():
                number += char
            else:
                break

        parts.append(
            int(number or 0)
        )

    return tuple(parts)


def maybe_self_update() -> None:
    """
    Update only the installed native host.

    Repo/dev copies never rewrite themselves.
    """

    current = Path(
        __file__
    ).resolve()

    installed = (
        Path.home()
        / ".local"
        / "share"
        / "zaku-chatdock"
        / "chatdock_native.py"
    ).resolve()

    if current != installed:
        return

    cache_dir = (
        Path.home()
        / ".cache"
        / "zaku-chatdock"
    )

    cache_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    stamp = (
        cache_dir
        / "native-update-check"
    )

    try:
        if (
            stamp.exists()
            and
            time.time()
            -
            stamp.stat().st_mtime
            <
            NATIVE_UPDATE_INTERVAL
        ):
            return

        stamp.touch()

    except OSError:
        pass

    try:
        request = urllib.request.Request(
            NATIVE_UPDATE_MANIFEST,
            headers={
                "User-Agent":
                    "Zaku-ChatDock/"
                    + CHATDOCK_NATIVE_VERSION
            }
        )

        with urllib.request.urlopen(
            request,
            timeout=3
        ) as response:
            metadata = json.loads(
                response.read()
            )

        remote_version = str(
            metadata.get(
                "version",
                "0"
            )
        )

        if (
            version_tuple(
                remote_version
            )
            <=
            version_tuple(
                CHATDOCK_NATIVE_VERSION
            )
        ):
            return

        url = str(
            metadata.get(
                "url",
                ""
            )
        )

        expected_hash = str(
            metadata.get(
                "sha256",
                ""
            )
        ).lower()

        if (
            not url.startswith(
                "https://"
            )
            or
            len(expected_hash) != 64
        ):
            return

        request = urllib.request.Request(
            url,
            headers={
                "User-Agent":
                    "Zaku-ChatDock-Updater/"
                    + CHATDOCK_NATIVE_VERSION
            }
        )

        with urllib.request.urlopen(
            request,
            timeout=5
        ) as response:
            payload = response.read()

        actual_hash = hashlib.sha256(
            payload
        ).hexdigest()

        if actual_hash != expected_hash:
            return

        # Basic sanity checks before replacing.
        source = payload.decode(
            "utf-8"
        )

        compile(
            source,
            str(current),
            "exec"
        )

        fd, temp_name = tempfile.mkstemp(
            prefix=".chatdock-native-",
            dir=str(
                current.parent
            )
        )

        try:
            with os.fdopen(
                fd,
                "wb"
            ) as f:
                f.write(
                    payload
                )
                f.flush()
                os.fsync(
                    f.fileno()
                )

            os.chmod(
                temp_name,
                0o755
            )

            os.replace(
                temp_name,
                current
            )

        finally:
            try:
                os.unlink(
                    temp_name
                )
            except FileNotFoundError:
                pass

        # Keep the existing Native Messaging stdin/stdout
        # descriptors and restart into the new source.
        os.execv(
            sys.executable,
            [
                sys.executable,
                str(current)
            ]
        )

    except Exception:
        # Updates must never prevent ChatDock from starting.
        return


def main() -> None:
    maybe_self_update()

    try:
        while True:
            message = receive()

            if message is None:
                break

            try:
                handle(message)

            except Exception as exc:
                send(
                    {
                        "type": "error",
                        "session":
                            safe_name(
                                message.get(
                                    "session",
                                    "",
                                )
                            ),
                        "error": str(exc),
                    }
                )

    finally:
        with SESSIONS_LOCK:
            session_ids = list(
                SESSIONS
            )

        for session_id in session_ids:
            detach_session(
                session_id
            )


if __name__ == "__main__":
    main()
