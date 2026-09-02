import {
  io,
} from "socket.io-client";

import {
  API,
} from "../config.js";

function readStoredToken() {
  return (
    localStorage.getItem(
      "token"
    ) ||
    sessionStorage.getItem(
      "token"
    ) ||
    ""
  );
}

const initialToken =
  readStoredToken();

const socket =
  io(API.BASE_URL, {
    auth: initialToken
      ? {
          token:
            initialToken,
        }
      : {},

    transports: [
      "websocket",
    ],

    /*
     * Visitante não precisa
     * abrir Socket.
     */
    autoConnect:
      Boolean(initialToken),
  });

function clearPresenceTimer() {
  const timer =
    (socket as any)
      .__presenceTimer;

  if (timer) {
    clearInterval(timer);

    (socket as any)
      .__presenceTimer =
      null;
  }
}

socket.on(
  "connect",
  () => {
    clearPresenceTimer();

    socket.emit(
      "presence:ping"
    );

    const timer =
      setInterval(() => {
        socket.emit(
          "presence:ping"
        );
      }, 25_000);

    (socket as any)
      .__presenceTimer =
      timer;
  }
);

socket.on(
  "disconnect",
  () => {
    clearPresenceTimer();
  }
);

export function syncSocketAuth(
  token?: string | null
) {
  const nextToken =
    String(
      token ??
        readStoredToken() ??
        ""
    ).trim();

  if (!nextToken) {
    socket.auth = {};

    if (socket.connected) {
      socket.disconnect();
    }

    return;
  }

  socket.auth = {
    token: nextToken,
  };

  /*
   * Força novo handshake
   * com o token atualizado.
   */
  if (socket.connected) {
    socket.disconnect();
  }

  socket.connect();
}

export default socket;