import axios, { type AxiosError } from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

export const http = axios.create({
  baseURL: API.BASE_URL,
  withCredentials: false,
});

function pickToken(): string | null {
  try {
    const ss = typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
    const ls = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return Storage?.token || ss || ls || null;
  } catch {
    return Storage?.token ?? null;
  }
}

http.interceptors.request.use((config) => {
  const t = pickToken();
  if (t) {
    const bearer = t.startsWith("Bearer ") ? t : `Bearer ${t}`;
    if (config.headers && (config.headers as any).set) {
      (config.headers as any).set("Authorization", bearer);
    } else {
      config.headers = { ...(config.headers || {}), Authorization: bearer } as any;
    }
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      try { sessionStorage.removeItem("token"); } catch {}
      try { localStorage.removeItem("token"); } catch {}
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);