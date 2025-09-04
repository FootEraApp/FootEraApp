import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "../config.js";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
function getTipoLocal() {
  return (
    localStorage.getItem("tipoUsuario") ||
    sessionStorage.getItem("tipoUsuario") ||
    ""
  ).toLowerCase();
}

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const [ok, setOk] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/admin/login");
      return;
    }

    if (getTipoLocal() === "admin") {
      setOk(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API.BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { navigate("/admin/login"); return; }

        const me = await res.json();
        const t = (me?.tipo ?? me?.usuario?.tipo ?? "")
          .toString().trim().toLowerCase();
        const isAdmin = t === "admin" || me?.isAdmin === true;

        if (isAdmin) setOk(true);
        else navigate("/feed");
      } catch {
        navigate("/admin/login");
      }
    })();
  }, [navigate]);

  if (!ok) return null;
  return children;
}