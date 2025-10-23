import { useEffect, useState} from "react";
import { API } from "../config.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import ValidacaoVideo from "./validacaovideo.js";
import { FLAGS } from "../config.js";

type Tab =
  | "dashboard"
  | "usuarios"
  | "exercicios"
  | "treinos"
  | "professores"
  | "desafios"
  | "validacao"
  | "moderacao"
  | "configuracoes";

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
}

const USERS_ENDPOINT = [
  `${API.BASE_URL}/api/admin/usuarios`,
  `${API.BASE_URL}/api/usuarios`, 
];


const EMPTY_DASH = {
  totalUsuarios: 0,
  totalTreinos: 0,
  totalDesafios: 0,
  totalPostsCriados: 0,
  totalAtletas: 0,
  totalEscolinhas: 0,
  totalClubes: 0,
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
  if (v.startsWith("/assets/") || v.startsWith("/videos/") || v.startsWith("/exercicios/"))
    return v;
  if (v.startsWith("assets/") || v.startsWith("videos/") || v.startsWith("exercicios/"))
    return `/${v}`;
  if (v.startsWith("/uploads/")) return `${API.BASE_URL}${v}`;
  if (v.startsWith("uploads/"))   return `${API.BASE_URL}/${v}`;
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
  const [usersBase, setUsersBase] = useState<string>(USERS_ENDPOINT[0]);

  const [modPendentes, setModPendentes] = useState<ModeracaoItem[]>([]);
  const [modTotal, setModTotal] = useState(0);                           
  const [modPage, setModPage] = useState(1);                            
  const modPageSize = 20;                                                
  const [modLoading, setModLoading] = useState(false);
  const [player, setPlayer] = useState<{ src: string; kind: "video" | "iframe" } | null>(null);
  const [modStatus, setModStatus] = useState<"pendente"|"aprovado"|"invalido"|"todos">("pendente");
  const [meId, setMeId] = useState<string | null>(null);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [adminNivel, setAdminNivel] = useState<number>(0);

  const isAdminBase = usersBase === USERS_ENDPOINT[0];

  function toPlayer(raw?: string | null) {
    if (!raw) return null;
    const url = toAbsoluteUrl(raw) || raw;

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: "video" as const, src: url };

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
      .then(r => r.json())
      .then(setExercicios)
      .catch(() => setExercicios([]));
  }, []);

  useEffect(() => {
    fetch(`${API.BASE_URL}/api/professores`, { headers: authHeaders() })
      .then(r => r.json())
      .then(setProfessores)
      .catch(() => setProfessores([]));
  }, []);

  useEffect(() => {
    fetch(`${API.BASE_URL}/api/configuracoes`, { headers: authHeaders() })
      .then(r => r.json())
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
        if (!res.ok) { setDados(EMPTY_DASH); return; }
        setDados(await res.json());
      } catch {
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

      const arr =
        Array.isArray(json)
          ? json
          : (json.items ??
             json.data ??
             json.treinos ??
             json.treinosProgramados ??
             json.rows ??
             json.result ??
             []);

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
  } finally { setModLoading(false); }
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
    const nome  = prompt("Nome (opcional):") ?? "";

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
    setUsuarios(prev => prev.filter(u => u.id !== id));
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

      let gotOk = false;
      let items: UsuarioAdmin[] = [];
      let total = 0;
      let lastStatus = 0;
      let lastBody = "";

      for (const base of USERS_ENDPOINT) {
        const url = `${base}?${params.toString()}`;
        const res = await fetch(url, { headers: authHeaders() });
        lastStatus = res.status;

        if (!res.ok) {
          try { lastBody = await res.text(); } catch {}
          continue; 
        }

       const json: any = await res.json();

        const arr =
          (Array.isArray(json) ? json :
          json.items ?? json.data ?? json.usuarios ?? json.users ?? json.rows ?? json.result ?? []);

        items = Array.isArray(arr) ? arr : [];
        total = json.total ?? json.count ?? (Array.isArray(json) ? json.length : items.length);

        setUsersBase(base);
        gotOk = true;
        break;
      }

      if (!gotOk) {
        setUsuarios([]);
        setTotalUsuarios(0);
        setErroUsuarios(
          `Falha ao buscar usuários (status ${lastStatus}). ${lastBody || "Verifique se o token é de admin e se a rota existe."}`
        );
        return;
      }

      setUsuarios(items);
      setTotalUsuarios(total);
      setPagina(targetPage);
    } catch (e: any) {
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
      setUserSelecionado(data);
    } catch { setUserSelecionado(null); }
    finally { setLoadingDetalhe(false); }
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
      setUsuarios(prev => prev.map(u => (u.id === id ? { ...u, [campo]: valor } as UsuarioAdmin : u)));
    } finally { setAcaoBusy(false); }
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
    } finally { setAcaoBusy(false); }
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
    } finally { setAcaoBusy(false); }
  }

  function formatDate(d?: string | null) {
    const v = d ?? (d as any)?.createdAt ?? (d as any)?.criado_em;
    if (!v) return "-";
    try { return new Date(v).toLocaleString("pt-BR"); } catch { return String(v); }
  }

  if (!dados) return <div className="p-6">Carregando...</div>;

  const percent = (val: unknown) => {
    const n = Number(val ?? 0);
    const total = Number(dados?.totalUsuarios ?? 0) || 1;
    return Math.round((n * 100) / total);
  };

  function handleLogout() {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("jwt");
      localStorage.removeItem("usuarioId");
      sessionStorage.removeItem("token");
      (window as any)?.Storage && ((window as any).Storage.token = null);
    } catch {}
    window.location.href = "/admin/login";
  }

  const rotulo = { pendente: "pendentes", aprovado: "aprovados", invalido: "inválidos", todos: "registros" }[modStatus];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="flex justify-between items-center bg-green-900 text-white px-6 py-4 rounded">
        <h1 className="text-2xl font-bold">FOOTERA</h1>
        <button className="bg-red-600 px-4 py-2 rounded" onClick={handleLogout}>Sair</button>
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
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <div className="p-4">
        {aba === "dashboard" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Dashboard Administrativo</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card title="Total de Usuários" icon="👥" value={dados?.totalUsuarios ?? 0} />
              <Card title="Treinos Cadastrados" icon="🏋️" value={dados?.totalTreinos ?? 0} />
              <Card title="Desafios Ativos" icon="🏆" value={dados?.totalDesafios ?? 0} />
              <Card title="Posts Criados" icon="✍️" value={dados?.totalPostsCriados ?? 0} />
            </div>

            <h4 className="font-semibold mb-2">Distribuição de Usuários</h4>
            <div className="bg-white p-3 ">
              {[
                { label: "Atletas", value: dados.totalAtletas },
                { label: "Escolas de Futebol", value: dados.totalEscolinhas },
                { label: "Clubes Profissionais", value: dados.totalClubes },
                { label: "Administradores", value: dados.totalAdministradores },
                { label: "Profilers", value: dados.totalMidias },
              ].map((d: any, i: number) => (
                <Bar key={i} label={d.label} percent={percent(d.value)} />
              ))}
            </div>

            <h4 className="font-semibold mt-6 mb-2">Status dos Usuários</h4>
            <div className="bg-white p-3 grid grid-cols-2 gap-4">
              <Bar label="Verificados" percent={percent(dados.totalVerificados)} />
              <Bar label="Não Verificados" percent={percent(dados.totalNaoVerificados)} />
            </div>
          </div>
        )}
        {aba === "usuarios" && (
          <div>
            <h3 className="text-xl font-bold mb-3">Usuários</h3>
            <div className="flex flex-wrap gap-2 items-center mb-4">
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou email…" className="border rounded px-3 py-2 w-64" />
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
              <button className="px-3 py-2 rounded bg-gray-200" onClick={() => carregarUsuarios(1)}>Atualizar</button>
              <div className="ml-auto text-sm text-gray-600">
                {carregandoUsuarios ? "Carregando…" : `${totalUsuarios} resultados`}
              </div>
            </div>

            {erroUsuarios && (
              <div className="mb-3 text-sm text-red-600">
                {erroUsuarios}
              </div>
            )}

             {canManageAdmins && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-amber-800">Gerenciar administradores</div>
                    <div className="text-sm text-amber-700">
                      Somente você (super admin) pode criar e remover contas de admin.
                    </div>
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
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center gap-3 justify-end">
                            <button
                              onClick={() => abrirDetalhes(u.id)}
                              className="text-green-700 hover:underline"
                            >
                              Detalhes
                            </button>

                            {canManageAdmins && String(u.tipo).toLowerCase() === "admin" && u.id !== meId && (
                              <button
                                onClick={() => deletarAdmin(u.id)}
                                className="text-red-600 hover:underline"
                                title="Deletar este administrador"
                              >
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
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">Nenhum usuário encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <button disabled={pagina <= 1}
                onClick={() => carregarUsuarios(pagina - 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50">Anterior</button>
              <div className="text-sm text-gray-600">Página {pagina}</div>
              <button disabled={(pagina * pageSize) >= totalUsuarios || usuarios.length < pageSize}
                onClick={() => carregarUsuarios(pagina + 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50">Próxima</button>
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
                       method: "DELETE", headers: authHeaders()
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
                                <button
                                  onClick={() => (window.location.href = `/admin/treinos/create?id=${t.id}`)}
                                  className="text-blue-600"
                                >
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
                            <p>CREF: {p.cref} — {p.areaFormacao}</p>
                            <p className="text-sm text-gray-600">
                              Qualificações: {(Array.isArray(p.qualificacoes) ? p.qualificacoes : []).join(", ") || "—"}
                            </p>
                            <p className="text-sm text-gray-500">
                              Certificações: {(Array.isArray(p.certificacoes) ? p.certificacoes : []).join(", ") || "—"}
                            </p>
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
        
                {aba === "desafios" && (FLAGS.DESAFIOS_ENABLED ? (
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

                {aba === "moderacao" && (FLAGS.DESAFIOS_ENABLED ? (
                  <div>
                   <h3 className="text-xl font-bold mb-3">Moderação</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-semibold text-green-900">Desafios</div>
                      <select
                        className="border rounded px-2 py-1"
                        value={modStatus}
                        onChange={(e) => setModStatus(e.target.value as any)}
                      >
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
                                  {it.desafio.titulo}{" "}
                                  <span className="text-xs text-gray-600">({it.desafio.pontuacao} pts)</span>
                                </td>
                                <td className="px-3 py-2">
                                  <div>{formatResultado(it)}</div>
                                  {it.observacao && (
                                    <div className="text-xs text-gray-500">{it.observacao}</div>
                                  )}
                                </td>

                                <td className="px-3 py-2">
                                  {new Date(it.criadoEm).toLocaleString("pt-BR")}
                                </td>

                                <td className="px-3 py-2">
                                  {it.videoUrl ? (
                                    <button className="text-blue-600 underline" onClick={() => openVideo(it.videoUrl)}>
                                      ver vídeo
                                    </button>
                                  ) : "—"}
                                </td>

                                <td className="px-3 py-2 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => aprovarDesafio(it.id)}
                                      className="px-3 py-1 rounded bg-green-600 text-white"
                                    >
                                      Aprovar
                                    </button>
                                    <button
                                      onClick={() => invalidarDesafio(it.id)}
                                      className="px-3 py-1 rounded bg-red-600 text-white"
                                    >
                                      Invalidar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {!modLoading && modPendentes.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-8 text-center text-gray-500">Nada pendente no momento.</td>
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
                      <div className="text-sm text-gray-600">
                        {modLoading ? "Carregando…" : `Página ${modPage} • ${modTotal} ${rotulo}`}
                      </div>
                      <button
                        disabled={(modPage * modPageSize) >= modTotal || modPendentes.length < modPageSize}
                        onClick={() => carregarPendentes(modPage + 1)}
                        className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
              ) : null)}

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
                            headers: authHeaders ({ "Content-Type": "application/json" }),
                            body: JSON.stringify({ maxDailyPosts: novoValor }),
                          });
                        }}
                      />
                    </div>
        
                    <div className="mt-4">
                      <h4 className="font-semibold text-green-800 mb-2">🔧 Ações Administrativas</h4>
                      <div className="flex gap-4">
                        <button className="bg-gray-200 px-4 py-2 rounded" onClick={() => alert("Cache atualizado!")}>Atualizar Cache</button>
                        <button className="bg-gray-200 px-4 py-2 rounded" onClick={() => alert("Verificação de integridade feita!")}>Verificar Integridade</button>
                      </div>
                    </div>
                  </div>
                )}
          </div>

          {player && (
            <div className="fixed inset-0 z-[70] grid place-items-center">
              <div className="absolute inset-0 bg-black/60" onClick={() => setPlayer(null)} />

              <div className="relative z-10">
                {player.kind === "video" ? (
                  <video
                    src={player.src}
                    controls
                    autoPlay
                    className="block max-w-[92vw] max-h-[90vh] rounded-lg shadow-xl"
                  />
                ) : (
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

                <button
                  onClick={() => setPlayer(null)}
                  className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full shadow p-2"
                  title="Fechar"
                >
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
              <button onClick={() => setDetalheAberto(false)} className="text-gray-600">✕</button>
            </div>

            {loadingDetalhe && <p>Carregando…</p>}

            {!loadingDetalhe && userSelecionado ? (() => {
              const u = userSelecionado!;
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={formatarUrlFoto(userSelecionado?.foto, "usuarios")}
                      className="w-14 h-14 rounded-full object-cover border"
                    />
                    <div>
                      <div className="font-semibold text-base">{u.nome ?? u.nomeDeUsuario}</div>
                      <div className="text-sm text-gray-600">{u.email ?? "-"}</div>
                      <div className="text-xs text-gray-500">
                        Tipo: {u.tipo ?? "-"} • Criado: {formatDate(u.criadoEm)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Telefone" value={u.telefone || "-"} />
                    <Info label="Data de Nascimento" value={formatDate(u.dataNascimento)} />
                    <Info label="Endereço" value={u.endereco || "-"} />
                    {u.tipo === "Atleta" && (
                      <Info label="Posição" value={u.posicaoCampo || "-"} />
                    )}
                    {(u.tipo === "Professor" || u.tipo === "Clube" || u.tipo === "Escolinha") && (
                      <Info
                        label="Alunos vinculados"
                        value={
                          typeof u.totalVinculados === "number" ? String(u.totalVinculados) : "-"
                        }
                      />
                    )}
                    <Info label="Posts" value={String(u.contagens?.posts ?? "-")} />
                    <Info label="Comentários" value={String(u.contagens?.comentarios ?? "-")} />
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
            })() : null}
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

function Bar({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded">
        <div className="h-full bg-green-600 rounded" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}