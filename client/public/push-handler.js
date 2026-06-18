self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "FootEra",
      body: event.data ? event.data.text() : "Você tem uma nova notificação.",
    };
  }

  const title = data.title || "FootEra";
  const options = {
    body: data.body || data.mensagem || "Você tem uma nova notificação.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || data.tipo || "footera-notificacao",
    data: {
      url: data.url || data.link || "/notificacoes",
      notificacaoId: data.notificacaoId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/notificacoes";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});