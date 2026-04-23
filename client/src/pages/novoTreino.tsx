//client/src/pages/novoTreino
import { useEffect, useMemo, useRef, useState, ReactNode, memo, type UIEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Search as SearchIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Calendar as CalendarIcon,
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import { TreinosApi } from "../utils/treinosApi.js";
import type { TreinoCreatePayload } from "../utils/treinos.types.js";
import {
  montarExerciciosParaPayload,
} from "../utils/treinos.helpers.js";
import BottomNav from "@/components/layout/BottomNav.js";
import axios from "axios";

type ExItemUILocal = {
  idLocal: string;
  id?: string | null;
  idCatalogo?: string | null;
  exercicioId?: string | null;
  exercicioPersonalizadoId?: string | null;
  exercicioTemporarioId?: string | null;
  nome: string;
  descricao?: string | null;
  objetivo?: string | null;
  nivel?: string | null;
  videoUrl?: string | null;
  videoDemonstrativoUrl?: string | null;
  videoPosterUrl?: string | null;
  series?: string | number | null;
  repeticoes?: string | number | null;
  duracao?: string | null;
  descanso?: string | null;
  ordem?: number | null;
  categorias?: string[];
  tipo?: "catalogo" | "personalizado" | "meus" | "temporario";
  origem?: "catalogo" | "personalizado" | "meus" | "temporario";
  observacao?: string | null;
  exercicio?: any;
  exercicioPersonalizado?: any;
  exercicioTemporario?: any;
  nomeCatalogo?: string | null;
  tipoExecucao?: "repeticao" | "duracao";
  descricaoExecucao?: string | null;  
};
type Organizacao = { id: string; nome: string; tipo: "Escolinha" | "Clube" };
type PontuacaoDetalhe = {
  total: number;
  nivel: number;
  tipo: number;
  exercicios: number;
  duracao: number;
  exCount: number;
};

type ExercicioSelecionadoUI = {
  exercicioId?: string;     
  id?: string;             
  ordem?: number | null;
  repeticoes?: string | number | null;
  series?: number | null;
};

function toRepeticoesStr(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v);
}

function exercicioTemExecucaoValida(ex: ExItemUILocal) {
  if (ex.tipoExecucao === "duracao") {
    return String(ex.duracao ?? "").trim() !== "";
  }

  return (
    String(ex.series ?? "").trim() !== "" &&
    String(ex.repeticoes ?? "").trim() !== ""
  );
}

function formatSerieXReps(series?: number | null, repsRaw?: string | number | null) {
  const s = typeof series === "number" && series > 0 ? series : null;

  const reps = String(repsRaw ?? "").trim();
  if (!reps) return null;

  // Se o cara já digitou "3x12", "4 x 10", etc, não mexe
  const jaTemX = /\d+\s*x\s*\d+/i.test(reps);
  if (jaTemX) return reps.replace(/\s+/g, " ").trim();

  // Se tem séries, monta "SxREPS"
  if (s) return `${s}x${reps}`;

  // Se não tem séries, fica só reps mesmo
  return reps;
}

function montarPayloadSomenteInfoEExercicios(params: {
  titulo: string;
  descricao: string;
  nivel: any; 
  duracaoMinutos: number | null;
  tipoTreino?: string | null; 
  metas?: string | null;
  pontuacao?: number | null;
  categoria?: any[]; 
  dicas?: string[];
  exerciciosSelecionados: ExercicioSelecionadoUI[];
  atletasIds?: string[];
  elencosIds?: string[];
  colaboradoresProfessorIds?: string[];
  tipoUsuarioId?: string;
}) {
  const {
    titulo,
    descricao,
    nivel,
    duracaoMinutos,
    tipoTreino,
    metas,
    pontuacao,
    categoria,
    dicas,
    exerciciosSelecionados,
    
  } = params;

  const exercicios = (exerciciosSelecionados ?? [])
    .map((it: any, idx: number) => {
      // ✅ IMPORTANTE:
      // - NUNCA use it.id (id local) como exercicioId
      // - exercicioId só pode vir do catálogo (it.exercicioId ou it.idCatalogo)
      const exercicioId = String(it.exercicioId ?? it.idCatalogo ?? "").trim();
      // ✅ se for um personalizado existente, vem com exercicioPersonalizadoId
      const exercicioPersonalizadoId = String(it.exercicioPersonalizadoId ?? "").trim();
      const nomeCustom = String(it.nome ?? "").trim();
      const descCustom = String(it.descricao ?? "").trim();
      const repsFinal =
        it.tipoExecucao === "repeticao"
          ? formatSerieXReps(it.series ?? null, it.repeticoes)
          : null;
      const base = {
        ordem: Number.isFinite(Number(it.ordem)) ? Number(it.ordem) : idx + 1,
        repeticoes: it.tipoExecucao === "repeticao" ? repsFinal : null,
        series:
          it.tipoExecucao === "repeticao" &&
          Number.isFinite(Number(it.series)) &&
          Number(it.series) > 0
            ? Number(it.series)
            : null,
        duracao:
          it.tipoExecucao === "duracao" && String(it.duracao ?? "").trim() !== ""
            ? String(it.duracao).trim()
            : null,
        descanso:
          String(it.descanso ?? "").trim() !== ""
            ? String(it.descanso).trim()
            : null,
      };

      if (exercicioId) {
        return {
          ...base,
          exercicioId,
          descricao: descCustom || null,
        };
      }

      if (exercicioPersonalizadoId) {
        return {
          ...base,
          exercicioPersonalizadoId,
          descricao: descCustom || null,
        };
      }

      // ✅ personalizado NOVO (linha adicionada) — TEM que ir NO ROOT (o backend lê assim)
      if (nomeCustom) {
        return {
          ...base,
          nome: nomeCustom,
          descricao: descCustom || null,
          videoDemonstrativoUrl: it.videoUrl ?? null,
          videoPosterUrl: it.videoPosterUrl ?? null,
          // (opcional) se você tiver esses campos na UI
          nivel: it.nivel ?? nivel,
          duracao: it.tipoExecucao === "duracao" ? it.duracao : null,
          categorias: Array.isArray(it.categorias) ? it.categorias : (Array.isArray(categoria) ? categoria : []),
        };
      }

      return null;
    })
    .filter(Boolean);

    const payload: any = {
      nome: (titulo ?? "").trim(),
      descricao: (descricao ?? "").trim() || null,
      nivel,
      duracao: duracaoMinutos === null ? null : Number(duracaoMinutos),
      categoria: Array.isArray(categoria) ? categoria : [],
      dicas: Array.isArray(dicas) ? dicas.filter(Boolean) : [],
      exercicios,
      atletasIds: Array.isArray(params.atletasIds) ? params.atletasIds : [],
      elencosIds: Array.isArray(params.elencosIds) ? params.elencosIds : [],
      colaboradoresProfessorIds: Array.isArray(params.colaboradoresProfessorIds)
        ? params.colaboradoresProfessorIds
        : [],
      tipoUsuarioId: params.tipoUsuarioId ?? "",
    };

    if (tipoTreino !== undefined) {
      payload.tipoTreino = tipoTreino ?? null;
    }
    if (metas !== undefined) payload.metas = metas ?? null;
    if (pontuacao !== undefined) payload.pontuacao = pontuacao ?? null;
    
    return payload;
}

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

const PONTOS = {
  NIVEL: { Base: 0, Avancado: 10, Performance: 20 } as Record<string, number>,
  TIPO: { Tecnico: 5, Fisico: 6, Tatico: 8 } as Record<string, number>,
  POR_EXERCICIO: 4,
  POR_15_MIN: 1,
};

