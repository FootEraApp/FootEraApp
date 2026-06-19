import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { API } from "../config.js";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export async function ativarPushAndroidNativo() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  let permission = await PushNotifications.checkPermissions();

  if (permission.receive !== "granted") {
    permission = await PushNotifications.requestPermissions();
  }

  if (permission.receive !== "granted") {
    throw new Error("Permissão de notificação negada no Android.");
  }

  await PushNotifications.removeAllListeners();

  await PushNotifications.addListener("registration", async (token) => {
    const jwt = getToken();

    const response = await fetch(
      `${API.BASE_URL}/api/notificacoes/push/native/subscribe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          platform: "android",
          token: token.value,
        }),
      }
    );

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      throw new Error(txt || "Erro ao salvar token FCM no backend.");
    }
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.error("[push native] registrationError:", error);
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[push native] recebida:", notification);
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[push native] clicada:", action);
  });

  await PushNotifications.register();

  return true;
}