import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  CircleX,
  CircleCheck,
  Send,
} from "lucide-react";

import ProfileHeader from "../components/profile/ProfileHeader.js";
import ActivityGrid from "../components/profile/ActivityGrid.js";
import { BadgesList } from "../components/profile/BadgesList.js";
import ScorePanel from "../components/profile/ScorePanel.js";
import TrainingProgress from "../components/profile/TrainingProgress.js";

import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";


interface Badge {
  id: string;
  titulo: string;
  imagemUrl: string;
}

interface Activity {
  id: string;
  tipo: "Desafio" | "Treino" | "Vídeo";
  imagemUrl: string;
  nome: string;
}

export default function PerfilUnico() {
  if (typeof window !== "undefined" && !(window as any).__patchFetchPontuacao) {
  (window as any).__patchFetchPontuacao = true;
  const origFetch = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (
      url.includes("/api/perfil/pontuacao") &&
      !/\/pontuacao\/[^/]+$/.test(url) &&
      !/\/me\/pontuacao$/.test(url)
    ) {
      console.group("%c[DEBUG] fetch /api/perfil/pontuacao (sem id)", "color:red;font-weight:bold");
      console.log("URL:", url);
      console.trace("Stack:");
      console.groupEnd();
    }
    return origFetch(input as any, init);
  };
}

  const { id } = useParams<{ id: string }>();
  const [usuario, setUsuario] = useState<any>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);

  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);

  const [scores] = useState({
    performance: 75,
    disciplina: 90,
    responsabilidade: 80,
  });

  const seguirUsuario = async () => {
    const token = Storage.token;
    const seguidorUsuarioId = Storage.usuarioId; 

    try {
      const response = await fetch(`${API.BASE_URL}/api/seguidores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          seguidoUsuarioId: id,
          seguidorUsuarioId, 
        }),
      });

      if (!response.ok) throw new Error("Erro ao seguir usuário");

      alert("Agora você está seguindo este usuário!");
    } catch (error) {
      console.error("Erro ao seguir:", error);
      alert("Falha ao seguir usuário.");
    }
  };

  const solicitarTreino = async () => {
    const token = Storage.token;

    try {
      const response = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ destinatarioId: id }), 
      });

      if (!response.ok) throw new Error("Erro ao solicitar treino");

      alert("Solicitação enviada!");
    } catch (error) {
      console.error(error);
    }
  };

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

  function abrirModalCompartilhar() {
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
    if (selecionados.size === 0) {
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
              conteudo: id,
              tipo: "USUARIO", 
            }),
          })
        )
      );

      alert("Perfil compartilhado por mensagem!");
      setModalAberto(false);
    } catch (e) {
      console.error(e);
      alert("Falha ao enviar mensagens.");
    } finally {
      setEnviandoDM(false);
    }
  }

  useEffect(() => {
    if (!id || id === "editar") return;

    const loggedInId = Storage.usuarioId;
    const token = Storage.token;

    if (id === loggedInId) {
      setIsOwnProfile(true);
    }

    fetch(`${API.BASE_URL}/api/perfil/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Não autorizado");
        return res.json();
      })
      .then((data) => {
        setUsuario(data);
      })
      .catch((err) => {
        console.error("Erro ao buscar perfil:", {
          msg: err?.message,
          status: err?.response?.status,
          data: err?.response?.data,
        });
      });
  }, [id]);

  if (!usuario)
    return (
      <div className="text-center p-10 text-gray-600">Carregando perfil...</div>
    );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        nome={
          usuario.dadosEspecificos?.nome && usuario.dadosEspecificos?.sobrenome
            ? `${usuario.dadosEspecificos.nome} ${usuario.dadosEspecificos.sobrenome}`
            : usuario.dadosEspecificos?.nome || usuario.usuario.nome || "Usuário"
        }
        pontuacao={scores.performance + scores.disciplina + scores.responsabilidade}
        isOwnProfile={isOwnProfile}
        foto={usuario.usuario.foto}
        perfilId={id}         
      />

      {!isOwnProfile && (
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={seguirUsuario}
            className="px-4 py-2 bg-green-600 text-white rounded-full"
          >
            Seguir
          </button>

          <button
            onClick={solicitarTreino}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-full"
          >
            Treinar Juntos
          </button>

          <button
            onClick={abrirModalCompartilhar}
            className="px-4 py-2 bg-blue-600 text-white rounded-full"
          >
            Compartilhar
          </button>
        </div>
      )}

      <TrainingProgress userId={id} />
      <ActivityGrid activities={activities} />
      {usuarioId && <BadgesList userId={usuarioId} />}

      <ScorePanel
        performance={scores.performance}
        disciplina={scores.disciplina}
        responsabilidade={scores.responsabilidade}
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">
              Compartilhar Perfil
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                Enviar por mensagem:
              </p>

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