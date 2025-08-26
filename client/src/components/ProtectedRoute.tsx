import { useEffect, useState } from "react";
import { getUserFromLocalStorage } from "../utils/protegerAdmin.js";

export function withAuth(Component: React.FC, options?: { adminOnly?: boolean }) {
  return function AuthenticatedPage(props: any) {
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
      const user = getUserFromLocalStorage();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      if (options?.adminOnly && user.tipo !== "Admin") {
        window.location.replace("/admin/login");
        return;
      }

      setAuthorized(true);
    }, []);

    if (!authorized) return null;
    return <Component {...props} />;
  };
}
