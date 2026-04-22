// client/src/pages/admin-page
import React, { useEffect, useState, useMemo } from "react";
import { API, APP } from "../config.js";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import ValidacaoVideo from "./validacaovideo.js";
import { FLAGS } from "../config.js";
import ToggleSwitch from "../components/ToggleSwitch";
import axios from "axios";
import Storage from "../utils/storage.js"
import LearningCard from "../components/learning/LearningCard.js";
import { Pencil, Trash2 } from "lucide-react";
// <-- ajuste o caminho correto do seu storage.ts do CLIENT
type Tab =
  | "dashboard"
  | "usuarios"
  | "exercicios"
  | "treinos"
  | "professores"
  | "metodologias"
  | "desafios"
  | "validacao"
  | "moderacao"
  | "analises"
  | "configuracoes"
  | "assinaturas"
  | "feedback";

interface Treinos {
  id: string;
  nome: string;
  codigo: string;
  nivel: string;
  descricao: string;
  agendadosCount?: number;
  realizadoCount?: number;
  realizados?: number;
  submissoes?: number;
  submissoesaprovados?: number;
}

type UsuarioTipo = "" | "atleta" | "escola" | "clube" | "professor" | "admin" | "olheiro";
type StatusConta =
  | "ATIVO"
  | "BLOQUEADO"
  | "ativo"
  | "banido"
  | "pendente";

const tipoToServer: Record<UsuarioTipo, string> = {
  "": "",
  atleta: "Atleta",
  escola: "Escolinha",
  clube: "Clube",
  professor: "Professor",
  admin: "Admin",
  olheiro: "Olheiro",
};

interface UsuarioAdmin {
  id: string;
  nome?: string;
  nomeDeUsuario?: string;
  email?: string;
  tipo?: UsuarioTipo | string;
  foto?: string | null;
  criadoEm?: string;
  verificado?: boolean;
  destaque?: boolean;
  ultimaAtividade?: string | null;
  ultimaAtividadeNome?: string | null;
  assinatura?: AssinaturaDTO | null; 
  status?: StatusConta;
  deletedAt?: string | null;
  blockedReason?: string | null;
}

type PlanoAssinatura = "FREE" | "PRO" | "ELITE" | string;

interface AssinaturaDTO {
  id?: string;
  plano: PlanoAssinatura;
  startsAt: string;
  canceledAt?: string | null;
  ativo: boolean;
  renovaEm?: string | null; 
}

interface UsuarioDetalhe extends UsuarioAdmin {
  documento?: string | null;
  telefone?: string | null;
  dataNascimento?: string | null;
  endereco?: string | null;
  ultimaAtividade?: string | null;
  ultimaAtividadeNome?: string | null;
  status?: StatusConta;
  contagens?: { posts?: number; comentarios?: number; seguidores?: number };
  camposCadastro?: Record<string, any>;
  posicaoCampo?: string | null;
  totalVinculados?: number | null;
  assinatura?: AssinaturaDTO | null;
}

const USERS_ENDPOINT = `${API.BASE_URL}/api/admin/usuarios`;
const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

const EMPTY_DASH = {
  totalUsuarios: 0,
  totalTreinos: 0,
  totalDesafios: 0,
  totalPostsCriados: 0,
  totalAtletas: 0,
  totalEscolinhas: 0,
  totalClubes: 0,
  totalProfessores: 0,
  totalOlheiros: 0,
  totalAdministradores: 0,
  totalMidias: 0, 
  totalVerificados: 0,
  totalNaoVerificados: 0,
};

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function authHeaders(extra: Record<string, string> = {}) {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

function toAbsoluteUrl(raw?: string | null) {
  if (!raw) return null;
  const v = String(raw).trim();
  if (v.startsWith("http") || v.startsWith("data:")) return v;
  if (v.startsWith("/assets/") || v.startsWith("/videos/") || v.startsWith("/exercicios/")) return v;
  if (v.startsWith("assets/") || v.startsWith("videos/") || v.startsWith("exercicios/")) return `/${v}`;
  if (v.startsWith("/uploads/")) return `${API.BASE_URL}${v}`;
  if (v.startsWith("uploads/")) return `${API.BASE_URL}/${v}`;
  if (/^[\w-]{11}$/.test(v)) return `https://www.youtube.com/watch?v=${v}`;
  return `${API.BASE_URL}${v.startsWith("/") ? v : `/${v}`}`;
}

function avatarSrc(raw?: string | null) {
  const v = formatarUrlFoto(raw, "usuarios");
  return v && String(v).trim() ? v : AVATAR_FALLBACK;
}

function onAvatarError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src.includes("footera-logo-fundo-verde.png")) return;
  img.src = AVATAR_FALLBACK;
}

function resolveVideoUrl(ex: any) {
  const raw =
    ex.videoDemonstrativoUrl ??
    ex.videoDemonstrativoURL ??
    ex.videoDemonstrativo ??
    ex.videoUrl ??
    ex.video ??
    ex.urlVideo ??
    ex.linkVideo ??
    ex.youtubeUrl ??
    ex.demoUrl ??
    null;

  return raw ? toAbsoluteUrl(String(raw)) : null;
}

type ModeracaoItem = {
  id: string;
  criadoEm: string;
  videoUrl?: string | null;
  observacao?: string | null;
  resultado?: string | number | null;
  resultadoDeclarado?: string | number | null;
  unidadeResultado?: string | null;
  tempoMs?: number | null;
  conteudoJson?: any;
  atleta: { id: string | null; nome: string; foto: string | null };
  desafio: { id: string | null; titulo: string; pontuacao: number };
};

function formatResultado(it: ModeracaoItem) {
  const r =
    it.resultado ??
    it.resultadoDeclarado ??
    (it as any).resultado_atleta ??
    (it as any).valor ??
    it.conteudoJson?.resultado ??
    null;

  const unidade =
    it.unidadeResultado ??
    (it as any).unidade ??
    it.conteudoJson?.unidade ??
    null;

  if (r === null || r === undefined || r === "") return "—";

  const msLike =
    typeof it.tempoMs === "number"
      ? it.tempoMs
      : unidade === "ms"
      ? Number(r)
      : null;

  if (typeof msLike === "number" && Number.isFinite(msLike)) {
    const min = Math.floor(msLike / 60000);
    const sec = Math.floor((msLike % 60000) / 1000);
    const cent = Math.floor((msLike % 1000) / 10);
    return min
      ? `${min}:${String(sec).padStart(2, "0")}.${String(cent).padStart(2, "0")}`
      : `${sec}.${String(cent).padStart(2, "0")}s`;
  }

  if (unidade === "s") return `${r}s`;
  return unidade ? `${r} ${unidade}` : String(r);
}

function getAdminMetodologiaHref(item: any) {
  const origemTipo = String(item?.origemTipo || item?.origemRegistro || "LEARNING").toUpperCase();
  const isAvulsa = origemTipo === "AVULSA";

  return isAvulsa
    ? `/learning/${item.id}?from=admin&origem=avulsa`
    : `/learning/${item.id}?from=admin`;
}

export default function AdminDashboard() {
  const [aba, setAba] = useState<Tab>("dashboard");

  const tabs: Tab[] = [
    "dashboard",
    "usuarios",
    "exercicios",
    "treinos",
    "professores",
    "metodologias",
    ...(FLAGS.DESAFIOS_ENABLED ? (["desafios", "validacao", "moderacao"] as Tab[]) : []),
    "assinaturas",
    "feedback",
    "analises",
    "configuracoes",
  ];

  const [dados, setDados] = useState<any>(EMPTY_DASH);
  const [dashLoading, setDashLoading] = useState(true);
  const [exercicios, setExercicios] = useState<any[]>([]);
  const [treinos, setTreinos] = useState<Treinos[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [profLoading, setProfLoading] = useState(false);
  const [profErro, setProfErro] = useState<string>("");
  const [profQ, setProfQ] = useState("");
  const [profDebQ, setProfDebQ] = useState("");
  const [profPage, setProfPage] = useState(1);
  const profPageSize = 20;
  const [profTotal, setProfTotal] = useState(0);
  const [desafios, setDesafios] = useState<any[]>([]);
  const [configuracoes, setConfiguracoes] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<UsuarioTipo>("");
  const [pagina, setPagina] = useState(1);
  const pageSize = 20;
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [exQ, setExQ] = useState("");
  const [exDebQ, setExDebQ] = useState("");
  const [exCat, setExCat] = useState<string>("");
  const [trQ, setTrQ] = useState("");
  const [trDebQ, setTrDebQ] = useState("");
  const [trCat, setTrCat] = useState<string>("");
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [userSelecionado, setUserSelecionado] = useState<UsuarioDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [acaoBusyId, setAcaoBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [erroUsuarios, setErroUsuarios] = useState<string>("");
  const [usersBase] = useState<string>(USERS_ENDPOINT);
  const [modPendentes, setModPendentes] = useState<ModeracaoItem[]>([]);
  const [modTotal, setModTotal] = useState(0);
  const [modPage, setModPage] = useState(1);
  const modPageSize = 20;
  const [modLoading, setModLoading] = useState(false);
  const [player, setPlayer] = useState<{ src: string; kind: "video" | "iframe" | "image" } | null>(null);
  const [modStatus, setModStatus] = useState<"pendente" | "aprovado" | "invalido" | "todos">("pendente");
  const [meId, setMeId] = useState<string | null>(null);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [adminNivel, setAdminNivel] = useState<number>(0);
  const [profDeleteModalOpen, setProfDeleteModalOpen] = useState(false);
  const [profToDelete, setProfToDelete] = useState<{ id: string; nome?: string } | null>(null);
  const [profDeleteBusy, setProfDeleteBusy] = useState(false);
  const [profDeleteErr, setProfDeleteErr] = useState<string>("");
  const [metTab, setMetTab] = useState<"pendentes" | "minhas" | "todas">("pendentes");
  const [metMinhas, setMetMinhas] = useState<MetodologiaPendente[]>([]);
  const [metMinhasLoading, setMetMinhasLoading] = useState(false);
  const [metMinhasErro, setMetMinhasErro] = useState("");
  const [metMinhasTotal, setMetMinhasTotal] = useState(0);
  const [metMinhasPage, setMetMinhasPage] = useState(1);
  const [metTodas, setMetTodas] = useState<any[]>([]);
  const [metTodasLoading, setMetTodasLoading] = useState(false);
  const [metTodasErro, setMetTodasErro] = useState("");
  const [metTodasTotal, setMetTodasTotal] = useState(0);
  const [metTodasPage, setMetTodasPage] = useState(1);

  type MetodologiaItemPreview = {
    id: string;
    semana: number;
    ordem: number;
    tipo: string;
    titulo: string;
    videoUrl?: string | null;
    thumbUrl?: string | null;
    duracaoMin?: number | null;
    treinoProgramadoId?: string | null;
    treinoProgramado?: {
      id: string;
      nome: string;
      codigo: string;

      // ✅ ADICIONAR:
      descricao?: string | null;
      exercicios?: Array<{
        id: string;
        ordem?: number | null;
        repeticoes?: string | null;
        exercicio?: {
          id: string;
          nome?: string | null;
          codigo?: string | null;
          nivel?: string | null;
          descricao?: string | null;
          videoDemonstrativoUrl?: string | null;
        } | null;
      }> | null;

      imagemUrl?: string | null;
      nivel?: string | null;
      categoria?: any;
      pontuacao?: number | null;
      duracao?: number | null;
    } | null;
  };


  type MetodologiaPendente = {
    id: string;
    titulo: string;
    descricao?: string | null;
    capaUrl?: string | null;
    nivel?: string | null;
    categorias?: any[];
    ativo: boolean;
    criadoEm?: string | null;
    origemTipo: "LEARNING" | "AVULSA";
    criadorUsuario?: {
      id: string;
      nome?: string | null;
      nomeDeUsuario?: string | null;
      email?: string | null;
      foto?: string | null;
      parceiro?: boolean | null;
    } | null;
    _count?: { assinantes?: number; itens?: number };

    // ✅ vem do include.itens (take 3)
    itens?: MetodologiaItemPreview[];
  };

  type MetodologiaDetail = MetodologiaPendente & {
    itens?: Array<{
      id: string;
      semana: number;
      ordem: number;
      titulo: string;
      descricao?: string | null;
      tipo: string;
      pontos?: number | null;
      publicado?: boolean | null;
      criadoEm?: string | null;
      atualizadoEm?: string | null;
      videoUrl?: string | null;
      thumbUrl?: string | null;
      duracaoMin?: number | null;
      treinoProgramadoId?: string | null;
      treinoProgramado?: {
        id: string;
        nome: string;
        codigo: string;
        descricao?: string | null;

        // ✅ ADICIONAR:
        exercicios?: Array<{
          id: string;
          ordem?: number | null;
          repeticoes?: string | null;
          exercicio?: {
            id: string;
            nome?: string | null;
            codigo?: string | null;
            nivel?: string | null;
            descricao?: string | null;
            videoDemonstrativoUrl?: string | null;
          } | null;
        }> | null;

        imagemUrl?: string | null;
        nivel?: string | null;
        categoria?: any;
        pontuacao?: number | null;
        duracao?: number | null;
        parceiro?: boolean | null;
        metodologia?: boolean | null;
      } | null;
    }>;
  };


  const [metPendentes, setMetPendentes] = useState<MetodologiaPendente[]>([]);
  const [metLoading, setMetLoading] = useState(false);
  const [metErro, setMetErro] = useState<string>("");
  const [metQ, setMetQ] = useState("");
  const [metDebQ, setMetDebQ] = useState("");
  const [metPage, setMetPage] = useState(1);
  const [metTotal, setMetTotal] = useState(0);
  const metPageSize = 20;

  const [metDetailOpen, setMetDetailOpen] = useState(false);
  const [metDetailLoading, setMetDetailLoading] = useState(false);
  const [metDetail, setMetDetail] = useState<MetodologiaDetail | null>(null);
  const [metDetailErr, setMetDetailErr] = useState<string>("");


  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 3500);
  }

type AssinanteListItem = {
  id: string;
  plano: string;
  startsAt: string;
  canceledAt?: string | null;
  ativo: boolean;
  renovaEm?: string | null;
  usuario: {
    id: string;
    nome: string | null;
    nomeDeUsuario: string | null;
    email: string | null;
    tipo: string | null;
    foto: string | null;
    dataCriacao: string | null;
  };
};

interface FeedbackAdmin {
  id: string;
  tipo: string;
  mensagem: string;
  createdAt: string;
  lidoEm?: string | null;
  usuario?: {
    id: string;
    nome?: string | null;
    nomeDeUsuario?: string | null;
    email?: string | null;
    tipo?: string | null;
  } | null;
}

const [dashErro, setDashErro] = useState<string | null>(null);
const [assQ, setAssQ] = useState("");
const [assDebQ, setAssDebQ] = useState("");
const [assPlano, setAssPlano] = useState<string>("");
const [assAtivo, setAssAtivo] = useState<string>("");
const [assPage, setAssPage] = useState(1);
const assPageSize = 20;
const [assLoading, setAssLoading] = useState(false);
const [assErro, setAssErro] = useState<string>("");
const [assinantes, setAssinantes] = useState<AssinanteListItem[]>([]);
const [assTotal, setAssTotal] = useState(0);
const [assOverview, setAssOverview] = useState<{ total: number; ativos: number; cancelados: number; porPlano: Record<string, {total:number; ativos:number}> } | null>(null);
const [fbItems, setFbItems] = useState<FeedbackAdmin[]>([]);
const [fbLoading, setFbLoading] = useState(false);
const [fbError, setFbError] = useState<string | null>(null);
const [fbTipo, setFbTipo] = useState<string>("");
const [fbFrom, setFbFrom] = useState<string>("");
const [fbOnlyUnread, setFbOnlyUnread] = useState(false);
const [profParceiroBusyId, setProfParceiroBusyId] = useState<string | null>(null);

const [expandedTreinoItemId, setExpandedTreinoItemId] = useState<string | null>(null);

 function safeJsonParse(txt: string) {
    try {
      return txt ? JSON.parse(txt) : null;
    } catch {
      return null;
    }
  }

type AcaoConta = "bloquear" | "desbloquear" | "reativar" | "restaurar";

async function carregarMinhasMetodologiasAdmin(page: number) {
  setMetMinhasLoading(true);
  setMetMinhasErro("");

  try {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(metPageSize));
    if (metDebQ) params.set("q", metDebQ);

    const r = await fetch(`${API.BASE_URL}/api/admin/metodologias/minhas?${params}`, {
      headers: authHeaders(),
    });

    const txt = await r.text().catch(() => "");
    if (!r.ok) {
      setMetMinhas([]);
      setMetMinhasTotal(0);
      setMetMinhasErro(txt || `Erro HTTP ${r.status}`);
      return;
    }

    const json = txt ? JSON.parse(txt) : {};
    const items = Array.isArray(json.items) ? json.items : [];

    setMetMinhas(items);
    setMetMinhasTotal(Number(json.total || 0));
    setMetMinhasPage(Number(json.page || page));
  } catch (e: any) {
    setMetMinhas([]);
    setMetMinhasTotal(0);
    setMetMinhasErro(e?.message || "Falha de rede ao carregar minhas metodologias.");
  } finally {
    setMetMinhasLoading(false);
  }
}

