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

function isUsuarioFree() {
  try {
    const planoRaw =
      (Storage as any).assinaturaPlano ??
      (Storage as any).plano ??
      localStorage.getItem("assinaturaPlano") ??
      localStorage.getItem("plano") ??
      sessionStorage.getItem("assinaturaPlano") ??
      sessionStorage.getItem("plano") ??
      "";

    const normalized = String(planoRaw || "").toLowerCase();
    if (!normalized) return true;

    if (
      normalized.includes("pro") ||
      normalized.includes("elite") ||
      normalized.includes("premium")
    ) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export const TreinosApi = {
  criar(payload: TreinoCreatePayload) {
    return axios.post(`${API.BASE_URL}/api/treinos`, payload, {
      headers: auth(),
      // NÃO joga no catch quando for 400 do limite; você trata no código
      validateStatus: (status) => status >= 200 && status < 400,
    });
  },

  atualizar(id: string, payload: Partial<TreinoCreatePayload>) {
    return axios.put(`${API.BASE_URL}/api/treinos/programados/${id}`, payload, {
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
      params: { start: start.toISOString(), end: end.toISOString() },
      headers: auth(),
      withCredentials: false,
    });
    return res.data;
  },

  agendarRotinaMensal(payload: AgendarRotinaMensalPayload) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const limite = new Date(hoje);
    limite.setMonth(limite.getMonth() + 1);
    limite.setHours(0, 0, 0, 0);

    const free = isUsuarioFree();

    const datasValidas = (payload.datas || []).filter((d) => {
      if (!d) return false;
      const dt = new Date(`${d}T00:00:00`);
      if (isNaN(dt.getTime())) return false;
      if (dt < hoje) return false;
      if (free && dt > limite) return false;
      return true;
    });

    if (!datasValidas.length) {
      return Promise.reject(
        new Error(
          "Nenhuma data válida para agendar a rotina. Verifique se as datas não estão no passado e, para contas Free, se estão dentro de 30 dias a partir de hoje.",
        ),
      );
    }

    return axios.post(
      `${API.BASE_URL}/api/treinos/rotina/agendar`,
      { ...payload, datas: datasValidas },
      { headers: auth() },
    );
  },
};