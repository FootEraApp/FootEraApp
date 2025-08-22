import { useState } from "react";
import { Link } from "wouter";
import { Users, Settings, Edit, Bell, Mail, CircleX, CircleCheck, Send } from "lucide-react";
import { Button } from "../ui/button.js";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

interface ProfileHeaderProps {
  nome: string;
  idade?: number;
  posicao?: string;
  time?: string;
  ponto?: number;
  avatar?: string | null;
  foto?: string | null;
  isOwnProfile?: boolean;
  perfilId: string;  
}

export default function ProfileHeader({
  nome,
  idade,
  posicao,
  time,
  ponto = 0,
  avatar,
  foto,
  isOwnProfile = false,
  perfilId,
}: ProfileHeaderProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);

  const [confirmBox, setConfirmBox] = useState<{
    open: boolean;
    text: string;
    onYes: () => Promise<void> | void;
  } | null>(null);

  function pedirConfirmacao(text: string, onYes: () => Promise<void> | void) {
    setConfirmBox({ open: true, text, onYes });
  }

  async function readBodySafe(r: Response) {
    try { return await r.json(); } catch { return null; }
  }
  function isDuplicado(resp: Response, body: any) {
    if (resp.status === 400 || resp.status === 409) return true;
    const msg = (body?.error || body?.message || "").toString().toLowerCase();
    return msg.includes("já segue") || msg.includes("ja segue") || msg.includes("já existe") || msg.includes("pendente");
  }

   const seguirUsuario = async () => {
    const token = Storage.token;
    const seguidorUsuarioId = Storage.usuarioId;
    if (!token || !seguidorUsuarioId) {
      alert("Faça login para seguir.");
      return;
    }

    const resp = await fetch(`${API.BASE_URL}/api/seguidores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ seguidoUsuarioId: perfilId }),
    });

    if (resp.ok) {
      alert("Agora você está seguindo este usuário!");
      return;
    }

    const body = await readBodySafe(resp);
    if (isDuplicado(resp, body)) {
      pedirConfirmacao("Você já segue esse usuário. Deseja parar de seguir?", async () => {
        const ok = await deixarDeSeguir(perfilId);
        alert(ok ? "Você deixou de seguir este usuário." : "Não foi possível deixar de seguir agora.");
      });
      return;  
    }

    console.error("Falha ao seguir:", resp.status, body);
    alert("Falha ao seguir usuário.");
  };

  async function deixarDeSeguir(alvoId: string) {
    const token = Storage.token;
    const r = await fetch(`${API.BASE_URL}/api/seguidores/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ seguidoUsuarioId: alvoId }),
    });
    return r.ok;
  }

  const solicitarTreino = async () => {
    const token = Storage.token;
    if (!token) {
      alert("Faça login para solicitar treino.");
      return;
    }

    const resp = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ destinatarioId: perfilId }),
    });

    if (resp.ok) {
      alert("Solicitação enviada!");
      return;
    }

    const body = await readBodySafe(resp);
    if (isDuplicado(resp, body)) {
      pedirConfirmacao("Você já tem uma solicitação com este usuário. Deseja cancelar?", async () => {
        const ok = await cancelarSolicitacaoTreino(perfilId);
        alert(ok ? "Solicitação cancelada." : "Não foi possível cancelar agora.");
      });
      return;
    }

    console.error("Falha ao solicitar treino:", resp.status, body);
    alert("Falha ao solicitar treino.");
  };

  async function cancelarSolicitacaoTreino(destinatarioId: string) {
    const token = Storage.token;

    const del = await fetch(`${API.BASE_URL}/api/solicitacoes-treino/${destinatarioId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (del.ok) return true;
    if (del.status !== 404) return false;

    const post = await fetch(`${API.BASE_URL}/api/solicitacoes-treino/cancelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ destinatarioId }),
    });
    return post.ok;
  }

   const carregarUsuariosMutuos = async () => {
    const token = Storage.token;
    setCarregandoMutuos(true);
    try {
      const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : [];
      setUsuariosMutuos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setUsuariosMutuos([]);
    } finally {
      setCarregandoMutuos(false);
    }
  };

  const abrirModalCompartilhar = () => {
    setModalAberto(true);
    setSelecionados(new Set());
    carregarUsuariosMutuos();
  };

  const toggleSelecionado = (idUsuario: string) => {
    setSelecionados(prev => {
      const novo = new Set(prev);
      novo.has(idUsuario) ? novo.delete(idUsuario) : novo.add(idUsuario);
      return novo;
    });
  };

  const enviarCompartilhamentoPorDM = async () => {
    if (selecionados.size === 0) {
      alert("Selecione ao menos uma pessoa.");
      return;
    }
    const token = Storage.token;
    if (!token) {
      alert("Faça login para compartilhar.");
      return;
    }

    try {
      setEnviandoDM(true);
      await Promise.all(
        Array.from(selecionados).map(paraId =>
          fetch(`${API.BASE_URL}/api/mensagem`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paraId, conteudo: perfilId, tipo: "USUARIO" }),
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
  };

  const resolveImageSrc = () => {
    if (!foto && !avatar) return "/attached_assets/Perfil.jpg";
    const caminho = foto || avatar;
    if (caminho?.startsWith("http") || caminho?.startsWith("/")) return caminho;
    return `${API.BASE_URL}/uploads/${caminho}`;
  };
  const imageSrc = resolveImageSrc();

  return (
    <div className="footera-bg-green p-6 flex flex-col items-center relative">
      {isOwnProfile && (
        <div>
          <div className="absolute top-4 left-4 flex gap-2">
            <Link href="/mensagens">
              <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 text-white rounded-full">
                <Mail />
              </Button>
            </Link>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <Link href="/notificacoes">
              <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 text-white rounded-full">
                <Bell size={18} />
              </Button>
            </Link>
            <Link href="/perfil/editar">
              <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 text-white rounded-full">
                <Edit size={18} />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="w-24 h-24 rounded-full mb-3 flex items-center justify-center bg-white border-2 border-white overflow-hidden">
        <img src={imageSrc} alt={`${nome} profile`} className="w-full h-full object-cover" />
      </div>

      <h1 className="footera-text-cream text-2xl font-bold">{nome.toUpperCase()}</h1>

      {(idade || posicao || time) && (
        <p className="footera-text-cream text-sm mb-1 text-center">
          {idade && `${idade} anos`}{(idade && posicao) && " • "}
          {posicao}{(posicao && time) && " • "}
          {time}
        </p>
      )}

      <div className="w-full mt-4">
        <h2 className="footera-text-cream text-center mb-2">Pontuação FootEra</h2>
        <div className="footera-bg-green border border-footera-cream rounded-lg p-3 flex justify-center">
          <span className="footera-text-cream text-3xl font-bold">{ponto} pts</span>
        </div>
      </div>

      {!isOwnProfile && (
        <div className="flex justify-center gap-4 mt-4 mb-2">
          <button onClick={seguirUsuario} className="px-4 py-2 bg-green-600 text-white rounded-full">
            Seguir
          </button>
          <button onClick={solicitarTreino} className="px-4 py-2 bg-green-100 text-green-800 rounded-full">
            Treinar Juntos
          </button>
          <button onClick={abrirModalCompartilhar} className="px-4 py-2 bg-blue-600 text-white rounded-full">
            Compartilhar
          </button>
        </div>
      )}

      {isOwnProfile && (
        <div className="mt-4 w-full grid grid-cols-2 gap-2">
          <Link href="/minha-rede">
            <Button className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30">
              <Users size={16} className="mr-2" />
              Minha rede
            </Button>
          </Link>

          <Link href="/configuracoes">
            <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30">
              <Settings size={16} className="mr-2" />
              Configurações
            </Button>
          </Link>
        </div>
      )}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">Compartilhar Perfil</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">Enviar por mensagem:</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {carregandoMutuos && <span className="text-sm text-gray-500">Carregando contatos...</span>}
                {!carregandoMutuos && usuariosMutuos.length === 0 && (
                  <span className="text-sm text-gray-500">Você ainda não tem contatos mútuos.</span>
                )}
                {usuariosMutuos.map((u) => {
                  const selecionado = selecionados.has(u.id);
                  const fotoSrc = u.foto?.startsWith("http") ? u.foto : `${API.BASE_URL}${u.foto || "default-user.png"}`;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelecionado(u.id)}
                      title={u.nome}
                      className={`relative shrink-0 rounded-full border-2 ${selecionado ? "border-green-600" : "border-transparent"}`}
                    >
                      <img src={fotoSrc} alt={u.nome} className="w-14 h-14 rounded-full object-cover" />
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
                  ${selecionados.size === 0 || enviandoDM ? "bg-gray-300 text-gray-600" : "bg-green-700 text-white hover:bg-green-800"}`}
              >
                <Send className="w-4 h-4" />
                {enviandoDM ? "Enviando..." : `Enviar para ${selecionados.size} contato(s)`}
              </button>
            </div>
            <button onClick={() => setModalAberto(false)} className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl" aria-label="Fechar modal">
              <CircleX />
            </button>
          </div>
        </div>
      )}

      {confirmBox?.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-5 rounded-xl w-96 shadow-xl">
            <p className="text-sm text-gray-800">{confirmBox.text}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-200" onClick={() => setConfirmBox(null)}>
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded bg-green-700 text-white"
                onClick={async () => {
                  try { await confirmBox.onYes(); }
                  finally { setConfirmBox(null); }
                }}
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
