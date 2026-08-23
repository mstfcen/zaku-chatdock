#!/usr/bin/env python3

import sys
import os
import json
import struct
import threading
import pty
import signal
import fcntl
import termios
import select
import re
import subprocess
import base64

INP = sys.stdin.buffer
OUT = sys.stdout.buffer

WRITE_LOCK = threading.Lock()
SESSIONS_LOCK = threading.Lock()

SESSIONS = {}


def send(obj):

    data = json.dumps(
        obj,
        ensure_ascii=False
    ).encode("utf-8")

    with WRITE_LOCK:

        OUT.write(
            struct.pack(
                "<I",
                len(data)
            )
        )

        OUT.write(data)
        OUT.flush()


def read_exact(n):

    chunks = []

    while n:

        b = INP.read(n)

        if not b:
            return None

        chunks.append(b)

        n -= len(b)

    return b"".join(chunks)


def recv():

    hdr = read_exact(4)

    if not hdr:
        return None

    n = struct.unpack(
        "<I",
        hdr
    )[0]

    if n > 8 * 1024 * 1024:
        raise ValueError(
            "message too large"
        )

    body = read_exact(n)

    if body is None:
        return None

    return json.loads(
        body.decode("utf-8")
    )


def safe(s):

    return (
        re.sub(
            r"[^A-Za-z0-9_-]",
            "_",
            str(s)
        )[:100]
        or
        "chatdock"
    )


def resize(fd, rows, cols):

    try:

        data = struct.pack(
            "HHHH",
            max(5, int(rows)),
            max(20, int(cols)),
            0,
            0
        )

        fcntl.ioctl(
            fd,
            termios.TIOCSWINSZ,
            data
        )

    except Exception:
        pass


def reader(sid, fd, pid):

    try:

        while True:

            ready, _, _ = select.select(
                [fd],
                [],
                [],
                0.5
            )

            if fd in ready:

                try:

                    data = os.read(
                        fd,
                        65536
                    )

                except OSError:
                    break

                if not data:
                    break

                send({
                    "type": "output",
                    "session": sid,
                    "data":
                        data.decode(
                            "utf-8",
                            "replace"
                        )
                })

            try:

                done, status = os.waitpid(
                    pid,
                    os.WNOHANG
                )

                if done:

                    send({
                        "type": "exit",
                        "session": sid,
                        "code":
                            os.waitstatus_to_exitcode(
                                status
                            )
                    })

                    break

            except ChildProcessError:
                break

    finally:

        with SESSIONS_LOCK:

            cur = SESSIONS.get(sid)

            if (
                cur and
                cur["fd"] == fd
            ):
                SESSIONS.pop(
                    sid,
                    None
                )

        try:
            os.close(fd)
        except OSError:
            pass


def open_session(msg):

    sid = safe(
        msg.get(
            "session",
            "chatdock"
        )
    )

    host = msg.get(
        "host",
        "zaku"
    )

    tmux_name = safe(
        msg.get("tmux")
        or
        sid
    )

    rows = msg.get(
        "rows",
        24
    )

    cols = msg.get(
        "cols",
        80
    )

    if host not in (
        "zaku",
        "canavar"
    ):

        send({
            "type": "error",
            "session": sid,
            "error": "invalid host"
        })

        return

    with SESSIONS_LOCK:

        old = SESSIONS.get(
            sid
        )

    if old:

        resize(
            old["fd"],
            rows,
            cols
        )

        send({
            "type": "opened",
            "session": sid,
            "host": host,
            "tmux": old["tmux"],
            "reused": True
        })

        return

    pid, fd = pty.fork()

    if pid == 0:

        env = os.environ.copy()

        env["TERM"] = \
            "xterm-256color"

        env["COLORTERM"] = \
            "truecolor"

        try:

            if host == "zaku":

                os.execvpe(
                    "tmux",
                    [
                        "tmux",
                        "new-session",
                        "-A",
                        "-s",
                        tmux_name
                    ],
                    env
                )

            remote = (
                "TERM=xterm-256color "
                "tmux new-session "
                f"-A -s {tmux_name}"
            )

            os.execvpe(
                "ssh",
                [
                    "ssh",
                    "-tt",
                    "canavar",
                    remote
                ],
                env
            )

        except Exception as e:

            os.write(
                2,
                (
                    "ChatDock exec "
                    f"failed: {e}\n"
                ).encode()
            )

            os._exit(127)

    resize(
        fd,
        rows,
        cols
    )

    with SESSIONS_LOCK:

        SESSIONS[sid] = {
            "pid": pid,
            "fd": fd,
            "host": host,
            "tmux": tmux_name
        }

    threading.Thread(
        target=reader,
        args=(
            sid,
            fd,
            pid
        ),
        daemon=True
    ).start()

    send({
        "type": "opened",
        "session": sid,
        "host": host,
        "tmux": tmux_name,
        "reused": False
    })


def detach_session(sid):

    sid = safe(sid)

    with SESSIONS_LOCK:

        s = SESSIONS.pop(
            sid,
            None
        )

    if not s:
        return

    # Only kill the tmux CLIENT.
    # The tmux server/session remains alive.

    try:
        os.kill(
            s["pid"],
            signal.SIGHUP
        )
    except Exception:
        pass

    try:
        os.close(
            s["fd"]
        )
    except OSError:
        pass


