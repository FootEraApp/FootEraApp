export function logout() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("usuarioId");
    localStorage.removeItem("tipoUsuario");
    localStorage.removeItem("tipoUsuarioId");
    sessionStorage.removeItem("token");
  } catch {}
}