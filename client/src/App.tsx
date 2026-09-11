// client/src/App
import { useEffect } from "react";
import { AppRoutes } from "./routes.js";
import { UserProvider } from "./context/UserContext.js";
import { usePresencePing } from "@/hooks/usePresencePing";
import { sincronizarPushSePermitido } from "./services/pushNotifications.js";
import ToastContainer from "./components/ui/ToastContainer.js";
import MaintenanceGate from "./components/system/MaintenanceGate.js"
import { AuthGateProvider } from "./context/AuthGateContext.js";
import {
  App as CapacitorApp,
} from "@capacitor/app";
import {
  Capacitor,
} from "@capacitor/core";
import {
  useLocation,
} from "wouter";
import {
  deepLinkPathFromUrl,
} from "./utils/publicRoutes.js";

function DeepLinkBoot() {
  const [, navigate] =
    useLocation();

  useEffect(() => {
    if (
      !Capacitor
        .isNativePlatform()
    ) {
      return;
    }

    let cancelado =
      false;

    function abrir(
      rawUrl?: string | null
    ) {
      if (
        cancelado ||
        !rawUrl
      ) {
        return;
      }

      const destino =
        deepLinkPathFromUrl(
          rawUrl
        );

      if (!destino) {
        console.warn(
          "[deep-link] URL ignorada:",
          rawUrl
        );

        return;
      }

      navigate(destino);
    }

    void CapacitorApp
      .getLaunchUrl()
      .then(
        (result) => {
          abrir(
            result?.url
          );
        }
      )
      .catch(
        (error) => {
          console.warn(
            "[deep-link] getLaunchUrl:",
            error
          );
        }
      );

    const listener =
      CapacitorApp
        .addListener(
          "appUrlOpen",
          ({ url }) => {
            abrir(url);
          }
        );

    return () => {
      cancelado =
        true;

      void listener.then(
        (handle) =>
          handle.remove()
      );
    };
  }, [navigate]);

  return null;
}

function PresenceBoot() {
  usePresencePing();
  return null;
}

function PushBoot() {
  useEffect(() => {
    const sincronizar = () => {
      void sincronizarPushSePermitido();
    };

    sincronizar();

    window.addEventListener(
      "footera:auth-changed",
      sincronizar
    );

    return () => {
      window.removeEventListener(
        "footera:auth-changed",
        sincronizar
      );
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <UserProvider>
      <MaintenanceGate>
        <AuthGateProvider>
          <DeepLinkBoot />
          <PresenceBoot />
          <PushBoot />
          <AppRoutes />
          <ToastContainer />
        </AuthGateProvider>
      </MaintenanceGate>
    </UserProvider>
  );
}