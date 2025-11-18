// client/src/utils/treinosApi.ts
import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import type { TreinoCreatePayload } from "./treinos.types.js";

const auth = () => ({ Authorization: `Bearer ${Storage.token}` });

type AgendarRotinaMensalPayload = {
  treinoProgramadoId: string;
  datas: string[];          // "2025-11-20" ou ISO completo
  atletaIds?: string[];     // ids de atletas (id ou usuarioId, igual no backend)
  elencosIds?: string[];    // ids de elencos
  incluirObservados?: boolean;
};

export const TreinosApi = {
  // Criar treino programado (template / plano)
  criar(payload: TreinoCreatePayload) {
    return axios.post(
      `${API.BASE_URL}/api/treinos`,
      payload,
      { headers: auth() }
    );
  },

  // Atualizar treino programado
  atualizar(id: string, payload: Partial<TreinoCreatePayload>) {
    return axios.put(
      `${API.BASE_URL}/api/treinos/${id}`,
      payload,
      { headers: auth() }
    );
  },

  // Listar exercícios disponíveis
  listarExercicios() {
    return axios.get(
      `${API.BASE_URL}/api/treinos/exercicios`,
      { headers: auth() }
    );
  },

  // Buscar calendário de treinos agendados (usa getCalendarioTreinos no backend)
  async getCalendario(start: Date, end: Date) {
    const res = await axios.get(
      `${API.BASE_URL}/api/treinos/calendario`,
      {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        headers: auth(),
        withCredentials: true, // mantém como você tinha
      }
    );
    return res.data; // array de eventos
  },

  // Agendar rotina mensal (usa agendarRotinaMensal do treinosController)
  agendarRotinaMensal(payload: AgendarRotinaMensalPayload) {
    return axios.post(
      `${API.BASE_URL}/api/treinos/agendar-rotina-mensal`,
      payload,
      { headers: auth() }
    );
  },
};