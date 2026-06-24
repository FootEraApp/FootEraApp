import { API } from "../config.js";

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getPublicKey() {
  const token = getToken();

  const res = await fetch(`${API.BASE_URL}/api/notificacoes/push/public-key`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || "Não foi possível carregar chave de push.");
  }

  return String(json.publicKey || "");
}

async function esperarServiceWorkerReady(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador não suporta service worker.");
  }

  let registrationAtual: ServiceWorkerRegistration | undefined =
    await navigator.serviceWorker.getRegistration("/");

  const scriptAtual =
    registrationAtual?.active?.scriptURL ||
    registrationAtual?.waiting?.scriptURL ||
    registrationAtual?.installing?.scriptURL ||
    "";

  const precisaRegistrarPushHandler =
    !registrationAtual || !scriptAtual.includes("/push-handler.js");

  if (precisaRegistrarPushHandler) {
    try {
      registrationAtual = await navigator.serviceWorker.register("/push-handler.js", {
        scope: "/",
      });
    } catch (e: any) {
      throw new Error(
        e?.message ||
          "Não foi possível registrar o service worker de push. Verifique se existe client/public/push-handler.js."
      );
    }
  }

  if (!registrationAtual) {
    throw new Error("Service worker de push não foi registrado corretamente.");
  }

  try {
    await registrationAtual.update();
  } catch {}

  if (registrationAtual.active) {
    return registrationAtual;
  }

  return await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            "Service worker não ficou pronto a tempo. Recarregue a página e tente ativar novamente."
          )
        );
      }, timeoutMs);
    }),
  ]);
}

export async function ativarPushNotifications() {
  const token = getToken();

  if (!token) {
    throw new Error("Você precisa estar logado para ativar notificações.");
  }

  if (!("Notification" in window)) {
    throw new Error("Este navegador não suporta notificações.");
  }

  if (!("PushManager" in window)) {
    throw new Error("Este navegador não suporta push notifications.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Permissão de notificação não foi concedida.");
  }

  const publicKey = await getPublicKey();

  if (!publicKey) {
    throw new Error("Chave pública de push não configurada.");
  }

  const registration = await esperarServiceWorkerReady();

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const res = await fetch(`${API.BASE_URL}/api/notificacoes/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subscription,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || "Não foi possível salvar dispositivo.");
  }

  return json;
}

export async function desativarPushNotifications() {
  const token = getToken();

  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await fetch(`${API.BASE_URL}/api/notificacoes/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
  }
}

export async function sincronizarPushSePermitido() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  try {
    await ativarPushNotifications();
  } catch (e) {
    console.warn("[push] não foi possível sincronizar", e);
  }
}

export type PushDeviceStatus =
  | "unsupported"
  | "default"
  | "denied"
  | "granted_without_subscription"
  | "subscribed";

export async function getPushDeviceStatus(): Promise<{
  status: PushDeviceStatus;
  permission: NotificationPermission | "unsupported";
  hasServiceWorker: boolean;
  hasSubscription: boolean;
}> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return {
      status: "unsupported",
      permission: "unsupported",
      hasServiceWorker: false,
      hasSubscription: false,
    };
  }

  const permission = Notification.permission;

  if (permission === "denied") {
    return {
      status: "denied",
      permission,
      hasServiceWorker: true,
      hasSubscription: false,
    };
  }

  if (permission === "default") {
    return {
      status: "default",
      permission,
      hasServiceWorker: true,
      hasSubscription: false,
    };
  }

  const registration = await navigator.serviceWorker.getRegistration("/");

  if (!registration) {
    return {
      status: "granted_without_subscription",
      permission,
      hasServiceWorker: false,
      hasSubscription: false,
    };
  }

  const subscription = await registration.pushManager.getSubscription();

  return {
    status: subscription ? "subscribed" : "granted_without_subscription",
    permission,
    hasServiceWorker: true,
    hasSubscription: !!subscription,
  };
}