async function apagarMinhaMetodologiaAdmin(id: string, titulo?: string, origemTipo: "LEARNING" | "AVULSA" = "LEARNING") {
  const ok = window.confirm(
    `Tem certeza que deseja apagar a metodologia "${titulo || "sem título"}"?`
  );
  if (!ok) return;

  setAcaoBusyId(id);

  try {
    const r = await fetch(
      `${API.BASE_URL}/api/admin/metodologias/${id}?origemTipo=${encodeURIComponent(origemTipo)}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      }
    );

    const txt = await r.text().catch(() => "");
    if (!r.ok) {
      showToast("error", txt || `Erro HTTP ${r.status}`);
      return;
    }

    setMetMinhas((prev) => prev.filter((m) => m.id !== id));
    setMetMinhasTotal((prev) => Math.max(0, prev - 1));
    showToast("success", "Metodologia apagada com sucesso.");
  } catch (e: any) {
    showToast("error", e?.message || "Falha de rede ao apagar metodologia.");
  } finally {
    setAcaoBusyId(null);
  }
}

async function ativarMetodologiaAdmin(
  id: string,
  origemTipo: "LEARNING" | "AVULSA",
  titulo?: string
) {
  setAcaoBusyId(id);

  try {
    const r = await fetch(`${API.BASE_URL}/api/admin/metodologias/${id}/ativo`, {
      method: "PATCH",
      headers: {
        ...authHeaders({ "Content-Type": "application/json" }),
      },
      body: JSON.stringify({
        ativo: true,
        origemTipo,
      }),
    });

    const txt = await r.text().catch(() => "");
    let json: any = null;
    try {
      json = txt ? JSON.parse(txt) : null;
    } catch {
      json = null;
    }

    if (!r.ok) {
      showToast("error", json?.message || txt || `Erro HTTP ${r.status}`);
      return;
    }

    setMetPendentes((prev) => prev.filter((m) => m.id !== id));
    setMetTotal((prev) => Math.max(0, prev - 1));

    showToast(
      "success",
      `Metodologia "${titulo || "sem título"}" ativada com sucesso.`
    );

    // opcional: recarrega também a aba "todas"
    carregarTodasMetodologiasAdmin(metTodasPage);
  } catch (e: any) {
    showToast("error", e?.message || "Erro ao ativar metodologia.");
  } finally {
    setAcaoBusyId(null);
  }
}

function renderMetodologiaAdminActions(
  item: any,
  tabOrigem: "pendentes" | "minhas" | "todas"
) {
  const origemTipo = String(
    item?.origemTipo || item?.origemRegistro || "LEARNING"
  ).toUpperCase() as "LEARNING" | "AVULSA";

  if (tabOrigem === "pendentes") {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            window.location.href = getAdminMetodologiaHref(item);
          }}
          className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
        >
          Ver metodologia
        </button>

        <button
          type="button"
          onClick={() => ativarMetodologiaAdmin(item.id, origemTipo, item.titulo)}
          className="inline-flex h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold items-center"
          disabled={acaoBusyId === item.id}
        >
          {acaoBusyId === item.id ? "Ativando..." : "Ativar"}
        </button>
      </>
    );
  }

  if (tabOrigem === "minhas") {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            window.location.href = getAdminMetodologiaHref(item);
          }}
          className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
        >
          Gerenciar
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href =
              `/learning/create?id=${item.id}` +
              `&tipo=${encodeURIComponent(item.tipo || "")}` +
              `&origem=${origemTipo === "AVULSA" ? "avulsa" : "learning"}`;
          }}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 h-10 text-slate-700"
          title="Editar metodologia"
        >
          <Pencil className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            apagarMinhaMetodologiaAdmin(item.id, item.titulo, origemTipo)
          }
          className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 h-10 text-red-600"
          title="Apagar metodologia"
          disabled={acaoBusyId === item.id}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          window.location.href = getAdminMetodologiaHref(item);
        }}
        className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
      >
        Ver metodologia
      </button>
    </>
  );
}

async function bloquearOuReativarConta(
  usuarioId: string,
  acao: AcaoConta
) {
  setAcaoBusyId(usuarioId);

  try {
    let body: any = undefined;

    if (acao === "bloquear") {
      const motivo = prompt("Motivo do bloqueio? (opcional)") ?? "";
      body = { motivo: String(motivo) };
    }

    const acaoToPath: Record<AcaoConta, string> = {
      bloquear: "bloquear",
      desbloquear: "reativar",
      reativar: "reativar",
      restaurar: "restaurar",
    };

    const url = `${API.BASE_URL}/api/admin/usuarios/${usuarioId}/${acaoToPath[acao]}`;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(url, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timeout));

    const txt = await resp.text().catch(() => "");
    const data = safeJsonParse(txt);

    if (!resp.ok) {
      const msg = (data as any)?.message || txt || `Erro HTTP ${resp.status}`;
      showToast("error", msg);
      return;
    }

    const current =
      usuarios.find((u) => u.id === usuarioId) ||
      (userSelecionado?.id === usuarioId ? userSelecionado : null);

    const nome = current?.nome ?? current?.nomeDeUsuario ?? "(sem nome)";
    const email = current?.email ?? "";

    const updated = (data as any)?.usuario?.id ? (data as any).usuario : ((data as any)?.id ? data : null);

    if (updated?.id) {
      setUsuarios((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
      );

      setUserSelecionado((prev) =>
        prev?.id === updated.id ? { ...prev, ...updated } : prev
      );
    } else {
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuarioId
            ? {
                ...u,
                status:
                  acao === "bloquear" ? "BLOQUEADO" : "ATIVO",
                blockedReason:
                  acao === "bloquear"
                    ? (body?.motivo?.trim() || "Bloqueado pelo administrador.")
                    : null,
                deletedAt: (acao === "restaurar" || acao === "reativar") ? null : u.deletedAt,
              }
            : u
        )
      );

      setUserSelecionado((prev) =>
        prev?.id === usuarioId
          ? {
              ...prev,
              status: acao === "bloquear" ? "BLOQUEADO" : "ATIVO",
              blockedReason:
                acao === "bloquear"
                  ? (body?.motivo?.trim() || "Bloqueado pelo administrador.")
                  : null,
              deletedAt: (acao === "restaurar" || acao === "reativar") ? null : prev.deletedAt,
            }
          : prev
      );
    }

    showToast(
      "success",
      acao === "bloquear"
        ? `Você bloqueou a conta de ${nome}${email ? ` (${email})` : ""}.`
        : acao === "desbloquear"
        ? `Você desbloqueou a conta de ${nome}${email ? ` (${email})` : ""}.`
        : acao === "restaurar"
        ? `Você restaurou a conta de ${nome}${email ? ` (${email})` : ""}.`
        : `Você reativou a conta de ${nome}${email ? ` (${email})` : ""}.`
    );
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "A requisição demorou demais e foi cancelada (timeout)."
        : e?.message || "Falha ao executar ação.";
    showToast("error", msg);
  } finally {
    setAcaoBusyId(null);
  }
}

async function excluirContaPermanente(usuario: any) {
  const confirmado = window.confirm(
    `Tem certeza que deseja EXCLUIR PERMANENTEMENTE a conta de "${usuario?.nome}"?\n\n` +
      `Isso apagará o usuário e dados relacionados do banco e ele nunca mais poderá logar.`
  );

  if (!confirmado) return;

  const typed = window.prompt('Digite EXCLUIR para confirmar:');
  if (typed !== "EXCLUIR") {
    alert("Exclusão cancelada.");
    return;
  }

  try {
    const token = Storage.token; // <- aqui é onde seu TS estava quebrando
    if (!token) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }

    await axios.delete(`${API.BASE_URL}/api/admin/usuarios/${usuario.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    alert("Conta excluída permanentemente.");

    // Atualiza a lista na tela
    setUsuarios((prev: any[]) => prev.filter((u) => u.id !== usuario.id));

    // Se o modal/detalhe estiver aberto para o mesmo usuário, feche
    if (userSelecionado?.id === usuario.id) {
      setUserSelecionado(null);
      setDetalheAberto(false);
    }
  } catch (err: any) {
    console.error("[Admin] erro hard-delete:", err?.response?.status, err?.response?.data, err?.message);
    alert(
      err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Erro ao excluir a conta."
    );
  }
}

async function toggleParceiroProfessor(professorId: string, next: boolean) {
  setProfParceiroBusyId(professorId);
  setProfessores((prev) =>
    prev.map((p) =>
      p.id === professorId
        ? { ...p, usuario: { ...(p.usuario || {}), parceiro: next } }
        : p
    )
  );

  try {
    const r = await fetch(`${API.BASE_URL}/api/professores/${professorId}/parceiro`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parceiro: next }),
    });

    const txt = await r.text().catch(() => "");
    if (!r.ok) {
      setProfessores((prev) =>
        prev.map((p) =>
          p.id === professorId
            ? { ...p, usuario: { ...(p.usuario || {}), parceiro: !next } }
            : p
        )
      );
      alert(txt || `Erro ao atualizar parceiro (HTTP ${r.status}).`);
      return;
    }
  } catch (e: any) {
    setProfessores((prev) =>
      prev.map((p) =>
        p.id === professorId
          ? { ...p, usuario: { ...(p.usuario || {}), parceiro: !next } }
          : p
      )
    );
    alert(e?.message || "Falha de rede ao atualizar parceiro.");
  } finally {
    setProfParceiroBusyId(null);
  }
}

useEffect(() => {
  const h = setTimeout(() => setAssDebQ(assQ.trim()), 400);
  return () => clearTimeout(h);
}, [assQ]);

useEffect(() => {
  const h = setTimeout(() => setExDebQ(exQ.trim()), 300);
  return () => clearTimeout(h);
}, [exQ]);

useEffect(() => {
  const h = setTimeout(() => setTrDebQ(trQ.trim()), 300);
  return () => clearTimeout(h);
}, [trQ]);

useEffect(() => {
  if (aba !== "assinaturas") return;
  void carregarAssinantes(1);
  void carregarAssOverview();
}, [aba, assPlano, assAtivo, assDebQ]);

useEffect(() => {
  if (aba !== "feedback") return;
  void carregarFeedback();
}, [aba, fbTipo, fbFrom, fbOnlyUnread]);

