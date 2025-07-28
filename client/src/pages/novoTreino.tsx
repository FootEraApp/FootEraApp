import { useEffect, useState } from "react";

interface UsuarioLogado {
  tipo: 'atleta' | 'escola' | 'clube' | 'professor';
}

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
}

export default function NovoTreino() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<Exercicio[]>([]);

  const [etapa, setEtapa] = useState<number>(1);
  const [nome, setNome] = useState("");

  const [descricao, setDescricao] = useState("");

  const [nivel, setNivel] = useState("Base");
  const [duracao, setDuracao] = useState<number>(60);
  const [dataTreino, setDataTreino] = useState<string>("");
  const [categoria, setCategoria] = useState<string>('Sub-13');
  const [tipoTreino, setTipoTreino] = useState<string>('Tecnico'); 

  const [objetivo, setObjetivo] = useState<string>('');

  const [exerciciosSelecionados, setExerciciosSelecionados] = useState<
  { nome: string, series: string, repeticoes: string, descricao: string, exercicioId?: string }[]
  >([]);
  const [dicas, setDicas] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState<string>('');

  useEffect(() => {
    const tipoSalvo = localStorage.getItem("tipoUsuario");
    const idSalvo = localStorage.getItem("usuarioId");
    if (["atleta", "escola", "clube", "professor"].includes(tipoSalvo || "")) {
      setUsuario({ tipo: tipoSalvo as UsuarioLogado["tipo"] });
      if (idSalvo) setUsuarioId(idSalvo);
    }

    const carregarExercicios = async () => {
      const res = await fetch("http://localhost:3001/api/exercicios");
      const json = await res.json();
      setExerciciosDisponiveis(json);
    };
    carregarExercicios();
  }, []);

  const adicionarExercicio = () => {
    setExerciciosSelecionados([...exerciciosSelecionados, { nome: '', series: '', repeticoes: '', descricao: '' }]);
  };

  type CampoExercicio = 'nome' | 'series' | 'repeticoes' | 'descricao' | 'exercicioId';

  const atualizarExercicio = (index: number, campo: CampoExercicio, valor: string) => {
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
  const exerciciosParaEnvio = exerciciosSelecionados.map((ex, index) => ({
    exercicioId: ex.exercicioId, 
    nome: ex.nome,
    descricao: ex.descricao,
    repeticoes: ex.repeticoes,
    series: ex.series,
    ordem: index + 1,
  }));

  if (!usuarioId) {
      alert("Erro: usuário não autenticado.");
      return;
    }

  const res = await fetch("http://localhost:3001/api/treinos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome,
      descricao,
      nivel,
      categoria: [categoria],
      tipoTreino,
      objetivo,
      duracao,
      dataTreino,
      dicas,
      exercicios: exerciciosParaEnvio,
      usuarioId,
      tipoUsuario: usuario?.tipo,          
      tipoUsuarioId: localStorage.getItem("tipoUsuarioId"), 
    }),
  });

  if (res.ok) {
    alert("Treino criado com sucesso!");
    setEtapa(1);
  } else {
    const erro = await res.json();
    console.error("Erro ao criar treino:", erro);
    alert("Erro ao criar treino. Verifique o console.");
  }
};

  const adicionarExercicioExistente = (exercicio: Exercicio) => {
    setExerciciosSelecionados([
      ...exerciciosSelecionados,
      {
        nome: exercicio.nome,
        series: '',
        repeticoes: '',
        descricao: '',
        exercicioId: exercicio.id,
      }
    ]);
  };

  const removerExercicio = (index: number) => {
    const novaLista = [...exerciciosSelecionados];
    novaLista.splice(index, 1);
    setExerciciosSelecionados(novaLista);
  };

  if (!usuario) return <p className="text-center p-4">Carregando...</p>;

  if (usuario.tipo === 'atleta') { 
  
    return (
      <div className="p-4 max-w-xl mx-auto">
        <h2 className="text-lg font-bold mb-2">Agendar Treino</h2>
        <p className="text-gray-600">Aqui você poderá futuramente selecionar treinos e escolher data e horário para agendamento.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-lg font-bold mb-4">Criar Novo Treino</h2> 
       

      {etapa === 1 && (
        <>
          <h3 className="font-bold text-lg mb-4">Informações Básicas</h3>

          <label className="block text-sm text-gray-700 mb-1">Título do Treino</label>
          <input
            className="border w-full mb-2 p-2"
            placeholder="Título do Treino"
            value={nome}
            onChange={e => setNome(e.target.value)}
          />

          <label className="block text-sm text-gray-700 mb-1">Descrição</label>
          <textarea
            className="border w-full mb-2 p-2"
            placeholder="Descrição do Treino"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
          />

          <label className="block text-sm text-gray-700 mb-1">Nível do Treino</label>
          <select
            className="border w-full mb-2 p-2"
            value={nivel}
            onChange={e => setNivel(e.target.value)}
          >
            <option value="">--</option>
            <option value="Base">Base</option>
            <option value="Avancado">Avançado</option>
            <option value="Performance">Performance</option>
          </select>

          <label className="block text-sm text-gray-700 mb-1">Categoria (Faixa Etária)</label>
          <select
            className="border w-full mb-2 p-2"
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
          >
            <option value="">--</option>
            <option value="Sub9">Sub-9</option>
            <option value="Sub11">Sub-11</option>
            <option value="Sub13">Sub-13</option>
            <option value="Sub15">Sub-15</option>
            <option value="Sub17">Sub-17</option>
            <option value="Sub20">Sub-20</option>
            <option value="Livre">Livre</option>

          </select>

          <label className="block text-sm text-gray-700 mb-1">Tipo do Treino</label>
          <select
            className="border w-full mb-2 p-2"
            value={tipoTreino}
            onChange={e => setTipoTreino(e.target.value)}
          >
            <option value="">--</option>
            <option value="Tecnico">Técnico</option>
            <option value="Fisico">Físico</option>
            <option value="Tatico">Tático</option>
          </select>

           <label className="block text-sm text-gray-700 mb-1">Duração do Treino (minutos)</label>
            <input
              className="border w-full mb-2 p-2"
              type="number"
              min={1}
              value={duracao}
              onChange={e => setDuracao(parseInt(e.target.value))}
            />

          <label className="block text-sm text-gray-700 mb-1">
            Data Agendada (prazo para envio)
          </label>
          <input
            className="border w-full mb-4 p-2"
            type="datetime-local"
            value={dataTreino}
            onChange={e => setDataTreino(e.target.value)}
          />

          <button
            onClick={() => setEtapa(2)}
            className="bg-green-800 text-white px-4 py-2 rounded"
          >
            Próximo
          </button>
        </>
      )}


        
      {etapa === 2 && ( 
        <>
          <h3 className="font-bold text-lg mb-2">Exercícios Selecionados</h3>
          {exerciciosSelecionados.map((ex, i) => (
            <div key={i} className="mb-2 border p-2 rounded relative">
              <button
                onClick={() => removerExercicio(i)}
                className="absolute top-1 right-1 text-red-600 text-sm"
              >
                Remover
              </button>
              <input
                className="border w-full mb-1 p-1"
                placeholder="Nome"
                value={ex.nome}
                onChange={e => atualizarExercicio(i, 'nome', e.target.value)}
              />
              <input
                className="border w-full mb-1 p-1"
                placeholder="Séries"
                value={ex.series}
                onChange={e => atualizarExercicio(i, 'series', e.target.value)}
              />
              <input
                className="border w-full mb-1 p-1"
                placeholder="Repetições"
                value={ex.repeticoes}
                onChange={e => atualizarExercicio(i, 'repeticoes', e.target.value)}
              />
              <textarea
                className="border w-full mb-1 p-1"
                placeholder="Descrição"
                value={ex.descricao}
                onChange={e => atualizarExercicio(i, 'descricao', e.target.value)}
              />
            </div>
          ))}

          <h3 className="font-bold text-lg mt-6 mb-2">Exercícios Disponíveis</h3>
          <div className="grid grid-cols-1 gap-2">
            {exerciciosDisponiveis.map((exercicio) => (
              <div key={exercicio.id} className="border p-2 rounded flex justify-between items-center">
                <span>{exercicio.nome}</span>
                <button
                  onClick={() => adicionarExercicioExistente(exercicio)}
                  className="bg-blue-600 text-white text-sm px-2 py-1 rounded"
                >
                  Adicionar
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-6">
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
          <div className="bg-gray-100 text-gray-600 text-center py-6 rounded">
            Você precisa ter atletas vinculados à sua escola para criar treinos com participantes.
          </div>
          <div className="flex justify-between mt-4">
            <button onClick={() => setEtapa(3)} className="bg-gray-200 px-4 py-2 rounded">Voltar</button>
            <button onClick={criarTreino} className="bg-green-800 text-white px-4 py-2 rounded">Salvar Treino</button>
          </div>
        </>
      )}
    </div>
  );
}