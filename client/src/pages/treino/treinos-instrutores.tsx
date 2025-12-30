import React, { useMemo, useEffect, useState, useRef, type SVGProps } from "react";
import { Link, useLocation } from "wouter";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  Check,
  X,
} from "lucide-react";
import { API } from "../../config.js";
import HealthBanner from "../../components/legal/HealthBanner.js";
import BottomNav from "@/components/layout/BottomNav.js";

const Storage = {
  get token() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  },
  get tipoSalvo() {
    return localStorage.getItem("tipoUsuario") || sessionStorage.getItem("tipoUsuario") || "";
  },
  get usuarioId() {
    return localStorage.getItem("usuarioId") || sessionStorage.getItem("usuarioId") || "";
  },
  get tipoUsuarioId() {
    return localStorage.getItem("tipoUsuarioId") || sessionStorage.getItem("tipoUsuarioId") || "";
  },
  get plano() {
    return localStorage.getItem("plano") || sessionStorage.getItem("plano") || "";
  },
  get assinaturaPlano() {
    return localStorage.getItem("assinaturaPlano") || sessionStorage.getItem("assinaturaPlano") || "";
  },
};

interface ExercicioSessaoDetalhe {
  id: string;
  nome: string;
  repeticoes?: string;
  detalhes?: string;
  videoUrl?: string | null;
  concluido?: boolean;
}

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
  professoresIds?: string[];
  criadoresNomes?: string[];
  criadorTipo?: "professor" | "clube" | "escolinha" | "escola" | "admin" | "desconhecido";
}

interface UsuarioLogado {
  tipo:
    | "admin"
    | "atleta"
    | "escola"
    | "escolinha"
    | "clube"
    | "professor"
    | "olheiro";
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

interface AtletaVinculado {
  id: string;
  usuario: {
    id: string;
    nome: string;
    foto?: string | null;
  };
}

interface Turma {
  id: string;
  nome: string;
  atletaIds: string[];
  professorIds?: string[];
  professorNomes?: string[];
  professorNome?: string | null;
}

type SessaoDeHoje = {
  id: string;
  data?: string;
  treino?: any;
  turma?: any;
  status: "nao_iniciada" | "em_andamento" | "finalizada";
  startedAt?: string | null;
  finishedAt?: string | null;
  duracaoMinutosReal?: number | null;
  penalidadeAtraso?: boolean;
  exercicios: ExercicioSessaoDetalhe[];
};

function normTxt(s: any) {
  return String(s || "").trim().toLowerCase();
}

function explodeNomes(input: any): string[] {
  const arr = Array.isArray(input) ? input : [input];

  return arr
    .flatMap((v) =>
      String(v || "")
        .split(",")              
        .map((s) => s.trim())
        .filter(Boolean)
    );
}

function splitProfessorNome(raw?: string | null): string[] {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqNames(arr: string[]): string[] {
  const map = new Map<string, string>();
  for (const n of arr) {
    const clean = String(n || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!map.has(key)) map.set(key, clean);
  }
  return Array.from(map.values());
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
const PLACEHOLDER_USER = "/assets/usuarios/default-user.png";

function resolveUploadUrl(raw?: string | null): string | null {
  if (!raw) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("/assets/")) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) {
    return `${API.BASE_URL}${raw}`;
  }

  return raw;
}

function formatarData(data?: string) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "";
}
function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
}

function pickFirstId(obj: any, keys: string[]): string {
  for (const k of keys) {
    const val = obj?.[k];
    const id = pickId(val);
    if (id) return id;
  }
  return "";
}

function pickId(v: any): string {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : "";
}

function getOwnerIdsFromTreino(tr: any) {
  const clubeObj =
    tr?.clube ?? tr?.Clube ?? tr?.criador?.clube ?? tr?.criador?.Clube ?? null;

  const escolinhaObj =
    tr?.escolinha ?? tr?.Escolinha ?? tr?.criador?.escolinha ?? tr?.criador?.Escolinha ?? null;

  const professorObj =
    tr?.professor ?? tr?.Professor ?? tr?.criador?.professor ?? tr?.criador?.Professor ?? null;

  const clubeId =
    pickFirstId(tr, ["clubeId", "clube_id", "ClubeId"]) ||
    pickFirstId(clubeObj, ["id", "clubeId", "clube_id"]) ||
    pickFirstId(tr?.criador, ["clubeId", "clube_id"]);

  const escolinhaId =
    pickFirstId(tr, ["escolinhaId", "escolinha_id", "EscolinhaId"]) ||
    pickFirstId(escolinhaObj, ["id", "escolinhaId", "escolinha_id"]) ||
    pickFirstId(tr?.criador, ["escolinhaId", "escolinha_id"]);

  const professorId =
    pickFirstId(tr, ["professorId", "professor_id", "ProfessorId"]) ||
    pickFirstId(professorObj, ["id", "professorId", "professor_id", "usuarioId"]) ||
    pickFirstId(tr?.criador, ["professorId", "professor_id", "usuarioId"]);

  return { clubeId, escolinhaId, professorId };
}

function getTipoUsuarioIdFromMe(tipo: string, me: any): string {
  const t = String(tipo || "").toLowerCase();
  if (t === "clube") return pickId(me?.clube?.id) || pickId(me?.clubeId) || pickId(me?.tipoUsuarioId);
  if (t === "escolinha") return pickId(me?.escolinha?.id) || pickId(me?.escolinhaId) || pickId(me?.tipoUsuarioId);
  if (t === "professor") return pickId(me?.professor?.id) || pickId(me?.professorId) || pickId(me?.tipoUsuarioId);
  if (t === "atleta") return pickId(me?.atleta?.id) || pickId(me?.atletaId) || pickId(me?.tipoUsuarioId);
  if (t === "admin") return pickId(me?.admin?.id) || pickId(me?.adminId) || pickId(me?.tipoUsuarioId);
  return pickId(me?.tipoUsuarioId);
}

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

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

export default function TreinosInstrutores({
  tipo,
}: {
  tipo: UsuarioLogado["tipo"] | "";
}) {
  const [, navigate] = useLocation();

  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [abaProfessor, setAbaProfessor] = useState<"avaliar" | "criar" | "sessoes">("avaliar");
  const [meuNome, setMeuNome] = useState<string>("");
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [profNomeById, setProfNomeById] = useState<Record<string, string>>({});
  const [submissoesPendentes, setSubmissoesPendentes] = useState<
    SubmissaoParaValidacao[]
  >([]);
  const [carregandoSubmissoes, setCarregandoSubmissoes] = useState(false);
  const [page, setPage] = useState({ total: 0, limit: 20, offset: 0 });

  const [dataAgendarById, setDataAgendarById] = useState<Record<string, string>>(
    {},
  );
  const [obsById, setObsById] = useState<Record<string, string>>({});
  const [horaAgendarById, setHoraAgendarById] = useState<
    Record<string, string>
  >({});

  const [atletasVinculados, setAtletasVinculados] = useState<
    AtletaVinculado[]
  >([]);

  const [atletasSelecionadosByTreinoId, setAtletasSelecionadosByTreinoId] =
    useState<Record<string, string[]>>({});

  const [turmas, setTurmas] = useState<Turma[]>([]);

  const [turmaSelecionadaByTreinoId, setTurmaSelecionadaByTreinoId] =
    useState<Record<string, string>>({});

  const [sessoesDeHoje, setSessoesDeHoje] = useState<SessaoDeHoje[]>([]);
  const [sessaoAbertaExerciciosId, setSessaoAbertaExerciciosId] =
    useState<string | null>(null);
  const [sessaoEmRemarcacaoId, setSessaoEmRemarcacaoId] =
  useState<string | null>(null);

  const [remarcarDataBySessaoId, setRemarcarDataBySessaoId] =
    useState<Record<string, string>>({});

  const [remarcarHoraBySessaoId, setRemarcarHoraBySessaoId] =
    useState<Record<string, string>>({});

  const [videoModal, setVideoModal] = useState<{
    url: string;
    nome: string;
    repeticoes?: string;
  } | null>(null);

  const [exerciciosMarcadosBySessao, setExerciciosMarcadosBySessao] =
    useState<Record<string, string[]>>({});
  const [alunosDaSessao, setAlunosDaSessao] = useState<AtletaVinculado[]>([]);
  const [modalSessaoId, setModalSessaoId] = useState<string | null>(null);
  const [presentesSelecionados, setPresentesSelecionados] = useState<string[]>([]);
  const [clockNow, setClockNow] = useState<number>(Date.now());
  const [professoresVinculadosIds, setProfessoresVinculadosIds] = useState<string[]>([]);
  const [professoresVinculadosNomeById, setProfessoresVinculadosNomeById] = useState<Record<string, string>>({});
  const [realizadoCountByTreinoId, setRealizadoCountByTreinoId] = useState<Record<string, number>>({});
  const [exerciciosCountByTreinoId, setExerciciosCountByTreinoId] = useState<Record<string, number>>({});

  const [videoByExId, setVideoByExId] = useState<Record<string, string>>({});
  const startedAtRef = useRef<string | null>(null);
  const debugOnceRef = useRef(false);

  const turmaById = useMemo(() => {
    const map: Record<string, Turma> = {};
     for (const t of turmas) map[String(t.id)] = t;
      return map;
  }, [turmas]);

  useEffect(() => {
  const token = getToken();
  if (!token) return;

  (async () => {
    const res = await fetch(`${API.BASE_URL}/api/exercicios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    const list = Array.isArray(data) ? data : data.items ?? data.data ?? [];

    const map: Record<string, string> = {};
    for (const e of list) {
      const v = e.videoDemonstrativoUrl ?? e.videoUrl ?? e.video ?? null;
      if (e.id && v) map[String(e.id)] = String(v);
    }
    setVideoByExId(map);
  })();
}, []);

useEffect(() => {
  const token = getToken();
  if (!token) return;

  (async () => {
    try {
      const res = await fetch(`${API.BASE_URL}/api/professores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data) ? data : data.items ?? data.data ?? [];

      const map: Record<string, string> = {};

      for (const p of list) {
        const professorId = String(p?.id ?? "").trim();
        const usuarioId = String(p?.usuarioId ?? p?.usuario?.id ?? "").trim();

        const nome =
          p?.usuario?.nome ||
          p?.nome ||
          p?.usuario?.nomeCompleto ||
          "";

        const nomeLimpo = String(nome || "").trim();
        if (!nomeLimpo) continue;

        if (professorId) map[professorId] = nomeLimpo;
        if (usuarioId) map[usuarioId] = nomeLimpo;
      }

      setProfNomeById(map);
    } catch (e) {
      console.warn("[treinos] falha ao carregar /api/professores", e);
    }
  })();
}, []);

