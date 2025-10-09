import React, { useEffect, useState, type SVGProps } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarClock,
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  CircleX,
  CircleCheck,
  Send,
  Share2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { Badge } from "@/components/ui/badge.js";
import HealthBanner from "@/components/legal/HealthBanner.js";

const tipoUser =
  String(
    (Storage as any)?.tipoSalvo ??
      (Storage as any)?.tipoUsuario ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      ""
  ).toLowerCase();

const isOlheiro = tipoUser === "olheiro";

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
}

interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  dataAgendada?: string;
  exercicios: Exercicio[];
  duracao?: number;
  objetivo?: string;
  dicas?: string[];
  professorId?: string;
  escolinhaId?: string;
  clubeId?: string;
  pontuacao?: number | null;
}

interface TreinoAgendado {
  id: string;
  titulo: string;
  dataTreino: string;
  dataExpiracao?: string | null;
  nivel?: string | null;
  prazoEnvio?: string | null;
  duracaoMinutos?: number | null;
  treinoProgramado?: {
    descricao?: string;
    nivel: string;
    dicas?: string[];
    objetivo?: string;
    duracao?: number;
    dataAgendada?: string | null;
    pontuacao?: number | null;
    exercicios: {
      exercicio: { id: string; nome: string };
      repeticoes: string;
    }[];
  };
}

interface Desafio {
  id: string;
  titulo: string;
  descricao: string;
  nivel: string;
  pontuacao: number;
  imagemUrl?: string;
}

interface UsuarioLogado {
  tipo: "admin" | "atleta" | "escola" | "escolinha" | "clube" | "professor";
  usuarioId: string;
  tipoUsuarioId: string;
}

interface SubmissaoParaValidacao {
  id: string;
  criadoEm: string;
  aprovado: boolean | null;
  pontosSugeridos: number;
  atleta: { id: string; usuarioId: string; nome: string; foto?: string | null };
  treino: { agendadoId: string; titulo: string; programadoId?: string | null };
  midias: string[];
  observacao?: string | null;
}

type MinhasSubTreino = {
  id: string;
  treinoAgendadoId: string | null;
  treinoProgramadoId: string | null;
  aprovado: boolean | null;
};

const PLACEHOLDER_USER = "/assets/default-user.png";

function resolveUploadUrl(raw?: string | null) {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/assets/") || raw.startsWith("/attached_assets/")) return raw;
  if (raw.startsWith("/uploads/")) return `${API.BASE_URL}${raw}`;
  return `${API.BASE_URL}/uploads/${raw.replace(/^\/+/, "")}`;
}

function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
}

function SoccerFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <circle cx="12" cy="12" r="2.25" />
      <rect x="3" y="8.5" width="4" height="7" rx="0.5" />
      <rect x="17" y="8.5" width="4" height="7" rx="0.5" />
    </svg>
  );
}

type TreinoStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

