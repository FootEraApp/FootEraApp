import Storage from "../../../server/utils/storage.js";

export function readToken(): string | null {
  const token = (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  ).trim();

  if (
    !token ||
    token === "null" ||
    token === "undefined"
  ) {
    return null;
  }

  return token;
}

export function readUserId(): string | null {
  const id = (
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    ""
  ).trim();

  return id && id !== "null" && id !== "undefined"
    ? id
    : null;
}

export function getUserId(): string | null {
  return readUserId();
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