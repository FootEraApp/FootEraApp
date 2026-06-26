import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { API } from "../config.js";

let listenersInstalados = false;

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getUsuarioIdPushAtual() {
  const direto =
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    localStorage.getItem("userId") ||
    sessionStorage.getItem("userId") ||
    localStorage.getItem("idUsuario") ||
    sessionStorage.getItem("idUsuario") ||
    "";

  if (direto) return direto;

  const payload = decodeJwtPayload(getToken());

  return String(
    payload?.usuarioId ||
      payload?.userId ||
      payload?.id ||
      payload?.sub ||
      ""
  );
}

export function fcmTokenPertenceAoUsuarioAtual() {
  const usuarioAtual = getUsuarioIdPushAtual();
  const tokenSalvo = localStorage.getItem("footera:fcmToken") || "";
  const tokenUsuarioId = localStorage.getItem("footera:fcmTokenUsuarioId") || "";

  return !!tokenSalvo && !!usuarioAtual && tokenUsuarioId === usuarioAtual;
}

async function salvarTokenFCM(tokenValue: string) {
  const jwt = getToken();

  if (!jwt) {
    throw new Error("Você precisa estar logado para salvar o token FCM.");
  }

  const usuarioAtual = getUsuarioIdPushAtual();

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
  localStorage.setItem("footera:fcmTokenUsuarioId", usuarioAtual);

  console.log("[push native] token FCM salvo no backend", {
    tokenStart: tokenValue.slice(0, 16),
    usuarioAtual,
    api: API.BASE_URL,
  });

  return json;
}

async function prepararCanaisAndroid() {
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
    console.warn("[push native] não foi possível criar canal push", e);
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
    console.warn("[push native] não foi possível criar canal local", e);
  }
}

async function mostrarNotificacaoLocal(notification: any) {
  const data = notification?.data || {};

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Date.now() % 2147483647),
        title:
          notification?.title ||
          data?.title ||
          data?.titulo ||
          "FootEra",
        body:
          notification?.body ||
          data?.body ||
          data?.mensagem ||
          data?.message ||
          data?.texto ||
          "Você tem uma nova notificação.",
        channelId: "footera_default",
        extra: data,
      },
    ],
  });
}

export async function mostrarNotificacaoLocalTeste() {
  if (!Capacitor.isNativePlatform()) return false;

  await prepararCanaisAndroid();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Date.now() % 2147483647),
        title: "Teste de notificação FootEra",
        body: "Se você recebeu isso, as notificações locais do app estão funcionando.",
        channelId: "footera_default",
        extra: {
          url: "/notificacoes",
          tipo: "TESTE_LOCAL",
        },
      },
    ],
  });

  return true;
}

export async function inicializarPushAndroidNativo() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const jwt = getToken();

  if (!jwt) {
    return false;
  }

  const perm = await PushNotifications.checkPermissions();

  if (perm.receive !== "granted") {
    return false;
  }

  await prepararCanaisAndroid();

  if (listenersInstalados) {
    return true;
  }

  await PushNotifications.removeAllListeners();

  PushNotifications.addListener("registration", async (token) => {
    try {
      console.log("[push native] registration token recebido", {
        tokenStart: token.value.slice(0, 16),
      });

      await salvarTokenFCM(token.value);
    } catch (e) {
      console.error("[push native] erro ao salvar token FCM:", e);
    }
  });

  PushNotifications.addListener("registrationError", (error) => {
    console.error("[push native] registrationError:", error);
  });

  PushNotifications.addListener("pushNotificationReceived", async (notification) => {
    console.log("[push native] recebida com app aberto:", notification);

    try {
      await mostrarNotificacaoLocal(notification);
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

  listenersInstalados = true;

  return true;
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

  await inicializarPushAndroidNativo();

  return await new Promise<boolean>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          "O Android liberou permissão, mas não retornou token FCM a tempo. Feche e abra o app, depois clique em Ativar novamente."
        )
      );
    }, 15000);

    PushNotifications.addListener("registration", async (token) => {
      try {
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
      reject(new Error(String((error as any)?.error || "Erro ao registrar push nativo.")));
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

  if (jwt && token) {
    await fetch(`${API.BASE_URL}/api/notificacoes/push/native/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ token }),
    }).catch((e) => {
      console.warn("[push native] erro ao remover token no backend:", e);
    });
  }

  localStorage.removeItem("footera:fcmToken");
  localStorage.removeItem("footera:fcmTokenUsuarioId");
}