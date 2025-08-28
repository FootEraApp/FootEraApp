import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Send, Share2, Volleyball, User, UserPlus, CirclePlus, Search, House, Users, Trash } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import socket from "../services/socket.js";
import { ModalGrupos } from "@/components/modal/ModalGrupos.js";
import { ModalDesafiosGrupo } from "@/components/modal/ModalDesafiosGrupos.js";
import { MensagemItemGrupo } from "@/components/chat/GroupDesafioCards.js";
import CardAtletaShield from "@/components/cards/CardAtletaShield.js";
import * as htmlToImage from "html-to-image";

interface Usuario {
  id: string;
  nome: string;
  foto?: string | null;
}

interface Mensagem {
  id: string;
  deId: string;
  paraId: string;
  conteudo: string;
  tipo: "NORMAL" | "POST" | "DESAFIO" | "USUARIO" | "CARD";
  criadaEm: string;
  clientMsgId?: string;
  pending?: boolean;
}

interface Grupo {
  id: string;
  nome: string;
  descricao?: string | null;
}

interface MensagemGrupo {
  id: string;
  grupoId: string;
  usuarioId: string;
  conteudo: string;
  criadaEm: string;
  usuario?: Usuario;
  tipo:
    | "NORMAL"
    | "DESAFIO"
    | "POST"
    | "USUARIO"
    | "CONQUISTA"
    | "GRUPO_DESAFIO"
    | "GRUPO_DESAFIO_BONUS";
  conteudoJson?: any;
  desafioEmGrupoId?: string | null;
  clientMsgId?: string;
  pending?: boolean;
}

interface Postagem {
  id: string;
  conteudo: string;
  imagemUrl?: string;
  videoUrl?: string;
  usuario: Usuario;
}

interface Desafio {
  id: string;
  titulo: string;
  descricao: string;
  imagemUrl?: string | null;
  nivel?: string | null;
  pontuacao?: number | null;
  categoria?: string[];
  createdAt: string;
}

type ChatTarget = { tipo: "usuario"; usuario: Usuario } | { tipo: "grupo"; grupo: Grupo };

