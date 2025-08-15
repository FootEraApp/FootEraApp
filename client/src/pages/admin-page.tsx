import { useEffect, useState } from "react";
import { API } from "../config.js";

type Tab = "dashboard" | "exercicios" | "treinos" | "professores" | "desafios" | "configuracoes";

interface Treinos {
  id: string;
  nome: string;
  codigo: string;
  nivel: string;
  descricao: string;
}

 function AdminDashboard() {
  const [aba, setAba] = useState("dashboard");
  const [dados, setDados] = useState<any>(null);
  const [exercicios, setExercicios] = useState<any[]>([]);
  const [treinos, setTreinos] = useState<Treinos[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [desafios, setDesafios] = useState<any[]>([]);
  const [configuracoes, setConfiguracoes] = useState<any>(null);
  
  useEffect(() => {
    fetch(`${API.BASE_URL}/api/admin`)
      .then(res => res.json())
      .then(setDados)
      .catch(console.error);

    fetch(`${API.BASE_URL}/api/exercicios`)
      .then(res => res.json())
      .then(setExercicios)
      .catch(console.error);
      
    fetch(`${API.BASE_URL}/api/treinos`)
      .then(res => res.json())
      .then(setTreinos)
      .catch(console.error);

    fetch(`${API.BASE_URL}/api/professores`)
      .then(res => res.json())
      .then(setProfessores)
      .catch(console.error);

    fetch(`${API.BASE_URL}/api/desafios`)
      .then(res => res.json())
      .then(setDesafios)
      .catch(console.error);

    fetch(`${API.BASE_URL}/api/configuracoes`)
      .then(res => res.json())
      .then(setConfiguracoes)
      .catch(console.error);
  }, []);

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
        {['dashboard', 'exercicios', 'treinos', 'professores', 'desafios', 'configuracoes'].map((t) => (
          <button
            key={t}
            className={`px-4 py-2 rounded ${aba === t ? 'bg-green-800 text-white' : 'bg-gray-200'}`}
            onClick={() => setAba(t as Tab)}
          >
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

            
            <h4 className="font-semibold mb-2" >Distribuição de Usuários</h4>
            <div className="bg-white p-3 ">
               {[
              { label: "Atletas", value: dados.totalAtletas },
              { label: "Escolas de Futebol", value: dados.totalEscolinhas },
              { label: "Clubes Profissionais", value: dados.totalClubes },
              { label: "Administradores", value: dados.totalAdministradores },
              { label: "Profilers", value: dados.totalMidias },
            ].map((d, i) => (
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

        {aba === "exercicios" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Gerenciar Exercícios</h3>
              <button
                className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800"
                onClick={() => window.location.href = "/admin/exercicios/create"}
              >
                + Novo Exercicio
              </button>
            </div>
            <ul className="space-y-2">
              {dados.exercicios.map((ex: any) => (
                <li key={ex.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{ex.nome}</strong> — {ex.codigo} [{ex.nivel}]
                    <p className="text-sm text-gray-500">{ex.descricao}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.href = `/admin/exercicios/create?id=${ex.id}`}
                      className="text-blue-600"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={async () => {
                        const confirmar = confirm("Deseja excluir este exercício?");
                        if (!confirmar) return;

                        const response = await fetch(`${API.BASE_URL}/api/exercicios/${ex.id}`, {
                          method: "DELETE",
                        });

                        if (response.ok) {
                          alert("Exercício excluído com sucesso!");
                        } else {
                          alert("Erro ao excluir exercício.");
                        }
                      }}
                    >🗑️</button>
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
              {dados.treinos.map((t: any) => (
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
                onClick={() => window.location.href = "/admin/professores/create"}
              >
                + Novo Professor
              </button>
            </div>
            <ul className="space-y-2">
              {dados.professores.map((p: any) => (
                <li key={p.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{p.nome}</strong> 
                    <p>  CREF: {p.cref} — {p.areaFormacao} </p>
                    <p className="text-sm text-gray-600"> - Qualificações: {p.qualificacoes.join(", ")}</p>
                    <p className="text-sm text-gray-500">- Certificações: {p.certificacoes.join(", ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => window.location.href = `/admin/professores/create?id=${p.id}`}>✏️</button>
                    <button
                      onClick={async () => {
                        const confirmar = confirm("Deseja excluir este professor?");
                        if (!confirmar) return;
                        const response = await fetch(`${API.BASE_URL}/api/professores/${p.id}`, {
                          method: "DELETE",
                        });
                        response.ok ? alert("Professor excluído!") : alert("Erro ao excluir professor.");
                      }}
                    >🗑️</button>
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
                onClick={() => window.location.href = "/admin/desafios/create"}
              >
                + Novo Desafio
              </button>
            </div>
            <ul className="space-y-2">
              {dados.desafios.map((d: any) => (
                <li key={d.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{d.titulo}</strong> 
                    <p>• {d.categoria.join(", ")} - {d.descricao} </p>
                    <p className="text-sm text-gray-500">Pontos: {d.pontos}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.href = `/admin/desafios/create?id=${d.id}`}
                      className="text-blue-600"
                    >✏️</button>
                    <button
                      onClick={async () => {
                        const confirmar = confirm("Deseja mesmo excluir este desafio?");
                        if (!confirmar) return;

                        const response = await fetch(`${API.BASE_URL}/api/desafios/${d.id}`, {
                          method: "DELETE",
                        });

                        if (response.ok) {
                          alert("Desafio excluído com sucesso!");
                          window.location.reload();
                        } else {
                          alert("Erro ao excluir desafio.");
                        }
                      }}
                      className="text-red-600"
                    >🗑️</button>
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
    </div>
  );
}
export default AdminDashboard;

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