useEffect(() => {
  if (aba !== "exercicios") return;

  const id = window.setInterval(() => {
    void carregarExercicios();
  }, 8000); 

  return () => window.clearInterval(id);
}, [aba]);

  useEffect(() => {
    const h = setTimeout(() => setProfDebQ(profQ.trim()), 350);
    return () => clearTimeout(h);
  }, [profQ]);

  useEffect(() => {
    if (aba !== "professores") return;
    void carregarProfessores(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, profDebQ]);

  async function carregarProfessores(page: number) {
    setProfLoading(true);
    setProfErro("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(profPageSize));
      if (profDebQ) params.set("q", profDebQ);

      const r = await fetch(`${API.BASE_URL}/api/professores?${params.toString()}`, {
        headers: authHeaders(),
      });

      const txt = await r.text().catch(() => "");
      if (!r.ok) {
        setProfessores([]);
        setProfTotal(0);
        setProfPage(page);
        setProfErro(txt || `Falha ao carregar professores (HTTP ${r.status}).`);
        return;
      }

      const json = txt ? JSON.parse(txt) : [];
      const arr =
        Array.isArray(json)
          ? json
          : json.items ?? json.data ?? json.professores ?? json.rows ?? json.result ?? [];

      const items = Array.isArray(arr) ? arr : [];
      const total =
        (Array.isArray(json) ? json.length : (json.total ?? json.count ?? items.length)) ?? items.length;

      setProfessores(items);
      setProfTotal(Number(total || 0));
      setProfPage(Number((json as any)?.page || page));
    } catch (e: any) {
      setProfessores([]);
      setProfTotal(0);
      setProfErro(e?.message || "Falha de rede ao carregar professores.");
    } finally {
      setProfLoading(false);
    }
  }

  useEffect(() => {
    const h = setTimeout(() => setMetDebQ(metQ.trim()), 350);
    return () => clearTimeout(h);
  }, [metQ]);

  async function carregarTodasMetodologiasAdmin(page = 1) {
    setMetTodasLoading(true);
    setMetTodasErro("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(metPageSize));
      if (metDebQ) params.set("q", metDebQ);

      const r = await fetch(
        `${API.BASE_URL}/api/admin/metodologias/todas?${params.toString()}`,
        { headers: authHeaders() }
      );

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(j?.message || "Erro ao carregar metodologias.");
      }

      setMetTodas(Array.isArray(j.items) ? j.items : []);
      setMetTodasTotal(Number(j.total || 0));
      setMetTodasPage(Number(j.page || page));
    } catch (e: any) {
      setMetTodas([]);
      setMetTodasTotal(0);
      setMetTodasErro(e?.message || "Erro ao carregar metodologias.");
    } finally {
      setMetTodasLoading(false);
    }
  }

  async function carregarMetodologiasPendentes(page: number) {
    setMetLoading(true);
    setMetErro("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(metPageSize));
      if (metDebQ) params.set("q", metDebQ);

      const r = await fetch(`${API.BASE_URL}/api/admin/metodologias/pendentes?${params.toString()}`, {
        headers: authHeaders(),
      });

      const txt = await r.text().catch(() => "");
      if (!r.ok) {
        setMetPendentes([]);
        setMetTotal(0);
        setMetPage(page);
        setMetErro(txt || `Falha ao carregar metodologias pendentes (HTTP ${r.status}).`);
        return;
      }

      const json = txt ? JSON.parse(txt) : {};
      const items = Array.isArray(json.items) ? json.items : [];
      setMetPendentes(items);
      setMetTotal(Number(json.total || 0));
      setMetPage(Number(json.page || page));
    } catch (e: any) {
      setMetPendentes([]);
      setMetTotal(0);
      setMetErro(e?.message || "Falha de rede ao carregar metodologias pendentes.");
    } finally {
      setMetLoading(false);
    }
  }

  async function setMetodologiaAtiva(id: string, ativo: boolean, origemTipo: "LEARNING" | "AVULSA" = "LEARNING") {
    setAcaoBusyId(id);
    try {
      const r = await fetch(`${API.BASE_URL}/api/admin/metodologias/${id}/ativo`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ativo, origemTipo }),
      });
      const txt = await r.text().catch(() => "");
      if (!r.ok) {
        showToast("error", txt || `Erro HTTP ${r.status}`);
        return;
      }

      showToast("success", ativo ? "Metodologia ativada ✅" : "Metodologia desativada ✅");

      // remove da lista (porque essa aba é só pendentes)
      if (ativo) {
        setMetPendentes((prev) => prev.filter((m) => m.id !== id));
        setMetTotal((prev) => Math.max(0, prev - 1));
      } else {
        // se desativou de novo, mantém na lista
        await carregarMetodologiasPendentes(metPage);
      }
    } catch (e: any) {
      showToast("error", e?.message || "Falha de rede.");
    } finally {
      setAcaoBusyId(null);
    }
  }

  useEffect(() => {
    if (aba !== "metodologias") return;

    if (metTab === "pendentes") {
      void carregarMetodologiasPendentes(1);
    } else if (metTab === "minhas") {
      void carregarMinhasMetodologiasAdmin(1);
    } else {
      void carregarTodasMetodologiasAdmin(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, metTab, metDebQ]);

  async function carregarAssinantes(page: number) {
    setAssLoading(true);
    setAssErro("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(assPageSize));
      if (assDebQ) params.set("q", assDebQ);
      if (assPlano) params.set("plano", assPlano);
      if (assAtivo) params.set("ativo", assAtivo);

      const r = await fetch(`${API.BASE_URL}/api/admin/assinantes?${params}`, { headers: authHeaders() });
      if (!r.ok) {
        setAssErro(await r.text());
        setAssinantes([]);
        setAssTotal(0);
        return;
      }
      const j = await r.json();
      setAssinantes(Array.isArray(j.items) ? j.items : []);
      setAssTotal(Number(j.total || 0));
      setAssPage(Number(j.page || page));
    } catch {
      setAssErro("Falha ao carregar assinantes.");
      setAssinantes([]);
      setAssTotal(0);
    } finally {
      setAssLoading(false);
    }
  }

  async function carregarAssOverview() {
    try {
      const r = await fetch(`${API.BASE_URL}/api/admin/assinantes/overview`, { headers: authHeaders() });
      if (r.ok) setAssOverview(await r.json());
      else setAssOverview(null);
    } catch {
      setAssOverview(null);
    }
  }

  async function carregarExercicios() {
    try {
      const r = await fetch(`${API.BASE_URL}/api/exercicios`, { headers: authHeaders() });
      const j = await r.json();

      const arr = Array.isArray(j)
        ? j
        : j.items ?? j.data ?? j.exercicios ?? j.rows ?? j.result ?? [];

      setExercicios(Array.isArray(arr) ? arr : []);
    } catch {
      setExercicios([]);
    }
  }

  async function carregarFeedback() {
    setFbLoading(true);
    setFbError(null);
    try {
      const params = new URLSearchParams();
      if (fbTipo) params.set("tipo", fbTipo);
      if (fbFrom) params.set("from", fbFrom);

      const url = `${API.BASE_URL}/api/feedback?${params.toString()}`;
      const r = await fetch(url, { headers: authHeaders() });
      const txt = await r.text();

      if (!r.ok) {
        throw new Error(txt || `Erro HTTP ${r.status}`);
      }

      const data = txt ? JSON.parse(txt) : [];
      let arr: FeedbackAdmin[] = Array.isArray(data) ? data : data.items ?? [];

      if (fbOnlyUnread) {
        arr = arr.filter((f) => !f.lidoEm);
      }

      arr = [...arr].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return da - db; 
      });

      setFbItems(arr);
    } catch (err: any) {
      console.error("Erro ao carregar feedbacks:", err);
      setFbError(err?.message || "Erro ao carregar feedbacks.");
      setFbItems([]);
    } finally {
      setFbLoading(false);
    }
  }

  async function marcarFeedbackComoLido(id: string) {
    try {
      const r = await fetch(`${API.BASE_URL}/api/feedback/${id}/lido`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
      });

      if (!r.ok) {
        const txt = await r.text();
        alert(`Erro ao marcar como lido: ${txt || r.status}`);
        return;
      }

      setFbItems((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, lidoEm: new Date().toISOString() } : f
        )
      );
    } catch (e) {
      console.error(e);
      alert("Falha ao marcar feedback como lido.");
    }
  }

  function fmtDate(d?: string | null) {
    return d ? new Date(d).toLocaleString("pt-BR") : "—";
  }

  const isAdminBase = true;

  const isImage = (u: string) => /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(u);

  function toPlayer(raw?: string | null) {
    if (!raw) return null;
    const url = toAbsoluteUrl(raw) || raw;

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: "video" as const, src: url };
    if (isImage(url)) return { kind: "image" as const, src: url };

    const yt1 = url.match(/youtube\.com\/watch\?v=([^&]+)/i);
    const yt2 = url.match(/youtu\.be\/([^?]+)/i);
    if (yt1?.[1]) return { kind: "iframe" as const, src: `https://www.youtube.com/embed/${yt1[1]}` };
    if (yt2?.[1]) return { kind: "iframe" as const, src: `https://www.youtube.com/embed/${yt2[1]}` };
    return { kind: "iframe" as const, src: url };
  }

  function openVideo(raw?: string | null) {
    const p = toPlayer(raw);
    if (p) setPlayer(p);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlayer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    if (aba !== "exercicios") return;
    void carregarExercicios();
  }, [aba]);



  useEffect(() => {
    fetch(`${API.BASE_URL}/api/configuracoes`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setConfiguracoes)
      .catch(() => setConfiguracoes({}));
  }, []);

  useEffect(() => {
    if (aba !== "usuarios") return;
    carregarUsuarios(1).catch(() => {});
  }, [aba, tipoFiltro, debouncedQ]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API.BASE_URL}/api/admin`, { headers: authHeaders() });
        const txt = await res.text();

        if (!res.ok) {
          setDashErro(`Erro ao carregar dashboard: [${res.status}] ${txt || res.statusText}`);
          setDados(EMPTY_DASH);
          return;
        }

        const json = txt ? JSON.parse(txt) : {};
        setDados(json);
        setDashErro(null);
      } catch (e) {
        console.error("erro /api/admin", e);
        setDashErro("Erro de rede ao carregar dashboard.");
        setDados(EMPTY_DASH);
      } finally {
        setDashLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!FLAGS.DESAFIOS_ENABLED) return;
    fetch(`${API.BASE_URL}/api/desafios`, { headers: authHeaders() })
      .then((res) => res.json())
      .then(setDesafios)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (aba !== "treinos") return;

    (async () => {
      try {
        const resTreinos = await fetch(`${API.BASE_URL}/api/treinos/programados`, {
          headers: authHeaders(),
        });

        if (!resTreinos.ok) throw new Error(`/treinos/programados: ${resTreinos.status}`);

        const jsonTreinos = await resTreinos.json();
        const arr = Array.isArray(jsonTreinos)
          ? jsonTreinos
          : (jsonTreinos?.items ?? jsonTreinos?.data ?? []);

        function pickNum(...vals: any[]) {
          for (const v of vals) {
            if (v === 0) return 0;
            if (v === null || v === undefined) continue;
            const n = Number(v);
            if (Number.isFinite(n)) return n;
          }
          return 0;
        }

        const normTreinos = (Array.isArray(arr) ? arr : []).map((tr: any) => {
          const realizadoCount = pickNum(
            tr.realizadoCount,
            tr.realizados,
            tr.realizacoes,
            tr.realizacoesCount,
            tr.totalRealizacoes,
            tr.estatistica?.realizacoes,
            tr.stats?.realizacoes,
            tr.counts?.realizacoes,
            tr._count?.realizacoes
          );

          const agendadoCount = pickNum(
            tr.agendadoCount,
            tr.agendados,
            tr.agendamentos,
            tr.agendamentosCount,
            tr.totalAgendamentos,
            tr.estatistica?.agendamentos,
            tr.stats?.agendamentos,
            tr.counts?.agendamentos,
            tr._count?.agendamentos
          );

          return {
            id: String(tr.id),
            nome: String(tr.nome ?? ""),
            codigo: String(tr.codigo ?? ""),
            nivel: String(tr.nivel ?? ""),
            descricao: tr.descricao ?? "",
            realizadoCount,
            agendadoCount,
          };
        });

        setTreinos(normTreinos);

      } catch (e) {
        console.error("[admin-page] erro ao carregar treinos:", e);
        setTreinos([]);
      }
    })();
  }, [aba]);

  useEffect(() => {
    if (!FLAGS.DESAFIOS_ENABLED) return;
    if (aba !== "moderacao") return;
    carregarPendentes(1).catch(() => {});
  }, [aba, modStatus]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/admin/me`, { headers: authHeaders() });
        if (!r.ok) return;
        const me = await r.json();
        setMeId(me.id ?? null);
        setAdminNivel(me.adminNivel ?? 0);
        setCanManageAdmins(!!me.canManageAdmins);
      } catch {}
    })();
  }, []);

  async function carregarPendentes(page: number) {
    setModLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(modPageSize));
      params.set("status", modStatus);
      const res = await fetch(`${API.BASE_URL}/api/admin/moderacao/desafios?${params}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setModPendentes(Array.isArray(json.items) ? json.items : []);
      setModTotal(json.total ?? 0);
      setModPage(page);
    } finally {
      setModLoading(false);
    }
  }

  async function aprovarDesafio(id: string) {
    const txt = prompt("Ajuste de pontuação (opcional). Deixe vazio para usar a pontuação do desafio:");
    const ajuste = txt ? Number(txt) : undefined;
    await fetch(`${API.BASE_URL}/api/admin/moderacao/desafios/${id}/aprovar`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ajustePontuacao: ajuste }),
    });
    await carregarPendentes(modPage);
  }

  async function invalidarDesafio(id: string) {
    const motivo = prompt("Motivo da invalidação (obrigatório):");
    if (!motivo) return;
    await fetch(`${API.BASE_URL}/api/admin/moderacao/desafios/${id}/invalidar`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ motivo }),
    });
    await carregarPendentes(modPage);
  }

  async function criarAdminViaPrompt() {
    if (!canManageAdmins) return alert("Ação restrita ao super admin.");

    const email = prompt("Email do novo admin:");
    if (!email) return;
    const senha = prompt("Senha inicial do novo admin:");
    if (!senha) return;
    const nome = prompt("Nome (opcional):") ?? "";

    const resp = await fetch(`${API.BASE_URL}/api/admin/admins`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email, senha, nome }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      alert(`Erro ao criar admin: ${t}`);
      return;
    }
    alert("Administrador criado com sucesso! Ele já pode acessar /admin/login com o email/senha definidos.");
    await carregarUsuarios(1);
  }

  async function deletarAdmin(id: string) {
    if (!canManageAdmins) return alert("Ação restrita ao super admin.");
    if (meId && id === meId) return alert("Você não pode deletar sua própria conta.");
    if (!confirm("Tem certeza que deseja deletar este administrador?")) return;

    const resp = await fetch(`${API.BASE_URL}/api/admin/admins/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!resp.ok) {
      const t = await resp.text();
      alert(`Falha ao deletar: ${t}`);
      return;
    }
    alert("Administrador removido.");
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
  }

  async function carregarUsuarios(targetPage: number) {
  setCarregandoUsuarios(true);
  setErroUsuarios("");
  try {
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("pageSize", String(pageSize));
    if (debouncedQ) params.set("q", debouncedQ);
    if (tipoFiltro && tipoToServer[tipoFiltro]) {
      params.set("tipo", tipoToServer[tipoFiltro]);
    }

    const url = `${USERS_ENDPOINT}?${params.toString()}`;
    const res = await fetch(url, { headers: authHeaders() });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      setUsuarios([]);
      setTotalUsuarios(0);
      setErroUsuarios(
        `Falha ao buscar usuários (status ${res.status}). ${body || "Verifique se o token de admin é válido."}`
      );
      return;
    }

    const json: any = await res.json();
    const arr =
      Array.isArray(json)
        ? json
        : json.items ??
          json.data ??
          json.usuarios ??
          json.users ??
          json.rows ??
          json.result ??
          [];

    const items = Array.isArray(arr) ? arr : [];
    const total =
      json.total ??
      json.count ??
      (Array.isArray(json) ? json.length : items.length);

    setUsuarios(items);
    setTotalUsuarios(total);
    setPagina(targetPage);
  } catch (e) {
    setErroUsuarios("Erro inesperado ao carregar usuários.");
    setUsuarios([]);
    setTotalUsuarios(0);
  } finally {
    setCarregandoUsuarios(false);
  }
}

function abrirModalExcluirProfessor(p: any) {
  setProfDeleteErr("");
  setProfToDelete({ id: p.id, nome: p.nome });
  setProfDeleteModalOpen(true);
}

function fecharModalExcluirProfessor() {
  if (profDeleteBusy) return;
  setProfDeleteModalOpen(false);
  setProfToDelete(null);
  setProfDeleteErr("");
}

