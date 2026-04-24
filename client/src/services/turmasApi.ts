import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

export type TurmaDTO = {
  id: string;
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  ativo: boolean;
  professorIds?: string[];
  professorNomes?: string[];
  professorNome?: string | null;
  escolinha?: { id: string; nome: string } | null;
  clube?: { id: string; nome: string } | null;
};

export type ProfessorMin = { id: string; nome: string; usuarioId?: string | null; codigo?: string | null; cref?: string | null };

const headers = () => {
  const token = Storage.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function getTurmasByOwner(ownerTipo: "Escolinha" | "Clube", ownerId: string) {
  const { data } = await axios.get(`${API.BASE_URL}/api/turmas`, {
    params: { ownerTipo, ownerId },
    headers: headers(),
  });

  const arr = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
  return (arr ?? []) as TurmaDTO[];
}

export async function getTurmasByProfessor(params: {
  professorId: string;
  ownerTipo: "Escolinha" | "Clube";
  ownerId: string;
}) {
  const { data } = await axios.get(`${API.BASE_URL}/api/turmas`, {
    params: { ownerTipo: params.ownerTipo, ownerId: params.ownerId },
    headers: headers(),
  });

  const items = (data?.items ?? data ?? []) as TurmaDTO[];
  return items.filter((t) => (t.professorIds ?? []).includes(String(params.professorId)));
}

export async function getProfessoresDisponiveis(ownerTipo: "Escolinha" | "Clube", ownerId: string) {
  const { data } = await axios.get(`${API.BASE_URL}/api/turmas/professores-disponiveis`, { params: { ownerTipo, ownerId }, headers: headers() });
  return (data?.items ?? []) as ProfessorMin[];
}

export async function createTurma(payload: {
  nome: string;
  categoria?: string;
  descricao?: string;
  ownerTipo: "Escolinha" | "Clube";
  ownerId: string;
  professorIds?: string[];
}) {
  const { data } = await axios.post(`${API.BASE_URL}/api/turmas`, payload, {
    headers: headers(),
  });
  return data as TurmaDTO;
}

export async function updateTurma(id: string, payload: Partial<{ nome: string; categoria: string; descricao: string; ativo: boolean }>) {
  const { data } = await axios.put(`${API.BASE_URL}/api/turmas/${id}`, payload, { headers: headers() });
  return data as TurmaDTO;
}

export async function setProfessores(id: string, professorIds: string[]) {
  const { data } = await axios.put(
    `${API.BASE_URL}/api/turmas/${id}/vincular-professor`,
    { professorIds },
    { headers: headers() }
  );
  return data as TurmaDTO;
}

export async function deleteTurma(id: string) {
  const { data } = await axios.delete(`${API.BASE_URL}/api/turmas/${id}`, { headers: headers() });
  return data;
}