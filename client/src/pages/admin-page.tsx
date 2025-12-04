import React, { useEffect, useState } from "react";
import { API } from "../config.js";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import ValidacaoVideo from "./validacaovideo.js";
import { FLAGS } from "../config.js";
import { Link } from "wouter";

type Tab =
  | "dashboard"
  | "usuarios"
  | "exercicios"
  | "treinos"
  | "professores"
  | "desafios"
  | "validacao"
  | "moderacao"
  | "analises"
  | "configuracoes"
  | "assinaturas";

interface Treinos {
  id: string;
  nome: string;
  codigo: string;
  nivel: string;
  descricao: string;
}

type UsuarioTipo = "" | "atleta" | "escola" | "clube" | "professor" | "admin" | "olheiro";

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
  status?: "ativo" | "banido" | "pendente";
  contagens?: { posts?: number; comentarios?: number; seguidores?: number };
  camposCadastro?: Record<string, any>;
  posicaoCampo?: string | null;
  totalVinculados?: number | null;
  assinatura?: AssinaturaDTO | null;
}

const USERS_ENDPOINT = `${API.BASE_URL}/api/admin/usuarios`;

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

export default function AdminDashboard() {
  const [aba, setAba] = useState<Tab>("dashboard");

  const tabs: Tab[] = [
    "dashboard",
    "usuarios",
    "exercicios",
    "treinos",
    "professores",
    ...(FLAGS.DESAFIOS_ENABLED ? (["desafios", "validacao", "moderacao"] as Tab[]) : []),
    "assinaturas",
    "analises",
    "configuracoes",
  ];

  const [dados, setDados] = useState<any>(null);
  const [exercicios, setExercicios] = useState<any[]>([]);
  const [treinos, setTreinos] = useState<Treinos[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
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

  const [detalheAberto, setDetalheAberto] = useState(false);
  const [userSelecionado, setUserSelecionado] = useState<UsuarioDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [acaoBusy, setAcaoBusy] = useState(false);

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

useEffect(() => {
  const h = setTimeout(() => setAssDebQ(assQ.trim()), 400);
  return () => clearTimeout(h);
}, [assQ]);

useEffect(() => {
  if (aba !== "assinaturas") return;
  void carregarAssinantes(1);
  void carregarAssOverview();
}, [aba, assPlano, assAtivo, assDebQ]);

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
    fetch(`${API.BASE_URL}/api/exercicios`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setExercicios)
      .catch(() => setExercicios([]));
  }, []);

  useEffect(() => {
    fetch(`${API.BASE_URL}/api/professores`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setProfessores)
      .catch(() => setProfessores([]));
  }, []);

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
          console.log("GET /api/admin status:", res.status, "body:", txt);

          if (!res.ok) {
            setDashErro(`Erro ao carregar dashboard: [${res.status}] ${txt || res.statusText}`);
            setDados(EMPTY_DASH);
            return;
          }

          const json = txt ? JSON.parse(txt) : {};
          setDados(json);
          console.log("DADOS DASH:", {
            totalUsuarios: json.totalUsuarios,
            totalAtletas: json.totalAtletas,
            totalClubes: json.totalClubes,
            totalEscolinhas: json.totalEscolinhas,
            totalAdministradores: json.totalAdministradores,
            totalProfessores: json.totalProfessores,
            totalOlheiros: json.totalOlheiros,
          });

          setDashErro(null);
        } catch (e) {
          console.error("erro /api/admin", e);
          setDashErro("Erro de rede ao carregar dashboard.");
          setDados(EMPTY_DASH);
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
    (async () => {
      try {
        const res = await fetch(`${API.BASE_URL}/api/treinos`, { headers: authHeaders() });
        const json = await res.json();

        const arr = Array.isArray(json)
          ? json
          : json.items ??
            json.data ??
            json.treinos ??
            json.treinosProgramados ??
            json.rows ??
            json.result ??
            [];

        setTreinos(Array.isArray(arr) ? arr : []);
      } catch (e) {
        console.error("Falha ao carregar treinos:", e);
        setTreinos([]);
      }
    })();
  }, []);

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
    setAcaoBusy(true);
    try {
      await fetch(`${usersBase}/${id}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ [campo]: valor }),
      });
      setUserSelecionado((prev) => (prev ? { ...prev, [campo]: valor } : prev));
      setUsuarios((prev) => prev.map((u) => (u.id === id ? ({ ...u, [campo]: valor } as UsuarioAdmin) : u)));
    } finally {
      setAcaoBusy(false);
    }
  }

  async function banirOuDesbanir(id: string, banir: boolean) {
    const motivo = banir ? prompt("Motivo do banimento? (obrigatório)") : "";
    if (banir && !motivo) return;
    setAcaoBusy(true);
    try {
      const url = `${usersBase}/${id}/banir`;
      const opts = banir
        ? { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ motivo }) }
        : { method: "DELETE", headers: authHeaders() };
      await fetch(url, opts as RequestInit);
      setUserSelecionado((prev) => (prev ? { ...prev, status: banir ? "banido" : "ativo" } : prev));
    } finally {
      setAcaoBusy(false);
    }
  }

  async function removerConteudo(id: string, escopo: "posts" | "comentarios" | "todos") {
    if (!confirm(`Remover ${escopo} deste usuário? Essa ação é irreversível.`)) return;
    setAcaoBusy(true);
    try {
      await fetch(`${usersBase}/${id}/remover-conteudo`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ escopo }),
      });
      alert("Conteúdo removido.");
    } finally {
      setAcaoBusy(false);
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

  function formatDate(d?: string | null) {
    const v = d ?? (d as any)?.createdAt ?? (d as any)?.criado_em;
    if (!v) return "-";
    try {
      return new Date(v).toLocaleString("pt-BR");
    } catch {
      return String(v);
    }
  }

  if (!dados) return <div className="p-6">Carregando...</div>;

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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
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
            {t === "moderacao" ? "Moderação" : t === "validacao" ? "Validar desafios" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {dashErro && (
        <div className="mb-4 rounded bg-red-50 text-red-700 px-4 py-2 text-sm">
          {dashErro}
        </div>
      )}

      <div className="p-4">
        {aba === "dashboard" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Dashboard Administrativo</h3>

            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card title="Total de Usuários" icon="👥" value={dados?.totalUsuarios ?? 0} />
              <Card title="Treinos Cadastrados" icon="🏋️" value={dados?.totalTreinos ?? 0} />
              <Card title="Desafios Ativos" icon="🏆" value={dados?.totalDesafios ?? 0} />
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
                  {usuarios.map((u) => {
                    const nome = u.nome ?? u.nomeDeUsuario ?? "(sem nome)";
                    const foto = formatarUrlFoto(u.foto, "usuarios") || "/default-profile.png";
                    return (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <img src={foto} className="w-8 h-8 rounded-full object-cover border" />
                            <div className="font-medium flex items-center gap-2">
                              {nome}
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!u.verificado}
                                  disabled={!isAdminBase || acaoBusy}
                                  onChange={(e) => toggleCampo(u.id, "verificado", e.target.checked)}
                                  title={!isAdminBase ? "Requer permissão de admin" : ""}
                                />
                                Verificado
                              </label>

                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!u.destaque}
                                  disabled={!isAdminBase || acaoBusy}
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
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
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
                onClick={() => (window.location.href = "/admin/exercicios/create")}
              >
                + Novo Exercicio
              </button>
            </div>
            <ul className="space-y-2">
              {exercicios.map((ex: any) => {
                const videoUrl = resolveVideoUrl(ex);

                return (
                  <li key={ex.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                    <div>
                      <strong>{ex.nome}</strong> — {ex.codigo} [{ex.nivel}]
                      <p className="text-sm text-gray-500">{ex.descricao}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => (window.location.href = `/admin/exercicios/create?id=${ex.id}`)}
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
                          response.ok ? alert("Exercício excluído!") : alert("Erro ao excluir.");
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

            {treinos.length === 0 ? (
              <p className="text-gray-500">Nenhum treino encontrado.</p>
            ) : (
              <ul className="space-y-2">
                {treinos.map((t: any) => {
                  const nome = t.nome ?? t.titulo ?? "(sem nome)";
                  const codigo = t.codigo ?? "-";
                  const nivel = t.nivel ?? t.dificuldade ?? "-";
                  const descricao = t.descricao ?? t.resumo ?? "";
                  return (
                    <li key={t.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                      <div>
                        <strong>{nome}</strong> — {codigo} [{nivel}]
                        <p className="text-sm text-gray-500">{descricao}</p>
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
            <ul className="space-y-2">
              {professores.map((p: any) => (
                <li key={p.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{p.nome}</strong>
                    <p>
                      CREF: {p.cref} — {p.areaFormacao}
                    </p>
                    <p className="text-sm text-gray-600">Qualificações: {(Array.isArray(p.qualificacoes) ? p.qualificacoes : []).join(", ") || "—"}</p>
                    <p className="text-sm text-gray-500">Certificações: {(Array.isArray(p.certificacoes) ? p.certificacoes : []).join(", ") || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => (window.location.href = `/admin/professores/create?id=${p.id}`)}>✏️</button>
                    <button
                      onClick={async () => {
                        const confirmar = confirm("Deseja excluir este professor?");
                        if (!confirmar) return;
                        const response = await fetch(`${API.BASE_URL}/api/professores/${p.id}`, { method: "DELETE" });
                        response.ok ? alert("Professor excluído!") : alert("Erro ao excluir.");
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
                      const fotoAtleta = formatarUrlFoto(it.atleta.foto, "usuarios") || "/default-profile.png";
                      return (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <img src={fotoAtleta} className="w-8 h-8 rounded-full object-cover border" />
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
                  {assinantes.map((a) => {
                    const u = a.usuario;
                    const nome = u.nome ?? u.nomeDeUsuario ?? "(sem nome)";
                    const foto = formatarUrlFoto(u.foto, "usuarios") || "/default-profile.png";
                    return (
                      <tr key={a.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <img src={foto} className="w-8 h-8 rounded-full object-cover border" />
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
                    <p className="font-medium">{item.label} ✅</p>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={configuracoes[item.key]}
                    onChange={async (e) => {
                      const res = await fetch(`${API.BASE_URL}/api/configuracoes`, {
                        method: "PATCH",
                        headers: authHeaders({ "Content-Type": "application/json" }),
                        body: JSON.stringify({ [item.key]: e.target.checked }),
                      });
                      if (res.ok) {
                        setConfiguracoes({ ...configuracoes, [item.key]: e.target.checked });
                      }
                    }}
                    className="scale-125"
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
        <div className="fixed inset-0 z-[70] grid place-items-center">
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
                        <img src={formatarUrlFoto(userSelecionado?.foto, "usuarios")} className="w-14 h-14 rounded-full object-cover border" />
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
                            disabled={acaoBusy}
                            onChange={(e) => toggleCampo(u.id, "verificado", e.target.checked)}
                          />
                          Verificado
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!u.destaque}
                            disabled={acaoBusy}
                            onChange={(e) => toggleCampo(u.id, "destaque", e.target.checked)}
                          />
                          Destaque
                        </label>
                      </div>

                      <div className="border-t pt-3 flex flex-wrap gap-2">
                        {u.status === "banido" ? (
                          <button
                            disabled={!isAdminBase || acaoBusy}
                            onClick={() => banirOuDesbanir(u.id, false)}
                            className="px-3 py-2 rounded bg-yellow-500 text-white disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Desbanir usuário
                          </button>
                        ) : (
                          <button
                            disabled={!isAdminBase || acaoBusy}
                            onClick={() => banirOuDesbanir(u.id, true)}
                            className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Banir usuário
                          </button>
                        )}

                        <div className="ml-auto flex gap-2">
                          <button
                            disabled={!isAdminBase || acaoBusy}
                            onClick={() => removerConteudo(u.id, "posts")}
                            className="px-3 py-2 rounded bg-gray-200 disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Remover posts
                          </button>
                          <button
                            disabled={!isAdminBase || acaoBusy}
                            onClick={() => removerConteudo(u.id, "comentarios")}
                            className="px-3 py-2 rounded bg-gray-200 disabled:opacity-50"
                            title={!isAdminBase ? "Requer permissão de admin" : ""}
                          >
                            Remover comentários
                          </button>
                          <button
                            disabled={!isAdminBase || acaoBusy}
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

function LineChart({ data, w = 560, h = 140 }: { data: Array<{ bucket: string | Date; value: number }>; w?: number; h?: number }) {
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
    try {
      const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

      const [ov, au, es, cl, en] = await Promise.all([
        safeJson(`${API.BASE_URL}/api/analises/overview?${q({ to })}`),
        safeJson(
          `${API.BASE_URL}/api/analises/users/active?${q({ from, to, granularity: "daily" })}`
        ),
        safeJson(`${API.BASE_URL}/api/analises/conversion/escolinha?${q({ from, to })}`),
        safeJson(`${API.BASE_URL}/api/analises/conversion/clube?${q({ from, to })}`),
        safeJson(`${API.BASE_URL}/api/analises/engagement/summary?${q({ from, to })}`),
      ]);

      setOverview(ov);
      setActiveSeries(
        (Array.isArray(au) ? au : []).map((r: any) => ({ bucket: r.bucket, active: r.active }))
      );
      setConvE(Array.isArray(es) ? es : []);
      setConvC(Array.isArray(cl) ? cl : []);
      setEngSummary(en);

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
  }, []);

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
              DAU <InfoI text="Daily Active Users — usuários ativos nas últimas 24h." />
            </span>
          }
          value={fmt(num(overview?.DAU))}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              WAU <InfoI text="Weekly Active Users — usuários ativos na janela de 7 dias." />
            </span>
          }
          value={fmt(num(overview?.WAU))}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              MAU <InfoI text="Monthly Active Users — usuários ativos na janela de 30 dias." />
            </span>
          }
          value={fmt(num(overview?.MAU))}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              Stickiness{" "}
              <InfoI text="WAU/MAU — medida de frequência (quanto mais próximo de 1, melhor)." />
            </span>
          }
          value={(overview?.stickiness ?? 0).toFixed(2)}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              D7{" "}
              <InfoI text="Retenção em 7 dias — % de novos usuários que voltam após 7 dias." />
            </span>
          }
          value={`${fmt(num(overview?.D7))}%`}
        />
        <Kpi
          title={
            <span className="inline-flex items-center gap-2">
              D30{" "}
              <InfoI text="Retenção em 30 dias — % de novos usuários que voltam após 30 dias." />
            </span>
          }
          value={`${fmt(num(overview?.D30))}%`}
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
              Média 7d{" "}
              <InfoI text="Média de usuários ativos dos últimos 7 dias." />
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
        <div className="font-semibold mb-2 flex items-center gap-2">
          Usuários ativos por dia
          <InfoI text="Contagem diária de usuários com pelo menos 1 evento de atividade." />
        </div>
        <LineChart data={activeSeries.map((r) => ({ bucket: r.bucket, value: r.active }))} />
      </div>

      <div className="bg-white rounded shadow p-3">
        <div className="font-semibold mb-3">Engajamento no período</div>
        <div className="grid md:grid-cols-4 gap-3">
          <Kpi title="Posts" value={fmt(num(engSummary?.posts))} />
          <Kpi title="Comentários" value={fmt(num(engSummary?.comments))} />
          <Kpi title="Curtidas" value={fmt(num(engSummary?.likes))} />
          <Kpi title="Mensagens" value={fmt(num(engSummary?.messages))} />
          <Kpi title="Sub. Treino" value={fmt(num(engSummary?.subTreino))} />
          <Kpi title="Sub. Desafio" value={fmt(num(engSummary?.subDesafio))} />
          <Kpi
            title="Treinos agendados"
            value={fmt(num(engSummary?.treinosAgendados))}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded shadow p-3">
          <div className="font-semibold mb-2 flex items-center gap-2">
            Conversão via Escolinha (semanal)
            <InfoI text="Novos vínculos de atletas oriundos de Escolinhas por semana." />
          </div>
          <LineChart
            data={(convE || []).map((r: any) => ({
              bucket: r.bucket,
              value: r.novosVinculos,
            }))}
          />
        </div>
        <div className="bg-white rounded shadow p-3">
          <div className="font-semibold mb-2 flex items-center gap-2">
            Conversão via Clube (semanal)
            <InfoI text="Novos vínculos de atletas oriundos de Clubes por semana." />
          </div>
          <LineChart
            data={(convC || []).map((r: any) => ({
              bucket: r.bucket,
              value: r.novosVinculos,
            }))}
          />
        </div>
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