export default function PaginaMensagens() {
  const [, navigate] = useLocation();

  const usuarioId: string | null = Storage.usuarioId;
  const token: string = Storage.token || "";

  const [usuariosMutuos, setUsuariosMutuos] = useState<Usuario[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [alvo, setAlvo] = useState<ChatTarget | null>(null);

  const [mensagensPrivadas, setMensagensPrivadas] = useState<Mensagem[]>([]);
  const [temMaisPriv, setTemMaisPriv] = useState(true);
  const [carregandoMaisPriv, setCarregandoMaisPriv] = useState(false);

  const [mensagensGrupo, setMensagensGrupo] = useState<MensagemGrupo[]>([]);
  const [temMaisGrupo, setTemMaisGrupo] = useState(true);
  const [carregandoMaisGrupo, setCarregandoMaisGrupo] = useState(false);

  const [novaMensagem, setNovaMensagem] = useState("");

  const [postsCache, setPostsCache] = useState<Record<string, Postagem>>({});
  const [usuariosCache, setUsuariosCache] = useState<Record<string, Usuario>>({});
  const [desafiosCache, setDesafiosCache] = useState<Record<string, Desafio>>({});

  const [modalAberto, setModalAberto] = useState(false);
  const abrirModal = () => setModalAberto(true);
  const fecharModal = () => setModalAberto(false);

  const [modalDesafiosAberto, setModalDesafiosAberto] = useState(false);
  const abrirModalDesafios = () => setModalDesafiosAberto(true);
  const fecharModalDesafios = () => setModalDesafiosAberto(false);

  const [meuCardDados, setMeuCardDados] = useState<{
    atletaId: string | null;
    nome: string;
    foto?: string | null;
    posicao?: string | null;
    ovr: number;
    perf: number;
    disc: number;
    resp: number;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const alvoRef = useRef<ChatTarget | null>(null);
  useEffect(() => {
    alvoRef.current = alvo;
  }, [alvo]);

  const recarregarMensagensDoGrupoAtual = async () => {
    const current = alvoRef.current;
    if (current?.tipo === "grupo") {
      await carregarMensagensDoGrupo(current.grupo.id, false);
     }
  };

   const compartilharPerfilNoChat = async () => {
    if (!alvo || alvo.tipo !== "usuario" || !usuarioId) return;

    try {
      const dados = (meuCardDados ?? await getMeuPerfilEBonus());
      if (!dados) {
        alert("Não consegui montar seu card agora.");
        return;
      }
      setMeuCardDados(dados);

      await new Promise((r) => setTimeout(r, 0));
      const node = cardRef.current;
      if (!node) {
        alert("Falha ao preparar o card para captura.");
        return;
      }
      const dataUrl = await htmlToImage.toPng(node, { cacheBust: true });

      const clientMsgId = genClientId();

      setMensagensPrivadas(prev => [
        ...prev,
        {
          id: clientMsgId,
          clientMsgId,
          pending: true,
          criadaEm: new Date().toISOString(),
          conteudo: dataUrl,
          deId: usuarioId!,
          paraId: alvo.usuario.id,
          tipo: "CARD",
        }
      ]);

      const resp = await fetch(`${API.BASE_URL}/api/mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paraId: alvo.usuario.id, conteudo: dataUrl, tipo: "CARD", clientMsgId }),
      });

      if (resp.ok) {
        const saved: Mensagem = await resp.json();
        reconcilePrivadaByClientId(saved);
      } else {
        console.error("POST /api/mensagem (CARD) falhou:", resp.status, await resp.text());
      }
    
    } catch (err) {
      console.error("Falha ao compartilhar card no chat:", err);
      alert("Não foi possível compartilhar seu card agora.");
    }
  };

useEffect(() => {
  if (!alvo || alvo.tipo !== "usuario" || !usuarioId) return;
  const key = `conversa_${usuarioId}_${alvo.usuario.id}`;
  localStorage.setItem(key, JSON.stringify(mensagensPrivadas.slice(-100)));
}, [mensagensPrivadas, alvo, usuarioId]);

useEffect(() => {
  if (!alvo || alvo.tipo !== "grupo") return;
  const key = `conversa_grupo_${alvo.grupo.id}`;
  localStorage.setItem(key, JSON.stringify(mensagensGrupo.slice(-100)));
}, [mensagensGrupo, alvo]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      if (usuarioId) socket.emit("join", usuarioId);
    });

    socket.on("novaMensagem", (mensagem: Mensagem) => {
      const current = alvoRef.current;
      if (current?.tipo !== "usuario") return;

      const curId = current.usuario.id;
      const relevante =
        (mensagem.deId === curId && mensagem.paraId === usuarioId) ||
        (mensagem.deId === usuarioId && mensagem.paraId === curId);
      if (!relevante) return;

      const replaced = reconcilePrivadaByClientId(mensagem);

      if (!replaced) {
        setMensagensPrivadas(prev => {
          const exists =
            prev.some(m => m.id === mensagem.id) ||
            (!!mensagem.clientMsgId && prev.some(m => m.clientMsgId === mensagem.clientMsgId));
          if (exists) return prev;
          return [...prev, { ...mensagem, pending: false }];
        });
      }
    });

    socket.on("novaMensagemGrupo", (mensagem: MensagemGrupo) => {
      const current = alvoRef.current;
      if (!(current?.tipo === "grupo" && mensagem.grupoId === current.grupo.id)) return;

      const replaced = reconcileGrupoByClientId(mensagem);

      if (!replaced) {
        setMensagensGrupo(prev => {
          const exists =
            prev.some(m => m.id === mensagem.id) ||
            (!!mensagem.clientMsgId && prev.some(m => m.clientMsgId === mensagem.clientMsgId));
          if (exists) return prev;
          return [...prev, { ...mensagem, pending: false }];
        });
      }
    });

  socket.on("mensagemDeletada", ({ id }: { id: string }) => {
    setMensagensPrivadas(prev => prev.filter(m => m.id !== id));
    setMensagensGrupo(prev => prev.filter(m => m.id !== id));
  });

    return () => {
      socket.off("novaMensagem");
      socket.off("novaMensagemGrupo");
      socket.off("mensagemDeletada");
    };
  }, [usuarioId]);

  useEffect(() => {
    (async () => {
      try {
        const gruposRes = await fetch(`${API.BASE_URL}/api/grupos/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!gruposRes.ok) {
          console.error("Falha /api/grupos/me:", gruposRes.status, await gruposRes.text());
          return;
        }
        const meusGrupos: Grupo[] = await gruposRes.json();

        const mutuosRes = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mutuosRes.ok) {
          console.error("Falha /api/seguidores/mutuos:", mutuosRes.status, await mutuosRes.text());
          return;
        }
        const mutuos: Usuario[] = await mutuosRes.json();
        setUsuariosMutuos(mutuos);
        setGrupos(meusGrupos);
      } catch (e) {
        console.error("Erro ao carregar sidebar:", e);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!alvo) return;

    if (alvo.tipo === "usuario") {
      const key = `conversa_${usuarioId}_${alvo.usuario.id}`;
      const cache = JSON.parse(localStorage.getItem(key) || "[]");
      setMensagensPrivadas(cache);
      setTemMaisPriv(true);
      carregarMensagensPrivadas(alvo.usuario.id, false).catch(() => {});
    } else {
      const key = `conversa_grupo_${alvo.grupo.id}`;
      const cache = JSON.parse(localStorage.getItem(key) || "[]");
      setMensagensGrupo(cache);
      setTemMaisGrupo(true);
      carregarMensagensDoGrupo(alvo.grupo.id, false).catch(() => {});
      socket.emit("joinGroup", alvo.grupo.id);
    }
    setNovaMensagem("");
  }, [alvo, usuarioId, token]);

  const carregarPostPorId = async (postId: string) => {
    if (postsCache[postId]) return;
    try {
      const res = await fetch(`${API.BASE_URL}/api/post/visualizar/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar post");
      const post: Postagem = await res.json();
      setPostsCache((prev) => ({ ...prev, [postId]: post }));
    } catch (err) {
      console.error("Erro ao carregar post:", err);
    }
  };

  const carregarUsuarioPorId = async (id: string) => {
    if (usuariosCache[id]) return;
    try {
      const res = await fetch(`${API.BASE_URL}/api/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar usuário");
      const usuario: Usuario = await res.json();
      setUsuariosCache((prev) => ({ ...prev, [id]: usuario }));
    } catch (err) {
      console.error("Erro ao carregar usuário:", err);
    }
  };

  const carregarDesafioPorId = async (desafioId: string) => {
    if (!desafioId || desafiosCache[desafioId]) return;
    try {
      const res = await fetch(`${API.BASE_URL}/api/desafios/${desafioId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar desafio");
      const data: Desafio = await res.json();
      setDesafiosCache((prev) => ({ ...prev, [desafioId]: data }));
    } catch (err) {
      console.error("Erro ao carregar desafio:", err);
    }
  };

  useEffect(() => {
    mensagensPrivadas.forEach((m) => {
      if (m.tipo === "POST") carregarPostPorId(m.conteudo);
      if (m.tipo === "USUARIO") carregarUsuarioPorId(m.conteudo);
      if (m.tipo === "DESAFIO") carregarDesafioPorId(m.conteudo);
    });
  }, [mensagensPrivadas]);

  const limite = 20;

  async function carregarMensagensPrivadas(usuarioIdAlvo: string, append: boolean) {
    try {
      const base = append ? mensagensPrivadas : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;

      const params: Record<string, string> = { paraId: usuarioIdAlvo, limit: String(limite) };
      if (usuarioId) params.deId = usuarioId;
      if (ultimoId) params.cursor = ultimoId;

      const query = new URLSearchParams(params);

      const res = await fetch(`${API.BASE_URL}/api/mensagem?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const novas: Mensagem[] = await res.json();
      if (novas.length < limite) setTemMaisPriv(false);

      const novasOrdenadas = [...novas].reverse();

      if (append) {
        setMensagensPrivadas((prev) => {
          const combined = [...novasOrdenadas, ...prev];
          const map = new Map<string, Mensagem>();
          combined.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort((a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime());
        });
      } else {
        setMensagensPrivadas(novasOrdenadas);
      }

      const key = `conversa_${usuarioId}_${usuarioIdAlvo}`;
      const mensagensSalvas = append ? [...novasOrdenadas, ...mensagensPrivadas] : novasOrdenadas;
      localStorage.setItem(key, JSON.stringify(mensagensSalvas.slice(-100)));
    } catch (err) {
      console.error("Erro ao carregar mensagens privadas:", err);
    }
  }

  async function carregarMensagensDoGrupo(grupoId: string, append: boolean) {
    try {
      const base = append ? mensagensGrupo : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;
      const query = new URLSearchParams({
        limit: String(limite),
        ...(ultimoId ? { cursor: ultimoId } : {}),
      });

      const res = await fetch(`${API.BASE_URL}/api/mensagem/grupos/${grupoId}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const novas: MensagemGrupo[] = await res.json();
      if (novas.length < limite) setTemMaisGrupo(false);

      const novasOrdenadas = [...novas].reverse();

      if (append) {
        setMensagensGrupo((prev) => {
          const combined = [...novasOrdenadas, ...prev];
          const map = new Map<string, MensagemGrupo>();
          combined.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort((a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime());
        });
      } else {
        setMensagensGrupo(novasOrdenadas);
      }

      const key = `conversa_grupo_${grupoId}`;
      const mensagensSalvas = append ? [...novasOrdenadas, ...mensagensGrupo] : novasOrdenadas;
      localStorage.setItem(key, JSON.stringify(mensagensSalvas.slice(-100)));
    } catch (err) {
      console.error("Erro ao carregar mensagens do grupo:", err);
    }
  }

  async function getMeuPerfilEBonus(): Promise<{
    atletaId: string | null;
    nome: string;
    foto?: string | null;
    posicao?: string | null;
    ovr: number;
    perf: number;
    disc: number;
    resp: number;
  } | null> {
    try {
      const perfilRes = await fetch(`${API.BASE_URL}/api/perfil/${usuarioId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!perfilRes.ok) return null;
      const perfilJson = await perfilRes.json();

      const nome = perfilJson?.usuario?.nome ?? "";
      const foto = perfilJson?.usuario?.foto ?? null;

      const posRes = await fetch(`${API.BASE_URL}/api/perfil/me/posicao-atual`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posJson = posRes.ok ? await posRes.json() : null;
      const posicao = posJson?.posicao ?? null;
      const atletaId = posJson?.atletaId ?? null;

      const pontosRes = await fetch(`${API.BASE_URL}/api/perfil/pontuacao/${usuarioId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const w = pontosRes.ok ? await pontosRes.json() : null;

      const perf = Number(w?.performance ?? 0);
      const disc = Number(w?.disciplina ?? 0);
      const resp = Number(w?.responsabilidade ?? 0);
      const ovr = Math.round((perf + disc + resp) / 3);

      return { atletaId, nome, foto, posicao, ovr, perf, disc, resp };
    } catch {
      return null;
    }
  }

  const genClientId = () => `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  function reconcilePrivadaByClientId(incoming: Mensagem) {
  if (!incoming.clientMsgId) return false;
  let replaced = false;
  setMensagensPrivadas(prev => {
    const idx = prev.findIndex(m => m.clientMsgId === incoming.clientMsgId);
    if (idx === -1) return prev;         
    const clone = [...prev];
    clone[idx] = { ...incoming, pending: false };
    replaced = true;
    return clone;
  });
  return replaced;
}

function reconcileGrupoByClientId(incoming: MensagemGrupo) {
  if (!incoming.clientMsgId) return false;
  let replaced = false;
  setMensagensGrupo(prev => {
    const idx = prev.findIndex(m => m.clientMsgId === incoming.clientMsgId);
    if (idx === -1) return prev;               
    const clone = [...prev];
    clone[idx] = { ...incoming, pending: false };
    replaced = true;
    return clone;
  });
  return replaced;
}
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (top >= 50 || !alvo) return;

    if (alvo.tipo === "usuario" && temMaisPriv && !carregandoMaisPriv) {
      setCarregandoMaisPriv(true);
      carregarMensagensPrivadas(alvo.usuario.id, true).finally(() => setCarregandoMaisPriv(false));
    }
    if (alvo.tipo === "grupo" && temMaisGrupo && !carregandoMaisGrupo) {
      setCarregandoMaisGrupo(true);
      carregarMensagensDoGrupo(alvo.grupo.id, true).finally(() => setCarregandoMaisGrupo(false));
    }
  };

 const enviarMensagem = async () => {
  if (!novaMensagem.trim() || !alvo) return;

  if (!usuarioId) {
    alert("Sessão expirada. Faça login novamente.");
    return;
  }

  if (alvo.tipo === "usuario") {
    const clientMsgId = genClientId();

    const otm: Mensagem = {
      id: clientMsgId,
      clientMsgId,
      pending: true,
      criadaEm: new Date().toISOString(),
      conteudo: novaMensagem,
      deId: usuarioId!,
      paraId: alvo.usuario.id,
      tipo: "NORMAL",
    };
    setMensagensPrivadas(prev => [...prev, otm]);

    try {
      const payload = { paraId: alvo.usuario.id, conteudo: novaMensagem, tipo: "NORMAL" as const, clientMsgId };
      const resp = await fetch(`${API.BASE_URL}/api/mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const saved: Mensagem = await resp.json();
        reconcilePrivadaByClientId(saved);
      } 
    } catch (e) {
      console.error("POST /api/mensagem erro:", e);
    }

    setNovaMensagem("");
  } else {
    const clientMsgId = genClientId();

    const otm: MensagemGrupo = {
      id: clientMsgId,
      clientMsgId,
      pending: true,
      criadaEm: new Date().toISOString(),
      conteudo: novaMensagem,
      grupoId: alvo.grupo.id,
      usuarioId: usuarioId!,
      tipo: "NORMAL",
    };
    setMensagensGrupo(prev => [...prev, otm]);

    try {
      const payload = { conteudo: novaMensagem, clientMsgId };
      const resp = await fetch(`${API.BASE_URL}/api/mensagem/grupos/${alvo.grupo.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const saved: MensagemGrupo = await resp.json();
        reconcileGrupoByClientId(saved);
      } else {
        console.error("POST /api/mensagem/grupos falhou:", resp.status, await resp.text());
      }
    } catch (e) {
      console.error("POST /api/mensagem/grupos erro:", e);
    }

    setNovaMensagem("");
  }
};

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const deletarMensagem = async (id: string) => {
  try {
    const msgPriv = mensagensPrivadas.find(m => m.id === id);
    const msgGrp  = mensagensGrupo.find(m => m.id === id);
    const pending = (msgPriv && msgPriv.pending) || (msgGrp && msgGrp.pending);

    if (pending || id.startsWith("c_") || !isUuid(id)) {
      setMensagensPrivadas(prev => prev.filter(m => m.id !== id));
      setMensagensGrupo(prev => prev.filter(m => m.id !== id));
      return;
    }

    const res = await fetch(`${API.BASE_URL}/api/mensagem/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Falha no delete");

    setMensagensPrivadas(prev => prev.filter(m => m.id !== id));
    setMensagensGrupo(prev => prev.filter(m => m.id !== id));
  } catch (err) {
    console.error("Erro ao apagar mensagem:", err);
    alert("Não foi possível apagar a mensagem.");
  }
};

  const renderizarMensagemPrivada = (msg: Mensagem) => {
    const isMine = msg.deId === usuarioId;

    if (msg.tipo === "POST") {
      const post = postsCache[msg.conteudo];
      if (!post) {
        return (
          <div key={msg.id} className={`p-4 rounded max-w-sm border shadow-sm cursor-pointer ${msg.deId === usuarioId ? "bg-blue-100 self-end ml-auto" : "bg-white"}`}>
            Carregando post...
          </div>
        );
      }
      return (
        <div
          key={msg.id}
          onClick={() => navigate(`/post/${post.id}`)}
          className={`relative p-4 rounded max-w-sm border shadow-sm cursor-pointer ${msg.deId === usuarioId ? "bg-blue-100 self-end ml-auto" : "bg-white"}`}
          title="Clique para abrir a postagem"
        >
          <div className="flex items-center mb-3 gap-3">
            <img
              src={post.usuario.foto ? `${API.BASE_URL}${post.usuario.foto}` : "https://via.placeholder.com/40"}
              alt={`Foto de ${post.usuario.nome}`}
              className="w-10 h-10 rounded-full object-cover border"
            />
            <span className="font-semibold">{post.usuario.nome}</span>
          </div>

          {post.imagemUrl && <img src={`${API.BASE_URL}${post.imagemUrl}`} alt="Imagem do post" className="w-full max-h-48 object-cover rounded mb-2" />}
          {!post.imagemUrl && post.videoUrl && (
            <video controls className="w-full max-h-48 rounded mb-2">
              <source src={`${API.BASE_URL}${post.videoUrl}`} />
              Seu navegador não suporta vídeo.
            </video>
          )}
           <p className="text-gray-800 text-sm line-clamp-2 whitespace-pre-wrap">{post.conteudo}</p>
        
           {isMine && (
              <button
                onClick={(e) => { e.stopPropagation(); deletarMensagem(msg.id); }}  
                className="absolute top-1 right-1 text-gray-500 hover:text-red-600"
                title="Apagar mensagem"
              >
                <Trash size={16} />
              </button>
            )}
        </div>
      );
    }

    if (msg.tipo === "USUARIO") {
      const u = usuariosCache[msg.conteudo];
      if (!u) {
        return (
          <div key={msg.id} className={`p-4 rounded max-w-sm border shadow-sm cursor-pointer ${msg.deId === usuarioId ? "bg-blue-100 self-end ml-auto" : "bg-white"}`}>
            Carregando usuário...
          </div>
        );
      }
      return (
        <div
          key={msg.id}
          onClick={() => navigate(`/perfil/${u.id}`)}
          className={`relative p-4 rounded max-w-sm border shadow-sm cursor-pointer flex items-center gap-3 ${
            msg.deId === usuarioId ? "bg-blue-100 self-end ml-auto" : "bg-white"
          }`}
          title="Clique para ver o perfil"
        >
          <img src={u.foto ? `${API.BASE_URL}${u.foto}` : "https://via.placeholder.com/40"} alt={`Foto de ${u.nome}`} className="w-12 h-12 rounded-full object-cover border" />
          <div>
            <p className="font-semibold">{u.nome}</p>
            <p className="text-sm text-gray-500">Ver perfil</p>
          </div>

           {isMine && (
              <button
                onClick={(e) => { e.stopPropagation(); deletarMensagem(msg.id); }}
                className="absolute top-1 right-1 text-gray-500 hover:text-red-600"
                title="Apagar mensagem"
              >
                <Trash size={16} />
              </button>
            )}
        </div>
      );
    }

    if (msg.tipo === "DESAFIO") {
      const d = desafiosCache[msg.conteudo];
      if (!d) {
        return (
          <div key={msg.id} className={`p-4 rounded max-w-sm border shadow-sm cursor-pointer ${msg.deId === usuarioId ? "bg-blue-100 self-end ml-auto" : "bg-white"} `}>
            Carregando desafio...
          </div>
        );
      }
      const isMine = msg.deId === usuarioId;
      const imagemSrc = d.imagemUrl && d.imagemUrl.startsWith("http") ? d.imagemUrl : d.imagemUrl ? `${API.BASE_URL}${d.imagemUrl}` : null;

      return (
        <div
          key={msg.id}
          onClick={() => navigate(`/desafios/${d.id}`)}
          className={`relative p-3 rounded-lg max-w-sm border shadow-md cursor-pointer transition-all hover:shadow-lg ${isMine ? "bg-blue-50 self-end ml-auto" : "bg-white"}`}
          title="Clique para ver o desafio"
        >
          <div className="flex items-center justify-between mb-2 gap-3">
            <h3 className="font-semibold text-sm text-gray-800 line-clamp-2">{d.titulo}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">{d.nivel ?? "—"}</span>
          </div>

          {imagemSrc && <img src={imagemSrc} alt={d.titulo} className="w-full h-36 object-cover rounded mb-2" />}

          <p className="text-gray-700 text-sm line-clamp-3 mb-2">{d.descricao}</p>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-700">Pontos: {d.pontuacao ?? "-"}</span>
              {d.categoria && d.categoria.length > 0 && <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{d.categoria.join(", ")}</span>}
            </div>
            <div>
              <span>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
           {isMine && (
              <button
                onClick={(e) => { e.stopPropagation(); deletarMensagem(msg.id); }}  
                className="absolute top-1 right-1 text-gray-500 hover:text-red-600"
                title="Apagar mensagem"
              >
                <Trash size={16} />
              </button>
            )}
        </div>
      );
    }

    if (msg.tipo === "CARD") {
      const isMine = msg.deId === usuarioId;
      return (
        <div
          key={msg.id}
          className={`relative p-2 rounded max-w-sm border shadow-sm ${
            isMine ? "bg-blue-50 self-end ml-auto" : "bg-white"
          } `}
        >
          <img
            src={msg.conteudo}
            alt="Card do atleta"
            className="w-60 h-auto rounded"
          />
           {isMine && (
              <button
                onClick={(e) => { e.stopPropagation(); deletarMensagem(msg.id); }}
                className="absolute top-1 right-1 text-gray-500 hover:text-red-600"
                title="Apagar mensagem"
              >
                <Trash size={16} />
              </button>
            )}
        </div>
      );
    }
      return (
    <div
      key={msg.id}
      className={`relative p-2 rounded max-w-sm ${
        isMine ? "bg-blue-100 self-end ml-auto" : "bg-gray-200"
      }`}
    >
      <p>{msg.conteudo}</p>

      {isMine && (
        <button
          onClick={() => deletarMensagem(msg.id)}
          className="absolute top-1 right-1 text-gray-500 hover:text-red-600"
          title="Apagar mensagem"
        >
          <Trash size={16} />
        </button>
      )}
    </div>
  );
};

  const tituloChat =
    alvo?.tipo === "usuario" ? alvo.usuario.nome : alvo?.tipo === "grupo" ? `${alvo.grupo.nome} (grupo)` : "Selecione uma conversa";

  return (
    <div className="flex h-screen">
      <aside className="w-1/4 border-r p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <button onClick={abrirModal} title="Criar/gerenciar grupos" className="p-1 rounded hover:bg-gray-200">
            <UserPlus size={20} />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <Users size={16} /> <span className="text-sm font-semibold">Grupos</span>
          </div>
          {grupos.length === 0 && <p className="text-xs text-gray-500">Você ainda não participa de grupos.</p>}
          {grupos.map((g) => {
            const selecionado = alvo?.tipo === "grupo" && alvo.grupo.id === g.id;

            return (
              <div
                key={g.id}
                className={`p-3 mb-2 rounded-lg cursor-pointer border shadow-sm transition-all ${selecionado ? "bg-blue-100 border-blue-400" : "hover:bg-gray-100 bg-white"}`}
                onClick={() => setAlvo({ tipo: "grupo", grupo: g })}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{g.nome}</div>
                </div>

                {g.descricao && <div className="text-xs text-gray-500 line-clamp-1">{g.descricao}</div>}
              </div>
            );
          })}
        </div>

        <div>
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <User size={16} /> <span className="text-sm font-semibold">Usuários</span>
          </div>
          {usuariosMutuos.map((u) => {
            const selecionado = alvo?.tipo === "usuario" && alvo.usuario.id === u.id;
            return (
              <div
                key={u.id}
                className={`flex items-center gap-3 p-3 mb-3 rounded-lg cursor-pointer border shadow-sm transition-all ${
                  selecionado ? "bg-blue-100 border-blue-400" : "hover:bg-gray-100 bg-white"
                }`}
                onClick={() => setAlvo({ tipo: "usuario", usuario: u })}
              >
                <img src={u.foto ? `${API.BASE_URL}${u.foto}` : "https://via.placeholder.com/40"} alt={`Foto de ${u.nome}`} className="w-12 h-12 rounded-full object-cover border" />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{u.nome}</span>
                  <span className="text-xs text-gray-500">Clique para conversar</span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

        <div style={{ position: "absolute", left: -99999, top: -99999 }}>
          <div ref={cardRef}>
            {meuCardDados && (
              <CardAtletaShield
                atleta={{
                  atletaId: meuCardDados.atletaId ?? "",
                  nome: meuCardDados.nome,
                  foto: meuCardDados.foto,
                  posicao: meuCardDados.posicao ?? undefined,
                  idade: null,
                }}
                ovr={meuCardDados.ovr}
                perf={meuCardDados.perf}
                disc={meuCardDados.disc}
                resp={meuCardDados.resp}
                size={{ w: 300, h: 420 }}
                goldenMinOVR={88}
              />
            )}
          </div>
        </div>

      <main className="flex-1 flex flex-col justify-between p-4 pb-20">
        {alvo ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{tituloChat}</h2>

              {alvo.tipo === "usuario" && (
                <button
                  onClick={compartilharPerfilNoChat}
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                  title="Compartilhar meu card nesta conversa"
                >
                  <Share2 size={18} />
                  Compartilhar meu card
                </button>
              )}

              {alvo.tipo === "grupo" && (
                <button onClick={() => setModalDesafiosAberto(true)} className="flex items-center gap-2 px-3 py-1 text-sm rounded bg-purple-600 text-white hover:bg-purple-700">
                  Desafio em grupo
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 border rounded p-2 mb-4 bg-gray-50" onScroll={handleScroll}>
              {alvo.tipo === "usuario" && mensagensPrivadas.map((m) => renderizarMensagemPrivada(m))}
              {alvo.tipo === "grupo" &&
                mensagensGrupo.map((m) => <MensagemItemGrupo key={m.id} msg={m} meId={usuarioId} baseUrl={API.BASE_URL} />)}

              {(carregandoMaisPriv || carregandoMaisGrupo) && <p className="text-center text-sm text-gray-400">Carregando mais...</p>}
            </div>

            <div className="flex gap-2">
              <input className="flex-1 border p-2 rounded" value={novaMensagem} onChange={(e) => setNovaMensagem(e.target.value)} placeholder="Digite sua mensagem..." />
              <button onClick={enviarMensagem} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-500">Selecione uma conversa para começar</p>
        )}
      </main>

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

      <ModalGrupos aberto={modalAberto} onFechar={fecharModal} usuarioId={usuarioId ?? ""} token={token} />

      {alvo?.tipo === "grupo" && (
        <ModalDesafiosGrupo aberto={modalDesafiosAberto} onFechar={fecharModalDesafios} grupoId={alvo.grupo.id} token={token} onCriado={recarregarMensagensDoGrupoAtual} />
      )}
    </div>
  );
}