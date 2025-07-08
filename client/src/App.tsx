import { AppRoutes } from "./routes";
import { UserProvider } from "./context/UserContext";

export default function App() {
  return (
    <div>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </div>
  );
}