def tmux_cwd(
    host,
    tmux_name
):

    try:

        if host == "zaku":

            r = subprocess.run(
                [
                    "tmux",
                    "display-message",
                    "-p",
                    "-t",
                    tmux_name,
                    "#{pane_current_path}"
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=4
            )

            cwd = \
                r.stdout.strip()

            if (
                r.returncode == 0
                and
                cwd
            ):
                return cwd

            return \
                os.path.expanduser("~")

        r = subprocess.run(
            [
                "ssh",
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=5",
                "canavar",
                "tmux",
                "display-message",
                "-p",
                "-t",
                tmux_name,
                "#{pane_current_path}"
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=7
        )

        return (
            r.stdout.strip()
            or
            "~"
        )

    except Exception:

        return (
            os.path.expanduser("~")
            if host == "zaku"
            else "~"
        )


def exec_worker(msg):

    sid = safe(
        msg.get(
            "session",
            ""
        )
    )

    run_id = safe(
        msg.get(
            "run_id",
            "run"
        )
    )

    script = str(
        msg.get(
            "script",
            ""
        )
    )

    with SESSIONS_LOCK:

        s = SESSIONS.get(
            sid
        )

    if not s:

        send({
            "type": "exec_done",
            "session": sid,
            "run_id": run_id,
            "code": 125,
            "error":
                "terminal session "
                "is not attached"
        })

        return

    host = s["host"]
    tmux_name = s["tmux"]

    cwd = tmux_cwd(
        host,
        tmux_name
    )

    send({
        "type": "exec_started",
        "session": sid,
        "run_id": run_id,
        "host": host,
        "cwd": cwd
    })

    try:

        if host == "zaku":

            proc = subprocess.Popen(
                [
                    "bash",
                    "-c",
                    script
                ],
                cwd=(
                    cwd
                    if os.path.isdir(cwd)
                    else
                    os.path.expanduser("~")
                ),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0
            )

        else:

            script64 = \
                base64.b64encode(
                    script.encode()
                ).decode()

            cwd64 = \
                base64.b64encode(
                    cwd.encode()
                ).decode()

            remote = (
                'CWD="$(printf %s '
                f'{cwd64} '
                '| base64 -d)"; '
                'cd -- "$CWD" '
                '2>/dev/null || cd ~; '
                'printf %s '
                f'{script64} '
                '| base64 -d | bash'
            )

            proc = subprocess.Popen(
                [
                    "ssh",
                    "-o",
                    "BatchMode=yes",
                    "-o",
                    "ConnectTimeout=8",
                    "canavar",
                    remote
                ],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0
            )

        while True:

            chunk = \
                proc.stdout.read(
                    4096
                )

            if not chunk:
                break

            send({
                "type": "exec_output",
                "session": sid,
                "run_id": run_id,
                "data":
                    chunk.decode(
                        "utf-8",
                        "replace"
                    )
            })

        code = proc.wait()

        send({
            "type": "exec_done",
            "session": sid,
            "run_id": run_id,
            "host": host,
            "code": code
        })

    except Exception as e:

        send({
            "type": "exec_done",
            "session": sid,
            "run_id": run_id,
            "host": host,
            "code": 125,
            "error": str(e)
        })


def list_sessions():

    result = []

    for host in (
        "zaku",
        "canavar"
    ):

        try:

            if host == "zaku":

                r = subprocess.run(
                    [
                        "tmux",
                        "list-sessions",
                        "-F",
                        "#{session_name}"
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=4
                )

            else:

                r = subprocess.run(
                    [
                        "ssh",
                        "-o",
                        "BatchMode=yes",
                        "-o",
                        "ConnectTimeout=5",
                        "canavar",
                        "tmux",
                        "list-sessions",
                        "-F",
                        "#{session_name}"
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=7
                )

            if r.returncode == 0:

                for name in \
                    r.stdout.splitlines():

                    name = name.strip()

                    if name:

                        result.append({
                            "host": host,
                            "tmux": name
                        })

        except Exception:
            pass

    send({
        "type": "sessions_list",
        "sessions": result
    })


def handle(msg):

    typ = msg.get("type")

    sid = safe(
        msg.get(
            "session",
            ""
        )
    )

    if typ == "ping":

        send({
            "type": "pong"
        })

    elif typ == "open":

        open_session(msg)

    elif typ == "input":

        with SESSIONS_LOCK:

            s = SESSIONS.get(
                sid
            )

        if s:

            try:

                os.write(
                    s["fd"],
                    str(
                        msg.get(
                            "data",
                            ""
                        )
                    ).encode("utf-8")
                )

            except Exception as e:

                send({
                    "type": "error",
                    "session": sid,
                    "error": str(e)
                })

    elif typ == "resize":

        with SESSIONS_LOCK:

            s = SESSIONS.get(
                sid
            )

        if s:

            resize(
                s["fd"],
                msg.get(
                    "rows",
                    24
                ),
                msg.get(
                    "cols",
                    80
                )
            )

    elif typ == "close":

        detach_session(
            sid
        )

    elif typ == "exec":

        threading.Thread(
            target=exec_worker,
            args=(msg,),
            daemon=True
        ).start()

    elif typ == "list_sessions":

        threading.Thread(
            target=list_sessions,
            daemon=True
        ).start()


def main():

    try:

        while True:

            msg = recv()

            if msg is None:
                break

            try:

                handle(msg)

            except Exception as e:

                send({
                    "type": "error",
                    "session":
                        safe(
                            msg.get(
                                "session",
                                ""
                            )
                        ),
                    "error": str(e)
                })

    finally:

        with SESSIONS_LOCK:

            ids = list(
                SESSIONS
            )

        for sid in ids:

            detach_session(
                sid
            )


if __name__ == "__main__":
    main()
