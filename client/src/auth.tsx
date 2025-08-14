import { useEffect } from "react";
import { useLocation } from "wouter";
import { jwtDecode } from "jwt-decode";
import Storage  from "../../server/utils/storage";

function getToken() {
  return Storage.token || sessionStorage.getItem("token") || "";
}

function isTokenValid(token: string) {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    if (!exp) return true;
    return Date.now() < exp * 1000;
  } catch {
    return false;
  }
}

export function Private({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    const token = getToken();
    if (!token || !isTokenValid(token)) {
      try { localStorage.removeItem("token"); sessionStorage.removeItem("token"); } catch {}
      navigate("/login");
    }
  }, [navigate]);
  const token = getToken();
  return token && isTokenValid(token) ? <>{children}</> : null;
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    const token = getToken();
    if (token && isTokenValid(token)) {
      navigate("/feed");
    }
  }, [navigate]);
  const token = getToken();
  return token && isTokenValid(token) ? null : <>{children}</>;
}

export function HomeRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const token = getToken();
    navigate(token && isTokenValid(token) ? "/feed" : "/login");
  }, [navigate]);
  return null;
}