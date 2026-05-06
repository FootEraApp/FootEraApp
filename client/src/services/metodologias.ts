// client/src/services/metodologias.ts
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export type LearningMetodoTipo = "TRILHAS_TREINO" | "CURSO_FORMACAO";
export type LearningEstruturaTipo = "TRILHA" | "MODULO";
export type LearningModoExecucao = "LIVRE" | "PRAZO_SUGERIDO" | "DESAFIO_FECHADO";
export type LearningItemTipo =
  | "TREINO"
  | "VIDEO"
  | "AULA"
  | "AULA_AO_VIVO"
  | "MATERIAL"
  | "DESAFIO";

export type LearningPermissaoCriacao = {
  podeCriar: boolean;
  ehProfessorParceiro?: boolean;
  temPlanoElegivel?: boolean;
  planoPrincipal?: string | null;
  motivoBloqueio?: string | null;
  planosPermitidos?: string[];
};
export type LearningMetodologiaInput = {
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  nivel?: string | null;
  categorias?: string[];
  publicoAlvo?: "ATLETAS" | "PROFISSIONAIS" | "AMBOS";
  tipo: LearningMetodoTipo;
  estruturaTipo: LearningEstruturaTipo;
  area?:
    | "TECNICO"
    | "FISICO"
    | "TATICO"
    | "MENTAL"
    | "GOLEIROS"
    | "PSICOLOGIA"
    | "INOVACAO"
    | "ANALISE_DESEMPENHO"
    | "OUTRO"
    | null;
  geraCertificado?: boolean;
  geraBadge?: boolean;
  ativo?: boolean;
};

export type LearningEstruturaInput = {
  tipo: LearningEstruturaTipo;
  titulo: string;
  descricao?: string | null;
  objetivo?: string | null;
  ordem?: number;
  duracaoSemanas?: number | null;
  treinosPorSemana?: number | null;
  quantidadeMinConclusao?: number | null;
  modoExecucao?: LearningModoExecucao | null;
  pontosPorItem?: number | null;
  bonusConsistencia?: number | null;
  bonusFinal?: number | null;
  prazoInicio?: string | null;
  prazoFinal?: string | null;
  percentualPerdaAtraso?: number | null;
  permiteAtraso?: boolean;
  ativo?: boolean;

  aulaAoVivo?: {
  id?: string;
  titulo?: string | null;
  descricao?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  chatAtivo?: boolean;
  gravacaoAtiva?: boolean;
  status?: "AGENDADA" | "AO_VIVO" | "FINALIZADA" | "CANCELADA";
  };
};

export type LearningEstruturaItemInput = {
  titulo: string;
  descricao?: string | null;
  tipo: LearningItemTipo;
  ordem?: number;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  arquivoUrl?: string | null;
  materialUrl?: string | null;
  duracaoMin?: number | null;
  treinoProgramadoId?: string | null;
  pontos?: number | null;
  obrigatorio?: boolean;
  publicado?: boolean;
};

function readToken(): string | null {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    (Storage as any)?.token ||
    null;

  if (!token || token === "null" || token === "undefined") return null;
  return token;
}

