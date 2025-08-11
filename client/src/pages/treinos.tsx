import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House, Trash2 } from "lucide-react";
import Storage from "../../../server/utils/storage";
import { API } from "../config";

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
  duracao?: number;
  objetivo?: string;
  dicas?: string[];
  professorId?: string;
  escolinhaId?: string;
  exercicios: Exercicio[];
  pontuacao: number;
}

interface TreinoAgendado {
  id: string;
  titulo: string;
  dataTreino: string;
  treinoProgramado?: {
    descricao?: string;
    nivel: string;
    pontuacao: number;
    dicas?: string[];
    objetivo?: string;
    duracao?: number;
    exercicios: {
      exercicio: {
        id: string;
        nome: string;
      };
      repeticoes: string;
    }[];
  };
}

interface Desafio {
  id: string;
  titulo: string;
  descricao: string;
  nivel: string;
  pontuacao: number;
  imagemUrl?: string;
}

interface UsuarioLogado {
  tipo: 'atleta' | 'escola' | 'clube' | 'professor' | 'admin';
  usuarioId: string;
  tipoUsuarioId: string;
}

export default function PaginaTreinos() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [, navigate] = useLocation();
  const [abaProfessor, setAbaProfessor] = useState<"avaliar" | "criar">("avaliar");
  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);
  
  useEffect(() => {
  const carregar = async () => {
    const desafiosRes = await fetch(`${API.BASE_URL}/api/desafios`);
    const desafiosJson: Desafio[] = await desafiosRes.json();
    setDesafios(desafiosJson);

    const treinosRes = await fetch(`${API.BASE_URL}/api/treinos`);
    const programadosJson: TreinoProgramado[] = await treinosRes.json();
    setTreinos(programadosJson);

    const tipo = Storage.tipoSalvo;
    const tipoUsuarioId = Storage.tipoUsuarioId;
    const token = Storage.token;
    const usuarioId = Storage.usuarioId;

    if (tipo && usuarioId && tipoUsuarioId) {
      setUsuario({ tipo: tipo as any, usuarioId, tipoUsuarioId });
    }

    if (tipo === "atleta" && tipoUsuarioId && token) {
      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados?tipoUsuarioId=${tipoUsuarioId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let treinosJson: TreinoAgendado[] = await res.json();
        console.log("Treinos agendados:", treinosJson);

      const agora = new Date();
      const treinosAtuais = await Promise.all(
        treinosJson.map(async (treino) => {
          const data = new Date(treino.dataTreino);
          if (data < agora) {
            try {
              const res = await fetch(`${API.BASE_URL}/api/treinos/agendados/${treino.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });

              if (res.status === 404) {
                console.warn(`Treino agendado com id ${treino.id} não encontrado (404).`);
              } else if (!res.ok) {
                console.error(`Erro ao excluir treino ${treino.id}:`, await res.text());
              }
            } catch (err) {
              console.error(`Erro na requisição ao deletar treino ${treino.id}:`, err);
            }
            return null; 
          }
          return treino; 
        })
      );

      setTreinosAgendados(treinosAtuais.filter(Boolean) as TreinoAgendado[]);

    }
  };

  carregar();
}, []);


  const formatarData = (data?: string) => {
    if (!data) return "";
    return new Date(data).toLocaleDateString("pt-BR");
  };

  const renderDesafioCard = (desafio: Desafio) => (
    <div key={desafio.id} className="bg-white p-4 rounded shadow border border-yellow-400 mb-3">
      <h4 className="font-bold text-yellow-700 text-lg mb-1">{desafio.titulo}</h4>
      <p className="text-sm text-gray-600 mb-2">{desafio.descricao}</p>
      <p className="text-sm text-gray-500">Nível: {desafio.nivel}</p>
      <p className="text-sm text-gray-500">Pontos: {desafio.pontuacao}</p>
      <div className="mt-3 text-right">
        <button
          onClick={() => navigate(`/submissao?desafioId=${desafio.id}`)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          Fazer Submissão
        </button>
      </div>
    </div>
  );

  if (!usuario) return <p className="text-center p-4">Carregando...</p>;


  const renderTreinoCard = (treino: TreinoProgramado) => (
    <div key={treino.id} className="bg-white p-4 rounded shadow border mb-4">
      <h4 className="font-bold text-lg text-green-800">{treino.nome}</h4>
      {treino.descricao && <p className="text-sm text-gray-700 mb-1">{treino.descricao}</p>}
      <div className="text-sm text-gray-600 space-y-1">
        <p><strong>Nível:</strong> {treino.nivel}</p>
        {treino.dataAgendada && <p><strong>Data:</strong> {formatarData(treino.dataAgendada)}</p>}
        {treino["duracao"] && <p><strong>Duração:</strong> {treino["duracao"]} min</p>}
        {treino["objetivo"] && <p><strong>Objetivo:</strong> {treino["objetivo"]}</p>}
        {Array.isArray(treino.dicas) && treino.dicas.length > 0 && (
          <div>
            <strong>Dicas:</strong>
            <ul className="list-disc list-inside pl-4">
              {treino.dicas.map((dica, idx) => (
                <li key={idx}>{dica}</li>
              ))}
            </ul>
          </div>
          
        )}
      </div>

      {treino.exercicios?.length > 0 && (
        <div className="mt-3">
          <strong className="text-sm text-gray-800">Exercícios:</strong>
          <div className="max-h-32 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
            {treino.exercicios.map((ex, i) => (
              <div key={ex.id} className="border-b pb-1">
                <strong>{i + 1}.</strong> {ex.nome}{" "}
                {ex.repeticoes && <span className="text-gray-500">({ex.repeticoes})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

const excluirTreino = async (treinoId: string) => {
  const confirm = window.confirm("Deseja cancelar este treino?");
  if (!confirm) return;

  console.log("Tentando deletar treino agendado com ID:", treinoId);

  const token = Storage.token;
  const res = await fetch(`${API.BASE_URL}/api/treinos/agendados/${treinoId}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});

if (res.status === 404) {
  console.warn("Treino já foi deletado ou não existe.");
  setTreinosAgendados(prev => prev.filter(t => t.id !== treinoId));
  return;
}

if (res.ok) {
  setTreinosAgendados(prev => prev.filter(t => t.id !== treinoId));
  alert("Treino cancelado.");
} else {
  alert("Erro ao cancelar treino.");
}
};

const renderTreinoAgendadoCard = (treino: TreinoAgendado) => {
  const programado = treino.treinoProgramado;

  return (
    <div key={treino.id} className="bg-white p-4 rounded shadow border mb-4">
      <h4 className="font-bold text-lg text-green-800">{treino.titulo}</h4>

      <div className="text-sm text-gray-600 space-y-1">
        <p><strong>Descrição:</strong> {programado?.descricao}</p>
        <p><strong>Nível:</strong> {programado?.nivel}</p>
        <p><strong>Pontuação:</strong> {programado?.pontuacao}</p>
        <p><strong>Data Final:</strong> {formatarData(treino.dataTreino)}</p>
        
        <div
          className="text-red-600 hover:text-red-800 cursor-pointer flex items-center"
          onClick={() => excluirTreino(treino.id)}
        >
          <Trash2 size={16} className="mr-1" /> Cancelar
        </div>
        {programado?.duracao && <p><strong>Duração:</strong> {programado.duracao} min</p>}
        {programado?.objetivo && <p><strong>Objetivo:</strong> {programado.objetivo}</p>}
        {Array.isArray(programado?.dicas) && programado.dicas.length > 0 && (
          <div>
            <strong>Dicas:</strong>
            <ul className="list-disc list-inside pl-4">
              {programado.dicas.map((dica, idx) => (
                <li key={idx}>{dica}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {Array.isArray(programado?.exercicios) && programado!.exercicios.length > 0 && (
        <div className="mt-3">
          <strong className="text-sm text-gray-800">Exercícios:</strong>
          <div className="max-h-32 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
            {programado?.exercicios?.map((ex, i) => (
              <div key={ex.exercicio.id} className="border-b pb-1">
                <strong>{i + 1}.</strong> {ex.exercicio.nome}{" "}
                {ex.repeticoes && <span className="text-gray-500">({ex.repeticoes})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-right">
        <button
          onClick={() => navigate(`/submissao?treinoAgendadoId=${treino.id}`)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Fazer Submissão
        </button>
      </div>
    </div>
  );
};

  return (
    <div className="min-h-screen bg-transparent pb-20">
      <div className="p-4 max-w-2xl mx-auto">
        {usuario.tipo === 'clube' ? (
          <div className="text-center py-10">
            <h2 className="text-lg font-semibold">Treinos e Desafios</h2>
            <p className="text-gray-500">Em breve disponível para clubes</p>
          </div>
        ) : (
          <>
            {usuario.tipo === 'atleta' && (
              <div className="space-y-6">

                <div className="bg-white rounded shadow p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Meus Treinos</h3>
                    <button
                      className="bg-green-800 text-white px-4 py-2 rounded text-sm"
                      onClick={() => navigate("/treinos/novo")}
                    >
                      Agendar novo treino
                    </button>
                  </div>

                  {treinosAgendados.length > 0 ? (
                    treinosAgendados.map(renderTreinoAgendadoCard)
                  ) : (
                    <p className="text-gray-500">Nenhum treino disponível ainda.</p>
                  )}
                </div>

                <div className="bg-white rounded shadow p-4">
                  <h3 className="text-lg font-semibold mb-2">Desafios</h3>
                  {desafios.length > 0 ? (
                    desafios.map(renderDesafioCard)
                  ) : (
                    <p className="text-gray-500">Nenhum desafio disponível no momento.</p>
                  )}
                </div>
              </div>
            )}

            {usuario.tipo === 'professor' && (
              <div className="space-y-6">
                <div className="flex space-x-4 mb-4">
                  <button
                    onClick={() => setAbaProfessor("avaliar")}
                    className={`px-4 py-2 rounded ${abaProfessor === "avaliar" ? "bg-green-800 text-white" : "bg-gray-200 text-gray-800"}`}
                  >
                    Avaliar Treinos
                  </button>
                  <button
                    onClick={() => setAbaProfessor("criar")}
                    className={`px-4 py-2 rounded ${abaProfessor === "criar" ? "bg-green-800 text-white" : "bg-gray-200 text-gray-800"}`}
                  >
                    Meus Treinos
                  </button>
                </div>

                {abaProfessor === "avaliar" && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Treinos dos atletas afiliados</h3>
                    <p className="text-gray-500">Nenhum treino pendente para avaliação no momento.</p>
                  </div>
                )}

                {abaProfessor === "criar" && (
                  <div>
                    <div className="text-right mb-4">
                      <button
                        className="bg-green-800 text-white px-4 py-2 rounded"
                        onClick={() => navigate("/treinos/novo")}
                      >
                        Criar novo treino
                      </button>
                    </div>

                    <h3 className="text-lg font-semibold mb-2">Treinos que você criou</h3>
                    {treinos.filter((t) =>
                      t.professorId === usuario.tipoUsuarioId || t.escolinhaId === usuario.tipoUsuarioId
                    ).length > 0 ? (
                      treinos
                        .filter((t) =>
                          t.professorId === usuario.tipoUsuarioId || t.escolinhaId === usuario.tipoUsuarioId
                        )
                        .map(renderTreinoCard)
                    ) : (
                      <p className="text-gray-500">Você ainda não criou nenhum treino.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
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
