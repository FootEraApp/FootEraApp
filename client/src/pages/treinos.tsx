import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CalendarClock, Volleyball, User, CirclePlus, Search, House, CircleX, CircleCheck, Send, Share2, Trash2} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { Badge } from "@/components/ui/badge.js";

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
  duracao?: number;
  objetivo?: string;
  dicas?: string[];
  professorId?: string;
  escolinhaId?: string;
}

interface TreinoAgendado {
  id: string;
  titulo: string;
  dataTreino: string;
  dataExpiracao?: string | null;
  nivel?: string | null;
  prazoEnvio?: string | null;
  duracaoMinutos?: number | null;
  treinoProgramado?: {
    descricao?: string;
    nivel: string;
    dicas?: string[];
    objetivo?: string;
    duracao?: number;
    dataAgendada?: string | null;
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
  tipo: 'atleta' | 'escola' | 'clube' | 'professor';
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

  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [desafioParaCompartilhar, setDesafioParaCompartilhar] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => setTreinosAgendados((prev) => [e.detail, ...prev]);
    window.addEventListener("treino:agendado", handler as EventListener);
    return () => window.removeEventListener("treino:agendado", handler as EventListener);
  }, []);

  useEffect(() => {
    const carregar = async () => {
      const tipo = Storage.tipoSalvo;
      const tipoUsuarioId = Storage.tipoUsuarioId;
      const token = Storage.token;

      if (tipo === "atleta" && tipoUsuarioId && token) {
        const [resTreinos, resDesafios] = await Promise.all([
          fetch(`${API.BASE_URL}/api/treinos/agendados?tipoUsuarioId=${tipoUsuarioId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API.BASE_URL}/api/desafios?tipoUsuarioId=${tipoUsuarioId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const treinosJson = await resTreinos.json();
        const desafiosJson = await resDesafios.json();

        const normalizados = (Array.isArray(treinosJson) ? treinosJson : []).map((t: any) => ({
          id: t.id,
          titulo: t.titulo,
          dataTreino: t.dataTreino ?? null,
          prazoEnvio: t.prazoEnvio ?? t.dataExpiracao ?? t.dataTreino ?? t.treinoProgramado?.dataAgendada ?? null,
          nivel: t.nivel ?? t.treinoProgramado?.nivel ?? null,
          duracaoMinutos: t.duracaoMinutos ?? t.treinoProgramado?.duracao ?? null,
          treinoProgramado: t.treinoProgramado ?? null,
        }));

        const agora = Date.now();
        const apenasVigentes = normalizados.filter(t => {
          if (!t.prazoEnvio) return true;
          const ts = Date.parse(t.prazoEnvio);
          return Number.isFinite(ts) ? ts >= agora : true;
        });

        setTreinosAgendados(apenasVigentes);
        setDesafios(desafiosJson || []);
      } else {
        const res = await fetch(`${API.BASE_URL}/api/treinos`);
        const json = await res.json();

        setTreinos(json.treinosProgramados || []);
        setDesafios(json.desafiosOficiais || []);
      }
    };

    const carregarUsuario = () => {
      const tipoSalvo = Storage.tipoSalvo;
      const usuarioId = Storage.usuarioId;
      const tipoUsuarioId = Storage.tipoUsuarioId;

      if (
        ["atleta", "escola", "clube", "professor"].includes(tipoSalvo || "") &&
        usuarioId && tipoUsuarioId
      ) {
        setUsuario({
          tipo: tipoSalvo as UsuarioLogado["tipo"],
          usuarioId,
          tipoUsuarioId,
        });
      } else {
        console.warn("Tipo de usuário, tipoUsuarioId ou ID inválido ou não encontrado.");
      }
    };
    carregar();
    carregarUsuario();
  }, []);

  const formatarDataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

  const formatarData = (data?: string) => {
    if (!data) return "";
    return new Date(data).toLocaleDateString("pt-BR");
  };

const renderDesafioCard = (desafio: Desafio) => (
  <div
    key={desafio.id}
    className="bg-white p-4 rounded shadow border border-yellow-400 mb-3"
  >
    <h4 className="font-bold text-yellow-700 text-lg mb-1">
      {desafio.titulo}
    </h4>
    <p className="text-sm text-gray-600 mb-2">{desafio.descricao}</p>
    <p className="text-sm text-gray-500">Nível: {desafio.nivel}</p>
    <p className="text-sm text-gray-500">Pontos: {desafio.pontuacao}</p>
    <div className="mt-3 flex justify-between">
      <button
        onClick={() => navigate(`/submissao?desafioId=${desafio.id}`)}
        className="bg-green-800 hover:bg-green-900 text-white px-4 py-2 rounded text-sm"
      >
        Fazer Submissão
      </button>
      <button
        onClick={() => abrirModalCompartilhar(desafio.id)}
        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm"
      >
        <Share2 className="w-4 h-4" /> Compartilhar
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
        {typeof treino.duracao === "number" && (
        <p><strong>Duração:</strong> {treino.duracao} min</p>
        )}
        {treino.objetivo && <p><strong>Objetivo:</strong> {treino.objetivo}</p>}
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

  const renderTreinoAgendadoCard = (treino: TreinoAgendado) => {
    const programado = treino.treinoProgramado;
    const nivel = treino.nivel ?? treino.treinoProgramado?.nivel ?? "-";
    const prazoIso = treino.prazoEnvio ?? treino.dataTreino ?? treino.treinoProgramado?.dataAgendada ?? null;
    const exercicios = programado?.exercicios ?? [];

    return (
      <div key={treino.id} className="bg-white p-4 rounded shadow border mb-4">
        <h4 className="font-bold text-lg text-green-800">{treino.titulo}</h4>
        {programado?.descricao && <p className="text-sm text-gray-700 mb-1">{programado.descricao}</p>}
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Nível:</strong> {nivel}</p>
          {prazoIso && (
            <div className="flex items-center">
             <CalendarClock className="h-4 w-4 mr-1" />
             Prazo para envio:
             <Badge variant="outline" className="ml-1 text-[10px] bg-green-100 text-green-700 border-green-200">
              {formatarDataHora(prazoIso)}
             </Badge>
            </div>
          )}
          <button
            onClick={() => removerTreinoAgendado(treino.id)}
            title="Remover"
            className="shrink-0 p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        
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
        
          {exercicios.length > 0 && (
            <div className="mt-3">
              <strong className="text-sm text-gray-800">Exercícios:</strong>
              <div className="max-h-32 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
                {exercicios.map((ex, i) => (
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
            className="bg-green-800 hover:bg-green-900 text-white px-3 py-2 rounded"
          >
            Fazer Submissão
          </button>
        </div>
      </div>
    );
  };
async function removerTreinoAgendado(id: string) {
  const token = Storage.token;
  if (!token) return alert("Sessão expirada.");
  if (!confirm("Remover este treino dos seus treinos?")) return;

  try {
    const res = await fetch(`${API.BASE_URL}/api/treinos/agendados/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Falha ao excluir:", res.status, txt);
      return alert("Não foi possível excluir.");
    }
    setTreinosAgendados((prev) => prev.filter((t) => t.id !== id));
  } catch (e) {
    console.error(e);
    alert("Erro inesperado ao excluir.");
  }
}

async function carregarUsuariosMutuos() {
  const token = Storage.token;
  setCarregandoMutuos(true);
  try {
    const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Erro ao buscar usuários mutuos");
    const data = await res.json();
    setUsuariosMutuos(data);
  } catch (err) {
    console.error(err);
    setUsuariosMutuos([]);
  } finally {
    setCarregandoMutuos(false);
  }
}

function abrirModalCompartilhar(desafioId: string) {
  setDesafioParaCompartilhar(desafioId);
  setModalAberto(true);
  carregarUsuariosMutuos();
  setSelecionados(new Set());
}

function toggleSelecionado(idUsuario: string) {
  setSelecionados((prev) => {
    const novo = new Set(prev);
    if (novo.has(idUsuario)) {
      novo.delete(idUsuario);
    } else {
      novo.add(idUsuario);
    }
    return novo;
  });
}

async function enviarCompartilhamentoPorDM() {
  if (selecionados.size === 0 || !desafioParaCompartilhar) {
    alert("Selecione ao menos uma pessoa para compartilhar.");
    return;
  }
  const token = Storage.token;

  try {
    setEnviandoDM(true);
    await Promise.all(
      Array.from(selecionados).map((paraId) =>
        fetch(`${API.BASE_URL}/api/mensagem`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paraId,
            conteudo: desafioParaCompartilhar,
            tipo: "DESAFIO",
          }),
        })
      )
    );

    alert("Desafio compartilhado por mensagem!");
    setModalAberto(false);
  } catch (e) {
    console.error(e);
    alert("Falha ao enviar mensagens.");
  } finally {
    setEnviandoDM(false);
  }
}

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
                    {treinos.filter(
                      (t) => t.professorId === usuario.tipoUsuarioId || t.escolinhaId === usuario.tipoUsuarioId
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


        {modalAberto && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative">
              <h2 className="text-lg font-bold mb-4 text-center">
                Compartilhar Desafio
              </h2>

              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">Enviar por mensagem:</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {carregandoMutuos && (
                    <span className="text-sm text-gray-500">
                      Carregando contatos...
                    </span>
                  )}

                  {!carregandoMutuos && usuariosMutuos.length === 0 && (
                    <span className="text-sm text-gray-500">
                      Você ainda não tem contatos mútuos.
                    </span>
                  )}

                  {usuariosMutuos.map((u) => {
                    const selecionado = selecionados.has(u.id);
                    const fotoSrc = u.foto?.startsWith("http")
                      ? u.foto
                      : `${API.BASE_URL}${u.foto || "default-user.png"}`;
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleSelecionado(u.id)}
                        title={u.nome}
                        className={`relative shrink-0 rounded-full border-2 ${
                          selecionado ? "border-green-600" : "border-transparent"
                        }`}
                      >
                        <img
                          src={fotoSrc}
                          alt={u.nome}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                        {selecionado && (
                          <span className="absolute -bottom-1 -right-1 bg-white rounded-full">
                            <CircleCheck className="w-5 h-5 text-green-600" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={selecionados.size === 0 || enviandoDM}
                  onClick={enviarCompartilhamentoPorDM}
                  className={`mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded 
                    ${
                      selecionados.size === 0 || enviandoDM
                        ? "bg-gray-300 text-gray-600"
                        : "bg-green-700 text-white hover:bg-green-800"
                    }`}
                >
                  <Send className="w-4 h-4" />
                  {enviandoDM
                    ? "Enviando..."
                    : `Enviar para ${selecionados.size} contato(s)`}
                </button>
              </div>

              <button
                onClick={() => setModalAberto(false)}
                className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl"
                aria-label="Fechar modal"
              >
                <CircleX />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
