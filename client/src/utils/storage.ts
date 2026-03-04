const getFromStorage = (key: string): string | null => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

const setToStorage = (key: string, value: string | null) => {
  if (value === null) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    return;
  }
  // você pode escolher só localStorage, mas assim funciona em ambos
  localStorage.setItem(key, value);
  sessionStorage.setItem(key, value);
};

const Storage = {
  get tipoSalvo() {
    return getFromStorage("tipoUsuario");
  },
  get usuarioId() {
    return getFromStorage("usuarioId");
  },
  get tipoUsuarioId() {
    return getFromStorage("tipoUsuarioId");
  },

  get nomeUsuario() {
    return getFromStorage("nomeUsuario");
  },

  get token() {
    return getFromStorage("token");
  },

  // ✅ agora existe de verdade e não recursa
  get nomeDeUsuario() {
    return (
      getFromStorage("nomeDeUsuario") ||
      getFromStorage("nomeUsuario") // fallback p/ legado
    );
  },
  set nomeDeUsuario(v: string | null) {
    setToStorage("nomeDeUsuario", v);
  },
};

export default Storage;