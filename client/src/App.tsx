// client/src/App
import { useEffect } from "react";
import { AppRoutes } from "./routes.js";
import { UserProvider } from "./context/UserContext.js";
import { usePresencePing } from "@/hooks/usePresencePing";
import { sincronizarPushSePermitido } from "./services/pushNotifications.js";
import ToastContainer from "./components/ui/ToastContainer.js";
import MaintenanceGate from "./components/system/MaintenanceGate.js"
import { AuthGateProvider } from "./context/AuthGateContext.js";

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

    /*
     * O login com Google pode acontecer
     * diretamente dentro do Auth Gate,
     * sem recarregar a aplicação.
     */
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
          <PresenceBoot />
          <PushBoot />
          <AppRoutes />
          <ToastContainer />
        </AuthGateProvider>
      </MaintenanceGate>
    </UserProvider>
  );
}