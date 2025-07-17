import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [aba, setAba] = useState("dashboard");
  const [dados, setDados] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:3001/api/admin")
      .then(res => res.json())
      .then(setDados)
      .catch(console.error);
  }, []);

  if (!dados) return <div className="p-6">Carregando...</div>;

  const percent = (val: number) => {
    const total = dados.totalUsuarios || 1;
    return Math.round((val * 100) / total);
  };

  return (
    <div className="min-h-screen bg-cream text-green-900">
      <div className="bg-green-900 text-white p-4 text-2xl font-bold text-center">FOOTERA</div>

      <div className="p-4 flex justify-between items-center">
        <h2 className="text-lg font-bold">Painel Administrativo</h2>
        <form action="/logout" method="post">
          <button className="bg-red-500 text-white px-3 py-1 rounded">Sair</button>
        </form>
      </div>

      <div className="flex justify-around border-b bg-green-100">
        {["dashboard", "exercicios", "treinos", "professores", "desafios", "configuracoes"].map(tab => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={`flex-1 py-2 text-center ${aba === tab ? "bg-white font-bold border-b-2 border-green-800" : ""}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

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
              { label: "Escolas", value: dados.totalEscolinhas },
              { label: "Clubes", value: dados.totalClubes },
              { label: "Admins", value: dados.totalAdministradores },
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
            <h3 className="font-bold mb-2">Exercícios</h3>
            <ul className="space-y-2">
              {dados.exercicios.map((ex: any) => (
                <li key={ex.id} className="bg-white p-3 rounded shadow">
                  <strong>{ex.nome}</strong> — {ex.codigo} [{ex.nivel}]
                </li>
              ))}
            </ul>
          </div>
        )}

        {aba === "treinos" && (
          <div>
            <h3 className="font-bold mb-2">Treinos</h3>
            <ul className="space-y-2">
              {dados.treinos.map((t: any) => (
                <li key={t.id} className="bg-white p-3 rounded shadow">
                  <strong>{t.titulo}</strong> — {t.codigo} [{t.nivel}]
                </li>
              ))}
            </ul>
          </div>
        )}

        {aba === "professores" && (
          <div>
            <h3 className="font-bold mb-2">Professores</h3>
            <ul className="space-y-2">
              {dados.professores.map((p: any) => (
                <li key={p.id} className="bg-white p-3 rounded shadow">
                  <strong>{p.usuario.nome}</strong> — CREF: {p.cref} — {p.areaFormacao}
                </li>
              ))}
            </ul>
          </div>
        )}

        {aba === "desafios" && (
          <div>
            <h3 className="font-bold mb-2">Desafios</h3>
            <ul className="space-y-2">
              {dados.desafios.map((d: any) => (
                <li key={d.id} className="bg-white p-3 rounded shadow">
                  <strong>{d.titulo}</strong> — {d.nivel}
                </li>
              ))}
            </ul>
          </div>
        )}

        {aba === "configuracoes" && (
          <div>
            <h3 className="font-bold">Configurações</h3>
            <p className="text-gray-500 mt-2">Nenhuma configuração disponível ainda.</p>
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
