"use strict";

let nativePort = null;

const clients = new Set();


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
      browser.runtime.connectNative(
        "local.zaku.chatdock"
      );

    nativePort.onMessage.addListener(
      broadcast
    );

    nativePort.onDisconnect.addListener(
      () => {

        const err =
          browser.runtime
            .lastError
            ?.message
          ||
          "native host disconnected";

        nativePort = null;

        broadcast({
          __chatdock_ctl:
            "close",
          error: err
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


browser.runtime.onConnect.addListener(
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
              "native host unavailable"
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
