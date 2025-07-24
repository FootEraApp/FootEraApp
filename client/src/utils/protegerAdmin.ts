export function verificarAdmin() {
  if (typeof window === "undefined") return false;

  const userStr = localStorage.getItem("user");
  if (!userStr) return false;

  try {
    const usuario = JSON.parse(userStr);
    return usuario?.tipo === "Admin";
  } catch {
    return false;
  }
}
