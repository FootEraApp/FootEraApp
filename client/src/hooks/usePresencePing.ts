import { useEffect, useRef } from "react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    (Storage as any)?.token ||
    ""
  );
}

export function usePresencePing() {
  const startedRef = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (startedRef.current) return;

    startedRef.current = true;
    let alive = true;

    async function ping() {
      const t = getToken();
      if (!t) return;

      try {
        const res = await fetch(`${API.BASE_URL}/api/presenca/ping`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
          },
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
          sessionStorage.removeItem("token");
          localStorage.removeItem("authToken");
          localStorage.removeItem("jwt");
          startedRef.current = false;
          return;
        }
      } catch {}
    }

    ping();

    const interval = setInterval(() => {
      if (!alive) return;
      ping();
    }, 25000);

    const onFocus = () => ping();
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      startedRef.current = false;
    };
  }, []);
}