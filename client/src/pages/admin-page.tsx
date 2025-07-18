import { useEffect, useState } from "react";

type Tab = "dashboard" | "exercicios" | "treinos" | "professores" | "desafios" | "configuracoes";

export default function AdminDashboard() {
  const [aba, setAba] = useState("dashboard");
  const [dados, setDados] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<Tab>('dashboard');
  const [exercicios, setExercicios] = useState<any[]>([]);
  const [treinos, setTreinos] = useState<any[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [desafios, setDesafios] = useState<any[]>([]);
  
  useEffect(() => {
    fetch("http://localhost:3001/api/admin")
      .then(res => res.json())
      .then(setDados)
      .catch(console.error);

    fetch('http://localhost:3001/api/exercicios')
      .then(res => res.json())
      .then(setExercicios)
      .catch(console.error);
      
    fetch('http://localhost:3001/api/treinos')
      .then(res => res.json())
      .then(setTreinos)
      .catch(console.error);

    fetch('http://localhost:3001/api/professores')
      .then(res => res.json())
      .then(setProfessores)
      .catch(console.error);

    fetch('http://localhost:3001/api/desafios')
      .then(res => res.json())
      .then(setDesafios)
      .catch(console.error);


  }, []);

  if (!dados) return <div className="p-6">Carregando...</div>;

  const percent = (val: number) => {
    const total = dados.totalUsuarios || 1;
    return Math.round((val * 100) / total);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="flex justify-between items-center bg-green-900 text-white px-6 py-4 rounded">
        <h1 className="text-2xl font-bold">FOOTERA</h1>
        <button className="bg-red-600 px-4 py-2 rounded">Sair</button>
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

            <h4 className="font-semibold mb-2">Distribuição de Usuários</h4>
            {[
              { label: "Atletas", value: dados.totalAtletas },
              { label: "Escolas de Futebol", value: dados.totalEscolinhas },
              { label: "Clubes Profissionais", value: dados.totalClubes },
              { label: "Administradores", value: dados.totalAdministradores },
              { label: "Profilers", value: dados.totalMidias },
            ].map((d, i) => (
              <Bar key={i} label={d.label} percent={percent(d.value)} />
            ))}

            <h4 className="font-semibold mt-6 mb-2">Status dos Usuários</h4>
            <Bar label="Verificados" percent={percent(dados.totalVerificados)} />
            <Bar label="Não Verificados" percent={percent(dados.totalNaoVerificados)} />
         </div>

        )}

        {aba === "exercicios" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Gerenciar Exercícios</h3>
              <button className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800">+ Novo Exercício</button>
            </div>
            <ul className="space-y-2">
              {dados.exercicios.map((ex: any) => (
                <li key={ex.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{ex.nome}</strong> — {ex.codigo} [{ex.nivel}]
                    <p className="text-sm text-gray-500">{ex.descricao}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-600">✏️</button>
                    <button className="text-red-600">🗑️</button>
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
              <button className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800">+ Novo Treino</button>
            </div>
            <ul className="space-y-2">
              {dados.treinos.map((t: any) => (
                <li key={t.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{t.titulo}</strong> — {t.codigo} [{t.nivel}]
                    <p className="text-sm text-gray-500">{t.descricao}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-600">✏️</button>
                    <button className="text-red-600">🗑️</button>
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
              <button className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800">+ Novo Professor</button>
            </div>
            <ul className="space-y-2">
              {dados.professores.map((p: any) => (
                <li key={p.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{p.usuario?.nome}</strong> — CREF: {p.cref} — {p.areaFormacao}
                    <p className="text-sm text-gray-600">{p.qualificacoes}</p>
                    <p className="text-sm text-gray-500">{p.certificacoes}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-600">✏️</button>
                    <button className="text-red-600">🗑️</button>
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
              <button className="bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800">+ Novo Desafio</button>
            </div>
            <ul className="space-y-2">
              {dados.desafios.map((d: any) => (
                <li key={d.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                  <div>
                    <strong>{d.titulo}</strong> — {d.categoriaIdade} — {d.objetivo}
                    <p className="text-sm text-gray-500">
                      Pontos: {d.pontuacao} • Prazo: {new Date(d.prazoSubmissao).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-600">✏️</button>
                    <button className="text-red-600">🗑️</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {aba === "configuracoes" && (
          <div className="bg-transparent p-6 rounded shadow">
            <h3 className="font-bold mb-4">Configurações</h3>
            <div className="grid gap-4">
              <label className="flex items-center justify-between">
                <span>Cadastro Habilitado</span>
                <input type="checkbox" defaultChecked className="scale-125" />
              </label>
              <label className="flex items-center justify-between">
                <span>Modo Manutenção</span>
                <input type="checkbox" className="scale-125" />
              </label>
              <label className="flex items-center justify-between">
                <span>Permitir Desafios de Atleta</span>
                <input type="checkbox" defaultChecked className="scale-125" />
              </label>
              <label className="flex items-center justify-between">
                <span>Editar Perfil</span>
                <input type="checkbox" defaultChecked className="scale-125" />
              </label>
            </div>
            <div className="mt-6">
              <label className="block mb-1">Máx. posts diários</label>
              <input type="number" defaultValue={5} className="border px-2 py-1 rounded w-24" />
            </div>
            <div className="mt-4 flex gap-4">
              <button className="bg-gray-200 px-4 py-2 rounded">Atualizar Cache</button>
              <button className="bg-gray-200 px-4 py-2 rounded">Verificar Integridade</button>
            </div>
          </div>
        )}
      </div>
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
