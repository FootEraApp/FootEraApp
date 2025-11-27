import Storage from "../../../server/utils/storage.js";

export function readToken(): string | null {
  const t =
    (window as any)?.Storage?.token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("jwt");
  if (!t || t === "null" || t === "undefined") return null;
  return t;
}

export function readUserId(): string | null {
  const v =
    (window as any)?.Storage?.usuarioId ||
    localStorage.getItem("usuarioId");
  if (!v || v === "null" || v === "undefined") return null;
  return v;
}

export function getUserId(): string | null {
  const id = localStorage.getItem("usuarioId");
  return id && id !== "null" && id !== "undefined" ? id : null;
}

export function clearAuth(): void {
  try {
    const keys = ["token", "authToken", "jwt", "usuarioId", "tipoUsuario"];
    keys.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  } catch {}
  try {
    (Storage as any).token = null;
    (Storage as any).usuarioId = null;
  } catch {}
  try { document.cookie = "token=; Max-Age=0; path=/"; } catch {}
}