import { useEffect, useState } from "react";
import { Link } from "wouter";

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
}

interface Desafio {
  id: string;
  titulo: string;
  descricao: string;
  nivel: string;
  pontos: number;
  imagemUrl?: string;
}

interface UsuarioLogado {
  tipo: 'atleta' | 'escola' | 'clube' | 'professor';
}

export default function PaginaTreinos() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [aba, setAba] = useState<'treinos' | 'desafios' | 'criar'>('treinos');
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<Exercicio[]>([]);
  const [filtroSub, setFiltroSub] = useState<string>('Todos');

  const [etapa, setEtapa] = useState<number>(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [duracao, setDuracao] = useState<number>(60);
  const [dataTreino, setDataTreino] = useState<string>("");
  const [faixaEtaria, setFaixaEtaria] = useState<string>('Sub-13');
  const [categoria, setCategoria] = useState<string>('Técnico');
  const [objetivo, setObjetivo] = useState<string>('');
  const [exerciciosSelecionados, setExerciciosSelecionados] = useState<{ nome: string, series: string, repeticoes: string, descricao: string }[]>([]);
  const [dicas, setDicas] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState<string>('');

  useEffect(() => {
    const carregar = async () => {
      const res = await fetch("http://localhost:3001/api/treinos");
      const json = await res.json();
      setTreinos(json.treinosProgramados);
      setDesafios(json.desafiosOficiais);
    };

    const carregarExercicios = async () => {
      const res = await fetch("http://localhost:3001/api/exercicios");
      const json = await res.json();
      setExerciciosDisponiveis(json);
    };

    const carregarUsuario = () => {
  const tipoSalvo = localStorage.getItem("tipoUsuario");

  if (["atleta", "escola", "clube", "professor"].includes(tipoSalvo || "")) {
    setUsuario({ tipo: tipoSalvo as 'atleta' | 'escola' | 'clube' | 'professor' });
  } else {
    console.warn("Tipo de usuário inválido ou não encontrado.");
  }
};

    carregar();
    carregarExercicios();
    carregarUsuario();
  }, []);

  const adicionarExercicio = () => {
    setExerciciosSelecionados([...exerciciosSelecionados, { nome: '', series: '', repeticoes: '', descricao: '' }]);
  };

  const atualizarExercicio = (index: number, campo: string, valor: string) => {
    const copia = [...exerciciosSelecionados];
    copia[index][campo] = valor;
    setExerciciosSelecionados(copia);
  };

  const adicionarDica = () => {
    if (dicaAtual.trim()) {
      setDicas([...dicas, dicaAtual]);
      setDicaAtual('');
    }
  };

  const criarTreino = async () => {
    const res = await fetch("http://localhost:3001/api/treinos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, descricao, nivel, faixaEtaria, categoria, objetivo, duracao, dataTreino, exercicios: exerciciosSelecionados, dicas }),
    });

    if (res.ok) {
      alert("Treino criado com sucesso!");
      setEtapa(1);
      setAba("treinos");
    }
  };

  if (!usuario) return <p className="text-center p-4">Carregando...</p>;

  return (
    <div className="min-h-screen bg-yellow-50 pb-20">
      <div className="p-4 max-w-2xl mx-auto">
        {usuario.tipo === 'clube' ? (
          <div className="text-center py-10">
            <h2 className="text-lg font-semibold">Treinos e Desafios</h2>
            <p className="text-gray-500">Em breve disponível para clubes</p>
          </div>
        ) : (
          <>
            <div className="flex space-x-2 mb-4">
              <button onClick={() => setAba('treinos')} className={`px-4 py-2 rounded ${aba === 'treinos' ? 'bg-green-900 text-white' : 'bg-gray-200'}`}>Meus Treinos</button>
              <button onClick={() => setAba('desafios')} className={`px-4 py-2 rounded ${aba === 'desafios' ? 'bg-yellow-400 text-white' : 'bg-gray-200'}`}>Desafios</button>
              {usuario.tipo === 'escola' && (
                <button onClick={() => setAba('criar')} className={`px-4 py-2 rounded ${aba === 'criar' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>Criar</button>
              )}
            </div>

            {aba === 'treinos' && (
              <div>
                <div className="flex gap-2 mb-2 overflow-x-auto">
                  {['Todos', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20'].map(sub => (
                    <button key={sub} onClick={() => setFiltroSub(sub)} className={`px-3 py-1 rounded-full border ${filtroSub === sub ? 'bg-green-800 text-white' : 'bg-white'}`}>{sub}</button>
                  ))}
                </div>
                <div className="space-y-4">
                  {treinos.filter(t => filtroSub === 'Todos' || t.nivel === filtroSub).map((treino) => (
                    <div key={treino.id} className="bg-white p-4 rounded shadow border">
                      <h3 className="font-bold text-lg">{treino.nome}</h3>
                      <p className="text-sm text-gray-600">{treino.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aba === 'desafios' && (
              <div className="space-y-4">
                {desafios.map((d) => (
                  <div key={d.id} className="bg-white p-4 rounded shadow border border-yellow-400">
                    <h3 className="font-bold text-yellow-700">{d.titulo}</h3>
                    <p className="text-sm text-gray-600">{d.descricao}</p>
                  </div>
                ))}
              </div>
            )}

            {aba === 'criar' && (usuario.tipo === 'escola' || usuario.tipo === 'professor') && (
              <div className="bg-white p-4 rounded shadow">
                {etapa === 1 && (
                  <>
                    <h3 className="font-bold text-lg mb-2">Informações Básicas</h3>
                    <input className="border w-full mb-2 p-2" placeholder="Título do Treino" value={nome} onChange={e => setNome(e.target.value)} />
                    <textarea className="border w-full mb-2 p-2" placeholder="Descrição" value={descricao} onChange={e => setDescricao(e.target.value)} />
                    <input className="border w-full mb-2 p-2" placeholder="Objetivo" value={objetivo} onChange={e => setObjetivo(e.target.value)} />
                    <select className="border w-full mb-2 p-2" value={categoria} onChange={e => setCategoria(e.target.value)}>
                      <option>Técnico</option>
                      <option>Físico</option>
                      <option>Tático</option>
                    </select>
                    <select className="border w-full mb-2 p-2" value={faixaEtaria} onChange={e => setFaixaEtaria(e.target.value)}>
                      <option>Sub-13</option>
                      <option>Sub-15</option>
                      <option>Sub-17</option>
                      <option>Sub-20</option>
                    </select>
                    <input className="border w-full mb-2 p-2" type="number" value={duracao} onChange={e => setDuracao(Number(e.target.value))} placeholder="Duração (min)" />
                    <input className="border w-full mb-2 p-2" type="date" value={dataTreino} onChange={e => setDataTreino(e.target.value)} />
                    <button onClick={() => setEtapa(2)} className="bg-green-800 text-white px-4 py-2 rounded">Próximo</button>
                  </>
                )}

                {etapa === 2 && (
                  <>
                    <h3 className="font-bold text-lg mb-2">Exercícios</h3>
                    {exerciciosSelecionados.map((ex, i) => (
                      <div key={i} className="mb-2 border p-2 rounded">
                        <input className="border w-full mb-1 p-1" placeholder="Nome" value={ex.nome} onChange={e => atualizarExercicio(i, 'nome', e.target.value)} />
                        <input className="border w-full mb-1 p-1" placeholder="Séries" value={ex.series} onChange={e => atualizarExercicio(i, 'series', e.target.value)} />
                        <input className="border w-full mb-1 p-1" placeholder="Repetições" value={ex.repeticoes} onChange={e => atualizarExercicio(i, 'repeticoes', e.target.value)} />
                        <textarea className="border w-full mb-1 p-1" placeholder="Descrição" value={ex.descricao} onChange={e => atualizarExercicio(i, 'descricao', e.target.value)} />
                      </div>
                    ))}
                    <button onClick={adicionarExercicio} className="bg-gray-300 px-3 py-1 rounded">+ Adicionar Exercício</button>
                    <div className="flex justify-between mt-4">
                      <button onClick={() => setEtapa(1)} className="bg-gray-200 px-4 py-2 rounded">Voltar</button>
                      <button onClick={() => setEtapa(3)} className="bg-green-800 text-white px-4 py-2 rounded">Próximo</button>
                    </div>
                  </>
                )}

                {etapa === 3 && (
                  <>
                    <h3 className="font-bold text-lg mb-2">Dicas para os Atletas</h3>
                    <input className="border w-full mb-2 p-2" placeholder="Ex: Mantenha a postura correta" value={dicaAtual} onChange={e => setDicaAtual(e.target.value)} />
                    <button onClick={adicionarDica} className="bg-gray-300 px-3 py-1 rounded mb-4">+ Adicionar</button>
                    <ul className="list-disc pl-5 text-sm text-gray-700">
                      {dicas.map((dica, i) => <li key={i}>{dica}</li>)}
                    </ul>
                    <div className="flex justify-between mt-4">
                      <button onClick={() => setEtapa(2)} className="bg-gray-200 px-4 py-2 rounded">Voltar</button>
                      <button onClick={() => setEtapa(4)} className="bg-green-800 text-white px-4 py-2 rounded">Próximo</button>
                    </div>
                  </>
                )}

                {etapa === 4 && (
                  <>
                    <h3 className="font-bold text-lg mb-2">Selecionar Atletas</h3>
                    <div className="bg-gray-100 text-gray-600 text-center py-6 rounded">Você precisa ter atletas vinculados à sua escola para criar treinos com participantes.</div>
                    <div className="flex justify-between mt-4">
                      <button onClick={() => setEtapa(3)} className="bg-gray-200 px-4 py-2 rounded">Voltar</button>
                      <button onClick={criarTreino} className="bg-green-800 text-white px-4 py-2 rounded">Salvar Treino</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/home" className="hover:underline">Feed</Link>
        <Link href="/explorar" className="hover:underline">Explorar</Link>
        <Link href="/novo" className="hover:underline text-2xl">+</Link>
        <Link href="/treinos" className="hover:underline">Treinos</Link>
        <Link href="/perfil" className="hover:underline">Perfil</Link>
      </nav>
    </div>
  );
}