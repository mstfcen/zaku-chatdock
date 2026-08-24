"use strict";

const EXT =
  globalThis.browser
  ??
  globalThis.chrome;

const COMPANION_INSTALL_URL =
  "https://github.com/mstfcen/zaku-chatdock#chatdock-companion";

if (!EXT)
  throw new Error(
    "WebExtension runtime API unavailable"
  );

let nativePort = null;

const clients = new Set();


function companionRequiredFor(
  error
) {

  const text =
    String(
      error || ""
    ).toLowerCase();

  return [
    "native messaging host",
    "specified native messaging host",
    "host not found",
    "not found",
    "not registered",
    "forbidden",
    "permission denied"
  ].some(
    needle =>
      text.includes(
        needle
      )
  );
}


function broadcast(msg) {

  for (const p of [...clients]) {

    try {
      p.postMessage(msg);
    }

    catch (_) {
      clients.delete(p);
    }
  }
}


function ensureNative() {

  if (nativePort)
    return nativePort;

  try {

    nativePort =
      EXT.runtime.connectNative(
        "local.zaku.chatdock"
      );

    nativePort.onMessage.addListener(
      broadcast
    );

    nativePort.onDisconnect.addListener(
      () => {

        const err =
          EXT.runtime
            .lastError
            ?.message
          ||
          "native host disconnected";

        const companionRequired =
          companionRequiredFor(
            err
          );

        nativePort = null;

        broadcast({
          __chatdock_ctl:
            "close",
          error: err,
          companion_required:
            companionRequired,
          help_url:
            companionRequired
              ? COMPANION_INSTALL_URL
              : null
        });
      }
    );

    return nativePort;

  }

  catch (e) {

    broadcast({
      __chatdock_ctl:
        "close",
      error: String(e)
    });

    nativePort = null;

    return null;
  }
}


EXT.runtime.onConnect.addListener(
  (port) => {

    if (
      port.name !==
      "chatdock-ui"
    )
      return;

    clients.add(port);

    const np =
      ensureNative();

    if (np) {

      port.postMessage({
        __chatdock_ctl:
          "open"
      });
    }

    port.onMessage.addListener(
      (msg) => {

        const p =
          ensureNative();

        if (!p) {

          port.postMessage({
            __chatdock_ctl:
              "close",
            error:
              "ChatDock Companion unavailable",
            companion_required: true,
            help_url: COMPANION_INSTALL_URL
          });

          return;
        }

        try {
          p.postMessage(msg);
        }

        catch (e) {

          port.postMessage({
            __chatdock_ctl:
              "close",
            error: String(e)
          });
        }
      }
    );

    port.onDisconnect.addListener(
      () => clients.delete(port)
    );
  }
);