function authHeaders(extra?: Record<string, string>): HeadersInit {
  const token = readToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API.BASE_URL}${path}`, init);
  const json = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(
      json?.detail || json?.message || json?.error || `Falha na requisição (${res.status})`
    );
  }

  return json as T;
}

export async function uploadMetodologiaFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  return request<{
    ok: boolean;
    url: string;
    key: string;
    mimetype: string;
  }>("/api/metodologias/upload-s3", {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
}

export async function listMinhasMetodologiasAssinadas() {
  return request<{ items: any[] }>("/api/metodologias/assinadas", {
    headers: authHeaders(),
  });
}

export async function listMinhasMetodologiasCriadas() {
  return request<{
    items: any[];
    permissaoCriacao?: LearningPermissaoCriacao;
  }>("/api/metodologias/criadas", {
    headers: authHeaders(),
  });
}

export async function listMetodologiasVisiveis() {
  return request<{ items: any[] }>("/api/metodologias/visiveis", {
    headers: authHeaders(),
  });
}

export async function listMetodologias() {
  return request<{ items: any[] }>("/api/metodologias", {
    headers: authHeaders(),
  });
}

export async function getMetodologiaById(id: string) {
  return request<{ item: any }>(`/api/metodologias/${id}`, {
    headers: authHeaders(),
  });
}

export async function getMetodologiaDetalhe(id: string) {
  return request<any>(`/api/metodologias/${id}/detalhe`, {
    headers: authHeaders(),
  });
}

export async function createMetodologia(payload: LearningMetodologiaInput) {
  return request<{ item: any }>("/api/metodologias", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function createMetodologiaCompleta(payload: any) {
  return request<{ item: any }>("/api/metodologias/completa", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateMetodologia(id: string, payload: Partial<LearningMetodologiaInput>) {
  return request<{ item: any }>(`/api/metodologias/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function deleteMetodologia(id: string) {
  return request<{ ok: boolean }>(`/api/metodologias/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function createMetodologiaAvulsa(payload: any) {
  return request<{ item: any }>("/api/metodologias/metodologias-avulsas", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function createMetodologiaAvulsaCompleta(payload: any) {
  return request<{ item: any }>("/api/metodologias/metodologias-avulsas/completa", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateMetodologiaAvulsa(id: string, payload: any) {
  return request<{ item: any }>(`/api/metodologias/metodologias-avulsas/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function getMetodologiaAvulsaById(id: string) {
  return request<{ item: any }>(`/api/metodologias/metodologias-avulsas/${id}`, {
    headers: authHeaders(),
  });
}

export async function deleteMetodologiaAvulsa(id: string) {
  return request<{ ok: boolean }>(`/api/metodologias/metodologias-avulsas/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function createMetodologiaEstruturas(
  metodologiaId: string,
  payload: LearningEstruturaInput | { estruturas: LearningEstruturaInput[] }
) {
  return request<{ estruturas: any[] }>(`/api/metodologias/${metodologiaId}/estruturas`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateMetodologiaEstrutura(
  metodologiaId: string,
  estruturaId: string,
  payload: Partial<LearningEstruturaInput>
) {
  return request<{ estrutura: any }>(
    `/api/metodologias/${metodologiaId}/estruturas/${estruturaId}`,
    {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMetodologiaEstrutura(metodologiaId: string, estruturaId: string) {
  return request<{ ok: boolean }>(
    `/api/metodologias/${metodologiaId}/estruturas/${estruturaId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
}

export async function createMetodologiaEstruturaItens(
  metodologiaId: string,
  estruturaId: string,
  payload: LearningEstruturaItemInput | { itens: LearningEstruturaItemInput[] }
) {
  return request<{ itens: any[] }>(
    `/api/metodologias/${metodologiaId}/estruturas/${estruturaId}/itens`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMetodologiaEstruturaItens(
  metodologiaId: string,
  estruturaId: string,
  itemIds?: string[]
) {
  return request<{ ok: boolean }>(
    `/api/metodologias/${metodologiaId}/estruturas/${estruturaId}/itens`,
    {
      method: "DELETE",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ itemIds: itemIds || [] }),
    }
  );
}

export async function concluirEstruturaItem(
  metodologiaId: string,
  estruturaId: string,
  itemId: string
) {
  return request<any>(
    `/api/metodologias/${metodologiaId}/estruturas/${estruturaId}/concluir-item`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ itemId }),
    }
  );
}

export async function assinarMetodologia(id: string, payload?: any) {
  return request<any>(`/api/metodologias/${id}/assinar`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload || {}),
  });
}

export async function criarAvaliacaoMetodologia(payload: {
  metodologiaId: string;
  nota: number;
  comentario?: string | null;
}) {
  return request<any>("/api/metodologias/avaliacoes", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}