import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import type { TreinoCreatePayload } from "./treinos.types.js";

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

const auth = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

type AgendarRotinaMensalPayload = {
  treinoProgramadoId: string;
  datas: string[];
  atletaIds?: string[];
  elencosIds?: string[];
  incluirObservados?: boolean;
};

export const TreinosApi = {
  criar(payload: TreinoCreatePayload) {
    return axios.post(`${API.BASE_URL}/api/treinos`, payload, {
      headers: auth(),
    });
  },

  atualizar(id: string, payload: Partial<TreinoCreatePayload>) {
    return axios.put(`${API.BASE_URL}/api/treinos/programados/${id}`, {
      ...payload,
    }, {
      headers: auth(),
    });
  },

  listarExercicios() {
    return axios.get(`${API.BASE_URL}/api/treinos/exercicios`, {
      headers: auth(),
    });
  },

  async getCalendario(start: Date, end: Date) {
    const res = await axios.get(`${API.BASE_URL}/api/treinos/calendario`, {
      params: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      headers: auth(),
      withCredentials: false,
    });
    return res.data;
  },

  agendarRotinaMensal(payload: AgendarRotinaMensalPayload) {
    return axios.post(`${API.BASE_URL}/api/treinos/rotina/agendar`, payload, {
      headers: auth(),
    });
  },
};