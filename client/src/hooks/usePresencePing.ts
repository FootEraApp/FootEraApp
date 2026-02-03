import { useEffect, useRef } from "react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

export function usePresencePing() {
  const startedRef = useRef(false);

  useEffect(() => {
    const getToken = () =>
      Storage.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const token = getToken();
    if (!token) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let alive = true;

    async function ping() {
      const t = getToken();
      if (!t) return;

      try {
        await fetch(`${API.BASE_URL}/api/presenca/ping`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
          },
        });
      } catch {
      }
    }

    ping();

    const interval = setInterval(() => {
      if (!alive) return;
      ping();
    }, 25_000);

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
    };
  }, [
    Storage.token,
    localStorage.getItem("token"),
    sessionStorage.getItem("token"),
  ]);
}