const NOMES_MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function formatYMD(ano: number, mesZeroBased: number, dia: number): string {
  const m = String(mesZeroBased + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

function toDateOnlyBR(input: string): string {
  const s = String(input || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return formatYMD(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDatetimeLocalValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`; 
}

function toISOWithLocalOffset(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  const offsetMin = -date.getTimezoneOffset(); // ex.: Brasil = -180 => +(-180 invertido) = -03:00
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const offH = String(Math.floor(abs / 60)).padStart(2, "0");
  const offM = String(abs % 60).padStart(2, "0");

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${offH}:${offM}`;
}

function dateKeyLocal(date: Date): string {
  return formatYMD(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnlyToLocalMidnight(dateOnly: string): Date {
  const s = toDateOnlyBR(dateOnly);
  if (!s) return new Date(NaN);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function resolveAvatarUrl(raw?: string) {
  const u = resolveMediaUrl(raw);
  return u || AVATAR_FALLBACK;
}

function resolveMediaUrl(raw?: string) {
  if (!raw) return "";
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("blob:") || p.startsWith("data:")) return p;
  if (p.startsWith("http")) return p;
  if (p.startsWith("/assets/")) return p;
  return `${API.BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

function resolveVideoUrl(raw?: string) {
  if (!raw) return "";
  const p = raw.replace(/\\/g, "/");

  if (p.startsWith("blob:") || p.startsWith("data:")) return p;

  if (p.startsWith("http")) return p;
  if (p.startsWith("/assets/")) return p;
  return `${API.BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

function calcularPontuacaoTreino(
  nivel: string,
  tipoTreino: string,
  duracaoMin: number,
  exercicios: ExItemUILocal[],
): PontuacaoDetalhe {
  const exCount = exercicios.filter((e) => e.idCatalogo || (e.nome && e.nome.trim())).length;
  const ptsEx = exCount * PONTOS.POR_EXERCICIO;

  const ptsNivel = PONTOS.NIVEL[nivel as keyof typeof PONTOS.NIVEL] ?? 0;
  const ptsTipo = PONTOS.TIPO[tipoTreino as keyof typeof PONTOS.TIPO] ?? 0;

  const dur = Number.isFinite(Number(duracaoMin)) ? Number(duracaoMin) : 0;
  const ptsDur = Math.max(0, Math.floor(dur / 15) * PONTOS.POR_15_MIN);

  const total = ptsEx + ptsNivel + ptsTipo + ptsDur;
  return {
    total,
    nivel: ptsNivel,
    tipo: ptsTipo,
    exercicios: ptsEx,
    duracao: ptsDur,
    exCount,
  };
}

interface UsuarioLogado {
  tipo: "atleta" | "escola" | "escolinha" | "clube" | "professor";
}

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
  videoDemonstrativoUrl?: string;
  objetivo?: string | null;
  descricao?: string | null;
  nivel?: string;
  categorias?: string[];      
  duracaoMinutos?: number | null; 
  tipoTreino?: string | null; 
}


interface AtletaVinculado {
  id: string;
  nome: string;
  foto?: string;
  usuarioId?: string;
}

interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  imagemUrl: string | null;
  dataAgendada?: string;
  exercicios: {
    id: string;
    nome: string;
    repeticoes?: string;
  }[];
  pontuacao?: number | null;
  treinoProgramadoId?: string | null;
  origemId?: string | null;
  criador?: {
    tipo: "Professor" | "Clube" | "Escolinha";
    id: string;
    nome: string;
  } | null;
  criadorNome?: string | null;
  criadorTipo?: string | null;
  criadores?: { id: string; nome: string }[];
}

interface Elenco {
  id: string;
  nome: string;
  atletasIds?: string[];
}

type TreinoAgendadoResp = {
  id: string;
  titulo: string;
  dataTreino: string;
  treinoProgramadoId: string;
};

type MeuExercicioItem = {
  id: string;
  origem: "exercicio" | "personalizado";
  nome: string;
  objetivo?: string | null;
  descricao?: string | null;
  nivel?: string | null;
  categorias?: string[];
  videoDemonstrativoUrl?: string | null;
  videoPosterUrl?: string | null;
};

const SAVE_KEY = "novoTreinoState";
const RESTORE_FLAG_KEY = "novoTreino-shouldRestore";
const MAX_SLOTS_TREINOS_SALVOS = 5;

function toCategoriaEnum(val?: string | null): string | null {
  if (!val) return null;
  const m = String(val).match(/sub[\s\-]?(\d{1,2})/i);
  if (m) return `Sub${m[1]}`;
  if (/^livre$/i.test(String(val))) return "Livre";
  return val;
}

async function uploadImagemCapa(file: File): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Sem token");

  const fd = new FormData();
  fd.append("foto", file);

  const base = (API as any)?.BASE_URL || "http://localhost:3001";

  const r = await fetch(`${base}/api/upload/perfil`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(txt || "Falha no upload");

  const j = txt ? JSON.parse(txt) : null;

  const url =
    j?.url ||
    j?.fileUrl ||
    j?.path ||
    j?.file?.url ||
    j?.data?.url ||
    "";

  if (!url) throw new Error("Upload não retornou URL");
  return String(url);
}

async function uploadVideo(file: File): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Sem token");

  const fd = new FormData();
  fd.append("foto", file);

  const base = (API as any)?.BASE_URL || "http://localhost:3001";

  const r = await fetch(`${base}/api/upload/perfil`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(txt || "Falha no upload");

  const j = txt ? JSON.parse(txt) : null;

  const url =
    j?.url ||
    j?.fileUrl ||
    j?.path ||
    j?.file?.url ||
    j?.data?.url ||
    "";

  if (!url) throw new Error("Upload não retornou URL");

  return String(url);
}

function authHeaders() {
  const token =
    (Storage as any).token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readApiError(res: Response): Promise<string> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    raw = "";
  }

  try {
    const j = raw ? JSON.parse(raw) : null;
    const msg =
      j?.message ||
      j?.erro ||
      j?.error ||
      j?.details ||
      j?.msg ||
      j?.title ||
      null;

    if (msg) return String(msg);

    if (Array.isArray(j?.errors) && j.errors.length) {
      const first = j.errors[0];
      return String(first?.message || first?.msg || first || "Erro na API");
    }
  } catch {
  }

  if (raw && raw.trim().startsWith("<")) {
    return `Erro na API (HTTP ${res.status}).`;
  }

  return raw?.trim()
    ? raw.trim()
    : `Erro na API (HTTP ${res.status}).`;
}

async function assertOk(res: Response, fallbackMsg: string): Promise<Response> {
  if (res.ok) return res;
  const msg = await readApiError(res);
  throw new Error(msg || fallbackMsg);
}

async function apiListarTreinosSalvos(
  ownerTipo: "professor" | "clube" | "escolinha",
  ownerId: string,
) {
  const headers = authHeaders();
    const url =
    `${API.BASE_URL}/api/treinosSalvos` +
    `?tipoUsuario=${encodeURIComponent(ownerTipo)}` +
    `&tipoUsuarioId=${encodeURIComponent(ownerId)}` +
    `&includePublic=0` +
    `&_ts=${Date.now()}`;

    const r = await fetch(url, {
      headers,          // ✅ não manda Cache-Control como header
      cache: "no-store" // ✅ isso já força não-cache sem preflight de CORS
    });
  await assertOk(r, "Falha ao listar treinos salvos");

  const j = await r.json().catch(() => null);
  const meus = Array.isArray(j?.meus) ? j.meus : [];
  return meus as Array<{
    id: string;
    titulo: string;
    atualizadoEm?: string;
    expiraEm?: string | null;
  }>;
}

async function apiDeletarTreinoSalvo(id: string) {
  const headers = authHeaders();
  const r = await fetch(
    `${API.BASE_URL}/api/treinosSalvos/${encodeURIComponent(id)}?_ts=${Date.now()}`,
    {
      method: "DELETE",
      headers,          // ✅ não manda Cache-Control como header
      cache: "no-store",
    },
  );
  await assertOk(r, "Falha ao apagar treino salvo");
  return true;
}

async function apiCriarTreinoSalvo(body: any) {
  const headers = authHeaders();
  
  const r = await fetch(`${API.BASE_URL}/api/treinosSalvos`, {
    method: "POST",
    headers: { ...headers },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  await assertOk(r, "Falha ao criar treino salvo");
  return r.json().catch(() => ({}));
}

async function tentarSalvarComoTreinoSalvo(
  payload: TreinoCreatePayload,
  scoreTotal: number,
) {
  const token = getToken();
  if (!token) return { saved: false, reason: "sem-token" as const };

  const ownerTipo = payload.tipoUsuario;
  const ownerId = payload.tipoUsuarioId;
  if (!ownerTipo || !ownerId) return { saved: false, reason: "sem-dono" as const };

  try {
    // ✅ valida antes de tudo
    if (!Array.isArray(payload.exercicios) || payload.exercicios.length === 0) {
      console.warn("[Gaveta] pulou: treino sem exercícios no payload");
      return { saved: false, reason: "sem-exercicios" as const };
    }

    const categorias = Array.isArray(payload.categoria)
      ? payload.categoria.map(toCategoriaEnum).filter(Boolean)
      : [];

    // ✅ sempre pega a lista mais recente (evita “treino antigo que já apaguei”)
    let meus = await apiListarTreinosSalvos(ownerTipo, ownerId);

    const formatarData = (iso?: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      // dd/mm/aaaa hh:mm
      return d.toLocaleString("pt-BR");
    };

    // ✅ enquanto estiver cheio, obriga liberar espaço
    while (meus.length >= MAX_SLOTS_TREINOS_SALVOS) {
      const lista = meus
        .map((m, i) => {
          const dt = m.atualizadoEm || m.expiraEm || "";
          const dtFmt = dt ? formatarData(dt) : "";
          return `${i + 1}) ${m.titulo}${dtFmt ? ` (${dtFmt})` : ""} [${m.id}]`;
        })
        .join("\n");

      const escolha = window.prompt(
        `Você já possui ${MAX_SLOTS_TREINOS_SALVOS} treinos salvos.\n` +
          `Escolha um número para apagar e liberar espaço OU deixe vazio para não salvar este novo treino.\n\n` +
          `${lista}\n\nDigite 1-${meus.length}, ou deixe em branco para pular:`,
      );

      const idx = Number(escolha);

      // ✅ usuário desistiu
      if (!escolha || !Number.isFinite(idx) || idx < 1 || idx > meus.length) {
        return { saved: false, reason: "usuario-pulou" as const };
      }

      const apagar = meus[idx - 1];

      // ✅ remove da lista local já (evita o prompt “mostrar apagado”)
      meus = meus.filter((t) => t.id !== apagar.id);

      try {
        await apiDeletarTreinoSalvo(apagar.id);
      } catch (err) {
        // ✅ se falhar, refaz listagem pra não ficar desincronizado
        meus = await apiListarTreinosSalvos(ownerTipo, ownerId);
        alert("Não foi possível apagar o treino selecionado. O novo não será salvo na Gaveta.");
        return { saved: false, reason: "falha-apagar" as const };
      }

      // ✅ refetch “de verdade” depois do delete (resolve seu bug do 5 continuar preso)
      meus = await apiListarTreinosSalvos(ownerTipo, ownerId);

      // ✅ se por algum motivo ainda está cheio, continua o loop e pede para apagar mais um
      if (meus.length >= MAX_SLOTS_TREINOS_SALVOS) {
        // aqui não retorna: volta pro prompt do while
        continue;
      }
    }

    const body = {
      titulo: payload.nome,
      descricao: payload.descricao ?? null,
      nivel: payload.nivel ?? null,
      tipoTreino: payload.tipoTreino ?? null,
      categoria: categorias,
      duracao: payload.duracao ?? null,
      dicas: [],
      conteudo: {
        objetivo: payload.objetivo ?? null,
        exercicios: payload.exercicios,
        pontuacao: scoreTotal ?? null,
        dataAgendada: payload.dataAgendada ?? null,
      },
      publico: false,
      parceiro: false,
      naoExpira: false,
      tipoUsuario: ownerTipo,
      tipoUsuarioId: ownerId,
      criadoPorUsuarioId: payload.usuarioId ?? null,
    };

    await apiCriarTreinoSalvo(body);
    return { saved: true as const };
  } catch (e) {
    console.warn("tentarSalvarComoTreinoSalvo falhou:", e);
    return { saved: false, reason: "erro" as const };
  }
}

function safeParse<T>(str: string | null, fallback: T): T {
  try {
    if (!str) return fallback;
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function saveState(partial: any) {
  try {
    const prev = safeParse<any>(sessionStorage.getItem(SAVE_KEY), {});
    const next = { ...prev, ...partial };
    sessionStorage.setItem(SAVE_KEY, JSON.stringify(next));
    sessionStorage.setItem(RESTORE_FLAG_KEY, "1");
  } catch {}
}

function Stepper({
  steps,
  current,
  onJump,
  completedUntil,
}: {
  steps: Array<{ id: number; label: string }>;
  current: number;
  onJump: (n: number) => void;
  completedUntil: number;
}) {
  return (
    <div className="-mx-2 sm:mx-0">
      <div className="overflow-x-auto px-2">
        <ol className="flex items-center gap-2 sm:gap-3 min-w-max">
          {steps.map((s, idx) => {
            const isCurrent = s.id === current;
            const isCompleted = s.id <= completedUntil;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onJump(s.id)}
                  className={[
                    "flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full border transition text-sm sm:text-base whitespace-nowrap",
                    isCurrent
                      ? "bg-green-700 text-white border-green-700"
                      : isCompleted
                      ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                      : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
                  ].join(" ")}
                  title={`Ir para ${s.label}`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs">
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.id}
                  </span>
                  <span className="font-semibold text-xs sm:text-sm">
                    {s.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div className="hidden sm:block w-8 h-px bg-gray-300" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function StepCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-4 sm:p-6">
      <h3 className="font-bold text-lg sm:text-xl mb-4">{title}</h3>
      {children}
    </div>
  );
}

const VideoThumb = memo(function VideoThumb({
  src,
  onClick,
}: {
  src: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-44 sm:h-28 rounded overflow-hidden bg-black"
      title="Ver vídeo"
    >
      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
        <Play className="w-10 h-10 text-white opacity-90" />
      </div>
    </button>
  );
});

export default function NovoTreino() {
  const [route, navigate] = useLocation();
  const opcoesNiveis = ["Base", "Avancado", "Performance"] as const;
  type NivelTreino = (typeof opcoesNiveis)[number];
  const OPCOES_CATEGORIA = [
    "Todas as categorias",
    "Sub9",
    "Sub11",
    "Sub13",
    "Sub15",
    "Sub17",
    "Sub20",
    "Livre",
  ];

  const getQueryParam = (search: string, key: string) => {
    const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return (sp.get(key) || "").trim();
  };

  const search = route.includes("?") ? route.slice(route.indexOf("?")) : "";
  const treinoIdEdit =
    getQueryParam(search, "id") ||
    getQueryParam(search, "treinoId") ||
    getQueryParam(search, "programadoId");
  const isEditMode = !!treinoIdEdit;
  const editId = useMemo(() => {
    const qs = route.includes("?") ? route.split("?")[1] : "";
    const sp = new URLSearchParams(qs);
    return (
      sp.get("id") ||
      sp.get("treinoId") ||
      sp.get("programadoId") ||
      ""
    ).trim();
  }, [route]);

  const isEditing = Boolean(editId);
  const carregouEdicaoRef = useRef(false);

  const steps = useMemo(() => {
    const base = [
      { id: 1, label: "Informações" },
      { id: 2, label: "Exercícios" },
    ];
    if (!isEditing) base.push({ id: 3, label: "Atletas" });
    return base;
  }, [isEditing]);

  const [videoModalSrc, setVideoModalSrc] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [prazos, setPrazos] = useState<Record<string, string>>({});
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<Exercicio[]>([]);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<TreinoProgramado[]>([]);
  const [capaPreview, setCapaPreview] = useState<string>("");
  const [capaUrl, setCapaUrl] = useState<string>("");        
  const [editProgramadoId, setEditProgramadoId] = useState<string>("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState([]);
  type AbaTreinosAtleta = "meu_professor" | "footera";
  const [abaTreinosAtleta, setAbaTreinosAtleta] = useState<AbaTreinosAtleta>("meu_professor");
  const [treinosFootera, setTreinosFootera] = useState<TreinoProgramado[]>([]);
  const [professorVinculadoIds, setProfessorVinculadoIds] = useState<string[]>([]);
  const [atletasVinculados, setAtletasVinculados] = useState<AtletaVinculado[]>([]);
  const [atletasSelecionados, setAtletasSelecionados] = useState<string[]>([]);
  const [elencos, setElencos] = useState<Elenco[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string>("");
  const [etapa, setEtapa] = useState<number>(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState<NivelTreino>("Base");
  const [duracao, setDuracao] = useState<number>(60);
  const [dataTreino, setDataTreino] = useState<string>("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [tipoTreino, setTipoTreino] = useState<string>("Tecnico");
  const [objetivo, setObjetivo] = useState<string>("");
  const [iniciado, setIniciado] = useState<boolean>(false);
  const [exerciciosSelecionados, setExerciciosSelecionados] = useState<ExItemUILocal[]>([]);
  const [pontuacao, setPontuacao] = useState<number>(0);
  const [metas, setMetas] = useState<string>("");
  const [dicas, setDicas] = useState<string[]>([]);
  const [isParceiro, setIsParceiro] = useState<boolean>(false);
  const [treinoFootera, setTreinoFootera] = useState<boolean>(false);
  const [filtroEx, setFiltroEx] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("Todas as categorias");
  const [filtroNivel, setFiltroNivel] = useState<string>("");
  const [filtroVideo, setFiltroVideo] = useState<"" | "com" | "sem">("");
  const [filtroProf, setFiltroProf] = useState("");
  const restoredRef = useRef(false);
  const jaSincronizouCalendarioComDatas = useRef(false);
  const [datasAgendadasPorTreino, setDatasAgendadasPorTreino] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [orgsVinculadas, setOrgsVinculadas] = useState<Organizacao[]>([]);
  const [orgSelecionada, setOrgSelecionada] = useState<string>("");
  const [novaTurmaNome, setNovaTurmaNome] = useState<string>("");
  const [datasAgendamento, setDatasAgendamento] = useState<string[]>([]);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [horaAgendamento, setHoraAgendamento] = useState<string>("18:00");
  const [horaAgendamentoInput, setHoraAgendamentoInput] = useState<string>("18:00");
  const [meusExercicios, setMeusExercicios] = useState<MeuExercicioItem[]>([]);
  const [loadingMeusExercicios, setLoadingMeusExercicios] = useState(false);

  type AbaExercicios = "meus" | "catalogo" | "personalizados";
  const [abaExercicios, setAbaExercicios] = useState<AbaExercicios>("meus");

  type ExercicioPersonalizadoItem = {
    id: string;
    nome: string;
    objetivo?: string | null;
    descricao?: string | null;
    nivel?: string | null;
    categorias?: string[];
    videoDemonstrativoUrl?: string | null;
    videoPosterUrl?: string | null;
  };

  const [exerciciosPersonalizados, setExerciciosPersonalizados] = useState<ExercicioPersonalizadoItem[]>([]);
  const [loadingPersonalizados, setLoadingPersonalizados] = useState(false);

  function hhmmNow() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function isValidHHMM(v: string) {
    return /^\d{2}:\d{2}$/.test(v);
  }

  function isTodayYMD(ymd: string) {
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    return ymd === today;
  }

  function normalizarCategoriaFiltro(valor: string) {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .replace(/sub[\s-]?/g, "sub");
  }

  type ProfessorItem = { id: string; nome: string; codigo?: string; cref?: string };
  type GrupoProfessor = {
    tipo: "Escolinha" | "Clube";
    ownerId: string;
    nome: string;
    professores: ProfessorItem[];
  };

  const [gruposProfessores, setGruposProfessores] = useState<GrupoProfessor[]>([]);
  const [professoresSelecionados, setProfessoresSelecionados] = useState<string[]>([]);

  const [mesCalendario, setMesCalendario] = useState<{
    ano: number;
    mes: number;
  }>(() => {
    const base =
      (typeof window !== "undefined" &&
        (sessionStorage.getItem("novoTreino-dataTreinoBase") || "")) ||
      "";
    const hoje = new Date();
    const d = base ? new Date(base) : hoje;
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  const PAGE_SIZE_EX = 25;
  const [pageEx, setPageEx] = useState(1);
  const listRef = useRef<HTMLUListElement | null>(null);

  const [salvando, setSalvando] = useState(false);
  const criandoTreinoRef = useRef(false);

  function setVideoNoEx(index: number, videoUrl: string | null) {
    setExerciciosSelecionados((prev: ExItemUILocal[]) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], videoUrl };
      return copia;
    });
  }

  function showToast(
    message: string,
    type: "success" | "error" | "info" = "success",
  ) {
    setToast({ message, type });
  }

  function toggleProfessorSelecionado(id: string) {
    setProfessoresSelecionados((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  }

  function detectarSeFree(): boolean {
    try {
      const candidatos = [
        (Storage as any).plano,
        (Storage as any).assinaturaPlano,
        localStorage.getItem("planoAtual"),
        localStorage.getItem("plano"),
        sessionStorage.getItem("planoAtual"),
        sessionStorage.getItem("plano"),
      ].filter(Boolean) as string[];

      if (!candidatos.length) return false;

      const txt = candidatos.join(" ").toLowerCase();
      return (
        txt.includes("free") ||
        txt.includes("gratuito") ||
        txt.includes("grátis") ||
        txt.includes("gratis")
      );
    } catch {
      return false;
    }
  }

  const professorLogadoId = useMemo(() => {
    const tipo = String(
      (Storage as any).tipoSalvo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        ""
    ).trim().toLowerCase();

    if (tipo !== "professor") return "";

    return String(
      (Storage as any).tipoUsuarioId ||
        localStorage.getItem("tipoUsuarioId") ||
        sessionStorage.getItem("tipoUsuarioId") ||
        ""
    ).trim();
  }, []);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const r = await fetch(
          `${API.BASE_URL}/api/professores/realizadores-disponiveis`,
          { headers }
        );
        if (!r.ok) throw new Error(await r.text());

        const j = await r.json().catch(() => null);
        const grupos = Array.isArray(j?.grupos) ? j.grupos : [];

        const norm: GrupoProfessor[] = grupos.map((g: any) => ({
          tipo: g.tipo === "Clube" ? "Clube" : "Escolinha",
          ownerId: String(g.ownerId),
          nome: String(g.nome ?? (g.tipo === "Clube" ? "Clube" : "Escolinha")),
          professores: Array.isArray(g.professores)
            ? g.professores.map((p: any) => ({
                id: String(p.id),
                nome: String(p.nome ?? "Professor"),
                codigo: p.codigo ? String(p.codigo) : undefined,
                cref: p.cref ? String(p.cref) : undefined,
              }))
            : [],
        }));

        if (!cancel) setGruposProfessores(norm);
      } catch (e) {
        console.error("Erro ao carregar professores realizadores:", e);
        if (!cancel) setGruposProfessores([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    fetchExerciciosCatalogo();
    fetchExerciciosPersonalizados();
    fetchMeusExercicios();
  }, []);

  useEffect(() => {
    const ehFree = detectarSeFree();
    setIsFreePlan(ehFree);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.type === "error" ? 9000 : 4000; 
    const id = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (dataTreino) {
      const soData = dataTreino.includes("T")
        ? dataTreino.split("T")[0]
        : dataTreino;
      sessionStorage.setItem("novoTreino-dataTreinoBase", soData);
    }
  }, [dataTreino]);

  useEffect(() => {
    if (
      !jaSincronizouCalendarioComDatas.current &&
      datasAgendamento.length > 0
    ) {
      const primeira = datasAgendamento[0];
      const d = new Date(primeira);
      if (!isNaN(d.getTime())) {
        setMesCalendario({ ano: d.getFullYear(), mes: d.getMonth() });
      }
      jaSincronizouCalendarioComDatas.current = true;
    }
  }, [datasAgendamento]);

  const DRAFT_KEY = `novoTreino:draft:exercicios:${usuarioId || "anon"}`;

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(exerciciosSelecionados || []));
    } catch {}
  }, [DRAFT_KEY, exerciciosSelecionados]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setExerciciosSelecionados(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAFT_KEY]);

  const gruposProfessoresFiltrados = useMemo(() => {
    const termo = filtroProf.trim().toLowerCase();

    if (!termo) return gruposProfessores;

    return gruposProfessores
      .map((grupo) => ({
        ...grupo,
        professores: grupo.professores.filter((p) => {
          const texto = [
            p.nome ?? "",
            p.codigo ?? "",
            p.cref ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return texto.includes(termo);
        }),
      }))
      .filter((grupo) => grupo.professores.length > 0);
  }, [gruposProfessores, filtroProf]);

  const MOSTRAR_TODOS = "__todos__";
  const score = useMemo(
    () => calcularPontuacaoTreino(nivel, tipoTreino, duracao, exerciciosSelecionados),
    [nivel, tipoTreino, duracao, exerciciosSelecionados],
  );

  function treinoTemPersonalizado(id: string) {
    return exerciciosSelecionados.some((x: any) => String((x as any).exercicioPersonalizadoId || "") === String(id));
  }

  function treinoTemExercicio(id: string) {
    return exerciciosSelecionados.some(
      (x: any) =>
        String((x as any).idCatalogo || (x as any).exercicioId || "") === String(id)
    );
  }

  function addPersonalizadoNoTreino(p: any) {
    setExerciciosSelecionados((prev) => [
      ...prev,
      {
        idLocal: crypto.randomUUID(),
        idCatalogo: null,
        exercicioId: null,
        exercicioPersonalizadoId: String(p.id ?? ""),
        nome: p.nome ?? "Exercício",
        descricao: p.objetivo ?? p.descricao ?? "",
        objetivo: p.objetivo ?? null,
        nivel: p.nivel ?? null,
        videoUrl: p.videoDemonstrativoUrl ?? null,
        videoDemonstrativoUrl: p.videoDemonstrativoUrl ?? null,
        videoPosterUrl: p.videoPosterUrl ?? null,
        series:
          typeof p.series === "number"
            ? p.series
            : p.series != null && String(p.series).trim() !== ""
            ? Number(p.series)
            : null,
        repeticoes:
          p.repeticoes != null ? String(p.repeticoes) : "",
        duracao:
          p.duracao != null ? String(p.duracao) : "",
        descanso:
          p.descanso != null ? String(p.descanso) : "",
        ordem: prev.length + 1,
        categorias: Array.isArray(p.categorias) ? p.categorias : [],
        origem: "personalizado",
        tipoExecucao: p.duracao ? "duracao" : "repeticao",
      },
    ]);
  }

  function normalizaTreinos(raw: any[]): TreinoProgramado[] {
    return raw.map((t: any) => {
      const programadoId =
        t.treinoProgramadoId ?? t.programadoId ?? t.programado?.id ?? t.id;

      let criador: TreinoProgramado["criador"] = t.criador ?? null;

      const criadoresArr =
        Array.isArray(t.criadores) ? t.criadores :
        Array.isArray(t.colaboradores) ? t.colaboradores.map((c:any) => ({
          id: String(c.professor?.id ?? c.professorId),
          nome: String(c.professor?.nome ?? "Professor"),
        })) : [];

      if (!criador) {
        if (t.professor) {
          criador = {
            tipo: "Professor",
            id: t.professor.id,
            nome: t.professor.nome ?? "Professor",
          };
        } else if (t.clube) {
          criador = {
            tipo: "Clube",
            id: t.clube.id,
            nome: t.clube.nome ?? "Clube",
          };
        } else if (t.escolinha) {
          criador = {
            tipo: "Escolinha",
            id: t.escolinha.id,
            nome: t.escolinha.nome ?? "Escolinha",
          };
        }
      }

      const criadorNome =
        criador?.nome ??
        t.criadorNome ??
        t.criadoPorNome ??
        t.ownerNome ??
        t.donoNome ??
        t.professor?.usuario?.nome ??
        t.professor?.nome ??
        t.clube?.nome ??
        t.escolinha?.nome ??
        null;

      const criadorTipo =
        criador?.tipo ??
        t.criadorTipo ??
        t.tipoUsuario ??
        t.ownerTipo ??
        t.donoTipo ??
        (t.professorId
          ? "Professor"
          : t.clubeId
          ? "Clube"
          : t.escolinhaId
          ? "Escolinha"
          : null);

      return {
        id: String(programadoId),
        nome: t.nome ?? t.titulo ?? "(sem nome)",
        descricao: t.descricao ?? t.resumo ?? "",
        nivel: t.nivel ?? t.dificuldade ?? "-",
        pontuacao: t.pontuacao ?? null,
        imagemUrl:
          t.imagemUrl ??
          t.imagemURL ??
          t.capaUrl ??
          t.capa ??
          t.foto ??
          null,
        exercicios: (t.exercicios ?? t.exs ?? []).map(
          (ex: any, i: number) => ({
            id: ex.id ?? ex.exercicioId ?? String(i),
            nome:
              ex.nome ??
              ex.titulo ??
              ex?.exercicio?.nome ??
              ex?.exercicioTemporario?.nome ??
              "",
            repeticoes: ex.repeticoes ?? ex.reps ?? ex.qtde ?? "",
          }),
        ),
        // @ts-ignore
        treinoProgramadoId:
          t.treinoProgramadoId ?? t.programadoId ?? t.programado?.id ?? null,
        // @ts-ignore
        origemId: t.id ?? null,
        criadores: criadoresArr,
        criador,
        criadorNome,
        criadorTipo,
      };
    });
  }

  function mapAtletas(items: any[]): AtletaVinculado[] {
    return (items || [])
      .map((a: any) => {
        const atletaId =
          a.atletaId ||
          a.id ||
          a?.atleta?.id ||
          "";

        const usuarioId =
          a.usuarioId ||
          a?.usuario?.id ||
          a?.atleta?.usuarioId ||
          a?.atleta?.usuario?.id ||
          "";

        const primeiroNome =
          a.nome ??
          a?.usuario?.nome ??
          a?.atleta?.nome ??
          "Atleta";

        const sobrenome =
          a.sobrenome ??
          a?.usuario?.sobrenome ??
          a?.atleta?.sobrenome ??
          "";

        let nomeCompleto = primeiroNome;
        if (sobrenome && !String(primeiroNome).includes(sobrenome)) {
          nomeCompleto = `${primeiroNome} ${sobrenome}`;
        }

        const foto =
          a.foto ??
          a?.usuario?.foto ??
          a?.atleta?.usuario?.foto ??
          undefined;

        return {
          id: String(atletaId),
          nome: nomeCompleto,
          foto,
          usuarioId: usuarioId ? String(usuarioId) : undefined,
        } as AtletaVinculado;
      })
      .filter((x) => x.id && x.id !== "undefined" && x.id !== "null")
  }

  const atletaIdLogado = useMemo(() => {
    const tipo = String(
      (Storage as any).tipoSalvo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        ""
    ).trim().toLowerCase();

    if (tipo !== "atleta") return "";

    return String(
      (Storage as any).tipoUsuarioId ??
        localStorage.getItem("tipoUsuarioId") ??
        sessionStorage.getItem("tipoUsuarioId") ??
        ""
    ).trim();
  }, []);

  useEffect(() => {
    const tipo =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";
    if (String(tipo).toLowerCase() !== "atleta") return;

    let cancel = false;

     (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const atletaId = String(atletaIdLogado || "").trim();

        if (!atletaId) {
          console.warn("[NovoTreino] atletaIdLogado vazio (Atleta.id).");
          return;
        }

        const tries = [
          `${API.BASE_URL}/api/treinos/disponiveis?atletaId=${encodeURIComponent(atletaId)}`,
        ];

        let lista: any[] = [];
        for (const url of tries) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const arr = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];
          if (Array.isArray(arr)) {
            lista = arr;
            break;
          }
        }

        if (!cancel) setTreinosDisponiveis(normalizaTreinos(lista || []));
        try {
          const urlAg = `${API.BASE_URL}/api/treinos/agendados?atletaId=${encodeURIComponent(
            atletaIdLogado
          )}&apenasFuturos=1`;

          
          const ra = await fetch(urlAg, { headers });
          if (ra.ok) {
            const ja = await ra.json().catch(() => null);
            const arrAg = Array.isArray(ja) ? ja : (ja?.items ?? ja?.data ?? ja?.rows ?? []);
            const mapa = new Map<string, Set<string>>();

            for (const x of (arrAg || [])) {
              const treinoId = String(x.treinoProgramadoId ?? x.programadoId ?? x.treinoId ?? "").trim();
              if (!treinoId || treinoId === "undefined" || treinoId === "null") continue;

             const dtRaw = x.dataTreino ?? x.dataOriginal ?? x.dataAgendada ?? null;

             let dia = "";
             if (dtRaw) {
               const d = new Date(String(dtRaw));
               if (!Number.isNaN(d.getTime())) {
                 dia = dateKeyLocal(d); // ✅ yyyy-mm-dd
               }
             }

             if (!dia) continue;

             if (!mapa.has(treinoId)) mapa.set(treinoId, new Set());
              mapa.get(treinoId)!.add(dia);
             }

             if (!cancel) setDatasAgendadasPorTreino(mapa);

           } else {
             const txt = await ra.text().catch(() => "");
             console.warn("[NovoTreino] falha ao listar agendados p/ bloquear:", ra.status, txt);
           }
         } catch (e) {
           console.warn("[NovoTreino] erro ao listar agendados p/ bloquear:", e);
         }
      } catch (e) {
        console.error("Falha ao carregar treinos disponíveis:", e);
        if (!cancel) setTreinosDisponiveis([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [atletaIdLogado]);

  useEffect(() => {
    const tipo =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";

    if (String(tipo).toLowerCase() !== "atleta") return;

    let cancel = false;

    (async () => {
      try {
        const token = getToken();
        if (!token) return;

        const atletaId = String(atletaIdLogado || "").trim();
        if (!atletaId) return;

        const headers = { Authorization: `Bearer ${token}` };

        const tries = [
          `${API.BASE_URL}/api/atletas/${encodeURIComponent(atletaId)}`,
          `${API.BASE_URL}/api/perfil/${encodeURIComponent(atletaId)}`, 
        ];

        let data: any = null;
        for (const url of tries) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          data = await r.json().catch(() => null);
          if (data) break;
        }

        const rels =
          data?.relacoesTreinamento ??
          data?.atleta?.relacoesTreinamento ??
          data?.data?.relacoesTreinamento ??
          [];

        const profIds = Array.from(
          new Set(
            (Array.isArray(rels) ? rels : [])
              .filter((x: any) => x?.ativo !== false)
              .map((x: any) => String(x?.professorId ?? x?.professor?.id ?? "").trim())
              .filter((id: string) => id && id !== "undefined" && id !== "null"),
          ),
        );

        if (!cancel) setProfessorVinculadoIds(profIds);
      } catch (e) {
        console.warn("[NovoTreino] falha ao carregar professorVinculadoIds:", e);
        if (!cancel) setProfessorVinculadoIds([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [atletaIdLogado]);

  useEffect(() => {
    const tipo =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";

    if (String(tipo).toLowerCase() !== "atleta") return;

    let cancel = false;

    (async () => {
      try {
        const token = getToken();
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };

        const r = await fetch(
          `${API.BASE_URL}/api/treinos/publicos-professores-parceiros`,
          { headers },
        );

        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          console.warn("[NovoTreino] falha /publicos-professores-parceiros:", r.status, txt);
          if (!cancel) setTreinosFootera([]);
          return;
        }

        const j = await r.json().catch(() => null);
        const arr = Array.isArray(j) ? j : (j?.items ?? j?.data ?? j?.rows ?? []);

        if (!cancel) setTreinosFootera(normalizaTreinos(arr || []));
      } catch (e) {
        console.warn("[NovoTreino] erro ao carregar treinosFootera:", e);
        if (!cancel) setTreinosFootera([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
  (async () => {
    try {
      const token =
        (Storage as any).token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const baseTipoUsuarioId =
        (Storage as any).tipoUsuarioId ||
        localStorage.getItem("tipoUsuarioId") ||
        sessionStorage.getItem("tipoUsuarioId") ||
        localStorage.getItem("perfilId") ||
        sessionStorage.getItem("perfilId") ||
        "";

      if (!baseTipoUsuarioId) {
        console.warn("[NovoTreino] sem tipoUsuarioId; não dá para carregar turmas/elencos");
        setElencos([]);
        setTurmaSelecionada("");
        return;
      }

      const orgId =
        orgSelecionada && orgSelecionada !== MOSTRAR_TODOS
          ? orgSelecionada
          : null;

      const orgObj = orgId
        ? orgsVinculadas.find((o) => String(o.id) === String(orgId))
        : null;

      const ownerTipo =
        orgObj?.tipo === "Clube"
          ? "Clube"
          : orgObj?.tipo === "Escolinha"
          ? "Escolinha"
          : "Professor";

      const ownerId = orgObj?.id ? String(orgObj.id) : String(baseTipoUsuarioId);
      const professorId = String(baseTipoUsuarioId);

      {
        const urlMinhas = `${API.BASE_URL}/api/turmas/minhas?tipoUsuarioId=${encodeURIComponent(
          baseTipoUsuarioId
        )}`;

        const r = await fetch(urlMinhas, { headers });

        if (r.ok) {
          const data = await r.json();
          const arr = Array.isArray(data)
            ? data
            : data.items ?? data.data ?? data.rows ?? data.result ?? [];

          const norm = (arr || []).map((t: any) => ({
            id: String(t.id),
            nome: t.nome ?? t.titulo ?? "Turma",
            atletasIds:
              t.atletasIds ??
              t.membros?.map((m: any) => m.atletaId ?? m.id) ??
              [],
          }));

          setElencos(norm);
          return;
        } else {
          const txt = await r.text().catch(() => "");
          console.warn("[NovoTreino] falha em /api/turmas/minhas:", r.status, txt);
        }
      }

      {
        const query =
          ownerTipo === "Professor"
            ? `professorId=${encodeURIComponent(professorId)}`
            : `ownerTipo=${encodeURIComponent(ownerTipo)}&ownerId=${encodeURIComponent(ownerId)}`;

        const url = `${API.BASE_URL}/api/turmas?${query}`;
        const r = await fetch(url, { headers });

        if (r.ok) {
          const j = await r.json();
          const arr = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];

          const norm = (arr || []).map((t: any) => ({
            id: String(t.id),
            nome: t.nome ?? t.titulo ?? "Turma",
            atletasIds:
              t.atletasIds ??
              t.membros?.map((m: any) => m.atletaId ?? m.id) ??
              [],
          }));

          setElencos(norm);
          return;
        } else {
          const txt = await r.text().catch(() => "");
          console.warn("[NovoTreino] falha em /api/turmas:", r.status, txt);
        }
      }

      setElencos([]);
      setTurmaSelecionada("");
    } catch (e) {
      console.error("[NovoTreino] erro inesperado ao carregar turmas", e);
      setElencos([]);
      setTurmaSelecionada("");
    }
  })();
}, [orgSelecionada, orgsVinculadas]);

  useEffect(() => {
    const tipoPersistido =
      (
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        (Storage as any).tipoSalvo ??
        ""
      )
        .toString()
        .trim()
        .toLowerCase();

    const tipoNormalizado =
      tipoPersistido === "escolinha" ? "escola" : tipoPersistido;
    const permitidos = ["escola", "clube", "professor", "atleta"] as const;

    if (permitidos.includes(tipoNormalizado as any)) {
      setUsuario({ tipo: tipoNormalizado as (typeof permitidos)[number] });
    } else {
      console.warn("tipoUsuario inválido/inesperado:", {
        tipoPersistido,
        tipoNormalizado,
      });
      setUsuario(null);
    }

    const id =
      localStorage.getItem("usuarioId") ??
      sessionStorage.getItem("usuarioId") ??
      (Storage as any).usuarioId ??
      null;
    setUsuarioId(id);

    if (!restoredRef.current) {
      const shouldRestore =
        sessionStorage.getItem(RESTORE_FLAG_KEY) === "1";

      if (shouldRestore) {
        const saved = safeParse<any>(sessionStorage.getItem(SAVE_KEY), null);
        if (saved) {
          setEtapa(saved.etapa ?? 1);
          setNome(saved.nome ?? "");
          setDescricao(saved.descricao ?? "");
          setNivel(saved.nivel ?? "Base");
          setDuracao(saved.duracao ?? 60);
          setDataTreino(saved.dataTreino ?? "");
          setCategorias(
            saved.categorias ??
              (saved.categoria
                ? Array.isArray(saved.categoria)
                  ? saved.categoria
                  : [saved.categoria]
                : []),
          );
          setTipoTreino(saved.tipoTreino ?? "Tecnico");
          setObjetivo(saved.objetivo ?? "");
          const exOld = Array.isArray(saved.exerciciosSelecionados)
            ? saved.exerciciosSelecionados
            : [];
          const exUi: ExItemUILocal[] = exOld.map((x: any, idx: number) => ({
            idLocal: crypto.randomUUID(),
            idCatalogo: x.exercicioId ?? x.idCatalogo ?? null,
            exercicioId: x.exercicioId ?? x.idCatalogo ?? null,
            exercicioPersonalizadoId: x.exercicioPersonalizadoId ?? null,
            nome: x.nome ?? "",
            descricao: x.descricaoExecucao ?? x.exercicio?.descricao ?? "",
            objetivo: x.objetivo ?? null,
            repeticoes: x.repeticoes ?? "",
            ordem: x.ordem ?? idx + 1,
            series: x.series ?? "",
            duracao: x.duracao ?? "",
            descanso: x.descanso ?? "",
            tipoExecucao: x.duracao ? "duracao" : "repeticao",
            videoUrl: x.videoDemonstrativoUrl ?? x.videoUrl ?? null,
            videoDemonstrativoUrl: x.videoDemonstrativoUrl ?? x.videoUrl ?? null,
            videoPosterUrl: x.videoPosterUrl ?? null,
            nivel: x.nivel ?? null,
            categorias: Array.isArray(x.categorias) ? x.categorias : [],
          }));
          setExerciciosSelecionados(exUi);
          setAtletasSelecionados(saved.atletasSelecionados ?? []);
          setDatasAgendamento(saved.datasAgendamento ?? []);
          setProfessoresSelecionados(
            Array.isArray(saved.professoresSelecionados)
              ? saved.professoresSelecionados.map(String)
              : []
          );
          setCapaUrl(saved.capaUrl ?? "");
          setTreinoFootera(Boolean(saved.treinoFootera ?? false));
        }
      }

      restoredRef.current = true;
    }

    setIniciado(true);
  }, []);

    useEffect(() => {
    if (!isEditing) return;
    if (!iniciado) return;
    if (carregouEdicaoRef.current) return;

    carregouEdicaoRef.current = true;

    (async () => {
      try {
        await carregarTreinoParaEdicao(editId);
        showToast("Modo edição: treino carregado.", "info");
      } catch (e: any) {
        console.error("[NovoTreino] falha ao carregar edição:", e);
        showToast(e?.message || "Falha ao carregar treino para editar.", "error");
      }
    })();
  }, [isEditing, iniciado, editId]);

  useEffect(() => {
    const tipo = String(
    (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      ""
  ).trim().toLowerCase();

  if (tipo !== "professor") {
    setOrgsVinculadas([]);
    return;
  }
    (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const professorTipoId =
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          "";

        if (!professorTipoId) {
          setOrgsVinculadas([]);
          return;
        }

        const tentativas = [
          `${API.BASE_URL}/api/professores/${professorTipoId}/vinculos`,
          `${API.BASE_URL}/api/organizacoes?vinculadasAoProfessorId=${professorTipoId}`,
          `${API.BASE_URL}/api/vinculos?tipo=Professor&id=${professorTipoId}`,
        ];

        let arr: any[] = [];
        for (const url of tentativas) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const list = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];
          if (Array.isArray(list) && list.length) {
            arr = list;
            break;
          }
        }

        const normalizada: Organizacao[] = (arr || [])
          .map((o: any) => {
            const tipo: Organizacao["tipo"] = String(
              o.tipo ?? o.kind ?? o.categoria ?? "",
            )
              .toLowerCase()
              .includes("clube")
              ? "Clube"
              : "Escolinha";

            return {
              id: String(o.escolinhaId ?? o.clubeId ?? o.id ?? o.organizacaoId),
              nome: String(o.nome ?? o.titulo ?? "Organização"),
              tipo,
            };
          })
          .filter((x) => x.id);

        setOrgsVinculadas(normalizada);
        if (!orgSelecionada && normalizada.length === 1)
          setOrgSelecionada(normalizada[0].id);
      } catch {
        setOrgsVinculadas([]);
      }
    })();
  }, []);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        if (orgSelecionada === MOSTRAR_TODOS) {
          const urlsTodos = [
            `${API.BASE_URL}/api/atletas`,
            `${API.BASE_URL}/api/usuarios?perfil=atleta`,
            `${API.BASE_URL}/api/relacoes/atletas?todos=1`,
          ];
          for (const url of urlsTodos) {
            const r = await fetch(url, { headers });
            if (!r.ok) continue;
            const j = await r.json();
            const arr = Array.isArray(j)
              ? j
              : j.items ?? j.data ?? j.rows ?? j.result ?? [];
            if (!cancel) setAtletasVinculados(mapAtletas(arr));
            return;
          }
          if (!cancel) setAtletasVinculados([]);
          return;
        }

        const tipoUsuarioId =
          orgSelecionada ||
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          localStorage.getItem("perfilId") ||
          sessionStorage.getItem("perfilId") ||
          "";

        if (!tipoUsuarioId) {
          console.warn(
            "[NovoTreino] nenhum tipoUsuarioId/perfilId encontrado; não dá para chamar /api/treinos/atletas-vinculados",
          );
          if (!cancel) setAtletasVinculados([]);
          return;
        }

        const url = `${API.BASE_URL}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(
          tipoUsuarioId,
        )}&incluirPontuacao=1`;

        const r = await fetch(url, { headers });
        const txt = await r.text();

        if (!r.ok) {
          console.error(
            "[NovoTreino] erro ao buscar atletas-vinculados:",
            r.status,
            txt,
          );
          if (!cancel) setAtletasVinculados([]);
          return;
        }

        let data: any;
        try {
          data = txt ? JSON.parse(txt) : [];
        } catch {
          data = [];
        }

        const items = Array.isArray(data)
          ? data
          : data.items ?? data.data ?? data.rows ?? data.result ?? [];

        if (!cancel) {
          setAtletasVinculados(mapAtletas(items));
        }
      } catch (e) {
        console.error(
          "[NovoTreino] exceção ao carregar atletas-vinculados:",
          e,
        );
        if (!cancel) setAtletasVinculados([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [orgSelecionada]);

  useEffect(() => {
    saveState({
      etapa,
      nome,
      descricao,
      nivel,
      duracao,
      dataTreino,
      categorias,
      tipoTreino,
      objetivo,
      exerciciosSelecionados,
      atletasSelecionados,
      datasAgendamento,
      professoresSelecionados,
      capaUrl,
      treinoFootera,
    });
  }, [
    etapa,
    nome,
    descricao,
    nivel,
    duracao,
    dataTreino,
    categorias,
    tipoTreino,
    objetivo,
    exerciciosSelecionados,
    atletasSelecionados,
    datasAgendamento,
    professoresSelecionados,
    treinoFootera,
  ]);

  async function carregarTreinoParaEdicao(id: string) {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const tries = [
      `${API.BASE_URL}/api/treinos/programados/${encodeURIComponent(id)}`,
      `${API.BASE_URL}/api/treinosprogramados/${encodeURIComponent(id)}`,
      `${API.BASE_URL}/api/treinos/${encodeURIComponent(id)}`,
    ];

    let data: any = null;

    for (const url of tries) {
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      data = await r.json().catch(() => null);
      if (data) break;
    }

    if (!data) throw new Error("Não foi possível carregar o treino para editar.");

    const t = data?.data ?? data;
    const pid =
      t?.treinoProgramadoId ??
      t?.programadoId ??
      t?.programado?.id ??
      t?.id ??
      "";

    setEditProgramadoId(String(pid || id));
    setNome(String(t.nome ?? t.titulo ?? ""));
    setDescricao(String(t.descricao ?? t.resumo ?? ""));
    const nivelCarregado = String(t.nivel ?? "Base");
    setNivel(
      (opcoesNiveis.includes(nivelCarregado as NivelTreino)
        ? (nivelCarregado as NivelTreino)
        : "Base")
    );
    setDuracao(Number(t.duracao ?? 60) || 60);
    setTipoTreino(String(t.tipoTreino ?? "Tecnico") || "Tecnico");
    setObjetivo(String(t.objetivo ?? t?.conteudo?.objetivo ?? ""));
    setCapaUrl(String(t.imagemUrl ?? t.capaUrl ?? t.capa ?? t.foto ?? ""));
    const cats = t.categoria ?? t.categorias ?? [];
    setCategorias(Array.isArray(cats) ? cats.map(String) : cats ? [String(cats)] : []);
    // ✅ se vier do backend como publico/parceiro
    setTreinoFootera(Boolean(t.publico ?? t.parceiro ?? t.isFootera ?? false));

    // professores colaboradores (pode vir professoresIds, colaboradores, criadores etc)
    const profIds =
      t.professoresIds ??
      t.colaboradoresProfessorIds ??
      t.colaboradoresIds ??
      (Array.isArray(t.colaboradores)
        ? t.colaboradores
            .map((c: any) => c.professorId ?? c.professor?.id)
            .filter(Boolean)
        : []);

    setProfessoresSelecionados(Array.isArray(profIds) ? profIds.map(String) : []);

    const atIds = t.atletasIds ?? t.atletaIds ?? [];
    if (Array.isArray(atIds)) setAtletasSelecionados(atIds.map(String));

    const datas = t.datasAgendamento ?? t.datas ?? [];
    if (Array.isArray(datas) && datas.length) setDatasAgendamento(datas.map(String));

    const exs = t.exercicios ?? t.exs ?? t.conteudo?.exercicios ?? [];
    const exUi: ExItemUILocal[] = (Array.isArray(exs) ? exs : []).map((ex: any, idx: number) => ({
      idLocal: crypto.randomUUID(),
      id: ex.id ?? `ex_${idx}`,

      idCatalogo:
        ex.exercicioId ??
        ex.idCatalogo ??
        (ex.exercicio && !ex.exercicioPersonalizado ? ex.exercicio.id : null) ??
        null,

      exercicioId:
        ex.exercicioId ??
        ex.idCatalogo ??
        (ex.exercicio && !ex.exercicioPersonalizado ? ex.exercicio.id : null) ??
        null,

      exercicioPersonalizadoId:
        ex.exercicioPersonalizadoId ??
        ex.exercicioPersonalizado?.id ??
        null,

      exercicioTemporarioId:
        ex.exercicioTemporarioId ??
        ex.exercicioTemporario?.id ??
        null,

      tipo:
        ex.exercicioPersonalizadoId || ex.exercicioPersonalizado
          ? "personalizado"
          : ex.exercicioTemporarioId || ex.exercicioTemporario
          ? "temporario"
          : "catalogo",

      origem:
        ex.exercicioPersonalizadoId || ex.exercicioPersonalizado
          ? "personalizado"
          : ex.exercicioTemporarioId || ex.exercicioTemporario
          ? "temporario"
          : "catalogo",

      nome:
        ex.nome ??
        ex.exercicio?.nome ??
        ex.exercicioPersonalizado?.nome ??
        ex.exercicioTemporario?.nome ??
        "",

      objetivo:
        ex.objetivo ??
        ex.exercicio?.objetivo ??
        ex.exercicioPersonalizado?.objetivo ??
        ex.exercicioTemporario?.objetivo ??
        null,

      descricao:
        ex.descricaoExecucao ??
        ex.descricao ??
        ex.exercicio?.descricao ??
        ex.exercicioPersonalizado?.descricao ??
        ex.exercicioTemporario?.descricao ??
        "",

      repeticoes: ex.repeticoes ?? ex.reps ?? "",

      series:
        typeof ex.series === "number"
          ? ex.series
          : ex.series != null && String(ex.series).trim() !== ""
          ? Number(ex.series)
          : "",

      duracao: ex.duracao ?? "",
      descanso: ex.descanso ?? "",
      ordem: Number(ex.ordem ?? idx + 1),

      tipoExecucao:
        String(ex.duracao ?? "").trim() !== "" ? "duracao" : "repeticao",

      videoUrl:
        ex.videoDemonstrativoUrl ??
        ex.videoUrl ??
        ex.exercicioPersonalizado?.videoDemonstrativoUrl ??
        ex.exercicioTemporario?.videoDemonstrativoUrl ??
        ex.exercicio?.videoDemonstrativoUrl ??
        null,

      videoDemonstrativoUrl:
        ex.videoDemonstrativoUrl ??
        ex.videoUrl ??
        ex.exercicioPersonalizado?.videoDemonstrativoUrl ??
        ex.exercicioTemporario?.videoDemonstrativoUrl ??
        ex.exercicio?.videoDemonstrativoUrl ??
        null,

      videoPosterUrl:
        ex.videoPosterUrl ??
        ex.exercicioPersonalizado?.videoPosterUrl ??
        ex.exercicioTemporario?.videoPosterUrl ??
        ex.exercicio?.videoPosterUrl ??
        null,

      nivel:
        ex.nivel ??
        ex.exercicioPersonalizado?.nivel ??
        ex.exercicioTemporario?.nivel ??
        ex.exercicio?.nivel ??
        null,

      categorias:
        ex.categorias ??
        ex.exercicioPersonalizado?.categorias ??
        ex.exercicioTemporario?.categorias ??
        ex.exercicio?.categorias ??
        [],
    }));

    setExerciciosSelecionados(exUi);
  }

  async function criarTurmaComSelecionados() {
    const token =
      (Storage as any).token ??
      localStorage.getItem("token") ??
      sessionStorage.getItem("token");

    if (!token) {
      showToast("Faça login novamente para criar uma turma.", "error");
      return;
    }

    if (!novaTurmaNome || !novaTurmaNome.trim()) {
      showToast("Dê um nome para a turma.", "error");
      return;
    }

    if (!atletasSelecionados || atletasSelecionados.length === 0) {
      alert("Selecione pelo menos 1 atleta para a turma.");
      return;
    }


    const atletasSelecionadosObjs = atletasVinculados.filter((a) =>
      atletasSelecionados.includes(a.id),
    );

    const atletaIds = atletasSelecionadosObjs.map((a) => a.id);

    const usuarioIds = atletasSelecionadosObjs
      .map((a) => a.usuarioId)
      .filter((id): id is string => Boolean(id));

    const orgId = orgSelecionada && orgSelecionada !== MOSTRAR_TODOS ? String(orgSelecionada) : "";

    const orgObj = orgId
      ? orgsVinculadas.find((o) => String(o.id) === String(orgId))
      : null;

    const ownerTipoCapital =
      orgObj?.tipo === "Clube"
        ? "Clube"
        : orgObj?.tipo === "Escolinha"
        ? "Escolinha"
        : String(
            usuario?.tipo ??
              (Storage as any).tipoSalvo ??
              (Storage as any).tipo ??
              ""
          ).toLowerCase().startsWith("clube")
        ? "Clube"
        : String(
            usuario?.tipo ??
              (Storage as any).tipoSalvo ??
              (Storage as any).tipo ??
              ""
          ).toLowerCase().startsWith("escolinha") ||
          String(
            usuario?.tipo ??
              (Storage as any).tipoSalvo ??
              (Storage as any).tipo ??
              ""
          ).toLowerCase().startsWith("escola")
        ? "Escolinha"
        : "Professor";

    const ownerIdFinal = orgObj?.id
      ? String(orgObj.id)
      : String(
          (Storage as any).tipoUsuarioId ||
            (Storage as any).professorId ||
            localStorage.getItem("tipoUsuarioId") ||
            sessionStorage.getItem("tipoUsuarioId") ||
            ""
        );

    if (!ownerIdFinal) {
      alert("Não foi possível identificar o dono da turma. Faça login novamente.");
      return;
    }

    const payload = {
      ownerTipo: ownerTipoCapital,
      ownerId: ownerIdFinal,
      nome: novaTurmaNome.trim(),
      professorId: ownerTipoCapital === "Professor" ? ownerIdFinal : undefined,
      atletaIds,
      usuarioIds,
    };

    try {
      const resp = await fetch(`${API.BASE_URL}/api/turmas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }

      if (!resp.ok) {
        const msg =
          data?.message ||
          data?.erro ||
          data?.error ||
          "Não foi possível criar a turma.";
        showToast(String(msg), "error");
        return;
      }

      if (data && data.id) {
        setElencos((prev) => [
          ...prev,
          {
            id: String(data.id),
            nome: data.nome ?? novaTurmaNome.trim(),
            atletasIds: atletaIds,
          },
        ]);
        setTurmaSelecionada(String(data.id));
      }

      showToast("Turma criada com sucesso!", "success");

      setNovaTurmaNome("");
      setAtletasSelecionados([]);
    } catch (e) {
      console.error("[NovoTreino] erro ao criar turma", e);
      showToast("Erro inesperado ao criar a turma.", "error");
    }
  }

  useEffect(() => {
      if (!professorLogadoId) return;
      setProfessoresSelecionados((prev) =>
        prev.filter((id) => String(id) !== String(professorLogadoId))
      );
  }, [professorLogadoId]);

  const [completedUntil, setCompletedUntil] = useState<number>(1);
  const goTo = (n: number) => {
    setEtapa(n);
    setCompletedUntil((prev) => Math.max(prev, n));
  };

  function normalizaNome(n?: string) {
    return (n || "").trim().toLowerCase();
  }

  function jaEstaNoTreinoPorIdOuNome(
    lista: ExItemUILocal[],
    id?: string,
    nome?: string,
  ) {
    const nomeK = normalizaNome(nome);
    const idK = id ? String(id) : null;

    return lista.some((ex) => {
      const sameId =
        idK &&
        (String(ex.idCatalogo ?? ex.exercicioId ?? ex.exercicioPersonalizadoId ?? "") === idK);

      const sameName = nomeK && normalizaNome(ex.nome) === nomeK;
      return Boolean(sameId || sameName);
    });
  }

  const exerciciosFiltrados = useMemo(() => {
    let lista = [...exerciciosDisponiveis];

    const q = filtroEx.trim().toLowerCase();
    if (q) {
      lista = lista.filter((e) => {
        const nome = (e.nome || "").toLowerCase();
        const desc = (e.objetivo || e.descricao || "").toLowerCase();
        const nivel = (e.nivel || "").toLowerCase();
        return nome.includes(q) || desc.includes(q) || nivel.includes(q);
      });
    }

    if (filtroCategoria && filtroCategoria !== "Todas as categorias") {
      const catFiltro = normalizarCategoriaFiltro(filtroCategoria);

      lista = lista.filter((e) => {
        const cats = Array.isArray((e as any).categorias)
          ? (e as any).categorias.map(normalizarCategoriaFiltro)
          : Array.isArray((e as any).categoria)
          ? (e as any).categoria.map(normalizarCategoriaFiltro)
          : [];

        return cats.includes(catFiltro);
      });
    }

    if (filtroNivel) {
      const nivelFiltro = filtroNivel.toLowerCase();

      lista = lista.filter((e) => {
        const nivelItem = String((e as any).nivel || "").toLowerCase();
        return nivelItem === nivelFiltro;
      });
    }

    if (filtroVideo) {
      lista = lista.filter((e) => {
        const hasVideo = !!(e.videoDemonstrativoUrl || (e as any).videoUrl);
        return filtroVideo === "com" ? hasVideo : !hasVideo;
      });
    }

    return lista;
  }, [exerciciosDisponiveis, filtroEx, filtroCategoria, filtroNivel, filtroVideo]);

  const exerciciosPersonalizadosFiltrados = useMemo(() => {
    let lista = [...exerciciosPersonalizados];

    const q = filtroEx.trim().toLowerCase();
    if (q) {
      lista = lista.filter((e) => {
        const nome = (e.nome || "").toLowerCase();
        const desc = (e.objetivo || e.descricao || "").toLowerCase();
        const nivel = (e.nivel || "").toLowerCase();
        return nome.includes(q) || desc.includes(q) || nivel.includes(q);
      });
    }

    if (filtroCategoria && filtroCategoria !== "Todas as categorias") {
      const catFiltro = normalizarCategoriaFiltro(filtroCategoria);

      lista = lista.filter((e) => {
        const cats = Array.isArray((e as any).categorias)
          ? (e as any).categorias.map(normalizarCategoriaFiltro)
          : Array.isArray((e as any).categoria)
          ? (e as any).categoria.map(normalizarCategoriaFiltro)
          : [];

        return cats.includes(catFiltro);
      });
    }

    if (filtroNivel) {
      const nivelFiltro = filtroNivel.toLowerCase();

      lista = lista.filter((e) => {
        const nivelItem = String((e as any).nivel || "").toLowerCase();
        return nivelItem === nivelFiltro;
      });
    }

    if (filtroVideo) {
      lista = lista.filter((e) => {
        const hasVideo = !!e.videoDemonstrativoUrl;
        return filtroVideo === "com" ? hasVideo : !hasVideo;
      });
    }

    return lista;
  }, [exerciciosPersonalizados, filtroEx, filtroCategoria, filtroNivel, filtroVideo]);

  const meusExerciciosFiltrados = useMemo(() => {
    let lista = [...meusExercicios];

    const q = filtroEx.trim().toLowerCase();
    if (q) {
      lista = lista.filter((e) => {
        const nome = (e.nome || "").toLowerCase();
        const desc = (e.objetivo || e.descricao || "").toLowerCase();
        const nivel = (e.nivel || "").toLowerCase();
        return nome.includes(q) || desc.includes(q) || nivel.includes(q);
      });
    }

    if (filtroCategoria && filtroCategoria !== "Todas as categorias") {
      const catFiltro = normalizarCategoriaFiltro(filtroCategoria);

      lista = lista.filter((e) => {
        const cats = Array.isArray((e as any).categorias)
          ? (e as any).categorias.map(normalizarCategoriaFiltro)
          : Array.isArray((e as any).categoria)
          ? (e as any).categoria.map(normalizarCategoriaFiltro)
          : [];

        return cats.includes(catFiltro);
      });
    }

    if (filtroNivel) {
      const nivelFiltro = filtroNivel.toLowerCase();

      lista = lista.filter((e) => {
        const nivelItem = String((e as any).nivel || "").toLowerCase();
        return nivelItem === nivelFiltro;
      });
    }

    if (filtroVideo) {
      lista = lista.filter((e) => {
        const hasVideo = !!e.videoDemonstrativoUrl;
        return filtroVideo === "com" ? hasVideo : !hasVideo;
      });
    }

    return lista;
  }, [meusExercicios, filtroEx, filtroCategoria, filtroNivel, filtroVideo]);

  useEffect(() => {
    setPageEx(1);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [filtroEx, filtroCategoria, filtroNivel]);

  const exerciciosVisiveis = useMemo(() => {
    const total = pageEx * PAGE_SIZE_EX;
    return exerciciosFiltrados.slice(0, total);
  }, [exerciciosFiltrados, pageEx]);

  const temMaisExercicios = exerciciosVisiveis.length < exerciciosFiltrados.length;

  function onScrollListaExercicios(e: UIEvent<HTMLElement>) {
    const el = e.currentTarget;
    const faltando = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (faltando < 250 && temMaisExercicios) {
      setPageEx((p) => p + 1);
    }
  }


  const adicionarExercicio = () => {
    setExerciciosSelecionados((prev) => [
      ...prev,
      {
        idLocal: crypto.randomUUID(),
        idCatalogo: null,
        exercicioId: null,
        exercicioPersonalizadoId: null,
        nome: "",
        descricao: "",
        objetivo: "",
        repeticoes: "",
        ordem: prev.length + 1,
        series: "",
        duracao: "",
        descanso: "",
        videoUrl: null,
        videoDemonstrativoUrl: null,
        videoPosterUrl: null,
        categorias: [],
        origem: "temporario",
        tipoExecucao: "repeticao",
      },
    ]);
  };

  const atualizarExercicio = (
    index: number,
    campo: keyof ExItemUILocal,
    valor: any
  ) => {
    setExerciciosSelecionados((prev) => {
      const copia = [...prev];

      // ✅ NORMALIZA series para number | null
      if (campo === "series") {
        const n = parseInt(String(valor), 10);
        (copia[index] as any).series = Number.isFinite(n) && n > 0 ? n : null;
        return copia;
      }

      (copia[index] as any)[campo] = valor;

      if (campo === "ordem") {
        const n = parseInt(String(valor), 10);
        if (!isNaN(n)) copia[index].ordem = n;
      }
      return copia;
    });
  };

  const removerExercicio = (index: number) => {
    const novaLista = [...exerciciosSelecionados];
    novaLista.splice(index, 1);
    const renumerado = novaLista.map((x, i) => ({ ...x, ordem: i + 1 }));
    setExerciciosSelecionados(renumerado);
  };

  function adicionarExercicioExistente(ex: any) {
    setExerciciosSelecionados((prev) => [
      ...prev,
      {
        idLocal: crypto.randomUUID(),
        idCatalogo: String(ex.id ?? ""),
        exercicioId: String(ex.id ?? ""),
        exercicioPersonalizadoId: null,
        nome: ex.nome ?? "Exercício",
        descricao: ex.objetivo ?? ex.descricao ?? "",
        objetivo: ex.objetivo ?? null,
        nivel: ex.nivel ?? null,
        videoUrl: ex.videoDemonstrativoUrl ?? ex.videoUrl ?? null,
        videoDemonstrativoUrl: ex.videoDemonstrativoUrl ?? ex.videoUrl ?? null,
        videoPosterUrl: ex.videoPosterUrl ?? null,
        // ✅ agora traz os valores já existentes do exercício
        series:
          typeof ex.series === "number"
            ? ex.series
            : ex.series != null && String(ex.series).trim() !== ""
            ? Number(ex.series)
            : null,
        repeticoes: ex.repeticoes != null ? String(ex.repeticoes) : "",
        duracao: ex.duracao != null ? String(ex.duracao) : "",
        descanso: ex.descanso != null ? String(ex.descanso) : "",
        ordem: prev.length + 1,
        categorias: Array.isArray(ex.categorias)
          ? ex.categorias
          : Array.isArray(ex.categoria)
          ? ex.categoria
          : [],
        origem: "catalogo",
        tipoExecucao: ex.duracao ? "duracao" : "repeticao",
      },
    ]);
  }

  function getDono() {
    const tipoRaw =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";

    const tipoUsuarioIdLogged =
      (Storage as any).tipoUsuarioId ||
      localStorage.getItem("tipoUsuarioId") ||
      sessionStorage.getItem("tipoUsuarioId") ||
      null;

    const orgId =
      orgSelecionada && orgSelecionada !== MOSTRAR_TODOS ? String(orgSelecionada) : "";

    if (orgId) {
      const org = orgsVinculadas.find((o) => String(o.id) === String(orgId));

      const tipoUsuario =
        org?.tipo === "Clube" ? ("Clube" as const) :
        org?.tipo === "Escolinha" ? ("Escolinha" as const) :
        ("Professor" as const);

      return {
        tipoUsuario,
        tipoUsuarioId: tipoUsuarioIdLogged,
      };
    }

    const normalized =
      String(tipoRaw).trim().toLowerCase() === "escola" ||
      String(tipoRaw).trim().toLowerCase() === "escolinha"
        ? "Escolinha"
        : String(tipoRaw).trim().toLowerCase() === "professor"
        ? "Professor"
        : String(tipoRaw).trim().toLowerCase() === "clube"
        ? "Clube"
        : null;

    return {
      tipoUsuario: normalized as "Professor" | "Clube" | "Escolinha" | null,
      tipoUsuarioId: tipoUsuarioIdLogged,
    };
  }

  type DonoLiteral = "professor" | "clube" | "escolinha";
  function isDono(v: string): v is DonoLiteral {
    return v === "professor" || v === "clube" || v === "escolinha";
  }

  async function fetchExerciciosCatalogo() {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    try {
      const resp = await axios.get(`${API.BASE_URL}/api/treinos/exercicios`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setExerciciosDisponiveis(Array.isArray(resp.data) ? resp.data : []);
    } catch (error) {
      console.error("Erro ao carregar exercícios BD:", error);
      setExerciciosDisponiveis([]);
    }
  }

  async function fetchExerciciosPersonalizados() {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    try {
      const resp = await axios.get(`${API.BASE_URL}/api/treinos/exercicios/personalizados`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setExerciciosPersonalizados(Array.isArray(resp.data) ? resp.data : []);
    } catch (error) {
      console.error("Erro ao carregar personalizados:", error);
      setExerciciosPersonalizados([]);
    }
  }

  async function fetchMeusExercicios() {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    try {
      const resp = await axios.get(`${API.BASE_URL}/api/treinos/exercicios/meus`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setMeusExercicios(Array.isArray(resp.data) ? resp.data : []);
    } catch (error) {
      console.error("Erro ao carregar meus exercícios:", error);
      setMeusExercicios([]);
    }
  }

  async function agendarTreinoEmLote(treinoProgramadoId: string) {
    try {
      const datasValidas = datasAgendamento.filter((d) => d && d.trim());

      let datasBase = datasValidas.length
        ? datasValidas
        : dataTreino
        ? [dataTreino]
        : [];

      if (isFreePlan && datasBase.length) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + 30);

        const dentroDaJanela = (str: string) => {
          const d = parseDateOnlyToLocalMidnight(str);
          if (isNaN(d.getTime())) return false;
          return d >= hoje && d <= limite;
        };

        const filtradas = datasBase.filter(dentroDaJanela);

        if (filtradas.length < datasBase.length) {
          showToast(
            "No plano Free, treinos só podem ser agendados em até 30 dias a partir de hoje. Datas fora desse intervalo foram ignoradas.",
            "info",
          );
        }

        datasBase = filtradas;
      }

      const alvoTemAtletas = atletasSelecionados.length > 0;
      const alvoTemTurma = Boolean(turmaSelecionada);

      if (!datasBase.length || (!alvoTemAtletas && !alvoTemTurma)) {
        return 0;
      }

      const token =
        (Storage as any).token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const baseTime = isValidHHMM(horaAgendamento) ? horaAgendamento : "18:00";
      const temHoje = datasBase.some((d) => isTodayYMD(toDateOnlyBR(d) || ""));
      if (temHoje) {
        const minNow = hhmmNow();
        if (baseTime < minNow) {
          showToast(`Para hoje, escolha um horário a partir de ${minNow}.`, "info");
          return 0;
        }
      }

      const datasLocal = datasBase.map((d) => {
        const dateOnly = toDateOnlyBR(d);
        if (!dateOnly) return "";

        const dt = new Date(`${dateOnly}T${baseTime}:00`);
        return toISOWithLocalOffset(dt);
      }).filter(Boolean);

      const body = {
        treinoProgramadoId,
        datas: datasLocal,
        // se tiver atleta selecionado, manda
        atletaIds: alvoTemAtletas ? atletasSelecionados.map(String).filter(Boolean) : [],
        // ✅ TURMA: manda no campo correto
        turmaIds: alvoTemTurma ? [String(turmaSelecionada)] : [],
        // ✅ opcional: deixa vazio pra não confundir com Elenco
        elencosIds: [],
        incluirObservados: false,
        tituloPadrao: nome || "Treino",
      };

      const res = await fetch(
        `${API.BASE_URL}/api/treinos/rotina/agendar`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao agendar treino em lote:", res.status, txt);
        return 0;
      }

      const json = await res.json().catch(() => null);
      return typeof json?.count === "number"
        ? json.count
        : datasLocal.length * atletasSelecionados.length;
    } catch (e) {
      console.error("Erro em agendarTreinoEmLote:", e);
      return 0;
    }
  }

  const limparProgressoETela = () => {
    sessionStorage.removeItem(SAVE_KEY);
    sessionStorage.removeItem(RESTORE_FLAG_KEY);
    localStorage.removeItem(DRAFT_KEY);
    setEtapa(1);
    setCompletedUntil(1);
    setNome("");
    setDescricao("");
    setNivel("Base");
    setDuracao(60);
    setDataTreino("");
    setCategorias([]);
    setTipoTreino("Tecnico");
    setObjetivo("");
    setExerciciosSelecionados([]);
    setAtletasSelecionados([]);
    setDatasAgendamento([]);
    jaSincronizouCalendarioComDatas.current = false;
    setProfessoresSelecionados([]);
    setCapaUrl("");
    setCapaPreview("");
    setTreinoFootera(false);
  };

  const criarTreino = async () => {
    if (criandoTreinoRef.current) return;
    criandoTreinoRef.current = true;

    setSalvando(true);
    let payloadOriginal: any = null;
    try {
      const { tipoUsuario, tipoUsuarioId } = getDono();
      const tipoUsuarioNormRaw = (tipoUsuario ?? "").toLowerCase();

      const professoresIdsFinal = Array.from(
        new Set(
          (professoresSelecionados || [])
            .map((x) => String(x))
            .filter(Boolean),
        ),
      );

      const professoresIdsFinalSemEu = professorLogadoId
        ? professoresIdsFinal.filter(
            (id) => String(id) !== String(professorLogadoId),
          )
        : professoresIdsFinal;

      if (!tipoUsuario || !tipoUsuarioId) {
        showToast(
          "Erro: não foi possível determinar o dono do treino (Professor/Clube/Escolinha).",
          "error",
        );
        return; 
      }

      if (!isDono(tipoUsuarioNormRaw)) {
        showToast("Erro: tipo de usuário inválido.", "error");
        return; 
      }
      const tipoUsuarioNorm: DonoLiteral = tipoUsuarioNormRaw;

      if (!usuarioId) {
        showToast("Erro: usuário não autenticado.", "error");
        return; 
      }

      const exerciciosRaw = montarExerciciosParaPayload(
        exerciciosSelecionados.map((e) => ({
          ...e,
          videoDemonstrativoUrl:
            e.videoUrl && String(e.videoUrl).startsWith("blob:") ? null : (e.videoUrl ?? null),
        })) as any,
      );

      const exerciciosValidos = (exerciciosSelecionados || []).filter((x: any) => {
        const id = x?.exercicioId ?? x?.idCatalogo ?? x?.exercicio?.id ?? x?.id ?? null;
        const nome = typeof x?.nome === "string" ? x.nome.trim() : "";
        return !!id || !!nome;
      });

      if (exerciciosValidos.length !== (exerciciosSelecionados || []).length) {
        const renumerado = exerciciosValidos.map((x: any, i: number) => ({ ...x, ordem: i + 1 }));
        setExerciciosSelecionados(renumerado);
      }

      const codigo =
        `${nome}`.trim()
          ? `${nome}`.toUpperCase().replace(/\s+/g, "-").slice(0, 24) +
            "-" +
            Date.now().toString(36)
          : "TP-" + Date.now().toString(36);

      const exValidos = exerciciosSelecionados.filter((ex: any) => {
        const temId = !!(ex?.exercicioId || ex?.idCatalogo || ex?.id);
        const temNome = !!String(ex?.nome || "").trim();
        return temId || temNome;
      });

      if (!exValidos.length) {
        showToast("Adicione pelo menos 1 exercício (catálogo ou personalizado).", "error");
        return;
      }

      const vistosId = new Set<string>();
      const vistosNome = new Set<string>();
      const duplicados: string[] = [];

      for (const ex of exerciciosSelecionados) {
        const idK = ex.idCatalogo ? String(ex.idCatalogo) : null;
        const nomeK = normalizaNome(ex.nome);

        if (idK) {
          if (vistosId.has(idK)) duplicados.push(`ID ${idK}`);
          vistosId.add(idK);
        }
        if (nomeK) {
          if (vistosNome.has(nomeK)) duplicados.push(ex.nome || nomeK);
          vistosNome.add(nomeK);
        }
      }

      if (duplicados.length) {
        showToast(
          `Remova os exercícios repetidos antes de salvar: ${duplicados.join(", ")}`,
          "error",
        );
        return;
      }

      const dataAgendadaISO =
        (datasAgendamento?.length ? datasAgendamento[0] : dataTreino)
          ? new Date(
              (datasAgendamento?.length ? datasAgendamento[0] : dataTreino) as any
            ).toISOString()
          : null;

      const exerciciosNormalizados = (exerciciosSelecionados || [])
        .map((e: any, idx: number) => {
          const exercicioId =
            e.exercicioId ?? e.idCatalogo ?? e.exercicio?.id ?? null;
          const nomeTemp = typeof e.nome === "string" ? e.nome.trim() : "";

          return {
            ...e,
            exercicioId: exercicioId ? String(exercicioId) : null,
            nome: nomeTemp || e.nome,
            ordem: e.ordem ?? idx + 1,
            descricao:
              typeof e.descricao === "string" && e.descricao.trim()
                ? e.descricao.trim()
                : typeof (e as any).objetivo === "string" && (e as any).objetivo.trim()
                ? (e as any).objetivo.trim()
                : null,
            videoDemonstrativoUrl: (e as any).videoDemonstrativoUrl ?? (e as any).videoUrl ?? null, // ✅ mantém vídeo também
            repeticoes:
              e.repeticoes ??
              e.repeticoesStr ??
              e.repeticoesTexto ??
              e.repeticoesString ??
              null,
            // ✅ mantém séries
            series:
              typeof e.series === "number"
                ? e.series
                : e.series != null && String(e.series).trim()
                ? parseInt(String(e.series), 10) || null
                : null,
          };
        })
        .filter((e: any) => !!e.exercicioId || (!!e.nome && String(e.nome).trim().length > 0));

      const payload = montarPayloadSomenteInfoEExercicios({
        tipoTreino,
        dataAgendada: dataAgendadaISO,
        exerciciosSelecionados: exerciciosNormalizados,
        titulo: nome + " " + Date.now(), // Adicionar timestamp para evitar duplicatas
        nivel,
        descricao,
        duracaoMinutos: duracao,
        categoria: categorias,
        dicas,
        pontuacao,
        metas,
      } as any);

      payloadOriginal = payload;
      const pontuacaoTopo = Number.isFinite(Number(score?.total)) ? Math.max(0, Math.floor(Number(score.total))) : null;
      
      const tipoUsuarioIdProfessor =
        (Storage as any).tipoUsuarioId ||
        localStorage.getItem("tipoUsuarioId") ||
        sessionStorage.getItem("tipoUsuarioId") ||
        "";
      (payload as any).nome = String(nome || "").trim();
      (payload as any).duracao = duracao != null ? Number(duracao) : null;    
      (payload as any).dataAgendada = dataAgendadaISO; 
      (payload as any).pontuacao = pontuacaoTopo;
      (payload as any).objetivo = (metas ?? "").trim() || null;
      (payload as any).tipoUsuario = tipoUsuarioNorm;            
      (payload as any).tipoUsuarioId = String(tipoUsuarioIdProfessor || tipoUsuarioId);
      // ✅ define se o treino é "Footera" (público/parceiro) ou normal
      // (o backend pode usar "publico" e/ou "parceiro" — mandamos ambos pra garantir)
      // ✅ segurança extra: se não é parceiro, força false
      const treinoFooteraFinal = isParceiro ? Boolean(treinoFootera) : false;
      if (!isParceiro && treinoFootera) setTreinoFootera(false);

      (payload as any).publico = treinoFooteraFinal;
      (payload as any).parceiro = treinoFooteraFinal;
      (payload as any).isFootera = treinoFooteraFinal; 
      (payload as any).atletasIds = atletasSelecionados;
      (payload as any).turmaIds = turmaSelecionada ? [turmaSelecionada] : [];
      (payload as any).elencosIds = turmaSelecionada ? [turmaSelecionada] : [];
      (payload as any).colaboradoresProfessorIds = professoresIdsFinalSemEu;
      (payload as any).codigo = codigo;
      (payload as any).exercicios = exerciciosNormalizados.map((e: any, idx: number) => {
        const repeticoesFinal =
          typeof e.repeticoes === "string"
            ? e.repeticoes.trim()
            : e.repeticoes != null
            ? String(e.repeticoes)
            : "";

        // ✅ pega vídeo/poster (e ignora blob:)
        const videoRaw = e.videoDemonstrativoUrl ?? e.videoUrl ?? null;
        const videoFinal =
          videoRaw && typeof videoRaw === "string" && videoRaw.startsWith("blob:")
            ? null
            : videoRaw
            ? String(videoRaw)
            : null;

        const posterRaw = e.videoPosterUrl ?? null;
        const posterFinal =
          posterRaw && typeof posterRaw === "string" && posterRaw.startsWith("blob:")
            ? null
            : posterRaw
            ? String(posterRaw)
            : null;

        const forcePersonalizado =
          !!videoFinal || !!posterFinal || !!String(e.exercicioPersonalizadoId ?? "").trim();

        if (e.exercicioId && !forcePersonalizado) {
          return {
            exercicioId: e.exercicioId ?? null,
            exercicioPersonalizadoId: e.exercicioPersonalizadoId ?? null,
            exercicioTemporarioId: e.exercicioTemporarioId ?? null,
            nome:
              typeof e.nome === "string" && e.nome.trim()
                ? e.nome.trim()
                : null,
            descricao:
              typeof e.descricao === "string" && e.descricao.trim()
                ? e.descricao.trim()
                : null,
            videoDemonstrativoUrl:
              (e as any).videoDemonstrativoUrl ?? (e as any).videoUrl ?? null,
            videoPosterUrl: (e as any).videoPosterUrl ?? null,
            repeticoes: repeticoesFinal,
            series:
              typeof e.series === "number"
                ? e.series
                : e.series != null && String(e.series).trim()
                ? parseInt(String(e.series), 10) || null
                : null,
            duracao:
              e.duracao != null && String(e.duracao).trim()
                ? String(e.duracao).trim()
                : null,
            descanso:
              e.descanso != null && String(e.descanso).trim()
                ? String(e.descanso).trim()
                : null,
            ordem: Number.isFinite(Number(e.ordem)) ? Number(e.ordem) : idx + 1,
            nivel: e.nivel ?? null,
            categorias: Array.isArray(e.categorias) ? e.categorias : [],
          };
        }

        return {
          nome: String(e.nome || "").trim(),
          nivel: e.nivel ?? null,
          categorias: Array.isArray(e.categorias) ? e.categorias : [],
          ordem: Number(e.ordem ?? idx + 1),
          repeticoes: repeticoesFinal,
          series:
            typeof e.series === "number"
              ? e.series
              : e.series != null && String(e.series).trim() !== ""
              ? parseInt(String(e.series), 10)
              : null,
          duracao:
            e.duracao != null && String(e.duracao).trim() !== ""
              ? String(e.duracao).trim()
              : null,
          descanso:
            e.descanso != null && String(e.descanso).trim() !== ""
              ? String(e.descanso).trim()
              : null,
          descricao:
            String(
              e.descricaoExecucao ??
              e.descricao ??
              e.observacao ??
              e.objetivo ??
              ""
            ).trim() || null,
          exercicioPersonalizadoId: e.exercicioPersonalizadoId
            ? String(e.exercicioPersonalizadoId)
            : null,
          videoDemonstrativoUrl: e.videoDemonstrativoUrl ?? e.videoUrl ?? null,
          videoPosterUrl: e.videoPosterUrl ?? null,
        };
      });

      const invalidos = exerciciosSelecionados.filter(
        (ex) => !exercicioTemExecucaoValida(ex)
      );

      if (invalidos.length > 0) {
        alert("Preencha pelo menos séries/repetições OU duração em todos os exercícios.");
        return;
      }

      const capaFinal = capaUrl && String(capaUrl).startsWith("blob:") ? null : capaUrl;
      (payload as any).imagemUrl = capaFinal ? String(capaFinal) : null;

      const resp = isEditing
        ? await TreinosApi.atualizar(editProgramadoId || editId, payload)
        : await TreinosApi.criar(payload);

      // ✅ Se você manteve validateStatus, resp SEMPRE vem aqui (até 400).
      const status = (resp as any)?.status;
      const data = (resp as any)?.data;

      // ✅ 1) LIMITE DE TREINOS PROGRAMADOS (o alert correto)
      if (!isEditing && status === 400 && data?.code === "LIMIT_TREINOS_PROGRAMADOS" && Array.isArray(data?.meus)) {
        const meus = data.meus as Array<{ id: string; nome: string; createdAt?: string }>;
        const lista = meus
          .map((m, i) => `${i + 1}) ${m.nome} (${m.createdAt ? new Date(m.createdAt).toLocaleString("pt-BR") : ""}) [${m.id}]`)
          .join("\n");

        const escolha = window.prompt(
          `Você atingiu o limite de 5 treinos.\n\nEscolha um número para apagar e liberar espaço:\n${lista}\n\nDigite 1-${meus.length} (ou deixe vazio para cancelar).`,
        );

        const idx = Number(escolha);
        if (!escolha || !Number.isFinite(idx) || idx < 1 || idx > meus.length) {
          // cancelou -> NÃO navega e NÃO limpa progresso
          return;
        }

        const apagar = meus[idx - 1];

        const resp2 = await TreinosApi.criar({
          ...(payload as any),
          apagarTreinoProgramadoId: apagar.id,
        } as any);

        const status2 = (resp2 as any)?.status;
        const data2 = (resp2 as any)?.data;

        if (status2 >= 400) {
          showToast(data2?.message || "Não foi possível criar o treino após apagar um antigo.", "error");
          return;
        }

        // ✅ agora sim: sucesso real -> limpa e navega
        showToast("Treino criado! Um treino antigo foi apagado.", "success");
        limparProgressoETela(); // (se você já tiver helper, usa ele)
        setTimeout(() => navigate("/treinos"), 300);
        return;
      }

      // ✅ 2) Qualquer outro erro 4xx/5xx
      if (status >= 400) {
        console.error("Erro ao criar treino:", status, data);
        showToast(data?.message || "Falha ao criar treino.", "error");
        return;
      }

      // ✅ 3) Sucesso real (2xx)
      const criado = data;

      let qtdAgendados = 0;
      const treinoProgramadoId =
        (isEditing ? editId : null) ||
        criado?.id ||
        criado?.treinoProgramadoId ||
        criado?.data?.id ||
        null;

      if (treinoProgramadoId) {
        try {
          const token = getToken();
          const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

          const rr = await fetch(
            `${API.BASE_URL}/api/treinos/programados/${encodeURIComponent(
              String(treinoProgramadoId),
            )}`,
            { headers },
          );
          const jj = await rr.json().catch(() => null);
        } catch (e) {
          console.warn("[NovoTreino] DEBUG confirmacao falhou:", e);
        }

        qtdAgendados = await agendarTreinoEmLote(String(treinoProgramadoId));
      } else {
        console.warn(
          "TreinosApi.criar não retornou id do treino programado. Agendamento em lote foi pulado.",
        );
      }

      const resultadoSalvar = await tentarSalvarComoTreinoSalvo(payload, score.total);

      const atletasDoTreino = atletasVinculados.filter((a) =>
        atletasSelecionados.includes(a.id),
      );
      const nomesAtletas = atletasDoTreino.map((a) => a.nome);

      const datasBase =
        datasAgendamento.length > 0 ? datasAgendamento : dataTreino ? [dataTreino] : [];

      const datasLabel = datasBase.length
        ? datasBase
            .slice()
            .sort()
            .map((str) => {
              const iso = str.includes("T") ? str : `${str}T00:00:00`;
              const d = new Date(iso);
              if (isNaN(d.getTime())) return str;
              return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            })
            .join(", ")
        : null;

      let msgPrincipal = isEditing
        ? `Treino "${nome || codigo}" atualizado com sucesso.`
        : `Treino "${nome || codigo}" criado com sucesso.`;

      if (qtdAgendados > 0 && nomesAtletas.length && datasLabel) {
        const nomesPreview =
          nomesAtletas.length <= 3
            ? nomesAtletas.join(", ")
            : `${nomesAtletas.slice(0, 3).join(", ")} + ${
                nomesAtletas.length - 3
              } atleta(s)`;

        msgPrincipal += ` Foi agendado automaticamente para ${nomesAtletas.length} atleta(s) (${nomesPreview}) nos dias ${datasLabel}.`;
      } else if (qtdAgendados > 0) {
        msgPrincipal += ` Foram gerados ${qtdAgendados} agendamentos para seus atletas.`;
      } else {
        msgPrincipal +=
          " Nenhum agendamento automático foi criado (você pode agendar depois na tela de treinos).";
      }

      let extra = "";
      if (resultadoSalvar.saved) {
        extra = " O treino também foi salvo na sua Gaveta.";
      } else if (resultadoSalvar.reason === "usuario-pulou") {
        extra = " Você optou por não salvar este treino na Gaveta (limite de 5).";
      } else if (resultadoSalvar.reason === "falha-apagar") {
        extra = " Não foi possível liberar espaço na Gaveta, então o treino não foi salvo lá.";
      } else if (resultadoSalvar.reason === "erro") {
        extra = " O treino foi criado, mas houve um erro ao salvar na Gaveta.";
      } else if (resultadoSalvar.reason === "sem-dono") {
        console.warn("Treino Salvo: sem dono identificado, pulando gaveta.");
      }

      showToast(msgPrincipal + extra, "success");
      limparProgressoETela();

      setTimeout(() => {
        navigate("/treinos");
      }, 200);

      return;
    } catch (e: any) {
      const data = e?.response?.data;

      // ✅ estourou limite de treinos programados (5) -> oferece apagar 1
      if (data?.code === "LIMIT_TREINOS_PROGRAMADOS" && Array.isArray(data?.meus)) {
        const meus = data.meus as Array<{ id: string; nome: string }>;
        const lista = meus.map((m, i) => `${i + 1}) ${m.nome}`).join("\n");
        const escolha = window.prompt(
          `Você atingiu o limite de 5 treinos.\n\nEscolha um número para apagar e liberar espaço:\n${lista}\n\nDigite 1-${meus.length} (ou deixe vazio para cancelar).`
        );

        const idx = Number(escolha);

        // cancelou
        if (!escolha || !Number.isFinite(idx) || idx < 1 || idx > meus.length) {
          return;
        }

        const apagar = meus[idx - 1];

        // ✅ reenvia o POST com apagarTreinoProgramadoId
        await TreinosApi.criar({
          ...(payloadOriginal || {}),
          apagarTreinoProgramadoId: apagar.id,
        });

        showToast("Treino criado! Um treino antigo foi apagado.", "success");
        navigate("/treinos");
        return;
      }

      const msgErro =
        data?.message ||
        e?.message ||
        "Falha inesperada ao criar treino.";

      console.error("[NovoTreino] erro criar treino:", data || e);

      if (data?.code === "TREINO_NOME_DUPLICADO_DO_MESMO_DONO") {
        alert(
          data?.message ||
            "Esse treino não pode ser criado porque você já possui um treino com esse nome. Se quiser criar, mude o nome do treino."
        );
        return;
      }

      showToast(msgErro, "error");
    } finally {
      criandoTreinoRef.current = false;
      setSalvando(false);
    }
  };

  const agendarTreino = async (t: TreinoProgramado) => {
    try {
      const atletaId = String(atletaIdLogado || "").trim();
      const token = (Storage as any).token;
      if (!atletaId || !token) {
        showToast("Sessão expirada. Faça login novamente.", "error");
        return;
      }

      const prazoSelecionadoRaw = (prazos[t.id] || "").trim();

      if (!prazoSelecionadoRaw) {
        showToast("Selecione o prazo para envio antes de agendar.", "info");
        return;
      }

      const prazoComSegundos =
        prazoSelecionadoRaw.length === 16 ? `${prazoSelecionadoRaw}:00` : prazoSelecionadoRaw;

      const quando = new Date(prazoComSegundos);

      if (isNaN(quando.getTime())) {
        showToast("Prazo inválido. Selecione novamente.", "error");
        return;
      }

      const diaEscolhido = dateKeyLocal(quando); // yyyy-mm-dd (local)
      const bloqueadas = datasAgendadasPorTreino.get(String(t.id));

      if (bloqueadas?.has(diaEscolhido)) {
        showToast("Você já tem esse treino agendado nessa data. Escolha outro dia.", "info");
        return;
      }

      const expira = new Date(quando.getTime() + 3 * 24 * 60 * 60 * 1000);
      const dataTreinoLocal = toISOWithLocalOffset(quando);
      const dataExpiracaoLocal = toISOWithLocalOffset(expira);

      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: t.nome,
          dataTreino: dataTreinoLocal,
          dataExpiracao: dataExpiracaoLocal,
          atletaId,
          treinoProgramadoId: t.id,
        }),
      });

      if (!res.ok) {
        const msg = await readApiError(res);
        console.error("Falha ao agendar treino:", res.status, msg);
        showToast(msg || "Erro ao agendar treino.", "error");
        return;
      }

      const novo: TreinoAgendadoResp = await res.json();

      sessionStorage.setItem("lastAgendamento", JSON.stringify(novo));
      window.dispatchEvent(new CustomEvent("treino:agendado", { detail: novo }));

      setDatasAgendadasPorTreino((prev) => {
        const next = new Map(prev);
        const treinoId = String(novo.treinoProgramadoId ?? t.id);
        const dia = dateKeyLocal(quando); // usa o "quando" que você já calculou

        const set = next.get(treinoId) ?? new Set<string>();
        set.add(dia);
        next.set(treinoId, set);

        return next;
      });
      setPrazos(({ [t.id]: _, ...rest }) => rest);          
      showToast("Treino agendado com sucesso!", "success");
      navigate("/treinos");
    } catch (e) {
      console.error(e);
      showToast("Erro inesperado ao agendar treino.", "error");
    }
  };

  if (!iniciado) return <p className="text-center p-4">Carregando...</p>;
  if (!usuario)
    return (
      <div className="p-4 text-center">
        Você precisa estar logado como <b>Escola</b>, <b>Clube</b> ou{" "}
        <b>Professor</b> para criar treinos.
      </div>
    );

  if (usuario.tipo === "atleta") {
    const treinosMeuProfessorBrutos =
      professorVinculadoIds.length === 0
        ? []
        : treinosDisponiveis.filter((t) => {
            const criadoresIds = (t.criadores || []).map((c) => String(c.id));
            const criadorId = t.criador?.id ? String(t.criador.id) : "";
            const todos = new Set<string>([...criadoresIds, ...(criadorId ? [criadorId] : [])]);
            return professorVinculadoIds.some((pid) => todos.has(String(pid)));
          });

    const treinosMeuProfessor = treinosMeuProfessorBrutos;
    const treinosParceirosFootera = treinosFootera;

    const listaAtiva =
      abaTreinosAtleta === "meu_professor" ? treinosMeuProfessor : treinosParceirosFootera;

    return (
      <div className="p-4 max-w-xl mx-auto mb-5">
        <Link
          href="/treinos"
          aria-label="Voltar para treinos"
          title="Voltar para explorar"
          className="inline-flex h-10 w-10 items-center justify-center
            rounded-full border border-green-800 bg-white text-green-900
            shadow-sm hover:bg-green-50 focus:outline-none
            focus:ring-2 focus:ring-green-700/30 mt-2 ml-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h2 className="text-lg font-bold mb-3">Treinos Disponíveis</h2>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAbaTreinosAtleta("meu_professor")}
            className={[
              "flex-1 px-3 py-2 rounded-xl border text-sm font-semibold transition",
              abaTreinosAtleta === "meu_professor"
                ? "bg-green-800 text-white border-green-800"
                : "bg-white text-green-900 border-green-200 hover:bg-green-50",
            ].join(" ")}
          >
            Meu professor
          </button>

          <button
            type="button"
            onClick={() => setAbaTreinosAtleta("footera")}
            className={[
              "flex-1 px-3 py-2 rounded-xl border text-sm font-semibold transition",
              abaTreinosAtleta === "footera"
                ? "bg-green-800 text-white border-green-800"
                : "bg-white text-green-900 border-green-200 hover:bg-green-50",
            ].join(" ")}
          >
            Professores Footera
          </button>
        </div>

        {listaAtiva.length === 0 ? (
          <div className="text-gray-600 bg-white border rounded-xl p-4">
            {abaTreinosAtleta === "meu_professor" ? (
              <>
                {professorVinculadoIds.length === 0 ? (
                  <p>
                    Você ainda não possui <b>professor vinculado</b>. Assim que houver vínculo,
                    os treinos dele aparecerão aqui.
                  </p>
                ) : (
                  <p>
                    Nenhum treino do seu professor está disponível para agendar no momento.
                  </p>
                )}
              </>
            ) : (
              <p>Nenhum treino público de professores parceiros encontrado no momento.</p>
            )}
          </div>
        ) : (
          listaAtiva.map((t) => (
            <div key={t.id} className="bg-white border p-4 rounded shadow mb-4">
              {t.imagemUrl ? (
                <img
                  src={resolveMediaUrl(t.imagemUrl)}
                  alt={`Capa do treino ${t.nome}`}
                  className="w-full h-40 object-cover rounded-xl border mb-3"
                />
              ) : null}

              <div className="flex items-start justify-between gap-2">
                <h3
                  className="text-green-800 text-lg font-semibold cursor-pointer hover:underline"
                  onClick={() => navigate(`/treinos/unico?programadoId=${t.id}`)}
                  title="Ver detalhes do treino"
                >
                  {t.nome}
                </h3>

                {typeof t.pontuacao === "number" && t.pontuacao > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    +{t.pontuacao} pts
                  </span>
                )}
              </div>

              <p className="text-sm">
                <strong>Descrição:</strong> {t.descricao}
              </p>

              <p className="text-sm">
                <strong>Nível:</strong> {t.nivel}
              </p>

              {t.criadores?.length ? (
                <p className="text-sm mt-1">
                  <strong>Criado por:</strong> {t.criadores.map((c) => `Prof. ${c.nome}`).join(", ")}
                </p>
              ) : t.criador ? (
                <p className="text-sm mt-1">
                  <strong>Criado por:</strong>{" "}
                  {t.criador.tipo === "Professor"
                    ? `Prof. ${t.criador.nome}`
                    : `${t.criador.nome} (${t.criador.tipo})`}
                </p>
              ) : null}

              <p className="text-sm">
                <strong>Exercícios:</strong>
              </p>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {t.exercicios.map((ex, i) => (
                  <li key={i}>
                    {ex.nome} {ex.repeticoes ? `(${ex.repeticoes})` : ""}
                  </li>
                ))}
              </ul>

              <label className="text-sm mt-2 block">
                <strong>Prazo para envio: </strong>
              </label>
              <input
                type="datetime-local"
                className="border p-2 rounded"
                value={prazos[t.id] || ""}
                onFocus={() => {
                  if (!prazos[t.id]) {
                    setPrazos((prev) => ({
                      ...prev,
                      [t.id]: toDatetimeLocalValue(new Date()),
                    }));
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;

                  // datetime-local vem "YYYY-MM-DDTHH:mm" (sem segundos)
                  const valComSeg = val && val.length === 16 ? `${val}:00` : val;
                  const d = valComSeg ? new Date(valComSeg) : new Date(NaN);

                  if (!val || isNaN(d.getTime())) {
                    setPrazos((prev) => ({ ...prev, [t.id]: val }));
                    return;
                  }

                  const dia = dateKeyLocal(d);
                  const bloqueadas = datasAgendadasPorTreino.get(String(t.id));

                  if (bloqueadas?.has(dia)) {
                    alert("Você já tem esse treino agendado nessa data. Escolha outro dia.");
                    // mantém o valor anterior (não deixa aplicar essa data)
                    return;
                  }

                  setPrazos((prev) => ({ ...prev, [t.id]: val }));
                }}
              />

              <div className="flex justify-end mt-2">
                <button
                  className="mt-3 bg-green-800 text-white px-3 py-1 rounded text-sm w-fit"
                  style={{ alignSelf: "flex-end" }}
                  onClick={() => agendarTreino(t)}
                >
                  Agendar treino
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-28">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="grid grid-cols-3 items-center mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold col-start-1">
            {isEditing ? "Editar Treino" : "Criar Novo Treino"}
          </h2>

          <div
            className="justify-self-center col-start-2"
            title={
              `Tipo: +${score.tipo} • ` +
              `Exercícios (${score.exCount}): +${score.exercicios} • ` +
              `Duração: +${score.duracao}`
            }
          >
            <span
              className="
              inline-flex items-center gap-1 rounded-full px-3 py-1
              text-sm font-semibold bg-amber-100 text-amber-900 border border-amber-300
            "
            >
              {score.total} pts
            </span>
          </div>

          <button
            onClick={() => {
              if (confirm("Deseja limpar o progresso deste treino?")) {
                setEtapa(1);
                setCompletedUntil(1);
                setNome("");
                setDescricao("");
                setNivel("Base");
                setDuracao(60);
                setDataTreino("");
                setCategorias([]);
                setTipoTreino("Tecnico");
                setObjetivo("");
                setExerciciosSelecionados([]);
                setAtletasSelecionados([]);
                setProfessoresSelecionados([]);
                setCapaUrl("");
                setCapaPreview("");
                sessionStorage.removeItem(SAVE_KEY);
                sessionStorage.removeItem(RESTORE_FLAG_KEY);
                setTreinoFootera(false);
              }
            }}
            className="text-sm text-red-700 underline justify-self-end col-start-3"
          >
            Limpar progresso
          </button>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={async () => {
                if (!confirm("Tem certeza que deseja apagar este treino?")) return;

                try {
                  const idParaApagar = (editProgramadoId || editId || "").trim();
                  if (!idParaApagar) throw new Error("ID do treino para apagar está vazio.");

                  const headers = authHeaders();

                  const tries = [
                    `${API.BASE_URL}/api/treinos/programados/${encodeURIComponent(idParaApagar)}`,
                    `${API.BASE_URL}/api/treinosprogramados/${encodeURIComponent(idParaApagar)}`,
                    `${API.BASE_URL}/api/treinos/${encodeURIComponent(idParaApagar)}`,
                  ];

                  let ok = false;
                  let lastTxt = "";

                  for (const url of tries) {
                    const r = await fetch(url, { method: "DELETE", headers });
                    if (r.ok) { ok = true; break; }
                    lastTxt = await r.text().catch(() => "");
                  }

                  if (!ok) throw new Error(lastTxt || "Falha ao apagar no backend.");

                  sessionStorage.removeItem(SAVE_KEY);
                  sessionStorage.removeItem(RESTORE_FLAG_KEY);

                  showToast("Treino apagado com sucesso.", "success");
                  setTimeout(() => navigate("/treinos"), 300);
                } catch (e: any) {
                  console.error(e);
                  showToast(e?.message || "Erro ao apagar treino.", "error");
                }
              }}

            className="text-sm text-red-700 underline justify-self-end col-start-3"
          >
            Apagar treino
          </button>
        )}

        {etapa === 1 && (
          <StepCard title="Informações Básicas">

            {/* ✅ Tipo de publicação — só aparece para professor parceiro */}
            {isParceiro && (
              <div className="mt-2">
                <label className="block text-sm text-gray-700 mb-2">
                  Publicação do treino
                </label>

                <button
                  type="button"
                  onClick={() => setTreinoFootera((v) => !v)}
                  className={[
                    "w-full flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition",
                    treinoFootera
                      ? "border-green-700 bg-green-50"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(" ")}
                  title="Marque para publicar como Footera (público/parceiro)"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">
                      {treinoFootera ? "✅ Treino Footera (público)" : "Treino normal (privado)"}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {treinoFootera
                        ? "Aparece para atletas na aba Professores Footera."
                        : "Aparece apenas no contexto normal do dono/vínculos."}
                    </div>
                  </div>

                  {/* Switch visual */}
                  <span
                    className={[
                      "relative inline-flex h-7 w-12 items-center rounded-full border transition",
                      treinoFootera ? "bg-green-700 border-green-700" : "bg-gray-200 border-gray-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                        treinoFootera ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </span>
                </button>
              </div>
            )}

            <label className="block text-sm text-gray-700 mb-1">
              Título do Treino
            </label>
            <input
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Título do Treino"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <label className="block text-sm text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Descrição do Treino"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Tipo do Treino
                </label>
                <select
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  value={tipoTreino}
                  onChange={(e) => setTipoTreino(e.target.value)}
                >
                  <option value="">--</option>
                  <option value="Tecnico">Técnico</option>
                  <option value="Fisico">Físico</option>
                  <option value="Tatico">Tático</option>
                  <option value="Mental">Mental</option>
                </select>
              </div>
            </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Duração do Treino (minutos)
                </label>
                <input
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  type="number"
                  min={1}
                  value={duracao}
                  onChange={(e) =>
                    setDuracao(parseInt(e.target.value || "0") || 0)
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Nível do Treino
                  </label>

                  <select
                    className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                    value={nivel}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNivel((opcoesNiveis.includes(v as NivelTreino) ? (v as NivelTreino) : "Base"));
                    }}
                  >
                    {opcoesNiveis.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Professores realizadores (colaboradores)
                </label>

                <div className="border rounded p-2">
                  <input
                    className="border w-full p-2 rounded text-sm mb-2"
                    placeholder="Buscar professor..."
                    value={filtroProf}
                    onChange={(e) => setFiltroProf(e.target.value)}
                  />

                  <div className="space-y-4 max-h-64 overflow-auto">
                    {gruposProfessoresFiltrados.length === 0 ? (
                      <div className="text-sm text-gray-500 px-1 py-2">
                        Nenhum professor disponível.
                      </div>
                    ) : (
                      gruposProfessoresFiltrados.map((grupo) => (
                        <div
                          key={`${grupo.tipo}-${grupo.ownerId}`}
                          className="rounded-lg border border-gray-200 p-3"
                        >
                          <div className="font-semibold text-sm text-gray-800 mb-2">
                            {grupo.tipo} {grupo.nome}
                          </div>

                          <div className="space-y-2">
                            {grupo.professores.map((p) => {
                              const checked = professoresSelecionados.includes(p.id);

                              return (
                                <label
                                  key={p.id}
                                  className="flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-gray-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleProfessorSelecionado(p.id)}
                                    className="mt-1"
                                  />
                                  <span className="text-sm text-gray-800">
                                    {p.nome}
                                    {p.codigo ? ` (${p.codigo})` : ""}
                                    {p.cref ? ` - ${p.cref}` : ""}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-700 mb-2 mt-3">
                Capa do Treino (opcional)
              </label>

              { (capaPreview || capaUrl) ? (
                <div className="mb-2">
                  <img
                    src={resolveMediaUrl(capaPreview || capaUrl)}
                    alt="Capa do treino"
                    className="w-full max-h-48 object-cover rounded-xl border"
                  />
                </div>
              ) : (
                <div className="mb-2 w-full h-32 rounded-xl border bg-gray-50 flex items-center justify-center text-xs text-gray-500">
                  Sem capa
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-xs px-3 py-2 rounded bg-gray-100 border cursor-pointer">
                  {capaUrl || capaPreview ? "Trocar imagem" : "Upload da galeria"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.currentTarget; 
                      const file = input.files?.[0];
                      if (!file) return;
                      if (capaPreview?.startsWith("blob:")) URL.revokeObjectURL(capaPreview);
                      const local = URL.createObjectURL(file);
                      setCapaPreview(local);

                      try {
                        const urlFinal = await uploadImagemCapa(file);
                        setCapaUrl(urlFinal);

                        URL.revokeObjectURL(local);
                        setCapaPreview("");
                      } catch (err: any) {
                        console.error(err);
                        alert(err?.message || "Erro ao enviar imagem");
                      } finally {
                        if (input) input.value = ""; 
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() => {
                    if (capaPreview?.startsWith("blob:")) URL.revokeObjectURL(capaPreview);
                    setCapaPreview("");
                    setCapaUrl("");
                  }}
                  disabled={!capaPreview && !capaUrl}
                  title="Deixar sem capa"
                >
                  Remover capa
                </button>
              </div>

              <p className="text-[11px] text-gray-500 mt-1">
                Você pode escolher uma imagem da galeria. Se não escolher, o treino ficará sem capa.
              </p>
            </div>
          </StepCard>
        )}

        {etapa === 2 && (
          <>
            <StepCard title="Exercícios Selecionados">
              {exerciciosSelecionados.length === 0 && (
                <div className="text-sm text-gray-600 mb-3">
                  Nenhum exercício adicionado ainda.
                </div>
              )}

              {exerciciosDisponiveis.length === 0 && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                  Nenhum exercício foi carregado. Verifique no console o log: <b>[NovoTreino] carregando exercicios...</b>
                </div>
              )}

              <div className="space-y-3">
                {exerciciosSelecionados.map((ex, i) => {
                  const base = ex.idCatalogo
                    ? exerciciosDisponiveis.find(
                        (e) => e.id === ex.idCatalogo,
                      )
                    : undefined;
                  const videoSrc = resolveVideoUrl(ex.videoUrl || base?.videoDemonstrativoUrl);
                  const nomeFinal = base?.nome ?? ex.nome ?? "";
                  const nivelFinal = base?.nivel ?? undefined;
                  const descFinal = base?.objetivo ?? base?.descricao ?? ex.descricao ?? "";
                  const ehDoBanco = Boolean(ex.idCatalogo || (ex as any).exercicioPersonalizadoId);
                  return (
                    <div
                      key={i}
                      className="border rounded-lg p-3 relative bg-white shadow-sm"
                    >
                      <button
                        onClick={() => removerExercicio(i)}
                        className="text-red-600 text-sm self-end sm:absolute sm:top-2 sm:right-2"
                        title="Remover exercício"
                      >
                        Remover
                      </button>

                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="w-full sm:w-44 shrink-0">
                          {videoSrc ? (
                            <button
                              type="button"
                              className="relative w-full h-44 sm:h-28 rounded overflow-hidden bg-black"
                              onClick={() => setVideoModalSrc(videoSrc)}
                              title="Ver vídeo"
                            >
                              <video
                                className="w-full h-full object-cover"
                                src={videoSrc}
                                preload="metadata"
                                muted
                                playsInline
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                                  <Play className="w-5 h-5 text-white" />
                                </span>
                              </div>
                            </button>
                          ) : (
                            <div className="w-full h-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                              sem vídeo
                            </div>
                          )}

                          {!ehDoBanco && (
                            <div className="mt-2 flex items-center gap-2">
                              <label className="text-xs px-3 py-1.5 rounded bg-gray-100 border cursor-pointer">
                                {ex.videoUrl ? "Trocar vídeo" : "Upload de vídeo"}
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const input = e.currentTarget; 
                                    const file = input.files?.[0];
                                    if (!file) return;

                                    const old = exerciciosSelecionados[i]?.videoUrl;
                                    if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);

                                    const localPreview = URL.createObjectURL(file);
                                    setVideoNoEx(i, localPreview);

                                    try {
                                      const url = await uploadVideo(file);
                                      setVideoNoEx(i, url);
                                      URL.revokeObjectURL(localPreview);
                                    } catch (err: any) {
                                      console.error(err);
                                      showToast(err?.message || "Erro ao enviar vídeo", "error");
                                    } finally {
                                      if (input) input.value = "";
                                    }
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                className="text-xs text-red-600 underline"
                                onClick={() => {
                                  const v = exerciciosSelecionados[i]?.videoUrl;
                                  if (v && v.startsWith("blob:")) URL.revokeObjectURL(v);
                                  setVideoNoEx(i, null);
                                }}
                                disabled={!ex.videoUrl}
                                title="Deixar sem vídeo"
                              >
                                Remover vídeo
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {ehDoBanco ? (
                              <div className="font-semibold">
                                {nomeFinal}
                              </div>
                            ) : (
                              <input
                                className="border p-1 rounded w-full"
                                placeholder="Nome do exercício"
                                value={ex.nome || ""}
                                onChange={(e) =>
                                  atualizarExercicio(
                                    i,
                                    "nome",
                                    e.target.value,
                                  )
                                }
                              />
                            )}

                            {nivelFinal ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                {nivelFinal}
                              </span>
                            ) : null}
                          </div>

                          {ehDoBanco ? (
                            <p className="text-sm text-gray-700 mb-2 whitespace-pre-line">
                              {descFinal || " "}
                            </p>
                          ) : ex.origem === "temporario" ? null : (
                            <textarea
                              className="border w-full mb-2 p-1 rounded"
                              placeholder="Descrição"
                              value={ex.descricao || ""}
                              onChange={(e) =>
                                atualizarExercicio(i, "descricao", e.target.value)
                              }
                            />
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <div className="md:col-span-2 flex gap-2 mb-1">
                              <button
                                type="button"
                                onClick={() => atualizarExercicio(i, "tipoExecucao", "repeticao")}
                                className={`px-3 py-1 rounded ${
                                  ex.tipoExecucao === "repeticao"
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                Série / Repetição
                              </button>

                              <button
                                type="button"
                                onClick={() => atualizarExercicio(i, "tipoExecucao", "duracao")}
                                className={`px-3 py-1 rounded ${
                                  ex.tipoExecucao === "duracao"
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                Duração
                              </button>
                            </div>

                            {ex.tipoExecucao === "repeticao" ? (
                              <>
                                <div>
                                  <label className="block text-sm text-zinc-700 mb-1">Séries</label>
                                  <input
                                    type="number"
                                    className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                                    placeholder="ex.: 3"
                                    value={ex.series ?? ""}
                                    onChange={(e) => atualizarExercicio(i, "series", e.target.value)}
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm text-zinc-700 mb-1">Repetições</label>
                                  <input
                                    type="text"
                                    className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                                    placeholder="ex.: 12"
                                    value={ex.repeticoes ?? ""}
                                    onChange={(e) => atualizarExercicio(i, "repeticoes", e.target.value)}
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="md:col-span-2">
                                <label className="block text-sm text-zinc-700 mb-1">Duração</label>
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                                  placeholder="ex.: 2min"
                                  value={ex.duracao ?? ""}
                                  onChange={(e) => atualizarExercicio(i, "duracao", e.target.value)}
                                />
                              </div>
                            )}

                            <div className={ex.tipoExecucao === "duracao" ? "md:col-span-2" : ""}>
                              <label className="block text-sm text-zinc-700 mb-1">Descanso (opcional)</label>
                              <input
                                type="text"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                                placeholder="ex.: 30seg"
                                value={ex.descanso ?? ""}
                                onChange={(e) => atualizarExercicio(i, "descanso", e.target.value)}
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm text-zinc-700 mb-1">Descrição (opcional)</label>
                              <textarea
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 min-h-[90px]"
                                placeholder="Descreva instruções, observações ou detalhes do exercício"
                                value={ex.descricao ?? ""}
                                onChange={(e) => atualizarExercicio(i, "descricao", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={adicionarExercicio}
                className="bg-gray-200 px-3 py-1 rounded mb-2 mt-3"
              >
                + Adicionar linha (personalizado)
              </button>
            </StepCard>

            <div className="h-4" />
          
            <StepCard title="Exercícios Disponíveis">
              {/* Abas */}
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAbaExercicios("meus")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-bold border",
                    abaExercicios === "meus"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  Meus Exercícios
                </button>

                <button
                  type="button"
                  onClick={() => setAbaExercicios("catalogo")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-bold border",
                    abaExercicios === "catalogo"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  Exercícios (BD)
                </button>

                <button
                  type="button"
                  onClick={() => setAbaExercicios("personalizados")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-bold border",
                    abaExercicios === "personalizados"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  Personalizados
                </button>
              </div>

              {abaExercicios === "meus" ? (
                <>
                <p className="text-sm text-gray-500 mb-3">
                  Exercícios criados por você na aba meus exercícios da página de treino
                </p>

                <div className="flex flex-col gap-3 w-full mb-4">
                  <input
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-sm outline-none focus:border-emerald-600"
                    placeholder="Buscar meus exercícios..."
                    value={filtroEx}
                    onChange={(e) => setFiltroEx(e.target.value)}
                  />

                  <select
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                  >
                    {OPCOES_CATEGORIA.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                    value={filtroNivel}
                    onChange={(e) => setFiltroNivel(e.target.value)}
                  >
                    <option value="">Todos os níveis</option>
                    <option value="Base">Base</option>
                    <option value="Avancado">Avançado</option>
                    <option value="Performance">Performance</option>
                  </select>

                  <select
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                    value={filtroVideo}
                    onChange={(e) => setFiltroVideo(e.target.value as "" | "com" | "sem")}
                  >
                    <option value="">Com/sem vídeo</option>
                    <option value="com">Somente com vídeo</option>
                    <option value="sem">Somente sem vídeo</option>
                  </select>
                </div>

                {loadingMeusExercicios ? (
                  <div className="text-sm text-gray-600">Carregando meus exercícios...</div>
                ) : (
                  <ul className="divide-y divide-gray-200 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
                    {meusExerciciosFiltrados.map((p) => {
                      const jaAdicionado =
                        p.origem === "personalizado"
                          ? treinoTemPersonalizado(p.id)
                          : treinoTemExercicio(p.id);

                      const videoSrc = p.videoDemonstrativoUrl || null;

                      return (
                        <li key={`${p.origem}-${p.id}`} className="py-3">
                          <div className="flex flex-col sm:flex-row gap-3 items-start">
                            <div className="w-full sm:w-44 shrink-0">
                              {videoSrc ? (
                                <VideoThumb
                                  src={videoSrc}
                                  onClick={() => setVideoModalSrc(videoSrc)}
                                />
                              ) : (
                                <div className="w-full h-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                                  sem vídeo
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-semibold truncate">{p.nome}</div>

                                {p.nivel ? (
                                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                    {p.nivel}
                                  </span>
                                ) : null}
                              </div>

                              {(p.objetivo || p.descricao) ? (
                                <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                  {p.objetivo || p.descricao}
                                </p>
                              ) : null}

                              {Array.isArray(p.categorias) && p.categorias.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-2 text-[11px] text-gray-700">
                                  {p.categorias.map((cat) => (
                                    <span
                                      key={String(cat)}
                                      className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200"
                                    >
                                      {String(cat)}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (jaAdicionado) return;

                                if (p.origem === "personalizado") {
                                  addPersonalizadoNoTreino(p);
                                } else {
                                  adicionarExercicioExistente(p as any);
                                }
                              }}
                              disabled={jaAdicionado}
                              className={`bg-blue-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto ${
                                jaAdicionado ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              {jaAdicionado ? "Adicionado" : "Adicionar"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
               ) : abaExercicios === "catalogo" ? (
                <>
                  <div className="flex flex-col gap-3 w-full mb-4">
                    <input
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-sm outline-none focus:border-emerald-600"
                      placeholder="Buscar exercícios do bd..."
                      value={filtroEx}
                      onChange={(e) => setFiltroEx(e.target.value)}
                    />

                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                      value={filtroCategoria}
                      onChange={(e) => setFiltroCategoria(e.target.value)}
                    >
                      {OPCOES_CATEGORIA.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                      value={filtroNivel}
                      onChange={(e) => setFiltroNivel(e.target.value)}
                    >
                      <option value="">Todos os níveis</option>
                      <option value="Base">Base</option>
                      <option value="Avancado">Avançado</option>
                      <option value="Performance">Performance</option>
                    </select>

                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                      value={filtroVideo}
                      onChange={(e) => setFiltroVideo(e.target.value as "" | "com" | "sem")}
                    >
                      <option value="">Com/sem vídeo</option>
                      <option value="com">Somente com vídeo</option>
                      <option value="sem">Somente sem vídeo</option>
                    </select>
                  </div>

                  {/* Lista catálogo */}
                  <ul
                    ref={listRef}
                    onScroll={onScrollListaExercicios}
                    className="divide-y divide-gray-200 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1"
                  >
                    {exerciciosFiltrados.map((exercicio) => {
                      const videoSrc = resolveVideoUrl(exercicio.videoDemonstrativoUrl);
                      const jaAdicionado = jaEstaNoTreinoPorIdOuNome(
                        exerciciosSelecionados,
                        exercicio.id,
                        exercicio.nome,
                      );

                      return (
                        <li key={exercicio.id} className="py-3">
                          <div className="flex flex-col sm:flex-row gap-3 items-start">
                            <div className="w-full sm:w-44 shrink-0">
                              {videoSrc ? (
                                <VideoThumb
                                  src={videoSrc}
                                  onClick={() => setVideoModalSrc(videoSrc)}
                                />
                              ) : (
                                <div className="w-full h-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                                  sem vídeo
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold truncate">{exercicio.nome}</div>
                                {exercicio.nivel ? (
                                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                    {exercicio.nivel}
                                  </span>
                                ) : null}
                              </div>

                              {(exercicio.objetivo || exercicio.descricao) ? (
                                <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                  {exercicio.objetivo || exercicio.descricao}
                                </p>
                              ) : null}

                              {(exercicio.tipoTreino ||
                                exercicio.duracaoMinutos ||
                                (exercicio.categorias && exercicio.categorias.length > 0)) && (
                                <div className="flex flex-wrap gap-1 mt-1 text-[11px] text-gray-700">
                                  {exercicio.tipoTreino && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                                      {exercicio.tipoTreino}
                                    </span>
                                  )}
                                  {typeof exercicio.duracaoMinutos === "number" &&
                                    exercicio.duracaoMinutos > 0 && (
                                      <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200">
                                        {exercicio.duracaoMinutos} min
                                      </span>
                                    )}
                                  {exercicio.categorias?.map((cat) => (
                                    <span
                                      key={cat}
                                      className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200"
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => !jaAdicionado && adicionarExercicioExistente(exercicio)}
                              disabled={jaAdicionado}
                              className={`bg-blue-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto ${
                                jaAdicionado ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              {jaAdicionado ? "Adicionado" : "Adicionar"}
                            </button>
                          </div>
                        </li>
                      );
                    })}

                    {temMaisExercicios && (
                      <li className="py-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setPageEx((p) => p + 1)}
                          className="text-sm px-3 py-2 rounded border bg-white hover:bg-gray-50"
                        >
                          Carregar mais ({exerciciosVisiveis.length}/{exerciciosFiltrados.length})
                        </button>
                      </li>
                    )}
                  </ul>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-3 w-full mb-4">
                    <input
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-sm outline-none focus:border-emerald-600"
                      placeholder="Buscar exercícios personalizados..."
                      value={filtroEx}
                      onChange={(e) => setFiltroEx(e.target.value)}
                    />

                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                      value={filtroCategoria}
                      onChange={(e) => setFiltroCategoria(e.target.value)}
                    >
                      {OPCOES_CATEGORIA.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                      value={filtroNivel}
                      onChange={(e) => setFiltroNivel(e.target.value)}
                    >
                      <option value="">Todos os níveis</option>
                      <option value="Base">Base</option>
                      <option value="Avancado">Avançado</option>
                      <option value="Performance">Performance</option>
                    </select>

                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600"
                      value={filtroVideo}
                      onChange={(e) => setFiltroVideo(e.target.value as "" | "com" | "sem")}
                    >
                      <option value="">Com/sem vídeo</option>
                      <option value="com">Somente com vídeo</option>
                      <option value="sem">Somente sem vídeo</option>
                    </select>
                  </div>

                  {/* Lista personalizados */}
                  {loadingPersonalizados ? (
                    <div className="text-sm text-gray-600">Carregando personalizados...</div>
                  ) : (
                    <ul className="divide-y divide-gray-200 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
                      {exerciciosPersonalizadosFiltrados.map((p) => {
                          const jaAdicionado = treinoTemPersonalizado(p.id);
                          const videoSrc = p.videoDemonstrativoUrl || null;

                          return (
                            <li key={p.id} className="py-3">
                              <div className="flex flex-col sm:flex-row gap-3 items-start">
                                <div className="w-full sm:w-44 shrink-0">
                                  {videoSrc ? (
                                    <VideoThumb
                                      src={videoSrc}
                                      onClick={() => setVideoModalSrc(videoSrc)}
                                    />
                                  ) : (
                                    <div className="w-full h-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                                      sem vídeo
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="font-semibold truncate">{p.nome}</div>
                                    {p.nivel ? (
                                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                        {p.nivel}
                                      </span>
                                    ) : null}
                                  </div>

                                  {(p.objetivo || p.descricao) ? (
                                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                      {p.objetivo || p.descricao}
                                    </p>
                                  ) : null}

                                  {Array.isArray(p.categorias) && p.categorias.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mt-2 text-[11px] text-gray-700">
                                      {p.categorias.map((cat) => (
                                        <span
                                          key={String(cat)}
                                          className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200"
                                        >
                                          {String(cat)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => !jaAdicionado && addPersonalizadoNoTreino(p)}
                                  disabled={jaAdicionado}
                                  className={`bg-blue-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto ${
                                    jaAdicionado ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                >
                                  {jaAdicionado ? "Adicionado" : "Adicionar"}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </>
              )}
            </StepCard>
          </>
        )}

        {etapa === 3 && (
          <StepCard title="Selecionar Atletas Vinculados">
            <div className="mb-4 grid gap-2">
              <label className="block text-sm text-gray-700">
                Organização (para montar turmas e listar alunos)
              </label>
              <select
                className="border w-full p-2 rounded"
                value={orgSelecionada}
                onChange={(e) => {
                  setOrgSelecionada(e.target.value);
                  setAtletasSelecionados([]);
                  setTurmaSelecionada("");
                }}
              >
                <option value="">
                  — Meus vinculados (professor/escola/clube) —
                </option>
                <option value={MOSTRAR_TODOS}>— Todos os atletas —</option>
                {orgsVinculadas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome} ({o.tipo})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600">
                Se escolher uma organização, os alunos e as turmas listados
                abaixo virão dela.
              </p>
            </div>

            {atletasVinculados.length === 0 ? (
              <div className="bg-gray-100 text-gray-600 text-center py-6 rounded">
                Nenhum atleta encontrado para a fonte selecionada.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {atletasVinculados.map((atleta) => {
                  const selecionado = atletasSelecionados.includes(atleta.id);
                  return (
                    <div
                      key={atleta.id}
                      onClick={() =>
                        setAtletasSelecionados((prev) =>
                          selecionado
                            ? prev.filter((id) => id !== atleta.id)
                            : [...prev, atleta.id],
                        )
                      }
                      className={`cursor-pointer p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 ${
                        selecionado
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200"
                      }`}
                    >
                      <img
                        src={resolveAvatarUrl(atleta.foto)}
                        alt={atleta.nome}
                        className="w-20 h-20 mx-auto rounded-full object-cover mb-2"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src !== AVATAR_FALLBACK) img.src = AVATAR_FALLBACK;
                        }}
                      />

                      <p className="font-semibold text-sm sm:text-base">
                        {atleta.nome}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="my-4 p-4 border rounded-xl bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-gray-800">Alvo do agendamento</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Você pode agendar para <b>uma turma</b>, <b>atletas individuais</b>, ou <b>ambos</b>.
                  </p>
                </div>

                <div className="text-xs text-gray-700 bg-gray-50 border rounded-full px-3 py-1">
                  {turmaSelecionada ? "✅ Turma selecionada" : "Turma: —"}
                  {" • "}
                  {atletasSelecionados.length ? `✅ ${atletasSelecionados.length} atleta(s)` : "Atletas: —"}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Turma</label>
                  <select
                    className="border w-full p-2 rounded"
                    value={turmaSelecionada}
                    onChange={(e) => setTurmaSelecionada(e.target.value)}
                  >
                    <option value="">— Selecionar turma —</option>
                    {elencos.map((el) => (
                      <option key={el.id} value={el.id}>
                        {el.nome}
                      </option>
                    ))}
                  </select>

                  {turmaSelecionada && (
                    <p className="text-[11px] text-gray-600 mt-1">
                      Ao salvar, o treino será agendado para esta turma nos dias selecionados.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Criar nova turma (com atletas selecionados)</label>
                  <div className="flex gap-2">
                    <input
                      className="border p-2 rounded flex-1"
                      placeholder='Ex.: "Sub-13 - Noite"'
                      value={novaTurmaNome}
                      onChange={(e) => setNovaTurmaNome(e.target.value)}
                    />
                    <button
                      onClick={criarTurmaComSelecionados}
                      className="bg-emerald-600 text-white px-3 py-2 rounded whitespace-nowrap"
                    >
                      Criar
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Dica: selecione os atletas abaixo e crie a turma.
                  </p>
                </div>
              </div>
            </div>

            <div className="my-4 p-3 border rounded-md bg-gray-50">
              <div className="flex items-start gap-2 mb-3">
                <div className="mt-[2px]">
                  <CalendarIcon className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-semibold">
                    Dias para agendar este treino automaticamente
                  </label>
                  <p className="text-xs text-gray-600">
                    Toque nos dias do calendário FootEra para marcar ou
                    desmarcar. Se você não escolher datas aqui, o treino será
                    criado sem agendamento automático. Depois você poderá
                    agendar manualmente para os atletas na tela de treinos.
                  </p>
                  {isFreePlan && (
                    <p className="mt-1 text-[11px] text-green-700">
                      No plano <b>Free</b>, o agendamento automático fica limitado
                      da data de hoje até 30 dias à frente. Para mais liberdade de
                      agenda, migre para o plano Pro. 😉
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() =>
                    setMesCalendario((prev) => {
                      const novoMes = prev.mes - 1;
                      if (novoMes < 0) {
                        return { ano: prev.ano - 1, mes: 11 };
                      }
                      return { ano: prev.ano, mes: novoMes };
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 bg-white hover:bg-gray-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <div className="text-sm sm:text-base font-semibold text-green-800">
                  {NOMES_MESES_PT[mesCalendario.mes]} {mesCalendario.ano}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMesCalendario((prev) => {
                      const novoMes = prev.mes + 1;
                      if (novoMes > 11) {
                        return { ano: prev.ano + 1, mes: 0 };
                      }
                      return { ano: prev.ano, mes: novoMes };
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 bg-white hover:bg-gray-100"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] sm:text-xs text-gray-500 mb-1">
                {DIAS_SEMANA_PT.map((d) => (
                  <div key={d} className="uppercase tracking-tight">
                    {d}
                  </div>
                ))}
              </div>

              {(() => {
                const { ano, mes } = mesCalendario;
                const primeiroDia = new Date(ano, mes, 1);
                const weekdaySundayBased = primeiroDia.getDay();
                const firstWeekday = (weekdaySundayBased + 6) % 7;
                const diasNoMes = new Date(ano, mes + 1, 0).getDate();

                const dias: Array<number | null> = [];
                for (let i = 0; i < firstWeekday; i++) dias.push(null);
                for (let d = 1; d <= diasNoMes; d++) dias.push(d);

                const semanas: Array<Array<number | null>> = [];
                for (let i = 0; i < dias.length; i += 7) {
                  semanas.push(dias.slice(i, i + 7));
                }

                let hoje: Date | null = null;
                let limite: Date | null = null;
                if (isFreePlan) {
                  hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);

                  limite = new Date(hoje);
                  limite.setDate(limite.getDate() + 30);
                }

                const temAlvoAgendamento =
                  atletasSelecionados.length > 0 || Boolean(turmaSelecionada);

                const diaForaDaJanela = (dia: number) => {
                  if (!isFreePlan || !hoje || !limite) return false;
                  const dateStr = formatYMD(ano, mes, dia);
                  const d = new Date(`${dateStr}T00:00:00`);
                  if (isNaN(d.getTime())) return true;
                  d.setHours(0, 0, 0, 0);
                  return d < hoje || d > limite;
                };

                const toggleDia = (dia: number) => {
                  if (!temAlvoAgendamento) {
                    showToast(
                      "Selecione uma turma ou pelo menos 1 atleta para liberar o agendamento automático.",
                      "info",
                    );
                    return;
                  }

                  if (diaForaDaJanela(dia)) {
                    showToast(
                      "No plano Free, você só pode agendar treinos da data de hoje até 30 dias à frente.",
                      "info",
                    );
                    return;
                  }

                  const dateStr = formatYMD(ano, mes, dia);
                  setDatasAgendamento((prev) => {
                    if (prev.includes(dateStr)) return prev.filter((d) => d !== dateStr);
                    const next = [...prev, dateStr];
                    return next.sort();
                  });
                };

                {!temAlvoAgendamento && (
                  <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Selecione uma <b>turma</b> ou pelo menos <b>1 atleta</b> para liberar o agendamento automático.
                  </div>
                )}

                return (
              <div
                className={[
                  "mb-2",
                  !temAlvoAgendamento ? "opacity-60" : "opacity-100",
                ].join(" ")}
              >
                {!temAlvoAgendamento && (
                  <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Selecione uma <b>turma</b> ou pelo menos <b>1 atleta</b> para liberar o agendamento automático.
                  </div>
                )}

                  <div className="grid grid-rows-6 gap-1 mb-2">
                    {semanas.map((semana, idxSemana) => (
                      <div key={idxSemana} className="grid grid-cols-7 gap-1">
                        {semana.map((dia, idxDia) => {
                          if (!dia) {
                            return (
                              <div key={idxDia} className="h-8 sm:h-9" />
                            );
                          }
                          const dateStr = formatYMD(ano, mes, dia);
                          const selecionado =
                            datasAgendamento.includes(dateStr);

                          const bloqueado = diaForaDaJanela(dia);
                          const bloqueadoPorAlvo = !temAlvoAgendamento;
                          const disabled = bloqueado || bloqueadoPorAlvo;

                          return (
                            <button
                              key={idxDia}
                              type="button"
                              onClick={() => toggleDia(dia)}
                              disabled={disabled}
                              className={[
                                "h-8 sm:h-9 text-xs sm:text-sm flex items-center justify-center rounded-full border transition-all",
                                disabled
                                  ? "bg-gray-100 text-gray-400 border-dashed border-gray-300 cursor-not-allowed"
                                  : selecionado
                                  ? "bg-green-700 text-white border-green-700 shadow-sm"
                                  : "bg-white text-gray-800 border-gray-300 hover:bg-green-50",
                              ].join(" ")}
                            >
                              {dia}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}

              {datasAgendamento.length > 0 && (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
                  <div className="font-bold text-gray-900">Horário do treino</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Se algum dia selecionado for <b>hoje</b>, o horário precisa ser <b>maior que o atual</b>.
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="HH:mm"
                      value={horaAgendamentoInput}
                      onChange={(e) => {
                        let v = e.target.value.replace(/[^\d:]/g, "");
                        const onlyDigits = v.replace(":", "");
                        if (!v.includes(":") && onlyDigits.length >= 3) {
                          v = `${onlyDigits.slice(0, 2)}:${onlyDigits.slice(2, 4)}`;
                        }
                        if (v.length > 5) v = v.slice(0, 5);
                        setHoraAgendamentoInput(v);
                      }}
                      onBlur={() => {
                        const v = horaAgendamentoInput;

                        if (!isValidHHMM(v)) {
                          setHoraAgendamentoInput(horaAgendamento);
                          return;
                        }

                        // se tem "hoje" nas datas, trava para >= agora
                        const temHoje = datasAgendamento.some(isTodayYMD);
                        if (temHoje) {
                          const minNow = hhmmNow();
                          if (v < minNow) {
                            showToast(`Para hoje, escolha um horário a partir de ${minNow}.`, "info");
                            setHoraAgendamento(minNow);
                            setHoraAgendamentoInput(minNow);
                            return;
                          }
                        }

                        setHoraAgendamento(v);
                        setHoraAgendamentoInput(v);
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
                    />

                    <div className="text-xs text-gray-500">Ex.: 07:30, 14:00, 19:15</div>
                  </div>
                </div>
              )}
              {datasAgendamento.length > 0 && (
                <div className="mt-2 text-xs text-gray-700">
                  <span className="font-semibold">Dias selecionados:</span>{" "}
                  {datasAgendamento
                    .slice()
                    .sort()
                    .map((str) => {
                      const iso = str.includes("T") ? str : `${str}T00:00:00`;
                      const d = new Date(iso);
                      if (isNaN(d.getTime())) return str;
                      return d.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      });
                    })
                    .join(", ")}
                </div>
              )}

              {datasAgendamento.length > 0 &&
                atletasSelecionados.length === 0 &&
                !turmaSelecionada && (
                  <p className="mt-2 text-xs text-amber-700">
                    Você já escolheu datas, mas ainda não selecionou nem turma nem atletas. O treino só será
                    agendado para quem estiver selecionado acima.
                  </p>
              )}
            </div>
          </StepCard>
        )}
      </div>

      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/95 backdrop-blur border border-gray-200 shadow-lg rounded-2xl p-2 sm:p-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (etapa === 1) navigate("/treinos");
                else goTo(etapa - 1);
              }}
              className="px-3 sm:px-4 py-2 rounded-xl bg-gray-200 text-gray-900 shrink-0"
            >
              Voltar
            </button>

            <div className="flex-1 min-w-0">
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  <Stepper steps={steps} current={etapa} onJump={goTo} completedUntil={completedUntil} />
                </div>
              </div>
            </div>

            {etapa < 3 ? (
              <button
                type="button"
                onClick={() => goTo(etapa + 1)}
                className="px-3 sm:px-4 py-2 rounded-xl bg-green-800 text-white shrink-0"
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                id="btnsalvar"
                onClick={criarTreino}
                disabled={salvando || criandoTreinoRef.current}
                className={[
                  "px-3 sm:px-4 py-2 rounded-xl bg-green-800 text-white shrink-0",
                  salvando ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center z-50 px-4">
          <div
            role="status"
            className={[
              "max-w-xl w-full rounded-2xl shadow-lg border bg-white overflow-hidden",
              toast.type === "success"
                ? "border-green-300"
                : toast.type === "error"
                ? "border-red-300"
                : "border-gray-300",
            ].join(" ")}
          >
            <div className="flex items-start gap-3 p-4">
              <div
                className={[
                  "mt-0.5 h-2.5 w-2.5 rounded-full shrink-0",
                  toast.type === "success"
                    ? "bg-green-600"
                    : toast.type === "error"
                    ? "bg-red-600"
                    : "bg-gray-600",
                ].join(" ")}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={[
                    "text-sm sm:text-base font-semibold",
                    toast.type === "success"
                      ? "text-green-900"
                      : toast.type === "error"
                      ? "text-red-900"
                      : "text-gray-900",
                  ].join(" ")}
                >
                  {toast.type === "success"
                    ? "Sucesso"
                    : toast.type === "error"
                    ? "Atenção"
                    : "Info"}
                </div>

                <div className="mt-1 text-sm sm:text-base text-gray-800 whitespace-pre-wrap break-words">
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-xs sm:text-sm text-gray-600 underline shrink-0"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {videoModalSrc && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setVideoModalSrc(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                className="text-sm text-gray-700 underline"
                onClick={() => setVideoModalSrc(null)}
              >
                Fechar
              </button>
            </div>

            <video
              className="w-full max-h-[70vh] rounded bg-black"
              src={videoModalSrc}
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}
      
    
      <BottomNav />
      
    </div>
  );
}