useEffect(() => {
  const token = getToken();
  if (!token) return;

  const tipoUser = String(usuario?.tipo ?? "").toLowerCase();
  const tipoUsuarioId = String(usuario?.tipoUsuarioId ?? "").trim();

  if (!tipoUsuarioId) return;

  if (tipoUser !== "clube" && tipoUser !== "escolinha") {
    setProfessoresVinculadosIds([]);
    setProfessoresVinculadosNomeById({});
    return;
  }

  (async () => {
    try {
      const res = await fetch(
        `${API.BASE_URL}/api/professores/vinculados?tipo=${encodeURIComponent(tipoUser)}&tipoUsuarioId=${encodeURIComponent(tipoUsuarioId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const txt = await res.text().catch(() => "");
      
      if (!res.ok) {
        setProfessoresVinculadosIds([]);
        setProfessoresVinculadosNomeById({});
        return;
      }

      const data = txt ? JSON.parse(txt) : [];

      const list = Array.isArray(data) ? data : data.items ?? data.data ?? [];

      const ids: string[] = [];
      const nomeById: Record<string, string> = {};

      for (const p of list) {
        const id =
          String(
            p?.professorId ??
            p?.professor?.id ??
            p?.id ??
            ""
          ).trim();

        if (!id) continue;

        const nome =
          String(
            p?.professor?.usuario?.nome ??
            p?.professor?.nome ??
            p?.usuario?.nome ??
            p?.nome ??
            ""
          ).trim();

        ids.push(id);
        if (nome) nomeById[id] = nome;
      }

      setProfessoresVinculadosIds(Array.from(new Set(ids)));
      setProfessoresVinculadosNomeById(nomeById);
    } catch (e) {
      console.warn("[treinos] erro ao carregar professores vinculados", e);
      setProfessoresVinculadosIds([]);
      setProfessoresVinculadosNomeById({});
    }
  })();
}, [usuario?.tipo, usuario?.tipoUsuarioId]);

  useEffect(() => {
    const id = setInterval(() => {
      setClockNow(Date.now());
    }, 1000); 

    return () => clearInterval(id);
  }, []);

  async function buscarAlunosDaTurma(turmaId: string): Promise<AtletaVinculado[]> {
    const token = getToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/turmas/${encodeURIComponent(turmaId)}/alunos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        console.warn("[treinos] rota /turmas/:id/alunos não retornou alunos com atletaId");
        return [];
      }

      const data = await res.json();
      
      if (Array.isArray((data as any).alunos)) {
        const raw = (data as any).alunos;

      const alunos: AtletaVinculado[] = raw
        .map((a: any) => {
          const usuarioId = a.usuario?.id ?? a.usuarioId ?? "";
          const atletaId  = a.atletaId ?? a.id ?? null;

          const id = atletaId || "";

          if (!id) return null;

          const nome = a.usuario?.nome ?? a.nome ?? "Atleta";
          const foto = a.usuario?.foto ?? a.foto ?? null;

          return {
            id, 
            usuario: { id: usuarioId || id, nome, foto },
          };
        })
        .filter((a: any) => !!a);

      return alunos;
      }

      console.warn("[treinos] backend não retornou alunos com atletaId. Ajuste /api/turmas/:id/alunos para retornar alunos[].atletaId");
      return [];

    } catch (e) {
      console.error("[treinos] erro ao buscar alunos da turma", turmaId, e);
      return [];
    }
  }

 async function finalizarTreinoSessao(sessaoId: string) {
  const token = getToken();

  const sessao = sessoesDeHoje.find((x: any) => x.id === sessaoId);

  let tempoSeg = 0;

  if (sessao?.startedAt) {
    const inicioMs = new Date(sessao.startedAt).getTime();
    tempoSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));
  } else if (startedAtRef.current) {
    const inicioMs = new Date(startedAtRef.current).getTime();
    tempoSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));
  }

  const res = await fetch(
    `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(sessaoId)}/finalizar`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const js = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(js?.erro || js?.message || "Erro ao finalizar treino.");
    return;
  }

  const pontos = encodeURIComponent(String(js?.pontosAplicadosPorAtleta ?? 0));
  const tempo = encodeURIComponent(String(tempoSeg));

  window.location.href =
    `/submissao?sessaoId=${encodeURIComponent(sessaoId)}` +
    `&pontos=${pontos}` +
    `&tempoSeg=${tempo}`;
}

  async function abrirModalIniciar(sessaoId: string, turmaId?: string) {
  const token = getToken();
  if (!token) return;

  try {
    let alunos: AtletaVinculado[] = [];

    if (turmaId) {
      alunos = await buscarAlunosDaTurma(turmaId);
    } else {
      const res = await fetch(
        `${API.BASE_URL}/api/sessoes-turma/${sessaoId}/alunos`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        console.warn(
          "[treinos] falha ao buscar alunos da sessão",
          sessaoId,
          res.status,
        );
      } else {
        const data = await res.json();
        const arr = Array.isArray(data.alunos) ? data.alunos : data;
        alunos = (Array.isArray(arr) ? arr : [])
        .map((a: any) => {
          const atletaId = a.atletaId ?? a.id ?? "";
          if (!atletaId) return null;

          const usuarioId = a.usuario?.id ?? a.usuarioId ?? "";
          const nome = a.usuario?.nome ?? a.nome ?? "Atleta";
          const foto = a.usuario?.foto ?? a.foto ?? null;

          return {
            id: String(atletaId),              
            usuario: { id: String(usuarioId || atletaId), nome, foto },
          };
        })
        .filter(Boolean) as AtletaVinculado[];

      }
    }

    setAlunosDaSessao(alunos);
    setPresentesSelecionados(alunos.map((a) => a.id));
    setModalSessaoId(sessaoId);

  } catch (e) {
    console.error("[treinos] erro ao abrir modal de presença:", e);
    setAlunosDaSessao([]);
    setPresentesSelecionados([]);
    setModalSessaoId(sessaoId);
  }
}

  async function confirmarPresencas() {
  const token = getToken();
  if (!token || !modalSessaoId) return;

  const sessaoId = modalSessaoId;

  try {
    const res = await fetch(
      `${API.BASE_URL}/api/sessoes-turma/${sessaoId}/iniciar`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          presentes: presentesSelecionados,
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[treinos] erro ao iniciar sessão:", res.status, txt);
      alert("Não foi possível iniciar esse treino.");
      return;
    }

    const js = await res.json().catch(() => ({}));

    startedAtRef.current = js?.startedAt ?? new Date().toISOString();
    
    setModalSessaoId(null);
    setSessaoAbertaExerciciosId(sessaoId);
    await carregarSessoesDeHoje();
  } catch (e) {
    console.error("[treinos] erro ao confirmar presenças:", e);
    alert("Erro inesperado ao iniciar o treino.");
  }
}

function extrairExerciciosSessao(s: any): ExercicioSessaoDetalhe[] {
  let list: any[] = Array.isArray(s.exercicios) ? s.exercicios : [];

  if (!list.length && Array.isArray(s.treino?.exercicios)) {
    list = s.treino.exercicios;
  }

  return list
   .map((item: any, idx: number) => {
    const ex =
      item.exercicio ||
      item.exercicioTemporario ||
      item.exercicioRef ||
      item.Exercicio ||
      item.treinoExercicio?.exercicio ||
      item.treinoProgramadoExercicio?.exercicio ||
      item;

    const nome =
      ex?.nome ||
      item?.nome ||
      item?.exercicioNome ||
      item?.titulo ||
      "Exercício";

    const detalhes =
      ex?.descricao ||
      ex?.detalhes ||
      item?.descricao ||
      item?.detalhes ||
      "";

    const safeId =
      item.id ||
      item.exercicioId ||
      item.exercicioTemporarioId ||
      item.treinoExercicio?.exercicioId ||
      item.treinoProgramadoExercicio?.exercicioId ||
      ex?.id ||
      `${s.id || "sessao"}-ex-${idx}`;

    const midias = Array.isArray(s.midias) ? s.midias : [];

    const videoMidia = midias.find((m: any) => {
      const tipoStr = String(m.tipo || m.tipoMidia || "").toUpperCase();
      return tipoStr.includes("VIDEO") || tipoStr.includes("VÍDEO");
    });

    const exId = String(ex?.id ?? item?.exercicioId ?? item?.id ?? "");
const videoUrlRaw =
  ex?.videoDemonstrativoUrl ||
  item?.exercicio?.videoDemonstrativoUrl ||
  item?.exercicioTemporario?.videoDemonstrativoUrl ||
  item?.videoDemonstrativoUrl ||
  (exId ? videoByExId[exId] : null) ||
  null;

  const videoUrl = videoUrlRaw ? String(videoUrlRaw) : null;
      const repRaw =
        item.repeticoes ||
        item.repeticao ||
        item.repsTexto ||
        item.treinoExercicio?.repeticoes ||
        item.treinoProgramadoExercicio?.repeticoes ||
        ex.repeticoes ||
        ex.repeticoesTexto ||
        ex.seriesRepeticoes ||
        "";

      const series =
        item.series ??
        item.qtdSeries ??
        ex.series ??
        ex.qtdSeries ??
        null;

      const reps =
        item.reps ??
        item.qtdRepeticoes ??
        ex.reps ??
        ex.qtdRepeticoes ??
        null;

      const tempoSeg =
        item.tempoSegundos ??
        item.tempo ??
        item.duracaoSegundos ??
        ex.tempoSegundos ??
        ex.tempo ??
        ex.duracaoSegundos ??
        null;

      const descansoSeg =
        item.descansoSegundos ??
        ex.descansoSegundos ??
        null;

      let repeticoes = "";
      const repText = String(repRaw || "").trim();

      const temFormatoRich = /x|seg|s\b|min|rep|descanso|,/i.test(repText);

      if (
        repText &&
        (
          temFormatoRich || 
          (!series && !reps && !tempoSeg && !descansoSeg) 
        )
      ) {
        repeticoes = repText;
      } else {
        const partes: string[] = [];

        if (series != null && tempoSeg != null) {
          partes.push(`${series}x ${tempoSeg}s`);
        } else if (series != null && reps != null) {
          partes.push(`${series}x ${reps} reps`);
        } else if (series != null) {
          partes.push(`${series} séries`);
        } else if (reps != null) {
          partes.push(`${reps} reps`);
        } else if (tempoSeg != null) {
          partes.push(`${tempoSeg}s`);
        }

        if (descansoSeg != null) {
          partes.push(`+ ${descansoSeg}s descanso`);
        }

        repeticoes = partes.join(" ");
      }
      
      return {
        id: String(safeId),
        nome,
        repeticoes: repeticoes || undefined,
        detalhes,
        videoUrl,
        concluido: Boolean(item.concluido),
      };
    })
    .filter((e) => e.id);
}

 async function carregarSessoesDeHoje() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API.BASE_URL}/api/sessoes-turma/minhas`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Falha ao buscar sessões");

    const data = await res.json();

    const norm = (Array.isArray(data) ? data : []).map((s: any) => {
      const statusRaw = String(s.status ?? "")
        .trim()
        .toUpperCase();

      let status: "nao_iniciada" | "em_andamento" | "finalizada";

      switch (statusRaw) {
        case "EM_ANDAMENTO":
          status = "em_andamento";
          break;

        case "FINALIZADO":
          status = "finalizada";
          break;

        case "AGENDADO":
        case "CANCELADO":
        default:
          status = "nao_iniciada";
          break;
      }
      const exercicios = extrairExerciciosSessao(s);

      return {
        id: s.id,
        data: s.data,
        treino: s.treino ?? null,
        turma: s.turma ?? null,
        status,
        startedAt: s.startedAt ?? null,
        finishedAt: s.finishedAt ?? null,
        duracaoMinutosReal: s.duracaoMinutosReal ?? null,
        penalidadeAtraso: Boolean(s.penalidadeAtraso),
        exercicios,
      };
    });

    setSessoesDeHoje(norm);
    setExerciciosMarcadosBySessao((prev) => {
      const next: Record<string, string[]> = { ...prev };
      norm.forEach((sessao) => {
        const marcados =
          sessao.exercicios
            ?.filter((e: ExercicioSessaoDetalhe) => e.concluido)
            .map((e: ExercicioSessaoDetalhe) => e.id) ?? [];
        if (marcados.length) {
          next[sessao.id] = marcados;
        }
      });
      return next;
    });
  } catch (e) {
    console.error("Erro ao carregar sessões:", e);
  }
}

async function remarcarSessao(
  sessaoId: string,
  dataISO: string,
  hora?: string,
) {
  const token = getToken();
  if (!token) return;

  if (!dataISO) {
    alert("Escolha uma data para remarcar o treino.");
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diaSelecionado = new Date(`${dataISO}T00:00:00`);
  if (diaSelecionado < hoje) {
    alert("Você não pode remarcar um treino para uma data que já passou.");
    return;
  }

  let novaDataISO: string;
  if (hora && /^\d{2}:\d{2}$/.test(hora)) {
    const [h, m] = hora.split(":").map(Number);
    const d = new Date(diaSelecionado);
    d.setHours(h, m, 0, 0);
    novaDataISO = d.toISOString();
  } else {
    novaDataISO = `${dataISO}T12:00:00.000Z`;
  }

  try {
    const res = await fetch(
      `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(
        sessaoId,
      )}/remarcar`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ novaDataISO }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[treinos] erro ao remarcar sessão:", res.status, txt);
      alert("Não foi possível remarcar esse treino.");
      return;
    }

    alert("Treino remarcado com sucesso!");

    setSessaoEmRemarcacaoId(null);
    await carregarSessoesDeHoje();
  } catch (e) {
    console.error("[treinos] erro inesperado ao remarcar sessão:", e);
    alert("Erro inesperado ao remarcar o treino.");
  }
}

async function excluirSessao(sessaoId: string) {
  const token = getToken();
  if (!token) return;

  if (!window.confirm("Tem certeza que deseja excluir esse treino da sua agenda?")) {
    return;
  }

  try {
    const res = await fetch(
      `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(sessaoId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[treinos] erro ao excluir sessão:", res.status, txt);
      alert("Não foi possível excluir esse treino.");
      return;
    }

    setSessoesDeHoje((prev) => prev.filter((s) => s.id !== sessaoId));
    setSessaoAbertaExerciciosId((prev) => (prev === sessaoId ? null : prev));

    alert("Treino removido da sua agenda.");

  } catch (e) {
    console.error("[treinos] erro inesperado ao excluir sessão:", e);
    alert("Erro inesperado ao excluir o treino.");
  }
}

async function salvarProgressoSessao(sessaoId: string) {
  const token = getToken();
  if (!token) return;

  const ids = exerciciosMarcadosBySessao[sessaoId] ?? [];

  try {
    await fetch(
      `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(
        sessaoId,
      )}/progresso`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exerciciosConcluidosIds: ids }),
      },
    );
  } catch (e) {
    console.error("Erro ao salvar progresso da sessão:", e);
  }
}

  useEffect(() => {
    const tipoSalvo =
      (Storage as any).tipoSalvo ??
      (Storage as any).tipoUsuario ??
      (Storage as any).tipo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario");

    const usuarioId =
      (Storage as any).usuarioId ?? localStorage.getItem("usuarioId");
    const tipoUsuarioId =
      (Storage as any).tipoUsuarioId ??
      localStorage.getItem("tipoUsuarioId") ??
      "";

    const t = String(tipoSalvo || "").toLowerCase() as UsuarioLogado["tipo"];
    if (
      [
        "admin",
        "atleta",
        "escola",
        "escolinha",
        "clube",
        "professor",
        "olheiro",
      ].includes(t) &&
      usuarioId
    ) {
      setUsuario({ tipo: t, usuarioId, tipoUsuarioId });
      (async () => {
        const token = getToken();
        if (!token) return;

        try {
          const r = await fetch(`${API.BASE_URL}/api/perfil/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) return;

          const me = await r.json().catch(() => ({}));

          const nome =
            me?.usuario?.nome ||
            me?.nome ||
            me?.professor?.usuario?.nome ||
            me?.professor?.nome ||
            me?.clube?.nome ||
            me?.escolinha?.nome ||
            "";

          setMeuNome(String(nome || "").trim());

          const tipoIdReal = getTipoUsuarioIdFromMe(t, me);

          if (tipoIdReal) {
            setUsuario((prev) =>
              prev ? { ...prev, tipoUsuarioId: tipoIdReal } : { tipo: t, usuarioId, tipoUsuarioId: tipoIdReal },
            );

            localStorage.setItem("tipoUsuarioId", tipoIdReal);
            sessionStorage.setItem("tipoUsuarioId", tipoIdReal);
          }
        } catch {}
      })();

    } else {
      console.warn("Tipo/IDs inválidos", { tipoSalvo, usuarioId, tipoUsuarioId });
    }
  }, []);

  const meusTreinos = treinos.filter((t) => {
    const meuId = String(usuario?.tipoUsuarioId ?? "").trim();
    const meuTipo = String(usuario?.tipo ?? "").toLowerCase();

    const donoId = {
      clubeId: String(t.clubeId ?? "").trim(),
      escolinhaId: String(t.escolinhaId ?? "").trim(),
      professorId: String(t.professorId ?? "").trim(),
    };

    const euSouDono =
      (!!meuId && (donoId.clubeId === meuId || donoId.escolinhaId === meuId || donoId.professorId === meuId));

    const euSouColaborador =
      Array.isArray(t.professoresIds) &&
      !!meuId &&
      t.professoresIds.map(String).includes(meuId);

    const treinoDoMeuProfessorVinculado =
      (meuTipo === "clube" || meuTipo === "escolinha") &&
      !!donoId.professorId &&
      professoresVinculadosIds.map(String).includes(donoId.professorId);

    const fallbackPorNome =
      !!meuNome &&
      Array.isArray(t.criadoresNomes) &&
      t.criadoresNomes.some((n) => normTxt(n) === normTxt(meuNome));

    return euSouDono || euSouColaborador || treinoDoMeuProfessorVinculado || fallbackPorNome;
  });

  const listaParaExibir =
    usuario?.tipo === "admin"
      ? treinos
      : (meusTreinos.length ? meusTreinos : treinos); 

  const totalTreinosExibidos = useMemo(() => listaParaExibir.length, [listaParaExibir]);

  const totalExerciciosExibidos = useMemo(() => {
    return (listaParaExibir || []).reduce((acc, t) => {
      const n = Number(exerciciosCountByTreinoId[t.id] ?? t.exercicios?.length ?? 0);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [listaParaExibir, exerciciosCountByTreinoId]);

  const usuarioReady = useMemo(() => {
    const tipoOk = String(usuario?.tipo ?? tipo ?? "").trim().toLowerCase();
    const idOk = String(usuario?.tipoUsuarioId ?? "").trim();
    return { tipoOk, idOk, ready: !!tipoOk && !!idOk };
  }, [usuario?.tipo, usuario?.tipoUsuarioId, tipo]);

  useEffect(() => {
  const token = getToken();
  if (!token) return;

  if (!usuarioReady.ready) return;

  const t = usuarioReady.tipoOk;

  const run = async () => {
    try {
      const resTreinos = await fetch(`${API.BASE_URL}/api/treinos/programados`, {
        headers: { Authorization: `Bearer ${token}` },
      });


      if (!resTreinos.ok) {
        throw new Error(`/treinos/programados: ${resTreinos.status}`);
      }

      const jsonTreinos = await resTreinos.json();

      const arr = Array.isArray(jsonTreinos)
        ? jsonTreinos
        : (jsonTreinos?.items ?? jsonTreinos?.data ?? []);

      const normTreinos: TreinoProgramado[] = (Array.isArray(arr) ? arr : []).map((tr: any) => {
        const ids = getOwnerIdsFromTreino(tr);

        const criadorNomePrincipal =
        tr?.professor?.usuario?.nome ||
        tr?.professor?.nome ||
        (tr?.professorId ? profNomeById[String(tr.professorId)] : undefined) ||
        tr?.criador?.nome ||
        tr?.criadorNome ||
        tr?.clube?.nome ||
        tr?.escolinha?.nome ||
        tr?.escola?.nome ||
        undefined;

      const criadorTipoRaw = String(tr?.criadorTipo ?? tr?.creatorType ?? tr?.criador?.tipo ?? "").toLowerCase();

      const criadorTipo: TreinoProgramado["criadorTipo"] =
        ids.professorId ? "professor"
        : ids.clubeId ? "clube"
        : ids.escolinhaId ? "escolinha"
        : criadorTipoRaw === "professor" ? "professor"
        : criadorTipoRaw === "clube" ? "clube"
        : criadorTipoRaw === "escolinha" ? "escolinha"
        : criadorTipoRaw === "escola" ? "escola"
        : criadorTipoRaw === "admin" ? "admin"
        : "desconhecido";

      const colaboradoresRaw =
        tr?.professores ||
        tr?.colaboradores ||
        tr?.professoresTreino ||
        tr?.treinosParticipando ||        
        tr?.treinosParticipandoProfessor ||
        tr?.professoresIds ||
        [];

      const professoresIds: string[] = Array.from(
        new Set(
          (Array.isArray(colaboradoresRaw) ? colaboradoresRaw : [])
            .map((p: any) =>
              String(
                p?.professorId ??
                p?.professor?.id ??
                p?.participanteId ??      
                p?.userId ??
                p?.id ??
                p ??
                "",
              ).trim(),
            )
            .filter(Boolean),
        ),
      );

      const nomesFromIds = professoresIds
        .map((id) => profNomeById[String(id)])
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      const colaboradoresNomes: string[] = Array.from(
        new Set(
          [
            ...(Array.isArray(colaboradoresRaw) ? colaboradoresRaw : [])
              .map((p: any) =>
                p?.usuario?.nome ??
                p?.nome ??
                p?.professor?.usuario?.nome ??
                p?.professor?.nome ??
                "",
              )
              .map((x: any) => String(x || "").trim())
              .filter(Boolean),
            ...nomesFromIds,
          ]
            .map((x) => String(x || "").trim())
            .filter(Boolean),
        ),
      );

      const meuTipoUsuarioId = usuarioReady.idOk;
      const souDono =
        String(ids.professorId ?? "") === meuTipoUsuarioId ||
        String(ids.escolinhaId ?? "") === meuTipoUsuarioId ||
        String(ids.clubeId ?? "") === meuTipoUsuarioId;

      const souColaborador = professoresIds.includes(meuTipoUsuarioId);
      const incluirMeuNome = Boolean(meuNome) && (souDono || souColaborador);
      const normalizarNome = (s: any) => String(s || "").trim().toLowerCase();

      const listaBruta = [
        criadorNomePrincipal,
        ...(incluirMeuNome ? [meuNome] : []),
        ...colaboradoresNomes,
      ]
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      const criadoresNomes = Array.from(
        new Map(listaBruta.map((n) => [normalizarNome(n), n])).values(),
      );

      return {
        id: String(tr.id),
        nome: String(tr.nome ?? ""),
        descricao: tr.descricao ?? undefined,
        nivel: String(tr.nivel ?? ""),
        dataAgendada: tr.dataAgendada ?? undefined,
        duracao: typeof tr.duracao === "number" ? tr.duracao : undefined,
        objetivo: tr.objetivo ?? undefined,
        dicas: Array.isArray(tr.dicas) ? tr.dicas : [],
        professorId: ids.professorId || pickId(tr?.criadorProfessorId) || undefined,
        escolinhaId: ids.escolinhaId || undefined,
        clubeId: ids.clubeId || undefined,
        pontuacao: typeof tr.pontuacao === "number" ? tr.pontuacao : undefined,
        professoresIds,
        criadoresNomes,
        criadorTipo,
        exercicios: (Array.isArray(tr.exercicios) ? tr.exercicios : []).map((ex: any) => ({
          id: String(ex?.exercicio?.id ?? ex?.id ?? ""),
          nome: String(ex?.exercicio?.nome ?? ex?.nome ?? ""),
          repeticoes: ex?.repeticoes ?? undefined,
        })),
      };
    });

    const meuId = usuarioReady.idOk;
    const meuTipo = usuarioReady.tipoOk;
    const matchCount = normTreinos.filter((t) => {
      const dono = [t.clubeId, t.escolinhaId, t.professorId].map((x) => String(x ?? "").trim());
      const souDono = meuId && dono.includes(meuId);
      const souColab = Array.isArray(t.professoresIds) && meuId && t.professoresIds.map(String).includes(meuId);
      const profVinc = (meuTipo === "clube" || meuTipo === "escolinha") && t.professorId && professoresVinculadosIds.map(String).includes(String(t.professorId));

      const fallbackPorNome =
        !!meuNome &&
        Array.isArray(t.criadoresNomes) &&
        t.criadoresNomes.some((n) => normTxt(n) === normTxt(meuNome));

      return souDono || souColab || profVinc || fallbackPorNome;
    }).length;

    setTreinos(normTreinos);
    // ✅ buscar stats (realizado X vezes + count exercicios) em lote
    try {
      const ids = normTreinos.map((t) => t.id).filter(Boolean);
      if (ids.length) {
        const statsRes = await fetch(
          `${API.BASE_URL}/api/treinos/programados/stats?ids=${encodeURIComponent(ids.join(","))}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (statsRes.ok) {
          const statsJson = await statsRes.json().catch(() => ({}));
          setRealizadoCountByTreinoId(statsJson?.realizadoCountByTreinoId ?? {});
          setExerciciosCountByTreinoId(statsJson?.exerciciosCountByTreinoId ?? {});
        } else {
          setRealizadoCountByTreinoId({});
          setExerciciosCountByTreinoId({});
        }
      } else {
        setRealizadoCountByTreinoId({});
        setExerciciosCountByTreinoId({});
      }
    } catch (e) {
      console.warn("[treinos] falha ao carregar stats", e);
      setRealizadoCountByTreinoId({});
      setExerciciosCountByTreinoId({});
    }

    } catch (e) {
      console.error(e);
      setTreinos([]);
    }

    if (
      ["professor", "admin", "escola", "escolinha", "clube"].includes(t) &&
      (usuario?.tipoUsuarioId ||
        (Storage as any).tipoUsuarioId ||
        (Storage as any).professorId)
    ) {
      carregarSubmissoes();
      carregarAtletasVinculados();
      carregarTurmas();
    }
  };

  run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  usuarioReady.ready,
  usuarioReady.idOk,
  usuarioReady.tipoOk,
  meuNome,
  profNomeById,
  professoresVinculadosIds,
] );

  useEffect(() => {
    if (abaProfessor === "sessoes") {
      carregarSessoesDeHoje();
    }
  }, [abaProfessor]);

  async function carregarAtletasVinculados() {
    const token = getToken();
    if (!token) return;

    const tipoUsuarioIdRaw =
      (Storage as any).tipoUsuarioId ||
      (Storage as any).professorId ||
      usuario?.tipoUsuarioId ||
      "";

    if (!tipoUsuarioIdRaw) {
      console.warn("[treinos] sem tipoUsuarioId para carregar atletas vinculados");
      return;
    }

    try {
      const url = `${API.BASE_URL}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`/treinos/atletas-vinculados: ${res.status}`);
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? [];
      const norm: AtletaVinculado[] = items.map((a: any) => ({
        id: a.id,
        usuario: {
          id: a.usuario?.id ?? a.usuarioId ?? "",
          nome: a.usuario?.nome ?? a.nome ?? "Atleta",
          foto: a.usuario?.foto ?? a.foto ?? null,
        },
      }));

      setAtletasVinculados(norm);
    } catch (e) {
      console.error(e);
      setAtletasVinculados([]);
    }
  }

  async function carregarTurmas() {
    const token = getToken();
    if (!token) return;

    const tipoUsuarioIdRaw =
      (Storage as any).tipoUsuarioId ||
      (Storage as any).professorId ||
      usuario?.tipoUsuarioId ||
      "";

    if (!tipoUsuarioIdRaw) {
      console.warn("[treinos] sem tipoUsuarioId para carregar turmas");
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const urls = [
      `${API.BASE_URL}/api/turmas/minhas?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
      `${API.BASE_URL}/api/treinos/elencos?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
      `${API.BASE_URL}/api/elencos?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
      `${API.BASE_URL}/api/turmas?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          console.warn("[treinos] falha ao buscar turmas em", url, res.status);
          if (res.status >= 500) throw new Error(String(res.status));
          continue;
        }

        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items ?? [];

        const norm: Turma[] = items.map((t: any) => {
        const nome = t.nome || t.titulo || "Turma";

        const professorNomeSingular = String(t.professorNome ?? t.professor ?? "").trim();

        const idsRaw =
          t.professorIds ??
          t.professoresIds ??
          t.professoresIdsDaTurma ??
          (Array.isArray(t.professores) ? t.professores.map((p: any) => p?.id ?? p?.professorId) : null) ??
          (Array.isArray(t.professoresTurma)
            ? t.professoresTurma.map((p: any) =>
                p?.professorId ??
                p?.professor?.id ??
                p?.Professor?.id ??
                ""
              )
            : null) ??
          [];

        const professorIds = Array.from(
          new Set((Array.isArray(idsRaw) ? idsRaw : []).map((x: any) => String(x || "")).filter(Boolean))
        );

        const nomesRaw =
          t.professorNomes ??
          t.professoresNomes ??
          (Array.isArray(t.professores)
            ? t.professores.map((p: any) => p?.nome ?? p?.usuario?.nome)
            : null) ??
          (Array.isArray(t.professoresTurma)
            ? t.professoresTurma.map((p: any) =>
                p?.professor?.usuario?.nome ??
                p?.professor?.nome ??
                p?.usuario?.nome ??
                p?.nome ??
                ""
              )
            : null) ??
          [];

        const professorNomesDireto = (Array.isArray(nomesRaw) ? nomesRaw : [])
          .map((x: any) => String(x || "").trim())
          .filter(Boolean);

        const nomesFromIds = professorIds
          .map((id) => profNomeById[String(id)])
          .map((x) => String(x || "").trim())
          .filter(Boolean);

        const professorNomes = Array.from(
          new Set([professorNomeSingular, ...professorNomesDireto, ...nomesFromIds].filter(Boolean))
        );

        const atletaIds = Array.from(
          new Set(
            (Array.isArray(t.atletaIds) ? t.atletaIds : [])
              .map((x: any) => String(x || "").trim())
              .filter(Boolean)
          )
        );

        return {
          id: String(t.id),
          nome: String(nome),
          atletaIds,
          professorIds,
          professorNomes,
          professorNome: professorNomes.join(", ") || professorNomeSingular || null,
        };

      });

      setTurmas(norm);
      return;

      } catch (e) {
        console.error("[treinos] erro ao carregar turmas de", url, e);
      }
    }

    setTurmas([]);
  }

  async function carregarSubmissoes(append = false) {
    const token = getToken();
    if (!token || !usuario) return;

    const limit = page.limit;
    const offset = append ? page.offset + page.limit : 0;

    setCarregandoSubmissoes(true);
    try {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/submissoes?tipoUsuarioId=${
          usuario.tipoUsuarioId
        }&status=pendente&limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Falha /treinos/submissoes: ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? [];

      setSubmissoesPendentes((prev) => (append ? [...prev, ...items] : items));
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

  async function validarSubmissao(
    id: string,
    aprovado: boolean,
    pontosSug?: number,
  ) {
    const token = getToken();
    if (!token || !usuario) return;

    let pontos = 0;
    if (aprovado) {
      const inp = prompt(
        "Pontos a creditar para este treino:",
        String(pontosSug ?? 0),
      );
      if (inp === null) return;
      const n = Number(inp);
      pontos = Number.isFinite(n) && n >= 0 ? n : 0;
    }

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/submissoes/${id}/validar?tipoUsuarioId=${usuario.tipoUsuarioId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ aprovado, pontos }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao validar:", res.status, txt);
        return alert("Não foi possível validar a submissão.");
      }
      setSubmissoesPendentes((prev) => prev.filter((s) => s.id !== id));
      alert(
        aprovado
          ? "Submissão aprovada e pontos creditados!"
          : "Submissão reprovada.",
      );
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao validar.");
    }
  }
  const aprovar = (id: string, pontos?: number) =>
    validarSubmissao(id, true, pontos);
  const reprovar = (id: string) => validarSubmissao(id, false, 0);

  async function obterAtletaIdsDaTurma(turmaId: string): Promise<string[]> {
    const token = getToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/turmas/${encodeURIComponent(turmaId)}/alunos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        console.warn(
          "[treinos] falha ao buscar alunos da turma",
          turmaId,
          res.status,
        );
        return [];
      }

      const data = await res.json();
      
      let ids: string[] = [];

      if (Array.isArray((data as any).alunos)) {
        ids = (data as any).alunos
          .map((a: any) => String(a.atletaId ?? ""))
          .filter(Boolean);
      }
      else if (Array.isArray((data as any).atletaIds)) {
        ids = (data as any).atletaIds.map(String);
      }
      else if (Array.isArray((data as any).usuarioIds)) {
        console.warn("[treinos] /turmas/:id/alunos retornou usuarioIds. Precisa retornar atletaIds/alunos[].atletaId.");
        return [];
      }

      ids = Array.from(new Set(ids));

      return ids;
    } catch (e) {
      console.error("[treinos] erro ao obter atletas da turma", turmaId, e);
      return [];
    }
  }

  async function agendarTreinoProgramado(
    treino: TreinoProgramado,
    dataSelecionadaISO: string,
    horaSelecionada?: string,
    observacao?: string,
  ) {
    const token = getToken();
    if (!token) {
      alert("Faça login para agendar um treino.");
      return;
    }

    const tipoUser = String(
      usuario?.tipo ?? (Storage as any).tipoSalvo ?? "",
    ).toLowerCase();

    let atletaIdsParaAgendar: string[] = [];

    if (tipoUser === "atleta") {
      const atletaId =
        (Storage as any).tipoUsuarioId ||
        (Storage as any).atletaId ||
        usuario?.tipoUsuarioId;

      if (!atletaId) {
        alert(
          "Não foi possível identificar o atleta logado. Tente entrar novamente.",
        );
        return;
      }

      atletaIdsParaAgendar = [atletaId];
        } else {
      const turmaIdSelecionada = turmaSelecionadaByTreinoId[treino.id] || "";

      if (turmaIdSelecionada) {
        const turma = turmas.find((t) => t.id === turmaIdSelecionada);

        if (!turma) {
          alert("Turma selecionada não encontrada.");
          return;
        }

        const idsDaTurma = await obterAtletaIdsDaTurma(turma.id);

        if (!idsDaTurma.length) {
          alert("Turma selecionada não possui alunos cadastrados.");
          return;
        }

        atletaIdsParaAgendar = idsDaTurma;
      } else {
        const selecionados = atletasSelecionadosByTreinoId[treino.id] || [];
        if (selecionados.length === 0) {
          alert(
            "Selecione ao menos um atleta vinculado ou escolha uma turma para agendar o treino.",
          );
          return;
        }
        atletaIdsParaAgendar = selecionados;
      }
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diaSelecionadoStr =
      dataSelecionadaISO || new Date().toISOString().slice(0, 10);
    const diaSelecionado = new Date(`${diaSelecionadoStr}T00:00:00`);

    if (diaSelecionado < hoje) {
      alert("Você não pode agendar um treino em uma data que já passou.");
      return;
    }

    if (isUsuarioFree()) {
      const limite = new Date(hoje);
      limite.setMonth(limite.getMonth() + 1);
      limite.setHours(0, 0, 0, 0);

      if (diaSelecionado > limite) {
        alert(
          "Contas Free só podem agendar treinos até 30 dias a partir de hoje. Escolha uma data mais próxima.",
        );
        return;
      }
    }

    const dia = diaSelecionado.toISOString().slice(0, 10);

    let quandoISO: string;
    if (horaSelecionada && /^\d{2}:\d{2}$/.test(horaSelecionada)) {
      const [h, m] = horaSelecionada.split(":").map(Number);
      const dataComHora = new Date(diaSelecionado);
      dataComHora.setHours(h, m, 0, 0);
      quandoISO = dataComHora.toISOString();
    } else {
      quandoISO = `${dia}T23:59:59.000Z`;
    }

    const turmaIdSelecionada = turmaSelecionadaByTreinoId[treino.id] || "";
    if (turmaIdSelecionada) {
      try {
        const respSessao = await fetch(`${API.BASE_URL}/api/sessoes-turma`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            treinoProgramadoId: treino.id,
            turmaId: turmaIdSelecionada,
            dataISO: quandoISO,
          }),
        });

        if (!respSessao.ok) {
          const txt = await respSessao.text().catch(() => "");
          console.error("Erro ao criar sessão de turma:", respSessao.status, txt);
          alert(
            "Treino foi agendado para os atletas, mas houve erro ao criar a sessão da turma.",
          );
        }
      } catch (e) {
        console.error("Erro inesperado ao criar sessão de turma:", e);
      }
    }

    try {
      let sucessos = 0;
      let conflitos = 0;

      for (const atletaId of atletaIdsParaAgendar) {
        const r = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            titulo: treino.nome,
            dataTreino: quandoISO,
            dataExpiracao: null,
            atletaId,
            treinoProgramadoId: treino.id,
            observacao: observacao ?? null,
            turmaId: turmaIdSelecionada || null,
          }),
        });

        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          if (r.status === 409) {
            conflitos++;
            console.warn(
              "Já existe agendamento futuro desse treino para o atleta",
              atletaId,
              txt,
            );
            continue;
          }
          console.error("Falha ao agendar para atleta", atletaId, r.status, txt);
          continue;
        }

        const novo = await r.json().catch(() => null);
        window.dispatchEvent(
          new CustomEvent("treino:agendado", { detail: novo }),
        );
        sucessos++;
      }

      if (sucessos > 0) {
        const textoBase =
          sucessos === 1
            ? "Treino agendado para 1 atleta!"
            : `Treino agendado para ${sucessos} atletas!`;

        if (conflitos > 0) {
          alert(
            `${textoBase} Alguns atletas já tinham esse treino agendado e foram ignorados (${conflitos}).`,
          );
        } else {
          alert(textoBase);
        }
      } else if (conflitos > 0) {
        alert(
          "Todos os atletas selecionados já tinham esse treino agendado em uma data futura.",
        );
      } else {
        alert("Não foi possível agendar o treino para nenhum atleta.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao agendar treino.");
    }
  }

  const renderTreinoCard = (treino: TreinoProgramado) => {
    const tipoBruto = String(
      usuario?.tipo ?? (Storage as any).tipoSalvo ?? "",
    ).toLowerCase();

    const tipoUser =
      tipoBruto.startsWith("professor") ? "professor"
      : tipoBruto.startsWith("atleta") ? "atleta"
      : tipoBruto.startsWith("clube") ? "clube"
      : tipoBruto.startsWith("escolinha") ? "escolinha"
      : tipoBruto.startsWith("escola") ? "escola"
      : tipoBruto.startsWith("admin") ? "admin"
      : tipoBruto.startsWith("olheiro") ? "olheiro"
      : tipoBruto;

    const podeAgendarComoAtleta =
      tipoUser === "atleta" &&
      Boolean(
        (Storage as any).tipoUsuarioId ||
          (Storage as any).atletaId ||
          usuario?.tipoUsuarioId,
      );

    const podeAgendarComoGestor =
    ["professor", "admin", "escola", "escolinha", "clube"].includes(tipoUser) &&
    (atletasVinculados.length > 0 || turmas.length > 0);

    const mostrarBlocoAgendar = podeAgendarComoAtleta || podeAgendarComoGestor;

    return (
      <div
        key={treino.id}
        className="bg-white p-4 rounded-xl shadow-sm border mb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h4
            className="font-bold text-lg text-green-800 cursor-pointer hover:underline"
            onClick={() =>
              navigate(`/treinos/unico?programadoId=${treino.id}`)
            }
          >
            {treino.nome}
          </h4>
          {typeof treino.pontuacao === "number" && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              +{treino.pontuacao} pts
            </span>
          )}
        </div>

        {treino.descricao && (
          <p className="text-sm text-gray-700 mt-1">{treino.descricao}</p>
        )}

        {/* ✅ Realizado X vezes (abaixo da descrição) */}
        <div className="text-xs text-gray-600 mt-1">
          <strong>Realizado:</strong>{" "}
          {Number(realizadoCountByTreinoId[treino.id] ?? 0)} vez(es)
        </div>

        {Array.isArray(treino.criadoresNomes) && treino.criadoresNomes.length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            <strong>Criado por:</strong>{" "}
            {treino.criadoresNomes.join(", ")}
          </div>
        )}

        {treino.professorId && (
          <div className="mt-1 text-xs text-gray-500">
            <strong>Professor responsável:</strong>{" "}
            {profNomeById[String(treino.professorId)] ||
              professoresVinculadosNomeById[String(treino.professorId)] ||
              "Professor"}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
         {mostrarBlocoAgendar && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 max-w-full sm:max-w-[680px]">
              {podeAgendarComoGestor && (
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {turmas.length > 0 && (
                    <select
                      className="px-3 py-2 border rounded-lg w-full sm:w-[220px]"
                      value={turmaSelecionadaByTreinoId[treino.id] ?? ""}
                      onChange={(e) => {
                        const turmaId = e.target.value;
                        setTurmaSelecionadaByTreinoId((prev) => ({
                          ...prev,
                          [treino.id]: turmaId,
                        }));

                        if (turmaId) {
                          setAtletasSelecionadosByTreinoId((prev) => ({
                            ...prev,
                            [treino.id]: [],
                          }));
                        }
                      }}
                    >
                      <option value="">
                        Enviar para atletas selecionados
                      </option>
                      {turmas.map((t) => {
                        const nomesDiretos = explodeNomes(t.professorNomes);
                        const nomesDoCampoProfessorNome = explodeNomes(t.professorNome);
                        const nomesViaIds = Array.isArray(t.professorIds)
                          ? explodeNomes(
                              t.professorIds.map((id) => {
                                const key = String(id);
                                return (
                                  profNomeById[key] ||
                                  professoresVinculadosNomeById[key] ||
                                  ""
                                );
                              }),
                            )
                          : [];

                        const profsList = uniqNames([
                          ...nomesDiretos,
                          ...nomesDoCampoProfessorNome,
                          ...nomesViaIds,
                        ]);

                        const profs = profsList.join(", ");
                        const sufixo = profs ? ` — Prof(s): ${profs}` : " — Sem professor";

                        return (
                          <option key={t.id} value={t.id}>
                            Turma: {t.nome}{sufixo}
                          </option>
                        );
                      })}
                    </select>
                  )}

                  <select
                    multiple
                    className="px-3 py-2 border rounded-lg w-full sm:w-[220px] max-h-32"
                    disabled={Boolean(turmaSelecionadaByTreinoId[treino.id])}
                    value={atletasSelecionadosByTreinoId[treino.id] ?? []}
                    onChange={(e) => {
                      const values = Array.from(
                        e.target.selectedOptions,
                      ).map((opt) => opt.value);
                      setAtletasSelecionadosByTreinoId((prev) => ({
                        ...prev,
                        [treino.id]: values,
                      }));
                    }}
                  >
                    {atletasVinculados.length === 0 ? (
                      <option value="" disabled>
                        Nenhum atleta vinculado
                      </option>
                    ) : (
                      <>
                        <option value="" disabled>
                          Selecione um ou mais atletas
                        </option>
                        {atletasVinculados.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.usuario.nome}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}

              <input
                type="date"
                className="px-3 py-2 border rounded-lg w-full sm:w-[140px]"
                value={dataAgendarById[treino.id] ?? ""}
                onChange={(e) =>
                  setDataAgendarById((p) => ({
                    ...p,
                    [treino.id]: e.target.value,
                  }))
                }
              />

              <input
                type="time"
                className="px-3 py-2 border rounded-lg w-full sm:w-[110px]"
                value={horaAgendarById[treino.id] ?? ""}
                onChange={(e) =>
                  setHoraAgendarById((p) => ({
                    ...p,
                    [treino.id]: e.target.value,
                  }))
                }
              />

              <input
                type="text"
                placeholder="Observação (opcional)"
                className="px-3 py-2 border rounded-lg flex-1"
                value={obsById[treino.id] ?? ""}
                onChange={(e) =>
                  setObsById((p) => ({ ...p, [treino.id]: e.target.value }))
                }
              />

              <button
                onClick={() => {
                  const diaISO =
                    dataAgendarById[treino.id] ||
                    new Date().toISOString().slice(0, 10);
                  const hora = horaAgendarById[treino.id] || "";

                  agendarTreinoProgramado(
                    treino,
                    diaISO,
                    hora,
                    obsById[treino.id],
                  );
                }}
                className="bg-green-800 text-white px-3 py-2 rounded-lg w-full sm:w-auto"
              >
                Agendar treino
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
          <p>
            <strong>Nível:</strong> {treino.nivel}
          </p>
          <p>
            <strong>Exercícios:</strong>{" "}
            {Number(exerciciosCountByTreinoId[treino.id] ?? treino.exercicios?.length ?? 0)}
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
                <div
                  key={ex.id || `${i}-${ex.nome || "ex"}`}
                  className="border-b pb-1 last:border-b-0"
                >
                  <strong>{i + 1}.</strong> {ex.nome}{" "}
                  {ex.repeticoes && (
                    <span className="text-gray-500">
                      ({ex.repeticoes})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const meuTipoUsuarioId = String(usuario?.tipoUsuarioId ?? "");

  const isGestor =
    usuario?.tipo &&
    ["professor", "admin", "escola", "escolinha", "clube"].includes(
      String(usuario.tipo).toLowerCase(),
    );

  const isOlheiro =
    String((Storage as any).tipoSalvo ?? "").toLowerCase() === "olheiro";

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl px-3 sm:px-4">
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <HealthBanner />
        </div>

        <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-neutral-50/90 backdrop-blur px-3 sm:px-0 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            {isGestor ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-[620px]">
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

                  <button
                    onClick={() => setAbaProfessor("sessoes")}
                    className={`px-4 py-2 rounded-lg border text-sm ${
                      abaProfessor === "sessoes"
                        ? "bg-green-800 text-white border-green-900"
                        : "bg-white text-gray-800 border-gray-200"
                    }`}
                  >
                    Treinos de Hoje
                  </button>
                </div>
              ) : (
              <div className="text-lg font-semibold text-green-900">
                Treinos
              </div>
            )}

              <Link
                href="/perfil/GerenciarAtletas"
                className="flex-shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50"
                title="Gerenciador de Carreira"
              >
                Gerenciar Atletas
              </Link>

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

        <div className="space-y-6">
          {isGestor && abaProfessor === "avaliar" && (
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
              <h3 className="text-lg font-semibold mb-3">
                Treinos dos atletas afiliados
              </h3>

              {carregandoSubmissoes ? (
                <p className="text-gray-500">
                  Carregando submissões pendentes...
                </p>
              ) : submissoesPendentes.length === 0 ? (
                <p className="text-gray-500">
                  Nenhum treino pendente para avaliação no momento.
                </p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {submissoesPendentes.map((s) => {
                      const foto = resolveUploadUrl(s.atleta?.foto) ?? PLACEHOLDER_USER;

                      const midias = (Array.isArray(s.midias) ? s.midias : [])
                        .map(resolveUploadUrl)
                        .filter((x): x is string => Boolean(x));

                      return (
                        <li
                          key={s.id}
                          className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-3 sm:p-4"
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <img
                              src={resolveUploadUrl(foto) ?? PLACEHOLDER_USER}
                              alt={s.atleta?.nome ?? "Atleta"}
                              className="w-12 h-12 rounded-full object-cover"
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                el.onerror = null;
                                el.src = PLACEHOLDER_USER;
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-semibold text-green-900 truncate">
                                  {s.treino.titulo}
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  +{s.pontosSugeridos ?? 0} pts
                                </span>

                                <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() =>
                                      aprovar(s.id, s.pontosSugeridos)
                                    }
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

                              <div className="text-sm text-gray-600 truncate">
                                {s.atleta?.nome}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatarData(s.criadoEm)} •{" "}
                                {new Date(s.criadoEm).toLocaleTimeString(
                                  "pt-BR",
                                )}
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
                            </div>
                          </div>
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
                  {usuario?.tipo === "admin"
                    ? "Todos os Treinos"
                    : "Treinos que você criou"}
                </h3>
                <div className="text-xs text-gray-600">
                  <strong>Treinos:</strong> {totalTreinosExibidos} •{" "}
                  <strong>Exercícios:</strong> {totalExerciciosExibidos}
                </div>
                <button
                  className="bg-green-800 text-white px-4 py-2 rounded-lg"
                  onClick={() => navigate("/treinos/novo")}
                >
                  Criar novo treino
                </button>
              </div>

              {listaParaExibir.map(renderTreinoCard).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listaParaExibir.map(renderTreinoCard)}
                </div>
              ) : (
                <p className="text-gray-500">
                  {usuario?.tipo === "admin"
                    ? "Nenhum treino cadastrado."
                    : "Você ainda não tem treinos (criador ou colaborador)."}
                </p>
               )}
            </div>
          )}
          {abaProfessor === "sessoes" && (
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
              <h3 className="text-lg font-semibold mb-3">Treinos de hoje</h3>

              {!sessoesDeHoje.length ? (
                <p className="text-gray-500">Nenhuma sessão marcada para hoje.</p>
              ) : (
                <ul className="space-y-3">
                  {sessoesDeHoje.map((s: any) => {
                    let labelTempo: string | null = null;

                    if (s.status === "em_andamento" && s.startedAt) {
                      const inicio = new Date(s.startedAt);
                      const diffMs = clockNow - inicio.getTime();
                      const totalSec = Math.max(0, Math.floor(diffMs / 1000));
                      const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
                      const ss = String(totalSec % 60).padStart(2, "0");
                      labelTempo = `Tempo decorrido: ${mm}:${ss}`;
                    } else if (s.status === "finalizada" && s.duracaoMinutosReal) {
                      labelTempo = `Duração registrada: ${s.duracaoMinutosReal} min`;
                    }

                    return (
                      <li key={s.id} className="p-3 border rounded-lg shadow-sm">
                        <div className="font-semibold text-green-900">
                          {s.treino?.nome ?? "Treino"}
                        </div>
                        {(() => {
                          const turmaId = String(s.turma?.id ?? "");
                          const turmaLocal = turmaId ? turmaById[turmaId] : null;

                          const nomeTurma = turmaLocal?.nome ?? s.turma?.nome ?? "Turma";
                          const profs = Array.from(
                            new Set(
                              [
                                String(turmaLocal?.professorNome ?? "").trim(),
                                ...(turmaLocal?.professorNomes ?? []).map((x) => String(x || "").trim()),
                              ].filter(Boolean)
                            )
                          ).join(", ");

                          return (
                            <div className="text-sm text-gray-600">
                              Turma: {nomeTurma}
                              {profs ? (
                                <span className="text-xs text-gray-500"> • Prof(s): {profs}</span>
                              ) : (
                                <span className="text-xs text-gray-400"> • Sem professor</span>
                              )}
                            </div>
                          );
                        })()}

                        {typeof s.treino?.duracao === "number" && (
                          <div className="text-xs text-gray-500 mt-1">
                            Duração programada: {s.treino.duracao} min
                          </div>
                        )}

                        {labelTempo && (
                          <div className="text-xs text-gray-500 mt-1">{labelTempo}</div>
                        )}

                        {s.penalidadeAtraso && s.status === "finalizada" && (
                          <div className="text-xs text-amber-700 mt-1">
                            ⚠ Pontos reduzidos pela metade por atraso.
                          </div>
                        )}

                        {s.status === "nao_iniciada" && (
                          <button
                            onClick={() => abrirModalIniciar(s.id, s.turma?.id)}
                            className="mt-2 px-3 py-2 bg-emerald-700 text-white rounded-lg"
                          >
                            Iniciar treino
                          </button>
                        )}

                        {(s.status === "em_andamento" || s.status === "nao_iniciada") && (
                          <button
                            onClick={() => setSessaoAbertaExerciciosId(s.id)}
                            className="px-3 py-2.5 border rounded-lg mr-3 bg-transparent text-green-700 ml-3 text-sm"
                          >
                            Ver exercícios
                          </button>
                        )}

                        {s.status === "em_andamento" && (
                          <button
                            onClick={() => finalizarTreinoSessao(s.id)}
                            className="mt-2 ml-0 sm:ml-2 px-3 py-2 bg-red-600 text-white rounded-lg"
                          >
                            Finalizar treino
                          </button>
                        )}

                        { s.status === "finalizada" && (
                          <span className="mt-2 inline-block text-emerald-700 font-medium">
                            Finalizado ✓
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}   
        </div>
      </div>

      {modalSessaoId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3">
            <h4 className="text-lg font-semibold">Selecione os presentes</h4>
            <p className="text-sm text-gray-600">
              Marque apenas os atletas que estão presentes para este treino.
            </p>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {alunosDaSessao.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">
                  Nenhum aluno encontrado para essa turma.
                </p>
              ) : (
                <ul className="divide-y">
                  {alunosDaSessao.map((aluno: any) => {
                    const id = aluno.id;
                    const nome =
                      aluno.nome ||
                      aluno.usuario?.nome ||
                      "Aluno";

                    const marcado = presentesSelecionados.includes(id);

                    return (
                      <li
                        key={id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={marcado}
                          onChange={() => {
                            setPresentesSelecionados((prev) =>
                              marcado
                                ? prev.filter((x) => x !== id)
                                : [...prev, id],
                            );
                          }}
                        />
                        <span className="text-sm text-gray-800">
                          {nome}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-2 rounded-lg border text-sm"
                onClick={() => {
                  setModalSessaoId(null);
                  setPresentesSelecionados([]);
                }}
              >
                Cancelar
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm"
                onClick={confirmarPresencas}
                disabled={!presentesSelecionados.length}
              >
                Iniciar treino
              </button>
            </div>
          </div>
        </div>
      )}
      {sessaoAbertaExerciciosId && (() => {
        const sessao = sessoesDeHoje.find(
          (s: any) => s.id === sessaoAbertaExerciciosId,
        );
        if (!sessao) return null;

        const exercicios: ExercicioSessaoDetalhe[] = sessao.exercicios ?? [];
        const marcados = new Set(exerciciosMarcadosBySessao[sessao.id] ?? []);

        const pontosTreino =
          typeof sessao.treino?.pontuacao === "number"
            ? sessao.treino.pontuacao
            : null;

        const emRemarcacao = sessaoEmRemarcacaoId === sessao.id;
        const dataRemarcar = remarcarDataBySessaoId[sessao.id] ?? "";
        const horaRemarcar = remarcarHoraBySessaoId[sessao.id] ?? "";

        return (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-lg max-w-md sm:max-w-lg w-full p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setSessaoAbertaExerciciosId(null)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="text-sm font-semibold text-gray-800 text-center flex-1">
                  {sessao.treino?.nome ?? "Treino"}
                </div>
                <div className="w-8" /> 
              </div>

              <h3 className="text-base sm:text-lg font-bold text-green-900">
                {sessao.treino?.nome ?? "Treino"}
              </h3>

              {pontosTreino !== null && (
                <div className="text-xs sm:text-sm text-amber-700 mt-1">
                  Vale <span className="font-semibold">+{pontosTreino} pts</span>{" "}
                  por atleta que concluir.
                </div>
              )}

              <div className="mt-2 max-h-[60vh] overflow-y-auto space-y-3">
                {exercicios.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum exercício cadastrado para este treino.
                  </p>
                ) : (
                  exercicios.map((ex) => {
                    const checked = marcados.has(ex.id);
                    const videoUrl = ex.videoUrl
                      ? resolveUploadUrl(ex.videoUrl)
                      : null;

                    return (
                      <div
                        key={ex.id}
                        className="border rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                      >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setExerciciosMarcadosBySessao((prev) => {
                              const current = new Set(prev[sessao.id] ?? []);
                              if (current.has(ex.id)) current.delete(ex.id);
                              else current.add(ex.id);
                              return {
                                ...prev,
                                [sessao.id]: Array.from(current),
                              };
                            });
                          }}
                          className={`mt-0.5 flex items-center justify-center w-6 h-6 rounded-full border text-xs ${
                            checked
                              ? "border-green-700 bg-green-700 text-white"
                              : "border-gray-300 bg-white text-gray-500"
                          }`}
                          aria-pressed={checked}
                        >
                          {checked ? <Check className="w-3 h-3" /> : "✕"}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-sm sm:text-base text-gray-900">
                                {ex.nome}
                              </div>

                              {ex.detalhes && (
                                <div className="text-xs sm:text-sm text-gray-700 mt-1">
                                  {ex.detalhes}
                                </div>
                              )}

                              {ex.repeticoes && (
                                <div className="text-xs sm:text-sm text-gray-600 mt-0.5">
                                  {ex.repeticoes}
                                </div>
                              )}
                            </div>

                            {videoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setVideoModal({
                                    url: videoUrl,
                                    nome: ex.nome,
                                    repeticoes: ex.repeticoes,
                                  })
                                }
                                className="text-xs sm:text-sm font-medium text-green-700 hover:underline underline-offset-2 flex-shrink-0"
                              >
                                Ver vídeo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 px-3 py-2 rounded-full border text-sm text-gray-700 bg-white hover:bg-gray-50"
                  onClick={() => {
                    const jaAtivo = sessaoEmRemarcacaoId === sessao.id;
                    if (jaAtivo) {
                      setSessaoEmRemarcacaoId(null);
                      return;
                    }

                    const baseISO =
                      sessao.data || sessao.startedAt || new Date().toISOString();

                    setSessaoEmRemarcacaoId(sessao.id);
                    setRemarcarDataBySessaoId((prev) => ({
                      ...prev,
                      [sessao.id]: baseISO.slice(0, 10),
                    }));
                    setRemarcarHoraBySessaoId((prev) => ({
                      ...prev,
                      [sessao.id]: baseISO.slice(11, 16),
                    }));
                  }}
                >
                  {emRemarcacao ? "Cancelar remarcação" : "Remarcar"}
                </button>

                <button
                  type="button"
                  className="flex-1 px-3 py-2 rounded-full bg-green-700 text-white text-sm hover:bg-green-800"
                  onClick={async () => {
                    await salvarProgressoSessao(sessao.id);
                    await carregarSessoesDeHoje();
                    alert("Progresso salvo!");
                  }}
                >
                  Salvar
                </button>

                <button
                  type="button"
                  className="flex-1 px-3 py-2 rounded-full border text-sm bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  onClick={() => excluirSessao(sessao.id)}
                >
                  Excluir
                </button>
              </div>

              {emRemarcacao && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2 items-center">
                  <input
                    type="date"
                    className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto flex-1"
                    value={dataRemarcar}
                    onChange={(e) =>
                      setRemarcarDataBySessaoId((prev) => ({
                        ...prev,
                        [sessao.id]: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="time"
                    className="px-3 py-2 border rounded-lg text-sm w-full sm:w-[120px]"
                    value={horaRemarcar}
                    onChange={(e) =>
                      setRemarcarHoraBySessaoId((prev) => ({
                        ...prev,
                        [sessao.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-full bg-emerald-700 text-white text-sm w-full sm:w-auto"
                    onClick={() =>
                      remarcarSessao(sessao.id, dataRemarcar, horaRemarcar)
                    }
                  >
                    Confirmar
                  </button>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {videoModal && (() => {
        const isArquivo = isVideoUrl(videoModal.url);

        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{videoModal.nome}</h4>
                <button onClick={() => setVideoModal(null)}>✕</button>
              </div>

              <div className="w-full flex justify-center">
                {isArquivo ? (
                  <video
                    src={videoModal.url}
                    className="max-h-[70vh] w-auto rounded-xl"
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <iframe
                    src={videoModal.url}
                    className="w-full h-[70vh] rounded-xl"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <BottomNav active="treinos" />

    </div>
  );
}