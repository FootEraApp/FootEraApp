import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

interface UsuarioLogado {
  tipo: "atleta" | "escola" | "clube" | "professor";
}

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
}

interface AtletaVinculado {
  id: string;
  nome: string;
  foto?: string;
}

interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  dataAgendada?: string;
  exercicios: {
    id: string;
    nome: string;
    repeticoes?: string;
  }[];
}

export default function NovoTreino() {
  const [, navigate] = useLocation();

  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [prazos, setPrazos]  = useState<Record<string, string>>({});
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<Exercicio[]>([]);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<TreinoProgramado[]>([]);
  const [atletasVinculados, setAtletasVinculados] = useState<AtletaVinculado[]>([]);
  const [atletasSelecionados, setAtletasSelecionados] = useState<string[]>([]);

  const [etapa, setEtapa] = useState<number>(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [duracao, setDuracao] = useState<number>(60);
  const [dataTreino, setDataTreino] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("Sub13");
  const [tipoTreino, setTipoTreino] = useState<string>("Tecnico");
  const [objetivo, setObjetivo] = useState<string>("");

  type ExercicioSelecionado = {
    nome: string;
    series: string;
    repeticoes: string;
    descricao: string;
    exercicioId?: string;
  };

  const [exerciciosSelecionados, setExerciciosSelecionados] =
  useState<ExercicioSelecionado[]>([]);
  const [dicas, setDicas] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState<string>("");

  type TreinoAgendadoResp = {
    id: string;
    titulo: string;
    dataTreino: string;
    treinoProgramadoId: string;
  };

  useEffect(() => {
    const tipoSalvo = Storage.tipoSalvo;
    const idSalvo = Storage.usuarioId;
    const atletaId = Storage.tipoUsuarioId;
    const token = Storage.token;

    if (["atleta", "escola", "clube", "professor"].includes(tipoSalvo || "")) {
      setUsuario({ tipo: tipoSalvo as UsuarioLogado["tipo"] });
      if (idSalvo) setUsuarioId(idSalvo);
    }

    const carregarExercicios = async () => {
      const res = await fetch(`${API.BASE_URL}/api/exercicios`);
      const json = await res.json();
      setExerciciosDisponiveis(json);
    };

    const carregarAtletas = async () => {
      if (!atletaId) return;
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/atletas-vinculados?tipoUsuarioId=${atletaId}`
      );
      const json = await res.json();
      setAtletasVinculados(json);
    };

    const carregarTreinosDisp = async () => {
      if (!atletaId || !token) return;
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/disponiveis?tipoUsuarioId=${atletaId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      setTreinosDisponiveis(json);
    };

    carregarExercicios();
    carregarAtletas();
    carregarTreinosDisp();
  }, []);

  const adicionarExercicio = () => {
    setExerciciosSelecionados([
      ...exerciciosSelecionados,
      { nome: "", series: "", repeticoes: "", descricao: "" },
    ]);
  };

  const atualizarExercicio = (
    index: number,
    campo: keyof ExercicioSelecionado,
    valor: string
  ) => {
    const copia = [...exerciciosSelecionados];
    (copia[index][campo] as string | undefined) = valor;
    setExerciciosSelecionados(copia);
  };

  const removerExercicio = (index: number) => {
    const novaLista = [...exerciciosSelecionados];
    novaLista.splice(index, 1);
    setExerciciosSelecionados(novaLista);
  };

  const adicionarExercicioExistente = (exercicio: Exercicio) => {
    setExerciciosSelecionados([
      ...exerciciosSelecionados,
      {
        nome: exercicio.nome,
        series: "",
        repeticoes: "",
        descricao: "",
        exercicioId: exercicio.id,
      },
    ]);
  };

  const adicionarDica = () => {
    if (dicaAtual.trim()) {
      setDicas([...dicas, dicaAtual]);
      setDicaAtual("");
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

    const res = await fetch(`${API.BASE_URL}/api/treinos`, {
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
        atletasIds: atletasSelecionados,
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

  const agendarTreino = async (t: TreinoProgramado) => {
    try {
      const atletaId = Storage.tipoUsuarioId;  
      const token = Storage.token;

      if (!atletaId || !token) {
        alert("Sessão expirada. Faça login novamente.");
        return;
      }

      const prazoSelecionado = prazos[t.id];
      const quandoISO = prazoSelecionado
      ? new Date(prazoSelecionado).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: t.nome,
          dataTreino: quandoISO,
          dataExpiracao: quandoISO,
          atletaId,      
          treinoProgramadoId: t.id, 
        }),
      });
      
      if (!res.ok) {
        const txt = await res.text();
        console.error('Falha ao agendar treino:', res.status, txt);
        alert("Erro ao agendar treino.");
        return;
      }

      const novo = await res.json();
      sessionStorage.setItem('lastAgendamento', JSON.stringify(novo));
      navigate("/treinos");

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("treino:agendado", { detail: novo }));
      }, 50);

      setPrazos(({ [t.id]: _, ...rest }) => rest);

      alert("Treino agendado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao agendar treino.");
    }
  };

  if (!usuario) return <p className="text-center p-4">Carregando...</p>;

  if (usuario.tipo === "atleta") {
    return (
      <div className="p-4 max-w-xl mx-auto">
        <h2 className="text-lg font-bold mb-4">Treinos Disponíveis</h2>

        {treinosDisponiveis.length === 0 ? (
          <p className="text-gray-600">Nenhum treino disponível no momento.</p>
        ) : (
          treinosDisponiveis.map((t) => (
            <div key={t.id} className="bg-white border p-4 rounded shadow mb-4">
              <h3 className="text-green-800 text-lg  font-semibold">{t.nome}</h3>
              
              <p className="text-sm"><strong>Descrição:</strong> {t.descricao }</p>
              
              <p className="text-sm">
                <strong>Nível:</strong> {t.nivel}
              </p>

               <p className="text-sm"><strong>Exercícios:</strong></p>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {t.exercicios.map((ex, i) => (
                  <li key={i}>{ex.nome} ({ex.repeticoes})</li>
                ))}
              </ul>
              <label className="text-sm mt-2 block"><strong>Prazo para envio: </strong></label>
               <input
                type="datetime-local"
                className="border p-2 rounded"
                value={prazos[t.id] || ""}
                onChange={(e) =>
                 setPrazos((prev) => ({ ...prev, [t.id]: e.target.value }))
                }
                />
              <button
                className="mt-3 bg-green-800 text-white px-5 py-2 rounded ml-10"
                onClick={() => agendarTreino(t)}
              >
                Agendar este treino
              </button>
            </div>
          ))
        )}

        <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-2 flex justify-around items-center shadow-md">
          <Link href="/feed" className="hover:underline">
            <House />
          </Link>
          <Link href="/explorar" className="hover:underline">
            <Search />
          </Link>
          <Link href="/post" className="hover:underline">
            <CirclePlus />
          </Link>
          <Link href="/treinos" className="hover:underline">
            <Volleyball />
          </Link>
          <Link href="/perfil" className="hover:underline">
            <User />
          </Link>
        </nav>
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
            onChange={(e) => setNome(e.target.value)}
          />

          <label className="block text-sm text-gray-700 mb-1">Descrição</label>
          <textarea
            className="border w-full mb-2 p-2"
            placeholder="Descrição do Treino"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />

          <label className="block text-sm text-gray-700 mb-1">Nível do Treino</label>
          <select
            className="border w-full mb-2 p-2"
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
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
            onChange={(e) => setCategoria(e.target.value)}
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
            onChange={(e) => setTipoTreino(e.target.value)}
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
            onChange={(e) => setDuracao(parseInt(e.target.value))}
          />

          <label className="block text-sm text-gray-700 mb-1">
            Data Agendada (prazo para envio)
          </label>
          <input
            className="border w-full mb-4 p-2"
            type="datetime-local"
            value={dataTreino}
            onChange={(e) => setDataTreino(e.target.value)}
          />

          <button onClick={() => setEtapa(2)} className="bg-green-800 text-white px-4 py-2 rounded">
            Próximo
          </button>
        </>
      )}

      {etapa === 2 && (
        <>
          <h3 className="font-bold text-lg mb-2">Exercícios Selecionados</h3>

          {exerciciosSelecionados.map((ex, i) => (
            <div key={i} className="mb-2 border p-2 rounded relative">
              <button onClick={() => removerExercicio(i)} className="absolute top-1 right-1 text-red-600 text-sm">
                Remover
              </button>

              <input
                className="border w-full mb-1 p-1"
                placeholder="Nome"
                value={ex.nome}
                onChange={(e) => atualizarExercicio(i, "nome", e.target.value)}
              />
              <input
                className="border w-full mb-1 p-1"
                placeholder="Séries"
                value={ex.series}
                onChange={(e) => atualizarExercicio(i, "series", e.target.value)}
              />
              <input
                className="border w-full mb-1 p-1"
                placeholder="Repetições"
                value={ex.repeticoes}
                onChange={(e) => atualizarExercicio(i, "repeticoes", e.target.value)}
              />
              <textarea
                className="border w-full mb-1 p-1"
                placeholder="Descrição"
                value={ex.descricao}
                onChange={(e) => atualizarExercicio(i, "descricao", e.target.value)}
              />
            </div>
          ))}

          <button onClick={adicionarExercicio} className="bg-gray-200 px-3 py-1 rounded mb-3">
            + Adicionar linha
          </button>

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
            <button onClick={() => setEtapa(1)} className="bg-gray-200 px-4 py-2 rounded">
              Voltar
            </button>
            <button onClick={() => setEtapa(3)} className="bg-green-800 text-white px-4 py-2 rounded">
              Próximo
            </button>
          </div>
        </>
      )}

      {etapa === 3 && (
        <>
          <h3 className="font-bold text-lg mb-2">Dicas para os Atletas</h3>
          <input
            className="border w-full mb-2 p-2"
            placeholder="Ex: Mantenha a postura correta"
            value={dicaAtual}
            onChange={(e) => setDicaAtual(e.target.value)}
          />
          <button onClick={adicionarDica} className="bg-gray-300 px-3 py-1 rounded mb-4">
            + Adicionar
          </button>

          <ul className="list-disc pl-5 text-sm text-gray-700">
            {dicas.map((dica, i) => (
              <li key={i}>{dica}</li>
            ))}
          </ul>

          <div className="flex justify-between mt-4">
            <button onClick={() => setEtapa(2)} className="bg-gray-200 px-4 py-2 rounded">
              Voltar
            </button>
            <button onClick={() => setEtapa(4)} className="bg-green-800 text-white px-4 py-2 rounded">
              Próximo
            </button>
          </div>
        </>
      )}

      {etapa === 4 && (
        <>
          <h3 className="font-bold text-lg mb-2">Selecionar Atletas Vinculados</h3>

          {atletasVinculados.length === 0 ? (
            <div className="bg-gray-100 text-gray-600 text-center py-6 rounded">
              Nenhum atleta vinculado encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {atletasVinculados.map((atleta) => {
                const selecionado = atletasSelecionados.includes(atleta.id);
                return (
                  <div
                    key={atleta.id}
                    onClick={() =>
                      setAtletasSelecionados((prev) =>
                        selecionado ? prev.filter((id) => id !== atleta.id) : [...prev, atleta.id]
                      )
                    }
                    className={`cursor-pointer p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 ${
                      selecionado ? "border-green-500 bg-green-50" : "border-gray-200"
                    }`}
                  >
                    <img
                      src={
                        atleta.foto ? `${API.BASE_URL}${atleta.foto}` : "https://via.placeholder.com/80"
                      }
                      alt={atleta.nome}
                      className="w-20 h-20 mx-auto rounded-full object-cover mb-2"
                    />
                    <p className="font-semibold">{atleta.nome}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setEtapa(3)} className="bg-gray-200 px-4 py-2 rounded">
              Voltar
            </button>
            <button onClick={criarTreino} className="bg-green-800 text-white px-4 py-2 rounded">
              Salvar Treino
            </button>
          </div>
        </>
      )}
    </div>
  );
}