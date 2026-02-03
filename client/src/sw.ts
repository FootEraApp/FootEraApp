/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { createHandlerBoundToURL } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

(self as any).__WB_DISABLE_DEV_LOGS = true;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"))
);

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "html-cache",
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 })],
  })
);

const FALLBACK_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";
const FALLBACK_TREINO = "/assets/usuarios/footera-logo-fundo-verde.png";

registerRoute(
  ({ request, url }) =>
    request.destination === "image" &&
    (url.pathname.startsWith("/assets/usuarios/") ||
      url.pathname.startsWith("/assets/treinos/")),
  async ({ request }) => {
    try {
      const res = await fetch(request);

      if (res && res.status === 404) {
        const u = new URL(request.url);
        return fetch(
          u.pathname.startsWith("/assets/treinos/")
            ? FALLBACK_TREINO
            : FALLBACK_AVATAR
        );
      }

      return res;
    } catch {
      const u = new URL(request.url);
      return fetch(
        u.pathname.startsWith("/assets/treinos/")
          ? FALLBACK_TREINO
          : FALLBACK_AVATAR
      );
    }
  },
  "GET"
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/assets/"),
  new StaleWhileRevalidate({
    cacheName: "assets-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 400,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  }),
  "GET"
);