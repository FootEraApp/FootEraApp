// server/utils/storage
const getFromStorage = (key: string): string | null => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

const setToStorage = (key: string, value: string | null) => {
  if (value === null) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, value);
  sessionStorage.setItem(key, value);
};

const AppStorage = {
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

  get nomeDeUsuario() {
    return (
      getFromStorage("nomeDeUsuario") ||
      getFromStorage("nomeUsuario") 
    );
  },
  set nomeDeUsuario(v: string | null) {
    setToStorage("nomeDeUsuario", v);
  },
};

export default AppStorage;