import { useEffect, useState} from "react";
import { API } from "../config.js";

type Tab =
  | "dashboard"
  | "usuarios"
  | "exercicios"
  | "treinos"
  | "professores"
  | "desafios"
  | "configuracoes";

interface Treinos {
  id: string;
  nome: string;
  codigo: string;
  nivel: string;
  descricao: string;
}

type UsuarioTipo = "" | "atleta" | "escola" | "clube" | "professor" | "admin";

const tipoToServer: Record<UsuarioTipo, string> = {
  "": "",
  atleta: "Atleta",
  escola: "Escolinha",  // << importante!
  clube: "Clube",
  professor: "Professor",
  admin: "Admin",
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
}

interface UsuarioDetalhe extends UsuarioAdmin {
  documento?: string | null;
  telefone?: string | null;
  dataNascimento?: string | null; 
  endereco?: string | null;
  ultimaAtividade?: string | null;  
  status?: "ativo" | "banido" | "pendente";
  contagens?: { posts?: number; comentarios?: number; seguidores?: number };
  camposCadastro?: Record<string, any>;
}

const USERS_ENDPOINT = [
  `${API.BASE_URL}/api/admin/usuarios`,
  `${API.BASE_URL}/api/usuarios`, 
];


function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
function authHeaders(extra: Record<string, string> = {}) {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

export default function AdminDashboard() {
  const [aba, setAba] = useState<Tab>("dashboard");

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

   useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    fetch(`${API.BASE_URL}/api/admin`, { headers: authHeaders() })
      .then(res => res.json()).then(setDados).catch(console.error);

    fetch(`${API.BASE_URL}/api/exercicios`, { headers: authHeaders() })
      .then(res => res.json()).then(setExercicios).catch(console.error);

    fetch(`${API.BASE_URL}/api/treinos`, { headers: authHeaders() })
      .then(res => res.json()).then(setTreinos).catch(console.error);

    fetch(`${API.BASE_URL}/api/professores`, { headers: authHeaders() })
      .then(res => res.json()).then(setProfessores).catch(console.error);

    fetch(`${API.BASE_URL}/api/desafios`, { headers: authHeaders() })
      .then(res => res.json()).then(setDesafios).catch(console.error);

    fetch(`${API.BASE_URL}/api/configuracoes`, { headers: authHeaders() })
      .then(res => res.json()).then(setConfiguracoes).catch(console.error);
  }, []);

  useEffect(() => {
    if (aba !== "usuarios") return;
    carregarUsuarios(1).catch(() => {});
  }, [aba, tipoFiltro, debouncedQ]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API.BASE_URL}/api/treinos`, { headers: authHeaders() });
        const json = await res.json();
        const arr = Array.isArray(json) ? json : (json.items ?? json.data ?? json.treinos ?? []);
        setTreinos(arr);
      } catch (e) { console.error(e); setTreinos([]); }
    })();
  }, []);

  async function carregarUsuarios(targetPage: number) {
    setCarregandoUsuarios(true);
    setErroUsuarios("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(pageSize));
      if (debouncedQ) params.set("q", debouncedQ);
      if (tipoFiltro) params.set("tipo", tipoToServer[tipoFiltro]);

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

  const percent = (val: number) => {
    const total = dados.totalUsuarios || 1;
    return Math.round((val * 100) / total);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuarioId");
    localStorage.removeItem("tipoUsuario");
    alert("Você saiu com sucesso.");
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="flex justify-between items-center bg-green-900 text-white px-6 py-4 rounded">
        <h1 className="text-2xl font-bold">FOOTERA</h1>
        <button className="bg-red-600 px-4 py-2 rounded" onClick={handleLogout}>Sair</button>
      </header>

      <h2 className="text-xl font-semibold text-green-900 my-4">Painel Administrativo</h2>

      <nav className="flex flex-wrap gap-3 mb-6">
        {["dashboard","usuarios","exercicios","treinos","professores","desafios","configuracoes"].map((t) => (
          <button key={t}
            className={`px-4 py-2 rounded ${aba === (t as Tab) ? "bg-green-800 text-white" : "bg-gray-200"}`}
            onClick={() => setAba(t as Tab)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <div className="p-4">
        {aba === "dashboard" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Dashboard Administrativo</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card title="Total de Usuários" icon="👥" value={dados.totalUsuarios} />
              <Card title="Treinos Cadastrados" icon="🏋️" value={dados.totalTreinos} />
              <Card title="Desafios Ativos" icon="🏆" value={dados.totalDesafios} />
              <Card title="Posts Criados" icon="✍️" value={dados.totalPostsCriados} />
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
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as UsuarioTipo)}
                className="border rounded px-3 py-2">
                <option value="">Todos os tipos</option>
                <option value="atleta">Atletas</option>
                <option value="escola">Escolas</option>
                <option value="clube">Clubes</option>
                <option value="professor">Professores</option>
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

            <div className="bg-white rounded shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Usuário</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Criado em</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const nome = u.nome ?? u.nomeDeUsuario ?? "(sem nome)";
                    const foto = u.foto
                      ? (u.foto.startsWith("http") ? u.foto : `${API.BASE_URL}${u.foto}`)
                      : `${API.BASE_URL}/assets/default-user.png`;
                    return (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <img src={foto} className="w-8 h-8 rounded-full object-cover border" />
                            <div className="font-medium flex items-center gap-2">
                              {nome}
                              {u.verificado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">Verificado</span>}
                              {u.destaque && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-900">Destaque</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{u.email ?? "-"}</td>
                        <td className="px-3 py-2 capitalize">{u.tipo ?? "-"}</td>
                        <td className="px-3 py-2">{formatDate(u.criadoEm)}</td>
                        <td className="px-3 py-2">{}-</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => abrirDetalhes(u.id)}
                            className="text-green-700 hover:underline"
                          >
                            Detalhes
                          </button>
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
                      {exercicios.map((ex: any) => (
                        <li key={ex.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                          <div>
                            <strong>{ex.nome}</strong> — {ex.codigo} [{ex.nivel}]
                            <p className="text-sm text-gray-500">{ex.descricao}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => (window.location.href = `/admin/exercicios/create?id=${ex.id}`)}
                              className="text-blue-600"
                            >
                              ✏️
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
                            >
                              🗑️
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
        
                {aba === "treinos" && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">Gerenciar Treinos</h3>
                      <button className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800" onClick={() => window.location.href = "/admin/treinos/create"}>
                        + Novo Treino
                      </button>

                    </div>
                    <ul className="space-y-2">
                      {treinos.map((t: any) => (
                        <li key={t.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                          <div>
                            <strong>{t.nome}</strong> — {t.codigo} [{t.nivel}]
                            <p className="text-sm text-gray-500">{t.descricao}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => window.location.href = `/admin/treinos/create?id=${t.id}`}
                              className="text-blue-600"
                            >
                              ✏️
                            </button>

                            <button
                              onClick={async () => {
                                const confirmar = confirm("Deseja mesmo excluir este treino?");
                                if (!confirmar) return;

                                const response = await fetch(`${API.BASE_URL}/api/treinosprogramados/${t.id}`, {
                                  method: "DELETE",
                                });

                                if (response.ok) {
                                  alert("Treino excluído com sucesso!");
                                  } else {
                                  alert("Erro ao excluir treino.");
                                }
                              }}
                            >
                              🗑
                            </button>

                          </div>
                        </li>
                      ))}
                    </ul>
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
                            <p className="text-sm text-gray-600">Qualificações: {p.qualificacoes.join(", ")}</p>
                            <p className="text-sm text-gray-500">Certificações: {p.certificacoes.join(", ")}</p>
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
        
                {aba === "desafios" && (
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
                            <p>• {d.categoria.join(", ")} - {d.descricao}</p>
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
                                headers: { "Content-Type": "application/json" },
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
                            headers: { "Content-Type": "application/json" },
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
                      src={
                        u.foto
                          ? (u.foto.startsWith("http") ? u.foto : `${API.BASE_URL}${u.foto}`)
                          : `${API.BASE_URL}/assets/default-user.png`
                      }
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
                    <Info label="Nascimento" value={formatDate(u.dataNascimento)} />
                    <Info label="Endereço" value={u.endereco || "-"} />
                    <Info label="Última atividade" value={formatDate(u.ultimaAtividade)} />
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
                        disabled={acaoBusy}
                        onClick={() => banirOuDesbanir(u.id, false)}
                        className="px-3 py-2 rounded bg-yellow-500 text-white"
                      >
                        Desbanir usuário
                      </button>
                    ) : (
                      <button
                        disabled={acaoBusy}
                        onClick={() => banirOuDesbanir(u.id, true)}
                        className="px-3 py-2 rounded bg-red-600 text-white"
                      >
                        Banir usuário
                      </button>
                    )}

                    <div className="ml-auto flex gap-2">
                      <button disabled={acaoBusy} onClick={() => removerConteudo(u.id, "posts")} className="px-3 py-2 rounded bg-gray-200">
                        Remover posts
                      </button>
                      <button disabled={acaoBusy} onClick={() => removerConteudo(u.id, "comentarios")} className="px-3 py-2 rounded bg-gray-200">
                        Remover comentários
                      </button>
                      <button disabled={acaoBusy} onClick={() => removerConteudo(u.id, "todos")} className="px-3 py-2 rounded bg-gray-200">
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