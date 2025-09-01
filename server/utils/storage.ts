// server/utils/storage
const getFromStorage = (key: string): string | null => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
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
  
};

export default Storage;