export default function PaginaTreinos() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [, navigate] = useLocation();
  const [abaProfessor, setAbaProfessor] = useState<"avaliar" | "criar">("avaliar");
  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [desafioParaCompartilhar, setDesafioParaCompartilhar] = useState<string | null>(null);

  const [submissoesPendentes, setSubmissoesPendentes] = useState<SubmissaoParaValidacao[]>([]);
  const [carregandoSubmissoes, setCarregandoSubmissoes] = useState(false);
  const [page, setPage] = useState({ total: 0, limit: 20, offset: 0 });

  const [idsAgendadosSubmetidos, setIdsAgendadosSubmetidos] = useState<Set<string>>(new Set());
  const [idsProgramadosSubmetidos, setIdsProgramadosSubmetidos] = useState<Set<string>>(new Set());
  const [idsDesafiosSubmetidos, setIdsDesafiosSubmetidos] = useState<Set<string>>(new Set());
 
  const [statusPorTreino, setStatusPorTreino] =
    useState<Record<string, { status: string; startedAt?: string|null; completedAt?: string|null }>>({});

  async function carregarStatus(id: string) {
    const token = getToken();
    if (!token) return;
    const r = await fetch(`${API.BASE_URL}/api/treinos/${id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const js = await r.json();
      setStatusPorTreino((prev) => ({ ...prev, [id]: js }));
    }
  }

  useEffect(() => {
    treinosAgendados.forEach(t => carregarStatus(t.id));
  }, [treinosAgendados]);

  useEffect(() => {
    const handler = (e: any) => setTreinosAgendados((prev) => [e.detail, ...prev]);
    window.addEventListener("treino:agendado", handler as EventListener);
    return () => window.removeEventListener("treino:agendado", handler as EventListener);
  }, []);

  async function concluir(
  treinoAgendadoId: string,
  payload?: { observacao?: string; duracaoMinutos?: number; tempoSeg?: number; repeticoes?: number }
) {
  const token = getToken();
  if (!token) return alert("Sessão expirada. Faça login novamente.");

  try {
    const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treinoAgendadoId, ...(payload || {}) }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Falha ao concluir treino:", r.status, txt);
      return alert("Não foi possível concluir o treino.");
    }

    setStatusPorTreino(prev => ({
      ...prev,
      [treinoAgendadoId]: {
        ...(prev[treinoAgendadoId] ?? {}),
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
      },
    }));
    setIdsAgendadosSubmetidos(prev => {
      const s = new Set(prev);
      s.add(treinoAgendadoId);
      return s;
    });

    alert("Treino concluído!");
  } catch (e) {
    console.error(e);
    alert("Erro inesperado ao concluir o treino.");
  }
}

  async function iniciar(treinoAgendadoId: string) {
    const token = getToken();
    if (!token) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }

    const r = await fetch(
      `${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/iniciar`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Falha ao iniciar treino:", r.status, txt);
      alert(r.status === 401
        ? "Sessão expirada. Faça login novamente."
        : "Não foi possível iniciar o treino.");
      return;
    }

    setStatusPorTreino((prev) => ({
      ...prev,
      [treinoAgendadoId]: {
        ...(prev[treinoAgendadoId] ?? {}),
        status: "IN_PROGRESS",
      },
    }));
  }

  useEffect(() => {
    const token =
      (Storage as any).token ?? localStorage.getItem("token") ?? undefined;
    if (!token) return;

    (async () => {
      const res = await fetch(`${API.BASE_URL}/api/treinos/minhas-submissoes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const rows: Array<{ treinoAgendadoId: string }> = await res.json();
      setIdsAgendadosSubmetidos(
        new Set(rows.map((r) => r.treinoAgendadoId).filter(Boolean))
      );
    })();
  }, []);

  async function carregarMinhasSubmissoes(atletaId: string) {
    try {
      const token = (Storage as any).token ?? localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const r = await fetch(
        `${API.BASE_URL}/api/treinos/minhas-submissoes?atletaId=${encodeURIComponent(atletaId)}`,
        { headers }
      );
      if (r.ok) {
        const arr: MinhasSubTreino[] = await r.json();
        const setAg = new Set<string>();
        const setPg = new Set<string>();
        for (const s of arr) {
          if (s.treinoAgendadoId) setAg.add(s.treinoAgendadoId);
          if (s.treinoProgramadoId) setPg.add(s.treinoProgramadoId);
        }
        setIdsAgendadosSubmetidos(setAg);
        setIdsProgramadosSubmetidos(setPg);
      } else {
        setIdsAgendadosSubmetidos(new Set());
        setIdsProgramadosSubmetidos(new Set());
      }

      try {
        const r2 = await fetch(
          `${API.BASE_URL}/api/desafios/minhas-submissoes?atletaId=${encodeURIComponent(atletaId)}`,
          { headers }
        );
        if (r2.ok) {
          const arr2: { desafioId: string }[] = await r2.json();
          setIdsDesafiosSubmetidos(new Set(arr2.map((x) => x.desafioId)));
        } else {
          setIdsDesafiosSubmetidos(new Set());
        }
      } catch {
        setIdsDesafiosSubmetidos(new Set());
      }
    } catch {
      setIdsAgendadosSubmetidos(new Set());
      setIdsProgramadosSubmetidos(new Set());
      setIdsDesafiosSubmetidos(new Set());
    }
  }

  useEffect(() => {
    const carregar = async () => {
      const rawTipo =
        (Storage as any).tipoSalvo ??
        (Storage as any).tipoUsuario ??
        (Storage as any).tipo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        "";

      const tipo = String(rawTipo).toLowerCase();

      const tipoUsuarioId = (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");
      const token = (Storage as any).token ?? localStorage.getItem("token");

      if (tipo === "atleta" && tipoUsuarioId && token) {
        carregarMinhasSubmissoes(tipoUsuarioId);

        const [resTreinos, resDesafios] = await Promise.all([
          fetch(`${API.BASE_URL}/api/treinos/agendados?usuarioId=${(Storage as any).usuarioId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API.BASE_URL}/api/desafios?tipoUsuarioId=${tipoUsuarioId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!resTreinos.ok) {
          console.error("/treinos/agendados", resTreinos.status, await resTreinos.text());
          return;
        }
        if (!resDesafios.ok) {
          console.error("/desafios", resDesafios.status, await resDesafios.text());
          return;
        }

        const treinosJson = await resTreinos.json();
        const desafiosJson = await resDesafios.json();

        const normalizados = (Array.isArray(treinosJson) ? treinosJson : []).map((t: any) => ({
          id: t.id,
          titulo: t.titulo,
          dataTreino: t.dataTreino ?? null,
          prazoEnvio: t.prazoEnvio ?? t.dataExpiracao ?? t.dataTreino ?? t.treinoProgramado?.dataAgendada ?? null,
          nivel: t.nivel ?? t.treinoProgramado?.nivel ?? null,
          duracaoMinutos: t.duracaoMinutos ?? t.treinoProgramado?.duracao ?? null,
          treinoProgramado: t.treinoProgramado ?? null,
        }));

        const agora = Date.now();
        const apenasVigentes = normalizados.filter((t) => {
          if (!t.prazoEnvio) return true;
          const ts = Date.parse(t.prazoEnvio);
          return Number.isFinite(ts) ? ts >= agora : true;
        });

        setTreinosAgendados(apenasVigentes);
        setDesafios(desafiosJson ?? []);
      } else if (tipo === "admin" && token) {
        const [resTreinos, resDesafios] = await Promise.all([
          fetch(`${API.BASE_URL}/api/treinos/programados`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API.BASE_URL}/api/desafios`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!resTreinos.ok) throw new Error(`Falha /treinos/programados: ${resTreinos.status}`);
        const jsonTreinos = await resTreinos.json();
        const normTreinos = (Array.isArray(jsonTreinos) ? jsonTreinos : []).map((t: any) => ({
          id: t.id,
          nome: t.nome,
          descricao: t.descricao ?? undefined,
          nivel: t.nivel,
          dataAgendada: t.dataAgendada ?? undefined,
          duracao: t.duracao ?? undefined,
          objetivo: t.objetivo ?? undefined,
          dicas: Array.isArray(t.dicas) ? t.dicas : [],
          professorId: t.professorId ?? undefined,
          escolinhaId: t.escolinhaId ?? undefined,
          clubeId: t.clubeId ?? undefined,
          pontuacao: t.pontuacao ?? undefined,
          exercicios: (t.exercicios ?? []).map((ex: any) => ({
            id: ex.exercicio?.id ?? ex.id ?? "",
            nome: ex.exercicio?.nome ?? ex.nome ?? "",
            repeticoes: ex.repeticoes ?? undefined,
          })),
        }));

        const jsonDesafios = await resDesafios.json();
        setTreinos(normTreinos);
        setDesafios(jsonDesafios?.desafiosOficiais ?? jsonDesafios ?? []);
      } else if (["professor", "clube", "escolinha", "escola"].includes(String(tipo)) && token) {
        const [resTreinos, resDesafios] = await Promise.all([
          fetch(`${API.BASE_URL}/api/treinos/programados`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API.BASE_URL}/api/desafios?tipoUsuarioId=${(Storage as any).tipoUsuarioId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!resTreinos.ok) throw new Error(`/treinos/programados: ${resTreinos.status}`);
        if (!resDesafios.ok) throw new Error(`/desafios: ${resDesafios.status}`);

        const jsonTreinos = await resTreinos.json();
        const normTreinos = (Array.isArray(jsonTreinos) ? jsonTreinos : []).map((t: any) => ({
          id: t.id,
          nome: t.nome,
          descricao: t.descricao ?? undefined,
          nivel: t.nivel,
          dataAgendada: t.dataAgendada ?? undefined,
          duracao: t.duracao ?? undefined,
          objetivo: t.objetivo ?? undefined,
          dicas: Array.isArray(t.dicas) ? t.dicas : [],
          professorId: t.professorId ?? undefined,
          escolinhaId: t.escolinhaId ?? undefined,
          clubeId: t.clubeId ?? undefined,
          pontuacao: t.pontuacao ?? undefined,
          exercicios: (t.exercicios ?? []).map((ex: any) => ({
            id: ex.exercicio?.id ?? ex.id ?? "",
            nome: ex.exercicio?.nome ?? ex.nome ?? "",
            repeticoes: ex.repeticoes ?? undefined,
          })),
        }));

        const jsonDesafios = await resDesafios.json();
        setTreinos(normTreinos);
        setDesafios(jsonDesafios ?? []);
      } else {
        const resTreinos = await fetch(`${API.BASE_URL}/api/treinos/disponiveis`);
        if (!resTreinos.ok) {
          console.error("/treinos/disponiveis", resTreinos.status, await resTreinos.text());
          return;
        }

        const jsonTreinos = await resTreinos.json();
        const normTreinos = (Array.isArray(jsonTreinos) ? jsonTreinos : []).map((t: any) => ({
          ...t,
          pontuacao: t.pontuacao ?? undefined,
          exercicios: (t.exercicios ?? []).map((ex: any) => ({
            id: ex.id ?? "",
            nome: ex.nome ?? "",
            repeticoes: ex.repeticoes ?? undefined,
          })),
        }));

        setTreinos(normTreinos);
        setDesafios([]);
      }
    };

    const carregarUsuario = () => {
      const tipoSalvo =
        (Storage as any).tipoSalvo ??
        (Storage as any).tipoUsuario ??
        (Storage as any).tipo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario");

      const usuarioId = (Storage as any).usuarioId ?? localStorage.getItem("usuarioId");
      const tipoUsuarioId = (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");

      if (
        ["admin", "atleta", "escola", "escolinha", "clube", "professor"].includes(String(tipoSalvo || "")) &&
        usuarioId &&
        tipoUsuarioId
      ) {
        setUsuario({
          tipo: (tipoSalvo as any) === "escolinha" ? "escolinha" : (tipoSalvo as any),
          usuarioId,
          tipoUsuarioId,
        });
      } else {
        console.warn("Tipo de usuário, tipoUsuarioId ou ID inválido ou não encontrado.", {
          tipoSalvo,
          usuarioId,
          tipoUsuarioId,
        });
      }
    };

    carregar();
    carregarUsuario();
  }, []);

  useEffect(() => {
    if (isOlheiro) {
      window.location.replace("/olheiros");
    }
  }, [isOlheiro]);

  useEffect(() => {
    if (!usuario) return;
    if (
      usuario.tipo === "professor" ||
      usuario.tipo === "clube" ||
      usuario.tipo === "escolinha" ||
      usuario.tipo === "escola" ||
      usuario.tipo === "admin"
    ) {
      if (abaProfessor === "avaliar") carregarSubmissoes();
    }
  }, [abaProfessor, usuario?.tipoUsuarioId]);

  async function carregarSubmissoes(append = false) {
  const token = (Storage as any).token ?? localStorage.getItem("token");
  if (!token || !usuario) return;

  const limit = page.limit;
  const offset = append ? (page.offset + page.limit) : 0;

  setCarregandoSubmissoes(true);
  try {
    const res = await fetch(
      `${API.BASE_URL}/api/treinos/submissoes?tipoUsuarioId=${usuario.tipoUsuarioId}&status=pendente&limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Falha /treinos/submissoes: ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items ?? []);

    setSubmissoesPendentes(prev => append ? [...prev, ...items] : items);
    setPage({
      total: data.total ?? items.length,
      limit: data.limit ?? limit,
      offset,
    });
  } catch (e) {
    console.error(e);
    if (!append) setSubmissoesPendentes([]);
  } finally {
    setCarregandoSubmissoes(false);
  }
}

  async function validarSubmissao(id: string, aprovado: boolean, pontosSug?: number) {
    const token = (Storage as any).token ?? localStorage.getItem("token");
    if (!token || !usuario) return;

    let pontos = 0;
    if (aprovado) {
      const inp = prompt("Pontos a creditar para este treino:", String(pontosSug ?? 0));
      if (inp === null) return;
      const n = Number(inp);
      pontos = Number.isFinite(n) && n >= 0 ? n : 0;
    }

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/submissoes/${id}/validar?tipoUsuarioId=${usuario.tipoUsuarioId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ aprovado, pontos }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao validar:", res.status, txt);
        return alert("Não foi possível validar a submissão.");
      }
      setSubmissoesPendentes((prev) => prev.filter((s) => s.id !== id));
      alert(aprovado ? "Submissão aprovada e pontos creditados!" : "Submissão reprovada.");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao validar.");
    }
  }

  const aprovar = (id: string, pontos?: number) => validarSubmissao(id, true, pontos);
  const reprovar = (id: string) => validarSubmissao(id, false, 0);

  const formatarDataHora = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

  const formatarData = (data?: string) => (data ? new Date(data).toLocaleDateString("pt-BR") : "");

  const treinosAgendadosVisiveis = treinosAgendados.filter(
    (t) => !idsAgendadosSubmetidos.has(t.id)
  );
  const desafiosVisiveis = desafios.filter(
    (d) => !idsDesafiosSubmetidos.has(d.id)
  );

  const renderDesafioCard = (desafio: Desafio) => (
    <div key={desafio.id} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-300/60 mb-3">
      <h4 className="font-bold text-yellow-700 text-lg mb-1">
        <Link href={`/desafios/${desafio.id}`} className="hover:underline">
          {desafio.titulo}
        </Link>
      </h4>

      <p className="text-sm text-gray-600 mb-2">{desafio.descricao}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>Nível: {desafio.nivel}</span>
        <span className="px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          {desafio.pontuacao} pts
        </span>
      </div>

       <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:justify-between">
        <button
          onClick={() => navigate(`/desafios/${desafio.id}`)}
          className="bg-green-800 hover:bg-green-900 text-white px-3 py-2 rounded-lg"
        >
          Ver desafio
        </button>
        <button
          onClick={() => abrirModalCompartilhar(desafio.id)}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm"
        >
          <Share2 className="w-4 h-4" /> Compartilhar
        </button>
      </div>
    </div>
  );

  if (!usuario) return <p className="text-center p-4">Carregando...</p>;
  const isGestor =
    ["professor", "admin", "escola", "escolinha", "clube"].includes(usuario.tipo);

  const renderTreinoCard = (treino: TreinoProgramado) => (
    <div key={treino.id} className="bg-white p-4 rounded-xl shadow-sm border mb-4">
      <div className="flex items-start justify-between gap-3">
        <h4
          className="font-bold text-lg text-green-800 cursor-pointer hover:underline"
          onClick={() => navigate(`/treinos/unico?programadoId=${treino.id}`)}
        >
          {treino.nome}
        </h4>

        {typeof treino.pontuacao === "number" && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            +{treino.pontuacao} pts
          </span>
        )}
      </div>
      {treino.descricao && <p className="text-sm text-gray-700 mt-1">{treino.descricao}</p>}

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
        <p>
          <strong>Nível:</strong> {treino.nivel}
        </p>
        {treino.dataAgendada && (
          <p>
            <strong>Data:</strong> {formatarData(treino.dataAgendada)}
          </p>
        )}
        {typeof treino.duracao === "number" && (
          <p>
            <strong>Duração:</strong> {treino.duracao} min
          </p>
        )}
        {treino.objetivo && (
          <p className="sm:col-span-2">
            <strong>Objetivo:</strong> {treino.objetivo}
          </p>
        )}
      </div>

      {treino.exercicios?.length > 0 && (
        <div className="mt-3">
          <strong className="text-sm text-gray-800">Exercícios:</strong>
          <div className="max-h-40 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
            {treino.exercicios.map((ex, i) => (
               <div key={ex.id || `${i}-${ex.nome || "ex"}`} className="border-b pb-1 last:border-b-0">
                <strong>{i + 1}.</strong> {ex.nome}{" "}
                {ex.repeticoes && <span className="text-gray-500">({ex.repeticoes})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderTreinoAgendadoCard = (treino: TreinoAgendado) => {
    const programado = treino.treinoProgramado;
    const nivel = treino.nivel ?? treino.treinoProgramado?.nivel ?? "-";
    const prazoIso = treino.prazoEnvio ?? treino.dataTreino ?? treino.treinoProgramado?.dataAgendada ?? null;
    const exercicios = programado?.exercicios ?? [];
    const pontos = programado?.pontuacao ?? null;
    const jaSubmetido = idsAgendadosSubmetidos.has(treino.id);
    const st = statusPorTreino[treino.id]?.status as TreinoStatus | undefined;

    return (
      <div key={treino.id} className="bg-white p-4 rounded-xl shadow-sm border mb-4">
        <div className="flex items-start justify-between gap-3">
          <h4
            className="font-bold text-lg text-green-800 cursor-pointer hover:underline"
            onClick={() => navigate(`/treinos/unico?agendadoId=${treino.id}`)}
          >
            {treino.titulo}
          </h4>

          <div className="flex items-center gap-2">
            {typeof pontos === "number" && pontos > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                +{pontos} pts
              </span>
            )}
            <button
              onClick={() => removerTreinoAgendado(treino.id)}
              title="Remover"
              className="shrink-0 p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {programado?.descricao && <p className="text-sm text-gray-700 mt-1">{programado.descricao}</p>}

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
          <p>
            <strong>Nível:</strong> {nivel}
          </p>

          {programado?.duracao && (
            <p>
              <strong>Duração:</strong> {programado.duracao} min
            </p>
          )}

          {programado?.objetivo && (
            <p className="sm:col-span-2">
              <strong>Objetivo:</strong> {programado.objetivo}
            </p>
          )}

          {prazoIso && (
            <div className="sm:col-span-2 flex items-center text-gray-700">
              <CalendarClock className="h-4 w-4 mr-1" />
              Prazo para envio:
              <Badge variant="outline" className="ml-2 text-[11px] bg-green-100 text-green-700 border-green-200">
                {formatarDataHora(prazoIso)}
              </Badge>
            </div>
          )}
        </div>

        {exercicios.length > 0 && (
          <div className="mt-3">
            <strong className="text-sm text-gray-800">Exercícios:</strong>
            <div className="max-h-40 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
              {exercicios.map((ex, i) => (
                <div key={ex.exercicio?.id || `${i}-${ex.exercicio?.nome || "ex"}`} className="border-b pb-1 last:border-b-0">
                  <strong>{i + 1}.</strong> {ex.exercicio.nome}{" "}
                  {ex.repeticoes && <span className="text-gray-500">({ex.repeticoes})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2 justify-end">
          {(st === undefined || st === "PENDING") && (
            <button
              onClick={() => iniciar(treino.id)}
              className="bg-green-700 text-white px-3 py-2 rounded-lg"
            >
              Iniciar
            </button>
          )}

          {st === "IN_PROGRESS" && (
            <button
              onClick={() => {
                const t = prompt("Tempo em segundos (opcional):") ?? "";
                const r = prompt("Repetições (opcional):") ?? "";
                concluir(treino.id, {
                  tempoSeg: t ? Number(t) : undefined,
                  repeticoes: r ? Number(r) : undefined,
                });
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg"
            >
              Concluir agora
            </button>
          )}

          {st === "COMPLETED" && (
            <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Concluído
            </span>
          )}

          {!jaSubmetido && (
            <button
              onClick={() => navigate(`/submissao?treinoAgendadoId=${treino.id}`)}
              className="bg-green-800 hover:bg-green-900 text-white px-3 py-2 rounded-lg"
            >
              Fazer Submissão
            </button>
          )}
        </div>
      </div>
    );
  };

  async function removerTreinoAgendado(id: string) {
    const token = Storage.token;
    if (!token) return alert("Sessão expirada.");
    if (!confirm("Remover este treino dos seus treinos?")) return;

    try {
      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao excluir:", res.status, txt);
        return alert("Não foi possível excluir.");
      }
      setTreinosAgendados((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao excluir.");
    }
  }

  async function carregarUsuariosMutuos() {
    const token = Storage.token;
    setCarregandoMutuos(true);
    try {
      const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar usuários mutuos");
      const data = await res.json();
      setUsuariosMutuos(data);
    } catch (err) {
      console.error(err);
      setUsuariosMutuos([]);
    } finally {
      setCarregandoMutuos(false);
    }
  }

  function abrirModalCompartilhar(desafioId: string) {
    setDesafioParaCompartilhar(desafioId);
    setModalAberto(true);
    carregarUsuariosMutuos();
    setSelecionados(new Set());
  }

  function toggleSelecionado(idUsuario: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(idUsuario)) novo.delete(idUsuario);
      else novo.add(idUsuario);
      return novo;
    });
  }

  async function enviarCompartilhamentoPorDM() {
    if (selecionados.size === 0 || !desafioParaCompartilhar) {
      alert("Selecione ao menos uma pessoa para compartilhar.");
      return;
    }
    const token = Storage.token;

    try {
      setEnviandoDM(true);
      await Promise.all(
        Array.from(selecionados).map((paraId) =>
          fetch(`${API.BASE_URL}/api/mensagem`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paraId, conteudo: desafioParaCompartilhar, tipo: "DESAFIO" }),
          })
        )
      );

      alert("Desafio compartilhado por mensagem!");
      setModalAberto(false);
    } catch (e) {
      console.error(e);
      alert("Falha ao enviar mensagens.");
    } finally {
      setEnviandoDM(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl px-3 sm:px-4">
        <div className="max-w-3xl mx-auto px-4 pt-3">
         <HealthBanner />
        </div>
        <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-neutral-50/90 backdrop-blur px-3 sm:px-0 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            {isGestor ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-[420px]">
                <button
                  onClick={() => setAbaProfessor("avaliar")}
                  className={`px-4 py-2 rounded-lg border text-sm ${
                    abaProfessor === "avaliar"
                      ? "bg-green-800 text-white border-green-900"
                      : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  Avaliar Treinos
                </button>
                <button
                  onClick={() => setAbaProfessor("criar")}
                  className={`px-4 py-2 rounded-lg border text-sm ${
                    abaProfessor === "criar"
                      ? "bg-green-800 text-white border-green-900"
                      : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  Meus Treinos
                </button>
              </div>
            ) : (
              <div className="text-lg font-semibold text-green-900">Treinos</div>
            )}

            <Link
              href="/treinos/elenco"
              aria-label="Ir para o elenco (campo)"
              title="Elenco (campo)"
              className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <SoccerFieldIcon className="w-5 h-5" />
            </Link>
          </div>
        </div>
        <>
          {usuario.tipo === "atleta" && (
            <div className="space-y-6">
              <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                  <h3 className="text-lg font-semibold">Meus Treinos</h3>
                  <div className="flex gap-2">
                    <button
                      className="bg-green-800 text-white px-4 py-2 rounded-lg text-sm"
                      onClick={() => navigate("/treinos/novo")}
                    >
                      Agendar novo treino
                    </button>

                    <button
                      className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm"
                      onClick={() => navigate("/treinos/livre/novo")}
                    >
                      Registrar treino livre
                    </button>

                    <button
                      className="bg-white border border-emerald-300 text-emerald-800 px-4 py-2 rounded-lg text-sm"
                      onClick={() => navigate("/treinos/livre/historico")}
                    >
                      Histórico de treinos livres
                    </button>
                  </div>
                </div>
                {treinosAgendadosVisiveis.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {treinosAgendadosVisiveis.map(renderTreinoAgendadoCard)}
                  </div>
                ) : (
                  <p className="text-gray-500">Nenhum treino disponível ainda.</p>
                )}
              </div>

              <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
                <h3 className="text-lg font-semibold mb-2">Desafios</h3>
                {desafiosVisiveis.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{desafiosVisiveis.map(renderDesafioCard)}</div>
                ) : (
                  <p className="text-gray-500">Nenhum desafio disponível no momento.</p>
                )}
              </div>
            </div>
          )}

          {isGestor && (
            <div className="space-y-6">
              {abaProfessor === "avaliar" && (
                <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
                  <h3 className="text-lg font-semibold mb-3">Treinos dos atletas afiliados</h3>

                  {carregandoSubmissoes ? (
                    <p className="text-gray-500">Carregando submissões pendentes...</p>
                  ) : submissoesPendentes.length === 0 ? (
                    <p className="text-gray-500">Nenhum treino pendente para avaliação no momento.</p>
                  ) : (
                    <>
                      <ul className="space-y-3">
                        {submissoesPendentes.map((s) => {
                          const foto = s.atleta?.foto ? resolveUploadUrl(s.atleta.foto) : PLACEHOLDER_USER;
                          const midias = (Array.isArray(s.midias) ? s.midias : []).map(resolveUploadUrl);

                          return (
                            <li
                              key={s.id}
                              className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-3 sm:p-4"
                            >
                              <div className="flex items-start gap-3 sm:gap-4">
                                <img
                                  src={foto}
                                  alt={s.atleta?.nome}
                                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border"
                                  onError={(e) => {
                                    const el = e.currentTarget as HTMLImageElement;
                                    (el as any).onerror = null;
                                    el.src = PLACEHOLDER_USER;
                                  }}
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-semibold text-green-900 truncate">{s.treino.titulo}</div>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      +{s.pontosSugeridos ?? 0} pts
                                    </span>

                                    <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
                                      <button
                                        onClick={() => aprovar(s.id, s.pontosSugeridos)}
                                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                        title="Aprovar e creditar pontos"
                                      >
                                        <Check className="w-4 h-4" /> Aprovar
                                      </button>
                                      <button
                                        onClick={() => reprovar(s.id)}
                                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                                        title="Reprovar"
                                      >
                                        <X className="w-4 h-4" /> Reprovar
                                      </button>
                                    </div>
                                  </div>

                                  <div className="text-sm text-gray-600 truncate">{s.atleta?.nome}</div>
                                  <div className="text-xs text-gray-500">{formatarDataHora(s.criadoEm)}</div>

                                  {!!s.observacao && (
                                    <p className="mt-1 text-[13px] italic text-gray-700 leading-snug">“{s.observacao}”</p>
                                  )}
                                </div>
                              </div>

                              {!!midias.length && (
                                <div className="mt-3 sm:mt-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                                    {midias.map((src, idx) => {
                                      const isVid = isVideoUrl(src);
                                      return isVid ? (
                                        <div
                                          key={`${src}-${idx}`}
                                          className="relative w-full overflow-hidden rounded-lg bg-black border pt-[56.25%]"
                                        >
                                          <video
                                            src={src}
                                            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition"
                                            controls
                                            playsInline
                                            muted
                                            aria-label={`mídia ${idx + 1}`}
                                            preload="metadata"
                                          />
                                        </div>
                                      ) : (
                                        <a
                                          key={`${src}-${idx}`}
                                          href={src}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block group"
                                          title="Abrir imagem"
                                        >
                                          <div className="relative w-full overflow-hidden rounded-lg border bg-gray-50 pt-[56.25%]">
                                            <img
                                              src={src}
                                              alt={`mídia ${idx + 1}`}
                                              className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </div>
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      {submissoesPendentes.length < page.total && (
                        <div className="mt-3 flex justify-center">
                          <button
                            onClick={() => carregarSubmissoes(true)}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Carregar mais
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {abaProfessor === "criar" && (
                <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold">
                      {usuario.tipo === "admin" ? "Todos os Treinos" : "Treinos que você criou"}
                    </h3>
                    <button
                      className="bg-green-800 text-white px-4 py-2 rounded-lg"
                      onClick={() => navigate("/treinos/novo")}
                    >
                      Criar novo treino
                    </button>
                  </div>

                  {(usuario.tipo === "admin"
                    ? treinos
                    : treinos.filter(
                        (t) =>
                          t.professorId === usuario.tipoUsuarioId ||
                          t.escolinhaId === usuario.tipoUsuarioId ||
                          t.clubeId === usuario.tipoUsuarioId
                      )
                  ).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(usuario.tipo === "admin"
                        ? treinos
                        : treinos.filter(
                            (t) =>
                              t.professorId === usuario.tipoUsuarioId ||
                              t.escolinhaId === usuario.tipoUsuarioId ||
                              t.clubeId === usuario.tipoUsuarioId
                          )
                      ).map(renderTreinoCard)}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      {usuario.tipo === "admin" ? "Nenhum treino cadastrado." : "Você ainda não criou nenhum treino."}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          </>

      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.3)]">
        <Link href="/feed" className="hover:opacity-90" aria-label="Feed">
          <House />
        </Link>
        <Link href="/explorar" className="hover:opacity-90" aria-label="Explorar">
          <Search />
        </Link>
        <Link href="/post" className="hover:opacity-90" aria-label="Novo post">
          <CirclePlus />
        </Link>
        <Link href={isOlheiro ? "/olheiros" : "/treinos"} className="hover:opacity-90" aria-label="Treinos">
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:opacity-90" aria-label="Perfil">
          <User />
        </Link>
      </nav>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">Compartilhar Desafio</h2>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">Enviar por mensagem:</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {carregandoMutuos && <span className="text-sm text-gray-500">Carregando contatos...</span>}

                {!carregandoMutuos && usuariosMutuos.length === 0 && (
                  <span className="text-sm text-gray-500">Você ainda não tem contatos mútuos.</span>
                )}

                {usuariosMutuos.map((u) => {
                  const selecionado = selecionados.has(u.id);
                  const fotoSrc = u.foto ? resolveUploadUrl(u.foto) : PLACEHOLDER_USER;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelecionado(u.id)}
                      title={u.nome}
                      className={`relative shrink-0 rounded-full border-2 ${
                        selecionado ? "border-green-600" : "border-transparent"
                      }`}
                    >
                      <img
                        src={fotoSrc}
                        alt={u.nome}
                        className="w-14 h-14 rounded-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          (el as any).onerror = null;
                          el.src = PLACEHOLDER_USER;
                        }}
                      />
                      {selecionado && (
                        <span className="absolute -bottom-1 -right-1 bg-white rounded-full">
                          <CircleCheck className="w-5 h-5 text-green-600" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={selecionados.size === 0 || enviandoDM}
                onClick={enviarCompartilhamentoPorDM}
                className={`mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg 
                    ${
                      selecionados.size === 0 || enviandoDM
                        ? "bg-gray-300 text-gray-600"
                        : "bg-green-700 text-white hover:bg-green-800"
                    }`}
              >
                <Send className="w-4 h-4" />
                {enviandoDM ? "Enviando..." : `Enviar para ${selecionados.size} contato(s)`}
              </button>
            </div>

            <button
              onClick={() => setModalAberto(false)}
              className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl"
              aria-label="Fechar modal"
            >
              <CircleX />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