async function confirmarExcluirProfessor() {
  if (!profToDelete?.id) return;

  setProfDeleteBusy(true);
  setProfDeleteErr("");

  try {
    const response = await fetch(`${API.BASE_URL}/api/professores/${profToDelete.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      setProfDeleteErr(txt || `Erro ao excluir (HTTP ${response.status}).`);
      return;
    }

    fecharModalExcluirProfessor();
    alert("Professor e conta vinculada foram excluídos!");
    const nextPage = professores.length <= 1 && profPage > 1 ? profPage - 1 : profPage;
    await carregarProfessores(nextPage);

  } catch (e: any) {
    setProfDeleteErr(e?.message || "Falha de rede ao excluir.");
  } finally {
    setProfDeleteBusy(false);
  }
}


  async function abrirDetalhes(id: string) {
    setLoadingDetalhe(true);
    setDetalheAberto(true);
    try {
      const res = await fetch(`${usersBase}/${id}`, { headers: authHeaders() });
      const data = (await res.json()) as UsuarioDetalhe;
      try {
        if (!data.assinatura) {
          const r2 = await fetch(`${API.BASE_URL}/api/assinaturas/${id}`, { headers: authHeaders() });
          if (r2.ok) {
            const a = await r2.json();
            data.assinatura = a ?? null;
          }
        }
      } catch {}
      setUserSelecionado(data);
    } catch {
      setUserSelecionado(null);
    } finally {
      setLoadingDetalhe(false);
    }
  }

  async function toggleCampo(id: string, campo: "verificado" | "destaque", valor: boolean) {
    setAcaoBusyId(id);
    try {
      const r = await fetch(`${usersBase}/${id}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ [campo]: valor }),
      });

      const txt = await r.text().catch(() => "");
      if (!r.ok) {
        showToast("error", txt || `Falha ao atualizar (HTTP ${r.status}).`);
        return;
      }

      setUserSelecionado((prev) => (prev ? { ...prev, [campo]: valor } : prev));
      setUsuarios((prev) => prev.map((u) => (u.id === id ? ({ ...u, [campo]: valor } as UsuarioAdmin) : u)));
    } finally {
      setAcaoBusyId(null);
    }
  }

  async function banirOuDesbanir(id: string, banir: boolean) {
    const motivo = banir ? prompt("Motivo do banimento? (obrigatório)") : "";
    if (banir && !motivo) return;

    setAcaoBusyId(id);
    try {
      const url = `${usersBase}/${id}/banir`;
      const opts = banir
        ? { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ motivo }) }
        : { method: "DELETE", headers: authHeaders() };

      const r = await fetch(url, opts as RequestInit);
      const txt = await r.text().catch(() => "");
      if (!r.ok) {
        showToast("error", txt || `Erro ao ${banir ? "banir" : "desbanir"} (HTTP ${r.status}).`);
        return;
      }

      setUserSelecionado((prev) => (prev ? { ...prev, status: banir ? "banido" : "ATIVO" } : prev));
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? ({ ...u, status: banir ? "banido" : "ATIVO" } as any) : u))
      );
    } finally {
      setAcaoBusyId(null);
    }
  }

  async function removerConteudo(id: string, escopo: "posts" | "comentarios" | "todos") {
    if (!confirm(`Remover ${escopo} deste usuário? Essa ação é irreversível.`)) return;

    setAcaoBusyId(id);
    try {
      const r = await fetch(`${usersBase}/${id}/remover-conteudo`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ escopo }),
      });

      const txt = await r.text().catch(() => "");
      if (!r.ok) {
        showToast("error", txt || `Erro ao remover conteúdo (HTTP ${r.status}).`);
        return;
      }

      showToast("success", "Conteúdo removido.");
    } finally {
      setAcaoBusyId(null);
    }
  }

  async function alterarPlanoAssinatura(usuarioId: string, novoPlano: PlanoAssinatura) {
    if (!novoPlano) return;
    const resp = await fetch(`${API.BASE_URL}/api/assinaturas/${usuarioId}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plano: novoPlano }),
    });
    if (!resp.ok) return alert(await resp.text());
    const upd = await resp.json();
    setUserSelecionado(prev => prev ? ({ ...prev, assinatura: upd }) : prev);
    alert("Plano atualizado.");
  }

  async function cancelarAssinatura(usuarioId: string) {
    if (!confirm("Cancelar assinatura deste usuário?")) return;
    const resp = await fetch(`${API.BASE_URL}/api/assinaturas/${usuarioId}/cancelar`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!resp.ok) return alert(await resp.text());
    const upd = await resp.json();
    setUserSelecionado(prev => prev ? ({ ...prev, assinatura: upd }) : prev);
    alert("Assinatura cancelada.");
  }

  async function reativarAssinatura(usuarioId: string) {
    const resp = await fetch(`${API.BASE_URL}/api/assinaturas/${usuarioId}/reativar`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!resp.ok) return alert(await resp.text());
    const upd = await resp.json();
    setUserSelecionado(prev => prev ? ({ ...prev, assinatura: upd }) : prev);
    alert("Assinatura reativada.");
  }

  function daysBetween(a: Date, b: Date) {
    const ms = Math.abs(a.getTime() - b.getTime());
    return ms / (1000 * 60 * 60 * 24);
  }

  function getAccountAction(u: UsuarioAdmin) {
    const status = String((u as any).status ?? "").toUpperCase();
    const deletedAtRaw = (u as any).deletedAt as string | null | undefined;

    if (deletedAtRaw) {
      const deletedAt = new Date(deletedAtRaw);
      const days = daysBetween(new Date(), deletedAt);
      if (days <= 30) return "RESTORE" as const;  
      return "DELETED_EXPIRED" as const;         
    }

    if (status === "BLOQUEADO") return "UNBLOCK" as const;
    return "BLOCK" as const;
  }

  function formatDate(d?: string | null) {
    const v = d ?? (d as any)?.createdAt ?? (d as any)?.criado_em;
    if (!v) return "-";
    try {
      return new Date(v).toLocaleString("pt-BR");
    } catch {
      return String(v);
    }
  }

    function handleLogout() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.clear();
      }

      if ((window as any)?.Storage) {
        (window as any).Storage = {};
      }
    } catch (e) {
      console.error("Erro ao limpar storages no logout:", e);
    } finally {
      window.location.href = "/admin/login";
    }
  }

  const rotulo = { pendente: "pendentes", aprovado: "aprovados", invalido: "inválidos", todos: "registros" }[modStatus];
  const ver = Number(dados.totalVerificados || 0);
  const nver = Number(dados.totalNaoVerificados || 0);
  const normStr = (v: any) => String(v ?? "").toLowerCase().trim();
  const itemHasCategoria = (item: any, cat: string) => {
    if (!cat) return true;
    const alvo = normStr(cat);
    const raw = item?.categoria ?? item?.categorias ?? item?.Categoria ?? null;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (list.length === 0) return false;

    return list.some((c: any) => normStr(c).includes(alvo));
  };

  const matchesText = (item: any, qtxt: string) => {
    if (!qtxt) return true;
    const q = normStr(qtxt);
    const nome = normStr(item?.nome ?? item?.titulo);
    const codigo = normStr(item?.codigo);
    const nivel = normStr(item?.nivel ?? item?.dificuldade);
    const desc = normStr(item?.descricao ?? item?.resumo);

    return (
      nome.includes(q) ||
      codigo.includes(q) ||
      nivel.includes(q) ||
      desc.includes(q)
    );
  };

  const treinosFiltrados = useMemo(() => {
    return (Array.isArray(treinos) ? treinos : []).filter((t: any) => {
      if (!matchesText(t, trDebQ)) return false;
      if (!itemHasCategoria(t, trCat)) return false;
      return true;
    });
  }, [treinos, trDebQ, trCat]);

  const exerciciosFiltrados = useMemo(() => {
    return (Array.isArray(exercicios) ? exercicios : []).filter((ex: any) => {
      if (!matchesText(ex, exDebQ)) return false;
      if (!itemHasCategoria(ex, exCat)) return false;
      return true;
    });
  }, [exercicios, exDebQ, exCat]);

  const treinosOrdenados = [...treinosFiltrados].sort((a: any, b: any) => {
    const ra = Number(a.realizadoCount ?? a.realizados ?? 0);
    const rb = Number(b.realizadoCount ?? b.realizados ?? 0);

    if (rb !== ra) return rb - ra;

    const na = String(a.nome ?? "").toLowerCase();
    const nb = String(b.nome ?? "").toLowerCase();
    if (na !== nb) return na.localeCompare(nb);

    const ca = String(a.codigo ?? "").toLowerCase();
    const cb = String(b.codigo ?? "").toLowerCase();
    return ca.localeCompare(cb);
  });

  const exerciciosOrdenados = [...exerciciosFiltrados].sort((a: any, b: any) => {
    const ca = Number(a.usadoEmTreinos ?? 0);
    const cb = Number(b.usadoEmTreinos ?? 0);

    if (cb !== ca) return cb - ca;

    const na = String(a.nome ?? "").toLowerCase();
    const nb = String(b.nome ?? "").toLowerCase();
    if (na !== nb) return na.localeCompare(nb);

    const ka = String(a.codigo ?? "").toLowerCase();
    const kb = String(b.codigo ?? "").toLowerCase();
    return ka.localeCompare(kb);
  });

  const usuariosOrdenados = usuarios;
  const assinantesOrdenados = assinantes;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999]">
          <div
            className={`px-4 py-3 rounded shadow text-white ${
              toast.type === "success" ? "bg-green-700" : "bg-red-600"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <header className="flex justify-between items-center bg-green-900 text-white px-6 py-4 rounded">
        <h1 className="text-2xl font-bold">FOOTERA</h1>
        <button className="bg-red-600 px-4 py-2 rounded" onClick={handleLogout}>
          Sair
        </button>
      </header>

      <h2 className="text-xl font-semibold text-green-900 my-4">Painel Administrativo</h2>

      <nav className="flex flex-wrap gap-3 mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            className={`px-4 py-2 rounded ${aba === t ? "bg-green-800 text-white" : "bg-gray-200"}`}
            onClick={() => setAba(t)}
          >
            {t === "moderacao"
              ? "Moderação"
              : t === "validacao"
              ? "Validar desafios"
              : t === "metodologias"
              ? "Metodologias"
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {dashErro && (
        <div className="mb-4 rounded bg-red-50 text-red-700 px-4 py-2 text-sm">
          {dashErro}
        </div>
      )}

      {dashLoading && (
        <div className="mb-4 rounded bg-gray-100 text-gray-700 px-4 py-2 text-sm">
          Carregando…
        </div>
      )}

      <div className="p-4">
        {aba === "dashboard" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Dashboard Administrativo</h3>

            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card title="Total de Usuários" icon="👥" value={dados?.totalUsuarios ?? 0} />
              <Card title="Treinos Cadastrados" icon="🏋️" value={dados?.totalTreinos ?? 0} />
              <Card title="Posts Criados" icon="✍️" value={dados?.totalPostsCriados ?? 0} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">

              <div className="bg-white rounded shadow p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold">Status de verificação</h4>
                </div>
                <div className="flex items-center gap-6">
                  <DonutTwoSegments a={ver} b={nver} labelA="Verificados" labelB="Não verificados" />
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block w-3 h-3 rounded bg-green-600" /> Verificados: <strong>{ver}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded bg-gray-300" /> Não verificados: <strong>{nver}</strong>
                    </div>
                    <div className="mt-2 text-gray-600">
                      Taxa: <strong>{(ver + nver > 0 ? Math.round((ver * 100) / (ver + nver)) : 0)}%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

                        <h4 className="font-semibold mb-2">Distribuição de Usuários</h4>
            <div className="bg-white p-4 rounded shadow">
              {(() => {
                const distData = [
                  { label: "Atletas", value: Number(dados.totalAtletas || 0) },
                  { label: "Escolas de Futebol", value: Number(dados.totalEscolinhas || 0) },
                  { label: "Clubes Profissionais", value: Number(dados.totalClubes || 0) },
                  { label: "Professores", value: Number(dados.totalProfessores || 0) },
                  { label: "Olheiros", value: Number(dados.totalOlheiros || 0) },
                  { label: "Administradores", value: Number(dados.totalAdministradores || 0) },
                ].filter((d) => d.value > 0); 
                return <PieChart data={distData} />;
              })()}
            </div>
          </div>
        )}

        {aba === "usuarios" && (
          <div>
            <h3 className="text-xl font-bold mb-3">Usuários</h3>
            <div className="flex flex-wrap gap-2 items-center mb-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou email…"
                className="border rounded px-3 py-2 w-64"
              />
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as UsuarioTipo)}
                className="border rounded px-3 py-2"
              >
                <option value="">Todos os tipos</option>
                <option value="atleta">Atletas</option>
                <option value="escola">Escolas</option>
                <option value="clube">Clubes</option>
                <option value="professor">Professores</option>
                <option value="admin">Administrador</option>
                <option value="olheiro">Olheiro</option>
              </select>
              <button className="px-3 py-2 rounded bg-gray-200" onClick={() => carregarUsuarios(1)}>
                Atualizar
              </button>
              <div className="ml-auto text-sm text-gray-600">{carregandoUsuarios ? "Carregando…" : `${totalUsuarios} resultados`}</div>
            </div>

            {erroUsuarios && <div className="mb-3 text-sm text-red-600">{erroUsuarios}</div>}
            {canManageAdmins && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-amber-800">Gerenciar administradores</div>
                    <div className="text-sm text-amber-700">Somente você (super admin) pode criar e remover contas de admin.</div>
                  </div>
                  <button
                    onClick={() => (window.location.href = "/admin/admins/create")}
                    className="px-3 py-2 rounded bg-green-700 text-white hover:bg-green-800"
                  >
                    + Criar novo admin
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Usuário</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Criado em</th>
                    <th className="px-3 py-2 text-left">Última atv.</th>
                    <th className="px-3 py-2 text-left">Renova em</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosOrdenados.map((u) => {
                    const nome = u.nome ?? u.nomeDeUsuario ?? "(sem nome)";
                    const foto = avatarSrc(u.foto);
                    return (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                           <img
                              src={foto}
                              onError={onAvatarError}
                              className="w-8 h-8 rounded-full object-cover border"
                            />
                            <div className="font-medium flex items-center gap-2">
                              {nome}
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!u.verificado}
                                  disabled={!isAdminBase || acaoBusyId === u.id}
                                  onChange={(e) => toggleCampo(u.id, "verificado", e.target.checked)}
                                  title={!isAdminBase ? "Requer permissão de admin" : ""}
                                />
                                Verificado
                              </label>

                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!u.destaque}
                                  disabled={!isAdminBase || acaoBusyId === u.id}
                                  onChange={(e) => toggleCampo(u.id, "destaque", e.target.checked)}
                                  title={!isAdminBase ? "Requer permissão de admin" : ""}
                                />
                                Destaque
                              </label>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{u.email ?? "-"}</td>
                        <td className="px-3 py-2 capitalize">{u.tipo ?? "-"}</td>
                       <td className="px-3 py-2">{formatDate(u.criadoEm)}</td>
                          <td className="px-3 py-2">
                            {u.ultimaAtividade ? (
                              <>
                                <span className="block truncate max-w-[220px]" title={u.ultimaAtividadeNome ?? ""}>
                                  {u.ultimaAtividadeNome ?? "—"}
                                </span>
                                <span className="text-xs text-gray-500">{formatDate(u.ultimaAtividade)}</span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {fmtDate(u.assinatura?.renovaEm ?? null)}
                          </td>
                          <td className="px-3 py-2 text-right">
                          <div className="flex items-center gap-3 justify-end">
                            <button onClick={() => abrirDetalhes(u.id)} className="text-green-700 hover:underline">
                              Detalhes
                            </button>

                            {(() => {
                              const act = getAccountAction(u);

                              if (act === "DELETED_EXPIRED") {
                                return (
                                  <span className="text-gray-400 text-xs" title="Conta apagada há mais de 30 dias">
                                    Conta apagada
                                  </span>
                                );
                              }

                              if (act === "RESTORE") {
                                return (
                                  <button
                                    onClick={() => bloquearOuReativarConta(u.id, "restaurar")}
                                    className="text-green-700 hover:underline"
                                    disabled={acaoBusyId === u.id}
                                  >
                                    {acaoBusyId === u.id ? "Processando..." : "Restaurar conta"}
                                  </button>
                                );
                              }

                              if (act === "UNBLOCK") {
                                return (
                                  <button
                                    onClick={() => bloquearOuReativarConta(u.id, "desbloquear")}
                                    className="text-green-700 hover:underline"
                                    disabled={acaoBusyId === u.id}
                                  >
                                    {acaoBusyId === u.id ? "Processando..." : "Desbloquear conta"}
                                  </button>
                                );
                              }

                              return (
                                <button
                                  onClick={() => bloquearOuReativarConta(u.id, "bloquear")}
                                  className="text-red-600 hover:underline"
                                  title="Bloquear conta (impede login)"
                                  disabled={acaoBusyId === u.id}
                                >
                                  {acaoBusyId === u.id ? "Processando..." : "Bloquear conta"}
                                </button>
                              );
                            })()}
                            <button
                                className="text-red-800 hover:underline ml-3"
                                onClick={() => excluirContaPermanente(u)}
                              >
                                Excluir conta
                            </button>

                            {canManageAdmins && String(u.tipo).toLowerCase() === "admin" && u.id !== meId && (
                              <button onClick={() => deletarAdmin(u.id)} className="text-red-600 hover:underline" title="Deletar este administrador">
                                Remover admin
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!carregandoUsuarios && usuarios.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                disabled={pagina <= 1}
                onClick={() => carregarUsuarios(pagina - 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Anterior
              </button>
              <div className="text-sm text-gray-600">Página {pagina}</div>
              <button
                disabled={pagina * pageSize >= totalUsuarios || usuarios.length < pageSize}
                onClick={() => carregarUsuarios(pagina + 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {aba === "exercicios" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Gerenciar Exercícios</h3>
              <button
                className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800"
                onClick={() => (window.location.href = "/treinos/exercicios/novo?returnTo=/admin")}
              >
                + Novo Exercicio
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-4">
              <input
                value={exQ}
                onChange={(e) => setExQ(e.target.value)}
                placeholder="Pesquisar por nome, código, nível (Base/Avançado), descrição…"
                className="border rounded px-3 py-2 w-[min(520px,100%)]"
              />

              <div className="ml-auto text-sm text-gray-600">
                {exerciciosOrdenados.length} resultado(s)
              </div>
            </div>

            <ul className="space-y-2">
              {exerciciosOrdenados.map((ex: any) => {
                const videoUrl = resolveVideoUrl(ex);

                return (
                  <li key={ex.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                    <div>
                      <strong>{ex.nome}</strong> — {ex.codigo} [{ex.nivel}]
                      <p className="text-sm text-gray-500">{ex.descricao}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Esse exercício foi utilizado{" "}
                        <strong>{Number(ex.usadoEmTreinos || 0)}</strong> treinos diferentes
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => (window.location.href = `/treinos/exercicios/editar/${ex.id}?returnTo=/admin`)}
                        className="text-blue-600"
                        title="Editar exercício"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => {
                          if (!videoUrl) return alert("Este exercício não possui vídeo cadastrado.");
                          openVideo(videoUrl);
                        }}
                        className={videoUrl ? "text-green-600" : "text-gray-400 cursor-not-allowed"}
                        title={videoUrl ? "Ver vídeo demonstrativo" : "Sem vídeo"}
                        disabled={!videoUrl}
                      >
                        ▶️
                      </button>

                      <button
                        onClick={async () => {
                          const confirmar = confirm("Deseja excluir este exercício?");
                          if (!confirmar) return;
                          const response = await fetch(`${API.BASE_URL}/api/exercicios/${ex.id}`, {
                            method: "DELETE",
                            headers: authHeaders(),
                          });
                          if (response.ok) {
                            alert("Exercício excluído!");
                            await carregarExercicios();
                          } else {
                            alert("Erro ao excluir.");
                          }
                        }}
                        className="text-red-600"
                        title="Excluir exercício"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {aba === "treinos" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Gerenciar Treinos</h3>
              <button
                className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800"
                onClick={() => (window.location.href = "/admin/treinos/create")}
              >
                + Novo Treino
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-4">
              <input
                value={trQ}
                onChange={(e) => setTrQ(e.target.value)}
                placeholder="Pesquisar por nome, código, nível (Base/Avançado), descrição…"
                className="border rounded px-3 py-2 w-[min(520px,100%)]"
              />

              <div className="ml-auto text-sm text-gray-600">
                {treinosOrdenados.length} resultado(s)
              </div>
            </div>

            {treinosOrdenados.length === 0 ? (
              <p className="text-gray-500">Nenhum treino encontrado.</p>
            ) : (
              <ul className="space-y-2">
                {treinosOrdenados.map((t: any) => {
                  const nome = t.nome ?? t.titulo ?? "(sem nome)";
                  const codigo = t.codigo ?? "-";
                  const realizado = Number(t.realizadoCount ?? 0);
                  const agendado = Number(t.agendadoCount ?? 0);
                  const nivel = t.nivel ?? t.dificuldade ?? "-";
                  const descricao = t.descricao ?? t.resumo ?? "";
                  return (
                    <li key={t.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                      <div>
                        <strong>{nome}</strong> — {codigo} [{nivel}]
                        <p className="text-sm text-gray-500">{descricao}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Esse treino foi realizado{" "}
                          <strong>{realizado}</strong> vezes
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => (window.location.href = `/admin/treinos/create?id=${t.id}`)} className="text-blue-600">
                          ✏️
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Deseja mesmo excluir este treino?")) return;

                            let resp = await fetch(`${API.BASE_URL}/api/treinos/${t.id}`, {
                              method: "DELETE",
                              headers: authHeaders(),
                            });
                            if (!resp.ok) {
                              resp = await fetch(`${API.BASE_URL}/api/treinosprogramados/${t.id}`, {
                                method: "DELETE",
                                headers: authHeaders(),
                              });
                            }
                            if (resp.ok) {
                              alert("Treino excluído com sucesso!");
                              setTreinos((prev) => prev.filter((x) => x.id !== t.id));
                              void carregarExercicios();
                            } else {
                              alert("Erro ao excluir treino.");
                            }
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {aba === "professores" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Gerenciar Professores</h3>
              <button
                className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800"
                onClick={() => (window.location.href = "/admin/professores/create")}
              >
                + Novo Professor
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-4">
              <input
                value={profQ}
                onChange={(e) => setProfQ(e.target.value)}
                placeholder="Buscar por nome, código, CREF…"
                className="border rounded px-3 py-2 w-72"
              />

              <button
                className="px-3 py-2 rounded bg-gray-200"
                onClick={() => carregarProfessores(1)}
                disabled={profLoading}
              >
                {profLoading ? "Carregando…" : "Atualizar"}
              </button>

              <div className="ml-auto text-sm text-gray-600">
                {profLoading ? "Carregando…" : `${profTotal} resultados`}
              </div>
            </div>

            {profErro && <div className="mb-3 text-sm text-red-600">{profErro}</div>}

            <ul className="space-y-2">
              {professores.map((p: any) => {
                const nome = p.nome ?? p.usuario?.nome ?? "(sem nome)";
                const cref = p.cref ?? p.usuario?.cref ?? "—";
                const area = p.areaFormacao ?? p.formacao ?? "—";
                const foto = avatarSrc(p.fotoUrl ?? p.foto ?? p.usuario?.foto ?? null);

                const qualificacoes = Array.isArray(p.qualificacoes) ? p.qualificacoes : [];
                const certificacoes = Array.isArray(p.certificacoes) ? p.certificacoes : [];
                
                const parceiro = !!p.usuario?.parceiro;
                const parceiroBusy = profParceiroBusyId === p.id;

                return (
                  <li
                    key={p.id}
                    className="bg-white p-4 rounded shadow flex justify-between items-center"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={foto}
                        onError={onAvatarError}
                        className="w-12 h-12 rounded-full object-cover border"
                        alt="Foto do professor"
                      />
                      <div>
                        <strong>{nome}</strong>

                        <div className="text-sm text-gray-700 mt-1">
                          <span className="font-medium">CREF:</span> {cref}
                          {" • "}
                          <span className="font-medium">Formação:</span> {area}
                          {p.codigo ? (
                            <>
                              {" • "}
                              <span className="font-medium">Código:</span> {p.codigo}
                            </>
                          ) : null}
                        </div>

                        <p className="text-sm text-gray-600 mt-1">
                          Qualificações: {qualificacoes.join(", ") || "—"}
                        </p>
                        <p className="text-sm text-gray-500">
                          Certificações: {certificacoes.join(", ") || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-center">
                      <label className="flex items-center gap-2 text-sm select-none">
                        <input
                          type="checkbox"
                          checked={parceiro}
                          disabled={parceiroBusy}
                          onChange={(e) => {
                            const next = e.target.checked;
                            const ok = confirm(
                              next
                                ? `Marcar "${nome}" como Parceiro FootEra?`
                                : `Remover "${nome}" de Parceiro FootEra?`
                            );
                            if (!ok) return;

                            void toggleParceiroProfessor(p.id, next);
                          }}
                        />
                        Parceiro FootEra
                      </label>

                      {parceiro ? (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 border border-green-200">
                          Parceiro
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200">
                          Não parceiro
                        </span>
                      )}

                      <button
                        onClick={() => (window.location.href = `/admin/professores/create?id=${p.id}`)}
                        className="text-blue-600"
                        title="Editar professor"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => abrirModalExcluirProfessor(p)}
                        className="text-red-600"
                        title="Excluir professor"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                );
              })}

              {!profLoading && professores.length === 0 && (
                <li className="bg-white p-6 rounded shadow text-center text-gray-500">
                  Nenhum professor encontrado.
                </li>
              )}
            </ul>

            <div className="flex items-center justify-between mt-3">
              <button
                disabled={profPage <= 1 || profLoading}
                onClick={() => carregarProfessores(profPage - 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Anterior
              </button>

              <div className="text-sm text-gray-600">Página {profPage}</div>

              <button
                disabled={profLoading || profPage * profPageSize >= profTotal || professores.length < profPageSize}
                onClick={() => carregarProfessores(profPage + 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {aba === "metodologias" && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="text-xl font-bold">Metodologias</h3>

              <div className="flex gap-2">
                <button
                  className={`px-4 py-2 rounded ${metTab === "pendentes" ? "bg-green-700 text-white" : "bg-gray-200"}`}
                  onClick={() => setMetTab("pendentes")}
                >
                  Pendentes
                </button>

                <button
                  className={`px-4 py-2 rounded ${metTab === "minhas" ? "bg-green-700 text-white" : "bg-gray-200"}`}
                  onClick={() => setMetTab("minhas")}
                >
                  Minhas metodologias
                </button>

                <button
                  className={`px-4 py-2 rounded ${metTab === "todas" ? "bg-green-700 text-white" : "bg-gray-200"}`}
                  onClick={() => setMetTab("todas")}
                >
                  Metodologias totais
                </button>
              </div>

              <button
                className="ml-auto px-4 py-2 rounded bg-green-700 text-white font-semibold"
                onClick={() => {
                  window.location.href = "/learning/create";
                }}
              >
                + Criar metodologia
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-4">
              <input
                value={metQ}
                onChange={(e) => setMetQ(e.target.value)}
                placeholder="Buscar por título, descrição ou criador…"
                className="border rounded px-3 py-2 w-[min(520px,100%)]"
              />

              <button
                className="px-3 py-2 rounded bg-gray-200"
                onClick={() => {
                  if (metTab === "pendentes") {
                    carregarMetodologiasPendentes(1);
                  } else if (metTab === "minhas") {
                    carregarMinhasMetodologiasAdmin(1);
                  } else {
                    carregarTodasMetodologiasAdmin(1);
                  }
                }}
                disabled={
                  metTab === "pendentes"
                    ? metLoading
                    : metTab === "minhas"
                    ? metMinhasLoading
                    : metTodasLoading
                }
              >
                {(metTab === "pendentes"
                  ? metLoading
                  : metTab === "minhas"
                  ? metMinhasLoading
                  : metTodasLoading)
                  ? "Carregando…"
                  : "Atualizar"}
              </button>

              <div className="ml-auto text-sm text-gray-600">
                {metTab === "pendentes"
                  ? (metLoading ? "Carregando…" : `${metTotal} pendente(s)`)
                  : metTab === "minhas"
                  ? (metMinhasLoading ? "Carregando…" : `${metMinhasTotal} metodologia(s)`)
                  : (metTodasLoading ? "Carregando…" : `${metTodasTotal} metodologia(s)`)}
              </div>
            </div>

            {metTab === "pendentes" && (
              <div>
                {metErro ? (
                  <div className="mb-3 text-sm text-red-600">{metErro}</div>
                ) : null}

                {metLoading && metPendentes.length === 0 ? (
                  <div className="bg-white p-6 rounded shadow text-center text-gray-500">
                    Carregando metodologias pendentes...
                  </div>
                ) : metPendentes.length === 0 ? (
                  <div className="bg-white p-6 rounded shadow text-center text-gray-500">
                    Nenhuma metodologia pendente no momento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metPendentes.map((item: MetodologiaPendente) => (
                      <LearningCard
                        key={`met_pendente_${item.id}`}
                        item={{
                          ...item,
                          origemRegistro: item.origemTipo,
                        }}
                        href={getAdminMetodologiaHref(item)}
                        extraActions={
                          <div className="flex items-center gap-2">
                            {renderMetodologiaAdminActions(item, "pendentes")}
                          </div>
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <button
                    disabled={metPage <= 1 || metLoading}
                    onClick={() => carregarMetodologiasPendentes(metPage - 1)}
                    className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                  >
                    Anterior
                  </button>

                  <div className="text-sm text-gray-600">Página {metPage}</div>

                  <button
                    disabled={metLoading || metPage * metPageSize >= metTotal || metPendentes.length < metPageSize}
                    onClick={() => carregarMetodologiasPendentes(metPage + 1)}
                    className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}

            {metTab === "minhas" && (
              <div className="space-y-4">
                {metMinhasErro ? <div className="mb-3 text-sm text-red-600">{metMinhasErro}</div> : null}

                {metMinhasLoading && metMinhas.length === 0 ? (
                  <div className="bg-white p-6 rounded shadow text-center text-gray-500">
                    Carregando suas metodologias...
                  </div>
                ) : metMinhas.length === 0 ? (
                  <div className="bg-white p-6 rounded shadow text-center text-gray-500">
                    Você ainda não criou nenhuma metodologia.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {metMinhas.map((item: MetodologiaPendente) => (
                      <LearningCard
                        key={`met_minha_${item.id}`}
                        item={{
                          ...item,
                          origemRegistro: item.origemTipo,
                        }}
                        href={getAdminMetodologiaHref(item)}
                        extraActions={
                          <div className="flex items-center gap-2">
                            {renderMetodologiaAdminActions(item, "minhas")}
                          </div>
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <button
                    disabled={metMinhasPage <= 1 || metMinhasLoading}
                    onClick={() => carregarMinhasMetodologiasAdmin(metMinhasPage - 1)}
                    className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                  >
                    Anterior
                  </button>

                  <div className="text-sm text-gray-600">Página {metMinhasPage}</div>

                  <button
                    disabled={
                      metMinhasLoading ||
                      metMinhasPage * metPageSize >= metMinhasTotal ||
                      metMinhas.length < metPageSize
                    }
                    onClick={() => carregarMinhasMetodologiasAdmin(metMinhasPage + 1)}
                    className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}

            {metTab === "todas" && (
              <div className="space-y-4">
                {metTodasErro ? <div className="mb-3 text-sm text-red-600">{metTodasErro}</div> : null}

                {metTodasLoading && metTodas.length === 0 ? (
                  <div className="bg-white p-6 rounded shadow text-center text-gray-500">
                    Carregando metodologias...
                  </div>
                ) : metTodas.length === 0 ? (
                  <div className="bg-white p-6 rounded shadow text-center text-gray-500">
                    Nenhuma metodologia encontrada.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {metTodas.map((item: any) => (
                      <LearningCard
                        key={`met_todas_${item.id}`}
                        item={{
                          ...item,
                          origemRegistro: item.origemTipo,
                        }}
                        href={getAdminMetodologiaHref(item)}
                        extraActions={
                          <div className="flex items-center gap-2">
                            {renderMetodologiaAdminActions(item, "todas")}
                          </div>
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <button
                    disabled={metTodasPage <= 1 || metTodasLoading}
                    onClick={() => carregarTodasMetodologiasAdmin(metTodasPage - 1)}
                    className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                  >
                    Anterior
                  </button>

                  <div className="text-sm text-gray-600">Página {metTodasPage}</div>

                  <button
                    disabled={
                      metTodasLoading ||
                      metTodasPage * metPageSize >= metTodasTotal ||
                      metTodas.length < metPageSize
                    }
                    onClick={() => carregarTodasMetodologiasAdmin(metTodasPage + 1)}
                    className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
        
        {aba === "desafios" &&
          (FLAGS.DESAFIOS_ENABLED ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Gerenciar Desafios</h3>
                <button
                  className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800"
                  onClick={() => (window.location.href = "/admin/desafios/create")}
                >
                  + Novo Desafio
                </button>
              </div>
              <ul className="space-y-2">
                {desafios.map((d: any) => (
                  <li key={d.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                    <div>
                      <strong>{d.titulo}</strong>
                      <p>• {(Array.isArray(d.categoria) ? d.categoria : [d.categoria]).filter(Boolean).join(", ")} - {d.descricao}</p>
                      <p className="text-sm text-gray-500">Pontos: {d.pontuacao}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => (window.location.href = `/admin/desafios/create?id=${d.id}`)} className="text-blue-600">
                        ✏️
                      </button>
                      <button
                        onClick={async () => {
                          const confirmar = confirm("Deseja mesmo excluir este desafio?");
                          if (!confirmar) return;
                          const response = await fetch(`${API.BASE_URL}/api/desafios/${d.id}`, { method: "DELETE" });
                          if (response.ok) {
                            alert("Desafio excluído com sucesso!");
                            window.location.reload();
                          } else {
                            alert("Erro ao excluir desafio.");
                          }
                        }}
                        className="text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-gray-600">Desafios desativados por enquanto.</div>
          ))}

        {aba === "validacao" && (FLAGS.DESAFIOS_ENABLED ? <ValidacaoVideo /> : null)}

        {aba === "moderacao" &&
          (FLAGS.DESAFIOS_ENABLED ? (
            <div>
              <h3 className="text-xl font-bold mb-3">Moderação</h3>
              <div className="flex items-center gap-2 mb-2">
                <div className="font-semibold text-green-900">Desafios</div>
                <select className="border rounded px-2 py-1" value={modStatus} onChange={(e) => setModStatus(e.target.value as any)}>
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendentes</option>
                  <option value="aprovado">Aprovados</option>
                  <option value="invalido">Inválidos</option>
                </select>
              </div>
              <div className="bg-white rounded shadow overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Atleta</th>
                      <th className="px-3 py-2 text-left">Desafio</th>
                      <th className="px-3 py-2 text-left">Resultado</th>
                      <th className="px-3 py-2 text-left">Enviado</th>
                      <th className="px-3 py-2 text-left">Vídeo</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {modPendentes.map((it) => {
                      const fotoAtleta = avatarSrc(it.atleta.foto);
                      return (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={fotoAtleta}
                                onError={onAvatarError}
                                className="w-8 h-8 rounded-full object-cover border"
                              />
                              <div className="font-medium">{it.atleta.nome}</div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {it.desafio.titulo} <span className="text-xs text-gray-600">({it.desafio.pontuacao} pts)</span>
                          </td>
                          <td className="px-3 py-2">
                            <div>{formatResultado(it)}</div>
                            {it.observacao && <div className="text-xs text-gray-500">{it.observacao}</div>}
                          </td>

                          <td className="px-3 py-2">{new Date(it.criadoEm).toLocaleString("pt-BR")}</td>

                          <td className="px-3 py-2">
                            {it.videoUrl ? (
                              <button className="text-blue-600 underline" onClick={() => openVideo(it.videoUrl)}>
                                ver vídeo
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="px-3 py-2 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => aprovarDesafio(it.id)} className="px-3 py-1 rounded bg-green-600 text-white">
                                Aprovar
                              </button>
                              <button onClick={() => invalidarDesafio(it.id)} className="px-3 py-1 rounded bg-red-600 text-white">
                                Invalidar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!modLoading && modPendentes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                          Nada pendente no momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  disabled={modPage <= 1}
                  onClick={() => carregarPendentes(modPage - 1)}
                  className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                >
                  Anterior
                </button>
                <div className="text-sm text-gray-600">{modLoading ? "Carregando…" : `Página ${modPage} • ${modTotal} ${rotulo}`}</div>
                <button
                  disabled={modPage * modPageSize >= modTotal || modPendentes.length < modPageSize}
                  onClick={() => carregarPendentes(modPage + 1)}
                  className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          ) : null)}

        {aba === "assinaturas" && (
          <div>
            <h3 className="text-xl font-bold mb-3">Gerenciar Assinaturas</h3>

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <Card title="Total de Assinaturas" icon="🧾" value={Number(assOverview?.total || 0)} />
              <Card title="Ativas" icon="✅" value={Number(assOverview?.ativos || 0)} />
              <Card title="Canceladas" icon="🛑" value={Number(assOverview?.cancelados || 0)} />
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-4">
              <input
                value={assQ}
                onChange={(e) => setAssQ(e.target.value)}
                placeholder="Buscar por nome, @usuario ou e-mail…"
                className="border rounded px-3 py-2 w-64"
              />
              <select value={assPlano} onChange={(e) => setAssPlano(e.target.value)} className="border rounded px-3 py-2">
                <option value="">Todos os planos</option>
                <option value="FREE">FREE</option>
                <option value="PRO">PRO</option>
                <option value="ELITE">ELITE</option>
              </select>
              <select value={assAtivo} onChange={(e) => setAssAtivo(e.target.value)} className="border rounded px-3 py-2">
                <option value="">Status (todos)</option>
                <option value="true">Ativas</option>
                <option value="false">Inativas</option>
              </select>
              <button className="px-3 py-2 rounded bg-gray-200" onClick={() => carregarAssinantes(1)}>
                Atualizar
              </button>
              <div className="ml-auto text-sm text-gray-600">
                {assLoading ? "Carregando…" : `${assTotal} resultados`}
              </div>
            </div>

            {assErro && <div className="mb-3 text-sm text-red-600">{assErro}</div>}

            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Usuário</th>
                    <th className="px-3 py-2 text-left">Plano</th>
                    <th className="px-3 py-2 text-left">Início</th>
                    <th className="px-3 py-2 text-left">Cancelada em</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {assinantesOrdenados.map((a) => {
                    const u = a.usuario;
                    const nome = u.nome ?? u.nomeDeUsuario ?? "(sem nome)";
                    const foto = avatarSrc(u.foto);
                    return (
                      <tr key={a.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={foto}
                              onError={onAvatarError}
                              className="w-8 h-8 rounded-full object-cover border"
                            />
                            <div>
                              <div className="font-medium">{nome}</div>
                              <div className="text-xs text-gray-600">{u.email ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{a.plano}</td>
                        <td className="px-3 py-2">{fmtDate(a.startsAt)}</td>
                        <td className="px-3 py-2">{fmtDate(a.canceledAt)}</td>
                        <td className="px-3 py-2">
                          {a.ativo ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Ativa</span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Inativa</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center gap-3 justify-end">
                            <button
                              className="text-green-700 hover:underline"
                              onClick={() => abrirDetalhes(u.id)}
                            >
                              Ver conta
                            </button>

                            <button
                              className="text-blue-600"
                              onClick={async () => {
                                const atual = a.plano ?? "FREE";
                                const novo = prompt('Novo plano (FREE | PRO | ELITE):', String(atual))?.toUpperCase().trim();
                                if (!novo) return;
                                await alterarPlanoAssinatura(u.id, novo);
                                await carregarAssinantes(assPage);
                                await carregarAssOverview();
                              }}
                            >
                              Trocar plano
                            </button>

                            {a.ativo ? (
                              <button
                                className="text-red-600"
                                onClick={async () => {
                                  await cancelarAssinatura(u.id);
                                  await carregarAssinantes(assPage);
                                  await carregarAssOverview();
                                }}
                              >
                                Cancelar
                              </button>
                            ) : (
                              <button
                                className="text-green-700"
                                onClick={async () => {
                                  await reativarAssinatura(u.id);
                                  await carregarAssinantes(assPage);
                                  await carregarAssOverview();
                                }}
                              >
                                Reativar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!assLoading && assinantes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        Nenhuma assinatura encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                disabled={assPage <= 1}
                onClick={() => carregarAssinantes(assPage - 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Anterior
              </button>
              <div className="text-sm text-gray-600">Página {assPage}</div>
              <button
                disabled={assPage * assPageSize >= assTotal || assinantes.length < assPageSize}
                onClick={() => carregarAssinantes(assPage + 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>

            {assOverview && (
              <div className="mt-6 bg-white rounded shadow p-4">
                <div className="font-semibold mb-2">Distribuição por plano (ativos)</div>
                <div className="flex flex-wrap gap-3 text-sm">
                  {Object.entries(assOverview.porPlano).map(([plan, v]) => (
                    <div key={plan} className="px-3 py-2 bg-gray-50 rounded border">
                      <div className="font-medium">{plan}</div>
                      <div>Total: {v.total}</div>
                      <div>Ativos: {v.ativos}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {aba === "feedback" && (
          <div>
            <h3 className="text-xl font-bold mb-3">Feedback dos usuários</h3>

            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <div className="text-sm text-gray-700">Tipo</div>
                <select
                  value={fbTipo}
                  onChange={(e) => setFbTipo(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="">Todos</option>
                  <option value="sugestao">Sugestão</option>
                  <option value="bug">Erro / Bug</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <div className="text-sm text-gray-700">A partir de</div>
                <input
                  type="date"
                  value={fbFrom}
                  onChange={(e) => setFbFrom(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fbOnlyUnread}
                  onChange={(e) => setFbOnlyUnread(e.target.checked)}
                />
                Mostrar apenas não lidos
              </label>

              <button
                onClick={() => carregarFeedback()}
                className="px-3 py-2 rounded bg-gray-200 text-sm"
              >
                Recarregar
              </button>

              <div className="ml-auto text-sm text-gray-600">
                {fbLoading ? "Carregando…" : `${fbItems.length} registros`}
              </div>
            </div>

            {fbError && (
              <div className="mb-3 text-sm text-red-600">{fbError}</div>
            )}

            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Mensagem</th>
                    <th className="px-3 py-2 text-left">Usuário</th>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {fbItems.map((f) => {
                    const u = f.usuario;
                    const nome =
                      u?.nome ||
                      u?.nomeDeUsuario ||
                      "(sem nome)";
                    const tipoBadge =
                      f.tipo === "bug"
                        ? "bg-red-100 text-red-700 border-red-200"
                        : f.tipo === "sugestao"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-gray-100 text-gray-700 border-gray-200";

                    return (
                      <tr key={f.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full border text-xs font-medium capitalize ${tipoBadge}`}
                          >
                            {f.tipo || "outro"}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-xl">
                          <div className="whitespace-pre-wrap">
                            {f.mensagem}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {u ? (
                            <>
                              <div className="font-medium">
                                {nome}
                              </div>
                              <div className="text-xs text-gray-600">
                                {u.email ?? "—"}{" "}
                                {u.tipo ? `(${u.tipo})` : ""}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-500 text-xs">
                              usuário não encontrado
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {formatDate(f.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          {f.lidoEm ? (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                              Lido
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                              Novo
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!f.lidoEm && (
                            <button
                              onClick={() => marcarFeedbackComoLido(f.id)}
                              className="text-xs px-3 py-1 rounded bg-green-700 text-white hover:bg-green-800"
                            >
                              Marcar como lido
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!fbLoading && fbItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-gray-500"
                      >
                        Nenhum feedback encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba === "analises" && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Análises</h3>
            <AnalyticsPane />
          </div>
        )}

        {aba === "configuracoes" && configuracoes && (
          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-bold mb-4">Configurações do Sistema</h3>

            <div className="mb-6">
              <h4 className="font-semibold text-green-800 mb-2">🔍 Funcionalidades</h4>
              {[
                { key: "registrationEnabled", label: "registration_enabled", desc: "Habilita o registro de novos usuários na plataforma" },
                { key: "maintenanceMode", label: "maintenance_mode", desc: "Coloca o site em modo de manutenção" },
                { key: "allowAthleteChallenges", label: "allow_athete_challenges", desc: "Permite que atletas participem de desafios" },
                { key: "allowProfileEditing", label: "allow_profile_editing", desc: "Permite edição de perfis pelos usuários" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between border-b py-2">
                  <div>
                    <p className="font-medium">{item.label} </p>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>

                <ToggleSwitch
                  checked={!!configuracoes?.[item.key]}
                  disabled={false} // ou coloque seu loading/busy aqui se quiser travar durante o PATCH
                  onChange={async (next) => {
                    // otimista
                    setConfiguracoes((prev: any) => ({ ...(prev || {}), [item.key]: next }));

                    try {
                      const res = await fetch(`${API.BASE_URL}/api/configuracoes`, {
                        method: "PATCH",
                        headers: authHeaders({ "Content-Type": "application/json" }),
                        body: JSON.stringify({ [item.key]: next }),
                      });

                      if (!res.ok) {
                        const txt = await res.text().catch(() => "");
                        setConfiguracoes((prev: any) => ({ ...(prev || {}), [item.key]: !next }));
                        alert(txt || "Erro ao salvar configuração.");
                        return;
                      }

                      const txt = await res.text().catch(() => "");
                      if (txt) setConfiguracoes(JSON.parse(txt));
                    } catch (err: any) {
                      setConfiguracoes((prev: any) => ({ ...(prev || {}), [item.key]: !next }));
                      alert(err?.message || "Falha de rede ao salvar configuração.");
                    }
                  }}
                />

                </div>
              ))}
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-green-800 mb-2">⚙️ Outras Configurações</h4>
              <label className="font-semibold flex items-center justify-between py-2">max_daily_posts </label>
              <p className="text-sm -mt-2">Número máximo de postagens diárias por usuário</p>
              <input
                type="number"
                className="border px-2 py-1 rounded w-24"
                value={configuracoes.maxDailyPosts}
                onChange={async (e) => {
                  const novoValor = parseInt(e.target.value);
                  setConfiguracoes({ ...configuracoes, maxDailyPosts: novoValor });

                  await fetch(`${API.BASE_URL}/api/configuracoes`, {
                    method: "PATCH",
                    headers: authHeaders({ "Content-Type": "application/json" }),
                    body: JSON.stringify({ maxDailyPosts: novoValor }),
                  });
                }}
              />
            </div>

            <div className="mt-4">
              <h4 className="font-semibold text-green-800 mb-2">🔧 Ações Administrativas</h4>
              <div className="flex gap-4">
                <button className="bg-gray-200 px-4 py-2 rounded" onClick={() => alert("Cache atualizado!")}>
                  Atualizar Cache
                </button>
                <button className="bg-gray-200 px-4 py-2 rounded" onClick={() => alert("Verificação de integridade feita!")}>
                  Verificar Integridade
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {player && (
        <div className="fixed inset-0 z-[9999] grid place-items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPlayer(null)} />
          <div className="relative z-10">
            {player.kind === "video" && (
              <video src={player.src} controls autoPlay className="block max-w-[92vw] max-h-[90vh] rounded-lg shadow-xl" />
            )}
            {player.kind === "image" && (
              <img src={player.src} alt="Prévia" className="block max-w-[85vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-xl" />
            )}
            {player.kind === "iframe" && (
              <div className="rounded-lg shadow-xl overflow-hidden">
                <iframe
                  src={player.src}
                  className="block w-[min(92vw,calc(90vh*16/9))] h-[min(90vh,calc(92vw*9/16))]"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="no-referrer"
                  allowFullScreen
                />
              </div>
            )}
            <button onClick={() => setPlayer(null)} className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full shadow p-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {metDetailOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMetDetailOpen(false)} />
          <div className="relative bg-white w-full max-w-3xl rounded shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">Detalhes da Metodologia</h4>
              <button 
                onClick={() => {
                  setMetDetailOpen(false);
                  setExpandedTreinoItemId(null);
                }} 
                className="text-gray-600"
              >
                ✕
              </button>
            </div>

            {metDetailLoading && <div className="text-sm text-gray-600">Carregando…</div>}
            {!!metDetailErr && <div className="text-sm text-red-600">{metDetailErr}</div>}

            {!metDetailLoading && metDetail && (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-28 h-28 rounded bg-gray-100 overflow-hidden border flex items-center justify-center">
                    {toAbsoluteUrl(metDetail.capaUrl) ? (
                      <img
                        src={toAbsoluteUrl(metDetail.capaUrl)!}
                        className="w-full h-full object-cover"
                        onError={(e) => ((e.currentTarget.style.display = "none"), void 0)}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">sem capa</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg">{metDetail.titulo}</div>
                    <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                      {metDetail.descricao || "—"}
                    </div>

                    <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded bg-gray-50 border">
                        Nível: <strong>{metDetail.nivel ?? "—"}</strong>
                      </span>
                      <span className="px-2 py-1 rounded bg-gray-50 border">
                        Itens: <strong>{Number(metDetail._count?.itens || metDetail.itens?.length || 0)}</strong>
                      </span>
                      <span className="px-2 py-1 rounded bg-gray-50 border">
                        Assinantes: <strong>{Number(metDetail._count?.assinantes || 0)}</strong>
                      </span>
                      <span className="px-2 py-1 rounded bg-gray-50 border">
                        Criado em: <strong>{formatDate(metDetail.criadoEm ?? null)}</strong>
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 mt-2">
                      Criador:{" "}
                      <strong>
                        {metDetail.criadorUsuario?.nome ||
                          metDetail.criadorUsuario?.nomeDeUsuario ||
                          metDetail.criadorUsuario?.email ||
                          "—"}
                      </strong>
                      {metDetail.criadorUsuario?.parceiro ? (
                        <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                          Parceiro
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Itens da metodologia</div>

                    <button
                      className="px-3 py-2 rounded bg-green-700 hover:bg-green-800 text-white text-sm disabled:opacity-60"
                      disabled={acaoBusyId === metDetail.id}
                      onClick={() => {
                        const ok = confirm(`Ativar esta metodologia?\n\n"${metDetail.titulo}"`);
                        if (!ok) return;
                        void setMetodologiaAtiva(
                          metDetail.id,
                          true,
                          (metDetail.origemTipo || "LEARNING") as "LEARNING" | "AVULSA"
                        ).then(() => {
                          setMetDetailOpen(false);
                        });
                      }}
                    >
                      {acaoBusyId === metDetail.id ? "Ativando..." : "Ativar ✅"}
                    </button>
                  </div>

                  {Array.isArray(metDetail.itens) && metDetail.itens.length > 0 ? (
                    <div className="max-h-[45vh] overflow-auto rounded border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Semana</th>
                            <th className="px-3 py-2 text-left">Ordem</th>
                            <th className="px-3 py-2 text-left">Tipo</th>
                            <th className="px-3 py-2 text-left">Título</th>
                            <th className="px-3 py-2 text-left">Mídia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metDetail.itens.map((it) => {
                            const isTreino = String(it.tipo).toUpperCase() === "TREINO";
                            const isOpen = expandedTreinoItemId === it.id;
                            const tp = it.treinoProgramado;
                            const exercs = Array.isArray(tp?.exercicios) ? tp!.exercicios : [];

                            return (
                              <React.Fragment key={it.id}>
                                <tr className="border-t">
                                  <td className="px-3 py-2">{it.semana}</td>
                                  <td className="px-3 py-2">{it.ordem}</td>
                                  <td className="px-3 py-2">
                                    <span className="px-2 py-0.5 rounded bg-gray-100 border">
                                      {it.tipo}
                                    </span>
                                  </td>

                                  <td className="px-3 py-2">
                                    <div className="font-medium flex items-center gap-2">
                                      {it.titulo}

                                      {isTreino && tp && (
                                        <button
                                          className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                                          onClick={() => setExpandedTreinoItemId(isOpen ? null : it.id)}
                                          title="Ver detalhes do treino"
                                        >
                                          {isOpen ? "Recolher ▲" : "Detalhes ▼"}
                                        </button>
                                      )}
                                    </div>

                                    {tp ? (
                                      <div className="text-xs text-gray-500">
                                        Treino: {tp.nome} ({tp.codigo})
                                      </div>
                                    ) : null}
                                  </td>

                                  <td className="px-3 py-2">
                                    {it.videoUrl ? (
                                      <button className="text-blue-700 underline" onClick={() => openVideo(it.videoUrl!)}>
                                        ver vídeo
                                      </button>
                                    ) : it.thumbUrl ? (
                                      <button
                                        className="text-blue-700 underline"
                                        onClick={() => setPlayer({ kind: "image", src: toAbsoluteUrl(it.thumbUrl)! })}
                                      >
                                        ver thumb
                                      </button>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>

                                {/* GAVETA */}
                                {isTreino && tp && isOpen && (
                                  <tr className="border-t bg-gray-50">
                                    <td colSpan={5} className="px-3 py-3">
                                      <div className="rounded border bg-white p-3">
                                        <div className="flex flex-wrap items-center gap-2 justify-between">
                                          <div>
                                            <div className="font-semibold text-gray-900">
                                              {tp.nome} <span className="text-xs text-gray-500">({tp.codigo})</span>
                                            </div>
                                            {tp.descricao ? (
                                              <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                                                {tp.descricao}
                                              </div>
                                            ) : null}
                                          </div>

                                          <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                                            <span className="px-2 py-1 rounded bg-gray-50 border">
                                              Nível: <strong>{tp.nivel ?? "—"}</strong>
                                            </span>
                                            <span className="px-2 py-1 rounded bg-gray-50 border">
                                              Duração: <strong>{tp.duracao ?? "—"} min</strong>
                                            </span>
                                            <span className="px-2 py-1 rounded bg-gray-50 border">
                                              Pontos: <strong>{tp.pontuacao ?? "—"}</strong>
                                            </span>
                                            <span className="px-2 py-1 rounded bg-gray-50 border">
                                              Exercícios: <strong>{exercs.length}</strong>
                                            </span>
                                          </div>
                                        </div>

                                        <div className="mt-3">
                                          {exercs.length === 0 ? (
                                            <div className="text-sm text-gray-500">Sem exercícios nesse treino.</div>
                                          ) : (
                                            <div className="overflow-auto rounded border">
                                              <table className="min-w-full text-sm">
                                                <thead className="bg-gray-50">
                                                  <tr>
                                                    <th className="px-3 py-2 text-left w-16">#</th>
                                                    <th className="px-3 py-2 text-left">Exercício</th>
                                                    <th className="px-3 py-2 text-left w-32">Reps</th>
                                                    <th className="px-3 py-2 text-left w-28">Vídeo</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {exercs
                                                    .slice()
                                                    .sort((a: any, b: any) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
                                                    .map((ex: any) => {
                                                      const exInfo = ex.exercicio;
                                                      const video = exInfo?.videoDemonstrativoUrl ?? null;
                                                      return (
                                                        <tr key={ex.id} className="border-t">
                                                          <td className="px-3 py-2">{ex.ordem ?? "—"}</td>
                                                          <td className="px-3 py-2">
                                                            <div className="font-medium">{exInfo?.nome ?? "—"}</div>
                                                            <div className="text-xs text-gray-500">
                                                              {exInfo?.codigo ?? "—"} • {exInfo?.nivel ?? "—"}
                                                            </div>
                                                            {exInfo?.descricao ? (
                                                              <div className="text-xs text-gray-600 mt-1">
                                                                {exInfo.descricao}
                                                              </div>
                                                            ) : null}
                                                          </td>
                                                          <td className="px-3 py-2">{ex.repeticoes ?? "—"}</td>
                                                          <td className="px-3 py-2">
                                                            {video ? (
                                                              <button
                                                                className="text-blue-700 underline"
                                                                onClick={() => openVideo(video)}
                                                              >
                                                                ver vídeo
                                                              </button>
                                                            ) : (
                                                              <span className="text-gray-400">—</span>
                                                            )}
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}

                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Sem itens.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {detalheAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetalheAberto(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">Detalhes da Conta</h4>
              <button onClick={() => setDetalheAberto(false)} className="text-gray-600">
                ✕
              </button>
            </div>

            {loadingDetalhe && <p>Carregando…</p>}

            {!loadingDetalhe && userSelecionado
              ? (() => {
                  const u = userSelecionado!;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={avatarSrc(userSelecionado?.foto)}
                          onError={onAvatarError}
                          className="w-14 h-14 rounded-full object-cover border"
                        />
                        <div>
                          <div className="font-semibold text-base">{u.nome ?? u.nomeDeUsuario}</div>
                          <div className="text-sm text-gray-600">{u.email ?? "-"}</div>
                          <div className="text-xs text-gray-500">Tipo: {u.tipo ?? "-"} • Criado: {formatDate(u.criadoEm)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <Info label="Telefone" value={u.telefone || "-"} />
                        <Info label="Data de Nascimento" value={formatDate(u.dataNascimento)} />
                        <Info label="Endereço" value={u.endereco || "-"} />
                        {u.tipo === "Atleta" && <Info label="Posição" value={u.posicaoCampo || "-"} />}
                        {(u.tipo === "Professor" || u.tipo === "Clube" || u.tipo === "Escolinha") && (
                          <Info label="Alunos vinculados" value={typeof u.totalVinculados === "number" ? String(u.totalVinculados) : "-"} />
                        )}
                        <Info label="Posts" value={String(u.contagens?.posts ?? "-")} />
                        <Info label="Comentários" value={String(u.contagens?.comentarios ?? "-")} />
                      </div>

                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold">Assinatura</div>
                          {u.assinatura?.ativo ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Ativa</span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Inativa</span>
                          )}
                        </div>

                        {(() => {
                          const a = u.assinatura;
                          const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
                          return (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <Info label="Plano" value={a?.plano ?? "FREE"} />
                              <Info label="Início" value={fmt(a?.startsAt)} />
                              <Info label="Cancelada em" value={fmt(a?.canceledAt)} />
                              <Info label="Status" value={a?.ativo ? "Ativa" : "Inativa"} />
                            </div>
                          );
                        })()}

                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            className="px-3 py-2 bg-blue-600 text-white rounded"
                            onClick={async () => {
                              const atual = u.assinatura?.plano ?? "FREE";
                              const novo = prompt('Novo plano (FREE | PRO | ELITE):', String(atual))?.toUpperCase().trim();
                              if (!novo) return;
                              await alterarPlanoAssinatura(u.id, novo);
                            }}
                          >
                            Trocar plano
                          </button>

                          {u.assinatura?.ativo ? (
                            <button
                              className="px-3 py-2 bg-red-600 text-white rounded"
                              onClick={() => cancelarAssinatura(u.id)}
                            >
                              Cancelar assinatura
                            </button>
                          ) : (
                            <button
                              className="px-3 py-2 bg-green-700 text-white rounded"
                              onClick={() => reativarAssinatura(u.id)}
                            >
                              Reativar assinatura
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 items-center">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!u.verificado}
                            disabled={acaoBusyId === u.id}

                            onChange={(e) => toggleCampo(u.id, "verificado", e.target.checked)}
                          />
                          Verificado
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!u.destaque}
                            disabled={acaoBusyId === u.id}

                            onChange={(e) => toggleCampo(u.id, "destaque", e.target.checked)}
                          />
                          Destaque
                        </label>
                      </div>

                      <div className="border-t pt-3 flex flex-wrap gap-2">
                        {u.status === "banido" ? (
                          <button
                            disabled={!isAdminBase || acaoBusyId === u.id}
                            onClick={() => banirOuDesbanir(u.id, false)}
                            className="px-3 py-2 rounded bg-yellow-500 text-white disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Desbanir usuário
                          </button>
                        ) : (
                          <button
                            disabled={!isAdminBase || acaoBusyId === u.id}
                            onClick={() => banirOuDesbanir(u.id, true)}
                            className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Banir usuário
                          </button>
                        )}

                        <div className="border-t pt-3 flex flex-wrap gap-2">
                        {(() => {
                          const status = String((u as any).status ?? "").toUpperCase();
                          const deletada = !!(u as any).deletedAt;
                          const precisaReativar = deletada || status === "BLOQUEADO";

                          return precisaReativar ? (
                            <button
                              onClick={() => bloquearOuReativarConta(u.id, "reativar")}
                              disabled={acaoBusyId === u.id}
                              className="px-3 py-2 rounded bg-green-700 text-white disabled:opacity-50"
                            >
                              Reativar conta
                            </button>
                          ) : (
                            <button
                              disabled={acaoBusyId === u.id}
                              onClick={() => bloquearOuReativarConta(u.id, "bloquear")}
                              className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                            >
                              {acaoBusyId === u.id ? "Processando..." : "Bloquear conta"}
                            </button>
                          );
                        })()}
                      </div>

                        <div className="ml-auto flex gap-2">
                          <button
                            disabled={!isAdminBase || acaoBusyId === u.id}
                            onClick={() => removerConteudo(u.id, "posts")}
                            className="px-3 py-2 rounded bg-gray-200 disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Remover posts
                          </button>
                          <button
                            disabled={!isAdminBase || acaoBusyId === u.id}
                            onClick={() => removerConteudo(u.id, "comentarios")}
                            className="px-3 py-2 rounded bg-gray-200 disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Remover comentários
                          </button>
                          <button
                            disabled={!isAdminBase || acaoBusyId === u.id}
                            onClick={() => removerConteudo(u.id, "todos")}
                            className="px-3 py-2 rounded bg-gray-200 disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Remover tudo
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              : null}
          </div>
        </div>
      )}

      {profDeleteModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={fecharModalExcluirProfessor} />

          <div className="relative bg-white w-full max-w-lg rounded-lg shadow-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-semibold text-gray-900">Confirmar exclusão</h4>
              <button
                onClick={fecharModalExcluirProfessor}
                className="text-gray-600 hover:text-gray-800"
                disabled={profDeleteBusy}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-gray-700 space-y-2">
              <p>
                Você tem certeza que deseja excluir o professor{" "}
                <strong>{profToDelete?.nome || "selecionado"}</strong>?
              </p>

              <div className="rounded bg-red-50 border border-red-200 p-3 text-red-800">
                <div className="font-semibold">Atenção</div>
                <div>
                  Esta ação é <strong>irreversível</strong> e também irá excluir a{" "}
                  <strong>conta (usuário) vinculada</strong> a esse professor.
                </div>
              </div>

              {profDeleteErr && (
                <div className="rounded bg-amber-50 border border-amber-200 p-3 text-amber-900">
                  {profDeleteErr}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={fecharModalExcluirProfessor}
                disabled={profDeleteBusy}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarExcluirProfessor}
                disabled={profDeleteBusy}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {profDeleteBusy ? "Excluindo..." : "Excluir professor e conta"}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Card({ title, icon, value }: { title: string; icon: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded shadow flex flex-col items-center">
      <span className="text-2xl">{icon}</span>
      <h4 className="text-sm mt-2">{title}</h4>
      <strong className="text-xl">{value}</strong>
    </div>
  );
}

function InfoI({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-flex items-center group ${className}`}>
      <span
        aria-label="informação"
        className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full border border-gray-400 text-gray-600 select-none bg-white"
      >
        i
      </span>
      <span
        className="
          pointer-events-none
          invisible group-hover:visible
          opacity-0 group-hover:opacity-100
          transition-opacity
          absolute top-full left-0 mt-1
          bg-black text-white text-xs rounded px-2 py-1
          max-w-xs text-left
          z-50 shadow
        "
      >
        {text}
      </span>
    </span>
  );
}

function num(n: any) {
  return Number(n ?? 0);
}
function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
}

function LineChart({
  data,
  w = 560,
  h = 140,
}: {
  data: Array<{ bucket: string | Date; value: number }>;
  w?: number;
  h?: number;
}) {
  const vals = data.map((d) => num(d.value));
  const max = Math.max(1, ...vals);
  const stepX = (w - 20) / Math.max(1, data.length - 1);
  const path = data
    .map((_, i) => {
      const x = 10 + i * stepX;
      const y = h - 12 - (vals[i] / max) * (h - 24);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[160px]">
      <rect x="0" y="0" width={w} height={h} rx="8" className="fill-white" />
      <path d={path} className="stroke-green-700 fill-none" strokeWidth={2} />

      {data.map((d, i) => {
        const x = 10 + i * stepX;
        const y = h - 12 - (vals[i] / max) * (h - 24);

        const label =
          typeof d.bucket === "string"
            ? d.bucket
            : new Date(d.bucket).toISOString().slice(0, 10);

        return (
          <g key={i}>
            <circle cx={x} cy={y} r={4} className="fill-green-700">
              <title>{`${label}: ${vals[i]}`}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

function ColumnChart({ series, w = 520, h = 180 }: { series: Array<{ label: string; value: number }>; w?: number; h?: number }) {
  const vals = series.map(s => s.value);
  const max = Math.max(1, ...vals);
  const bw = Math.max(24, Math.floor((w - 40) / Math.max(1, series.length)));
  const gap = 12;
  const totalWidth = 40 + series.length * (bw + gap);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${Math.max(totalWidth, w)} ${h}`} className="min-w-full">
        <rect x="0" y="0" width={Math.max(totalWidth, w)} height={h} rx="8" className="fill-white" />
        {series.map((s, i) => {
          const x = 20 + i * (bw + gap);
          const bh = Math.round(((s.value || 0) / max) * (h - 50));
          const y = h - 30 - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={bh} className="fill-green-600" rx="6" />
              <text x={x + bw / 2} y={h - 12} textAnchor="middle" className="fill-gray-600 text-[10px]">{s.label}</text>
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" className="fill-gray-800 text-[10px]">{s.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutTwoSegments({
  a,
  b,
  labelA = "A",
  labelB = "B",
  size = 120,
  stroke = 14,
}: {
  a: number; b: number; labelA?: string; labelB?: string; size?: number; stroke?: number;
}) {
  const total = Math.max(0, a) + Math.max(0, b);
  const pctA = total ? a / total : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const aLen = c * pctA;
  const bLen = c - aLen;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
          <circle cx={size/2} cy={size/2} r={r} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
          <circle
            cx={size/2} cy={size/2} r={r}
            stroke="#16A34A"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${aLen} ${c - aLen}`}
            strokeLinecap="round"
          />
        </g>
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-gray-800 text-sm font-semibold">
          {total ? `${Math.round(pctA * 100)}%` : "0%"}
        </text>
      </svg>
      <div className="text-sm">
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-green-600" /> {labelA}</div>
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-gray-300" /> {labelB}</div>
      </div>
    </div>
  );
}

function PieChart({
  data,
  size = 180,
}: {
  data: Array<{ label: string; value: number }>;
  size?: number;
}) {
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0);
  if (!total) {
    return <div className="text-sm text-gray-500">Sem dados para exibir.</div>;
  }

  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  const colors = [
    "#14532D",
    "#15803D", 
    "#16A34A", 
    "#22C55E",
    "#4ADE80",
    "#BBF7D0",
  ];

  let currentAngle = 0;

  const segments = data.map((d, idx) => {
    const value = d.value || 0;
    const angle = (value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const pathData = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

    return {
      d: pathData,
      fill: colors[idx] ?? colors[colors.length - 1],
      label: d.label,
      value,
    };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius} fill="#F3F4F6" />
        {segments.map((s, idx) => (
          <path key={idx} d={s.d} fill={s.fill} />
        ))}
      </svg>
      <div className="space-y-1 text-sm">
        {segments.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: s.fill }}
            />
            <span className="font-medium">{s.label}</span>
            <span className="text-gray-500">
              — {s.value} ({Math.round((s.value * 100) / total)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ title, value, sub }: { title: React.ReactNode; value: any; sub?: string }) {
  return (
    <div className="bg-white rounded shadow p-4">
      <div className="text-sm text-gray-500 flex items-center gap-2">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub ? <div className="text-xs text-gray-500 mt-1">{sub}</div> : null}
    </div>
  );
}

function AnalyticsPane() {
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [overview, setOverview] = useState<any>(null);
  const [activeSeries, setActiveSeries] = useState<Array<{ bucket: string; active: number }>>([]);
  const [engSummary, setEngSummary] = useState<any>(null);
  const [convE, setConvE] = useState<any[]>([]);
  const [convC, setConvC] = useState<any[]>([]);
  const [churn, setChurn] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginSummary, setLoginSummary] = useState<any>(null);
  const [activeByType, setActiveByType] = useState<any[]>([]);

  async function safeJson(url: string) {
    const r = await fetch(url, { headers: authHeaders() });
    const txt = await r.text();
    if (!r.ok) {
      throw new Error(txt || `Erro HTTP ${r.status}`);
    }
    return txt ? JSON.parse(txt) : {};
  }

  async function loadAll() {
    setLoading(true);
    const dTo = new Date(to);
    const dFrom30 = new Date(dTo);
    dFrom30.setDate(dTo.getDate() - 30);

    const from30 = dFrom30.toISOString().slice(0,10);

    try {
      const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

      const [ov, au, es, cl, en, ls, abt] = await Promise.all([
        safeJson(`${API.BASE_URL}/api/analises/overview?${q({ to })}`),
        safeJson(`${API.BASE_URL}/api/analises/users/active?${q({ from, to, granularity: "daily" })}`),
        safeJson(`${API.BASE_URL}/api/analises/conversion/escolinha?${q({ from, to })}`),
        safeJson(`${API.BASE_URL}/api/analises/conversion/clube?${q({ from, to })}`),
        safeJson(`${API.BASE_URL}/api/analises/engagement/summary?${q({ from, to })}`),
        safeJson(`${API.BASE_URL}/api/analises/logins/summary?${q({ from, to })}`),
        safeJson(`${API.BASE_URL}/api/analises/users/active-by-type?${q({ from, to })}`),
      ]);

      setOverview(ov);
      setActiveSeries(
        (Array.isArray(au) ? au : []).map((r: any) => ({ bucket: r.bucket, active: r.active }))
      );
      setConvE(Array.isArray(es) ? es : []);
      setConvC(Array.isArray(cl) ? cl : []);
      setEngSummary(en);
      setLoginSummary(ls);
      setActiveByType(Array.isArray(abt) ? abt : []);

      const fromMonth = from.slice(0, 7);
      const toMonth = to.slice(0, 7);
      try {
        const r = await fetch(
          `${API.BASE_URL}/api/analises/subscriptions/churn?from=${fromMonth}&to=${toMonth}`,
          { headers: authHeaders() }
        );
        const txt = await r.text();
        if (!r.ok) {
          console.warn("Erro no churn:", txt);
          setChurn([]);
        } else if (txt) {
          const parsed = JSON.parse(txt);
          setChurn(Array.isArray(parsed) ? parsed : []);
        } else {
          setChurn([]);
        }
      } catch (err) {
        console.error("Erro ao carregar churn:", err);
        setChurn([]);
      }
    } catch (err) {
      console.error("Erro ao carregar análises:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [from, to]);

  function avgLast(series: Array<{ active: number }>, take: number, offset: number) {
    const end = Math.max(0, series.length - offset);
    const start = Math.max(0, end - take);
    const slice = series.slice(start, end);
    if (!slice.length) return 0;
    const sum = slice.reduce((acc, s) => acc + num(s.active), 0);
    return sum / slice.length;
  }

  const avg7 = avgLast(activeSeries as any, 7, 0);
  const prev7 = avgLast(activeSeries as any, 7, 7);
  const delta7 = prev7 ? ((avg7 - prev7) / prev7) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-600">De</div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-600">Até</div>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </div>
        <button onClick={loadAll} className="px-3 py-2 bg-green-700 text-white rounded">
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              Usuários logados (24h) <InfoI text="DAU (Daily Active Users) — usuários logados nas últimas 24h." />
            </span>
          }
          value={fmt(num(overview?.DAU))}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              Usuários logados (7 dias) <InfoI text="WAU (Weekly Active Users) — usuários logados na janela de 7 dias." />
            </span>
          }
          value={fmt(num(overview?.WAU))}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              Usuários logados (30 dias) <InfoI text="MAU (Monthly Active Users) — usuários logados na janela de 30 dias." />
            </span>
          }
          value={fmt(num(overview?.MAU))}
        />

        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              Novos (30d) <InfoI text="Novos cadastros nos últimos 30 dias." />
            </span>
          }
          value={fmt(num(overview?.novos30d))}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              Média usuários 7d{" "}
              <InfoI text="Média de usuários logados dos últimos 7 dias." />
            </span>
          }
          value={Math.round(avg7)}
          sub={
            prev7
              ? `${delta7 > 0 ? "▲" : delta7 < 0 ? "▼" : "•"} ${Math.abs(delta7).toFixed(
                  1
                )}% vs 7d anterior`
              : undefined
          }
        />
      </div>

      <div className="bg-white rounded shadow p-3">
       <div className="font-semibold mb-3">Engajamento no período selecionado acima</div>
        <div className="grid md:grid-cols-4 gap-3">
          <Kpi title="Posts" value={fmt(num(engSummary?.posts))} />
          <Kpi title="Comentários" value={fmt(num(engSummary?.comments))} />
          <Kpi title="Curtidas" value={fmt(num(engSummary?.likes))} />
          <Kpi title="Mensagens" value={fmt(num(engSummary?.messages))} />
          <Kpi title="Sub. Treino" value={fmt(num(engSummary?.subTreino))} />
          <Kpi
            title="Treinos agendados"
            value={fmt(num(engSummary?.treinosAgendados))}
          />
        </div>
      </div>

      <div className="bg-white rounded shadow p-3">
        <div className="font-semibold mb-2 flex items-center gap-2">
          Logins únicos por tipo de usuário
          <InfoI text="Quantidade de usuários diferentes que fizeram login no período, agrupados por tipo." />
        </div>

        {activeByType.length === 0 ? (
          <div className="text-sm text-gray-500">Sem dados no período.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {activeByType.map((r: any) => (
              <div key={r.tipo} className="border rounded-lg p-3">
                <div className="text-xs text-gray-500">{r.tipo}</div>
                <div className="text-xl font-bold">{fmt(num(r.usuarios))}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded shadow p-3">
        <div className="font-semibold mb-2 flex items-center gap-2">
          Churn de Assinaturas (mensal)
          <InfoI text="Taxa de cancelamento mensal: cancelados / base." />
        </div>
        {churn.length === 0 ? (
          <div className="text-sm text-gray-500">
            Sem dados (adicione o model Assinatura e gere alguns registros).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[560px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Mês</th>
                  <th className="px-2 py-1 text-left">Base</th>
                  <th className="px-2 py-1 text-left">Cancelados</th>
                  <th className="px-2 py-1 text-left">Novos</th>
                  <th className="px-2 py-1 text-left">Churn</th>
                </tr>
              </thead>
              <tbody>
                {churn.map((r: any) => (
                  <tr key={r.month} className="border-t">
                    <td className="px-2 py-1">{r.month}</td>
                    <td className="px-2 py-1">{r.base}</td>
                    <td className="px-2 py-1">{r.cancelados}</td>
                    <td className="px-2 py-1">{r.novos}</td>
                    <td className="px-2 py-1">
                      {(r.churnRate * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}