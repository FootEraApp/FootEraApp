import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { API } from "../config.js";
import { LocalNotifications } from "@capacitor/local-notifications"

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function getUsuarioId() {
  return (
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    ""
  );
}

async function salvarTokenFCM(tokenValue: string) {
  const jwt = getToken();

  if (!jwt) {
    throw new Error("Você precisa estar logado para salvar o token FCM.");
  }

  const res = await fetch(`${API.BASE_URL}/api/notificacoes/push/native/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      platform: "android",
      token: tokenValue,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || "Erro ao salvar token FCM no backend.");
  }

  localStorage.setItem("footera:fcmToken", tokenValue);
  localStorage.setItem("footera:fcmTokenUsuarioId", getUsuarioId());

  console.log("[push native] token FCM salvo no backend", {
    tokenStart: tokenValue.slice(0, 16),
    api: API.BASE_URL,
  });

  return json;
}

export async function ativarPushAndroidNativo() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const jwt = getToken();

  if (!jwt) {
    throw new Error("Você precisa estar logado para ativar notificações.");
  }

  let permission = await PushNotifications.checkPermissions();

  if (permission.receive !== "granted") {
    permission = await PushNotifications.requestPermissions();
  }

  if (permission.receive !== "granted") {
    throw new Error("Permissão de notificação negada no Android.");
  }

  await PushNotifications.removeAllListeners();

  try {
    await PushNotifications.createChannel({
      id: "footera_default",
      name: "FootEra",
      description: "Notificações da FootEra",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch (e) {
    console.warn("[push native] não foi possível criar canal", e);
  }

  try {
    await LocalNotifications.requestPermissions();

    await LocalNotifications.createChannel({
      id: "footera_default",
      name: "FootEra",
      description: "Notificações da FootEra",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch (e) {
    console.warn("[push native] não foi possível preparar notificação local", e);
  }

  return await new Promise<boolean>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          "O Android liberou permissão, mas não retornou token FCM a tempo. Tente fechar e abrir o app novamente."
        )
      );
    }, 15000);

    PushNotifications.addListener("registration", async (token) => {
      try {
        console.log("[push native] registration token recebido", {
          tokenStart: token.value.slice(0, 16),
        });

        await salvarTokenFCM(token.value);

        window.clearTimeout(timeout);
        resolve(true);
      } catch (e) {
        window.clearTimeout(timeout);
        reject(e);
      }
    });

    PushNotifications.addListener("registrationError", (error) => {
      window.clearTimeout(timeout);
      console.error("[push native] registrationError:", error);
      reject(new Error(String((error as any)?.error || "Erro ao registrar push nativo.")));
    });

    PushNotifications.addListener("pushNotificationReceived", async (notification) => {
    console.log("[push native] recebida com app aberto:", notification);

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2147483647),
            title:
              notification.title ||
              notification.data?.title ||
              "FootEra",
            body:
              notification.body ||
              notification.data?.body ||
              notification.data?.mensagem ||
              "Você tem uma nova notificação.",
            channelId: "footera_default",
            extra: notification.data || {},
          },
        ],
      });
    } catch (e) {
      console.warn("[push native] erro ao mostrar notificação local:", e);
    }
  });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[push native] clicada:", action);
      const url =
        action.notification?.data?.url ||
        action.notification?.data?.link ||
        "/notificacoes";

      if (url) {
        window.location.href = String(url);
      }
    });

    PushNotifications.register().catch((e) => {
      window.clearTimeout(timeout);
      reject(e);
    });
  });
}

export async function desativarPushAndroidNativo() {
  const jwt = getToken();
  const token = localStorage.getItem("footera:fcmToken") || "";

  if (!jwt || !token) return;

  await fetch(`${API.BASE_URL}/api/notificacoes/push/native/unsubscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ token }),
  });

  localStorage.removeItem("footera:fcmToken");
  localStorage.removeItem("footera:fcmTokenUsuarioId");
}