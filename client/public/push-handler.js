function normalizarDestino(raw) {
  const fallback = "/notificacoes";

  try {
    const value = String(raw || "").trim();

    if (!value) {
      return fallback;
    }

    const url = new URL(
      value,
      self.location.origin
    );

    if (
      url.origin !==
      self.location.origin
    ) {
      return fallback;
    }

    return (
      url.pathname +
      url.search +
      url.hash
    );
  } catch {
    return fallback;
  }
}

self.addEventListener(
  "push",
  (event) => {
    let data = {};

    try {
      data = event.data
        ? event.data.json()
        : {};
    } catch {
      data = {
        title: "FootEra",
        body: event.data
          ? event.data.text()
          : "Você tem uma nova notificação.",
      };
    }

    const title =
      data.title || "FootEra";

    const destino =
      normalizarDestino(
        data.url ||
        data.link
      );

    const options = {
      body:
        data.body ||
        data.mensagem ||
        "Você tem uma nova notificação.",

      icon:
        data.icon ||
        "/icon-192.png",

      badge:
        data.badge ||
        "/icon-192.png",

      tag:
        data.tag ||
        data.tipo ||
        "footera-notificacao",

      data: {
        url: destino,

        notificacaoId:
          data.notificacaoId ||
          null,
      },
    };

    event.waitUntil(
      self.registration.showNotification(
        title,
        options
      )
    );
  }
);

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const destino =
      normalizarDestino(
        event.notification?.data?.url
      );

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clientList) => {
          for (
            const client of clientList
          ) {
            if ("focus" in client) {
              client.navigate(
                destino
              );

              return client.focus();
            }
          }

          if (
            clients.openWindow
          ) {
            return clients.openWindow(
              destino
            );
          }
        })
    );
  }
);