import { useEffect } from "react";
import { AppRoutes } from "./routes.js";
import { UserProvider } from "./context/UserContext.js";
import { usePresencePing } from "@/hooks/usePresencePing";
import { sincronizarPushSePermitido } from "./services/pushNotifications.js";
import ToastContainer from "./components/ui/ToastContainer.js";

function PresenceBoot() {
  usePresencePing();
  return null;
}

function PushBoot() {
  useEffect(() => {
    sincronizarPushSePermitido();
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