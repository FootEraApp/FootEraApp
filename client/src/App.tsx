import { useEffect } from "react";
import { AppRoutes } from "./routes.js";
import { UserProvider } from "./context/UserContext.js";
import { usePresencePing } from "@/hooks/usePresencePing";
import { sincronizarPushSePermitido } from "./services/pushNotifications.js";
import { inicializarPushAndroidNativo } from "./services/nativePushNotifications.js";
import ToastContainer from "./components/ui/ToastContainer.js";

function PresenceBoot() {
  usePresencePing();
  return null;
}

function PushBoot() {
  useEffect(() => {
    let cancelado = false;

    async function inicializarPush() {
      if (cancelado) return;

      try {
        await sincronizarPushSePermitido();
      } catch (e) {
        console.warn("[push web] não sincronizou no boot:", e);
      }

      try {
        await inicializarPushAndroidNativo();
      } catch (e) {
        console.warn("[push native] não inicializou no boot:", e);
      }
    }

    inicializarPush();

    const timeout = window.setTimeout(() => {
      inicializarPush();
    }, 1500);

    const onFocus = () => {
      inicializarPush();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        inicializarPush();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelado = true;
      window.clearTimeout(timeout);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <UserProvider>
      <PresenceBoot />
      <PushBoot />
      <AppRoutes />
      <ToastContainer />
    </UserProvider>
  );
}