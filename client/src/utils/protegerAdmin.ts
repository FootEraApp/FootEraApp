export function getUserFromLocalStorage() {
  if (typeof window === "undefined") return null;

  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function isAdmin() {
  const user = getUserFromLocalStorage();
  return user?.usuario?.tipo === "Admin";
}

export function isAuthenticated() {
  return !!getUserFromLocalStorage();
}
