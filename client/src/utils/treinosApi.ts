import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import type { TreinoCreatePayload } from "./treinos.types.js";

const auth = () => ({ Authorization: `Bearer ${Storage.token}` });

export const TreinosApi = {
  criar(payload: TreinoCreatePayload) {
    return axios.post(`${API.BASE_URL}/api/treinos`, payload, { headers: auth() });
  },
  atualizar(id: string, payload: Partial<TreinoCreatePayload>) {
    return axios.put(`${API.BASE_URL}/api/treinos/${id}`, payload, { headers: auth() });
  },
  listarExercicios() {
    return axios.get(`${API.BASE_URL}/api/treinos/exercicios`, { headers: auth() });
  },
};