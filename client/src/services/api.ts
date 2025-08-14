import { API } from "@/config";
import { logout } from "@/utils/session";
import Storage  from "../../../server/utils/storage";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  onUnauthorized?: () => void
) {
  const token =
    Storage.token || sessionStorage.getItem("token") || "";

  const res = await fetch(`${API.BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (res.status === 401 || res.status === 403) {
    logout();
    onUnauthorized?.(); 
    throw new Error("Não autorizado");
  }
  if (!res.ok) {
    throw new Error(await res.text().catch(() => res.statusText));
  }
  return res;
}

export const apiGet = (path: string, onUnauthorized?: () => void) =>
  apiFetch(path, {}, onUnauthorized);

export const apiPost = (path: string, body: any, onUnauthorized?: () => void) =>
  apiFetch(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    onUnauthorized
  );