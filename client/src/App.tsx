import { AppRoutes } from "./routes.js";
import { UserProvider } from "./context/UserContext.js";

export default function App() {
  return (
    <div>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </div>
  );
}
