// src/App.tsx
import { AppRoutes } from "./routes.js";
import { UserProvider } from "./context/UserContext.js";
import { usePresencePing } from "@/hooks/usePresencePing";

function PresenceBoot() {
  usePresencePing();
  return null;
}

export default function App() {
  return (
    <UserProvider>
      <PresenceBoot />
      <AppRoutes />
    </UserProvider>
  );
}