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
import { publicImgUrl } from "@/utils/publicUrl.js";

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
  const [showSidebar, setShowSidebar] = useState(false);

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

  const pendingOpenRef = useRef(false);

  const RECENTS_KEY = "mensagens_recent_usuarios";
  const loadRecentUsers = (): Usuario[] => {
    try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); } catch { return []; }
  };
  const saveRecentUser = (u: Usuario) => {
    try {
      const cur = loadRecentUsers();
      const next = [u, ...cur.filter(x => x.id !== u.id)].slice(0, 50);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {}
  };
  const mergeUnique = (a: Usuario[], b: Usuario[]) => {
    const m = new Map<string, Usuario>();
    [...a, ...b].forEach(u => m.set(u.id, u));
    return Array.from(m.values());
  };

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

  const compactMsgs = <T extends { tipo: string; conteudo: any }>(arr: T[]) =>
    arr.slice(-60).map((m) => {
      if (m.tipo === "CARD") return { ...m, conteudo: "__CARD__", pending: false, clientMsgId: undefined } as T;
      const clone: any = { ...m };
      if (typeof clone.conteudo === "string" && clone.conteudo.length > 2000) {
        clone.conteudo = clone.conteudo.slice(0, 2000);
      }
      delete clone.pending;
      delete clone.clientMsgId;
      return clone as T;
    });

  const safeSave = (key: string, value: any[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(compactMsgs(value)));
    } catch (e) {
      console.warn("LocalStorage quota:", e);
      try {
        localStorage.setItem(key, JSON.stringify(compactMsgs(value).slice(-30)));
      } catch {}
    }
  };

  const safeLoad = <T = any>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const cardRef = useRef<HTMLDivElement | null>(null);
  const alvoRef = useRef<ChatTarget | null>(null);
  useEffect(() => { alvoRef.current = alvo; }, [alvo]);

  const recarregarMensagensDoGrupoAtual = async () => {
    const current = alvoRef.current;
    if (current?.tipo === "grupo") {
      await carregarMensagensDoGrupo(current.grupo.id, false);
    }
  };

  async function publicarCardNoFeed(dataUrl: string, legenda = "Meu Card FOOTERA") {
    const resp = await fetch(`${API.BASE_URL}/api/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ descricao: legenda, midiaBase64: dataUrl }),
    });
    if (!resp.ok) throw new Error(await resp.text());
  }

  const SidebarContent = () => (
    <div className="p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Conversas</h2>
        <button onClick={abrirModal} title="Criar/gerenciar grupos" className="p-1 rounded hover:bg-gray-100">
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
              className={`p-3 mb-2 rounded-lg cursor-pointer border shadow-sm transition ${selecionado ? "bg-green-50 border-green-300" : "hover:bg-gray-50 bg-white"}`}
              onClick={() => { setAlvo({ tipo: "grupo", grupo: g }); setShowSidebar(false); }}
            >
              <div className="font-medium text-sm">{g.nome}</div>
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
              className={`flex items-center gap-3 p-3 mb-3 rounded-lg cursor-pointer border shadow-sm transition ${selecionado ? "bg-green-50 border-green-300" : "hover:bg-gray-50 bg-white"}`}
              onClick={() => { setAlvo({ tipo: "usuario", usuario: u }); setShowSidebar(false); }}
            >
              <img
                src={publicImgUrl(u.foto) || `${API.BASE_URL}/assets/default-user.png`}
                className="w-12 h-12 rounded-full object-cover border"
              />
              <div className="flex flex-col">
                <span className="font-medium text-sm">{u.nome}</span>
                <span className="text-xs text-gray-500">Clique para conversar</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const compartilharPerfilNoChat = async () => {
    if (!alvo || alvo.tipo !== "usuario" || !usuarioId) return;
    try {
      const dados = (meuCardDados ?? await getMeuPerfilEBonus());
      if (!dados) { alert("Não consegui montar seu card agora."); return; }
      setMeuCardDados(dados);

      await new Promise((r) => setTimeout(r, 0));
      const node = cardRef.current;
      if (!node) { alert("Falha ao preparar o card para captura."); return; }

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

      try {
        const legenda = `Meu Card FOOTERA OVR: ${dados.ovr} Performance: ${dados.perf} pts Disciplina: ${dados.disc} pts Responsabilidade: ${dados.resp} pts`;
        await publicarCardNoFeed(dataUrl, legenda);
      } catch (e) {
        console.warn("Falha ao publicar o card no feed:", e);
      }
    } catch (err) {
      console.error("Falha ao compartilhar card no chat:", err);
      alert("Não foi possível compartilhar seu card agora.");
    }
  };

  useEffect(() => {
    if (!alvo || alvo.tipo !== "usuario" || !usuarioId) return;
    const key = `conversa_${usuarioId}_${alvo.usuario.id}`;
    safeSave(key, mensagensPrivadas);
  }, [mensagensPrivadas, alvo, usuarioId]);

  useEffect(() => {
    if (!alvo || alvo.tipo !== "grupo") return;
    const key = `conversa_grupo_${alvo.grupo.id}`;
    safeSave(key, mensagensGrupo);
  }, [mensagensGrupo, alvo]);

  useEffect(() => {
    socket.connect();
    socket.on("connect", () => { if (usuarioId) socket.emit("join", usuarioId); });

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
        const gruposRes = await fetch(`${API.BASE_URL}/api/grupos/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!gruposRes.ok) throw new Error(await gruposRes.text());
        const meusGrupos: Grupo[] = await gruposRes.json();

        const mutuosRes = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, { headers: { Authorization: `Bearer ${token}` } });
        if (!mutuosRes.ok) throw new Error(await mutuosRes.text());
        const mutuos: Usuario[] = await mutuosRes.json();

        const recentes = loadRecentUsers();
        setUsuariosMutuos(mergeUnique(recentes, mutuos));
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
      const cache = safeLoad<Mensagem>(key);
      setMensagensPrivadas(cache);
      setTemMaisPriv(true);
      carregarMensagensPrivadas(alvo.usuario.id, false).catch(() => {});
    } else {
      const key = `conversa_grupo_${alvo.grupo.id}`;
      const cache = safeLoad<MensagemGrupo>(key);
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
      const res = await fetch(`${API.BASE_URL}/api/post/visualizar/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`${API.BASE_URL}/api/usuarios/${id}`, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`${API.BASE_URL}/api/desafios/${desafioId}`, { headers: { Authorization: `Bearer ${token}` } });
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

  useEffect(() => {
    if (pendingOpenRef.current) return;
    try {
      const raw = localStorage.getItem("mensagens_open_target");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!(data && data.tipo === "usuario" && typeof data.id === "string")) return;

      const alvoId = data.id as string;

      const u = usuariosMutuos.find((x) => x.id === alvoId);
      if (u) {
        saveRecentUser(u);
        setAlvo({ tipo: "usuario", usuario: u });
        pendingOpenRef.current = true;
        localStorage.removeItem("mensagens_open_target");
        return;
      }

      (async () => {
        try {
          const resp = await fetch(`${API.BASE_URL}/api/usuarios/${alvoId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) throw new Error();
          const usuario = (await resp.json()) as Usuario;

          saveRecentUser(usuario);
          setUsuariosMutuos((prev) => {
            if (prev.some((p) => p.id === usuario.id)) return prev;
            return [usuario, ...prev];
          });
          setAlvo({ tipo: "usuario", usuario });
        } finally {
          pendingOpenRef.current = true;
          localStorage.removeItem("mensagens_open_target");
        }
      })();
    } catch {}
  }, [usuariosMutuos, token]);

  async function carregarMensagensPrivadas(usuarioIdAlvo: string, append: boolean) {
    try {
      const base = append ? mensagensPrivadas : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;

      const params: Record<string, string> = { paraId: usuarioIdAlvo, limit: String(limite) };
      if (usuarioId) params.deId = usuarioId;
      if (ultimoId) params.cursor = ultimoId;

      const query = new URLSearchParams(params);
      const res = await fetch(`${API.BASE_URL}/api/mensagem?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
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
      safeSave(key, mensagensSalvas);
    } catch (err) {
      console.error("Erro ao carregar mensagens privadas:", err);
    }
  }

  async function carregarMensagensDoGrupo(grupoId: string, append: boolean) {
    try {
      const base = append ? mensagensGrupo : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;
      const query = new URLSearchParams({ limit: String(limite), ...(ultimoId ? { cursor: ultimoId } : {}) });

      const res = await fetch(`${API.BASE_URL}/api/mensagem/grupos/${grupoId}?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
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
      safeSave(key, mensagensSalvas);
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
      const perfilRes = await fetch(`${API.BASE_URL}/api/perfil/${usuarioId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!perfilRes.ok) return null;
      const perfilJson = await perfilRes.json();

      const nome = perfilJson?.usuario?.nome ?? "";
      const foto = publicImgUrl(perfilJson?.usuario?.foto ?? null);

      const posRes = await fetch(`${API.BASE_URL}/api/perfil/me/posicao-atual`, { headers: { Authorization: `Bearer ${token}` } });
      const posJson = posRes.ok ? await posRes.json() : null;
      const posicao = posJson?.posicao ?? null;
      const atletaId = posJson?.atletaId ?? null;

      const pontosRes = await fetch(`${API.BASE_URL}/api/perfil/${usuarioId}/pontuacao`, { headers: { Authorization: `Bearer ${token}` } });
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
    if (!usuarioId) { alert("Sessão expirada. Faça login novamente."); return; }

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

      const res = await fetch(`${API.BASE_URL}/api/mensagem/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Falha no delete");

      setMensagensPrivadas(prev => prev.filter(m => m.id !== id));
      setMensagensGrupo(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error("Erro ao apagar mensagem:", err);
      alert("Não foi possível apagar a mensagem.");
    }
  };

  const renderizarMensagemGrupoWhats = (msg: MensagemGrupo) => {
    const isMine = msg.usuarioId === usuarioId;
    const wrap = isMine ? "self-end items-end" : "self-start items-start";
    const bubble = isMine ? "bg-green-900 text-white rounded-2xl rounded-tr-none" : "bg-[#E8ECF7] text-[#0F172A] rounded-2xl rounded-tl-none";
    const ts = isMine ? "text-[11px] text-grey-500 text-right mt-1" : "text-[11px] text-gray-500 mt-1";

    const Shell = (children: React.ReactNode): JSX.Element => (
      <div className={`max-w-[75%] flex flex-col ${wrap}`}>
        <div className={`${bubble} px-3 py-2 shadow-sm relative`}>
          {children}
          {isMine && (
            <button
              onClick={() => deletarMensagem(msg.id)}
              className="absolute -top-2 -right-2 bg-white/80 text-gray-700 hover:text-red-600 p-1 rounded-full shadow"
              title="Apagar"
            >
              <Trash size={14} />
            </button>
          )}
        </div>
        <div className={ts}>
          {new Date(msg.criadaEm).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    );

    if (msg.tipo === "GRUPO_DESAFIO" || msg.tipo === "GRUPO_DESAFIO_BONUS" || msg.tipo === "DESAFIO" || msg.tipo === "POST" || msg.tipo === "USUARIO") {
      return Shell(
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
          <MensagemItemGrupo msg={msg} meId={usuarioId} baseUrl={API.BASE_URL} />
        </div>
      );
    }
    return Shell(<p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.conteudo}</p>);
  };

  const renderizarMensagemPrivadaWhats = (msg: Mensagem) => {
    const isMine = msg.deId === usuarioId;
    const wrap = isMine ? "self-end items-end" : "self-start items-start";
    const bubble = isMine ? "bg-green-900 text-white rounded-2xl rounded-tr-none" : "bg-[#E8ECF7] text-[#0F172A] rounded-2xl rounded-tl-none";
    const ts = isMine ? "text-[11px] text-grey-500 text-right mt-1" : "text-[11px] text-gray-500 mt-1";

    const Shell = (children: React.ReactNode): JSX.Element => (
      <div className={`max-w-[75%] flex flex-col ${wrap}`}>
        <div className={`${bubble} px-3 py-2 shadow-sm relative`}>
          {children}
          {isMine && (
            <button
              onClick={() => deletarMensagem(msg.id)}
              className="absolute -top-2 -right-2 bg-white/80 text-gray-700 hover:text-red-600 p-1 rounded-full shadow"
              title="Apagar"
            >
              <Trash size={14} />
            </button>
          )}
        </div>
        <div className={ts}>
          {new Date(msg.criadaEm).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    );

    if (msg.tipo === "POST") {
      const post = postsCache[msg.conteudo];
      if (!post) return Shell(<div className="text-sm">Carregando post...</div>);

      const img = post.imagemUrl ? (post.imagemUrl.startsWith("http") ? post.imagemUrl : `${API.BASE_URL}${post.imagemUrl}`) : null;
      const video = !img && post.videoUrl ? (post.videoUrl.startsWith("http") ? post.videoUrl : `${API.BASE_URL}${post.videoUrl}`) : null;

      return Shell(
        <div onClick={() => navigate(`/post/${post.id}`)} className="cursor-pointer">
          <div className="flex items-center gap-2 mb-2">
            <img src={publicImgUrl(post.usuario.foto) || `${API.BASE_URL}/assets/default-user.png`} className="w-8 h-8 rounded-full object-cover border" />
            <span className="text-sm font-semibold">{post.usuario.nome}</span>
          </div>
          {img && <img src={img} className="w-60 max-h-48 object-cover rounded mb-2" />}
          {video && (
            <video controls className="w-60 max-h-48 rounded mb-2">
              <source src={video} />
            </video>
          )}
          <p className="text-sm whitespace-pre-wrap">{post.conteudo}</p>
        </div>
      );
    }

    if (msg.tipo === "USUARIO") {
      const u = usuariosCache[msg.conteudo];
      if (!u) return Shell(<div className="text-sm">Carregando usuário...</div>);
      return Shell(
        <div onClick={() => navigate(`/perfil/${u.id}`)} className="flex items-center gap-2 cursor-pointer">
          <img src={publicImgUrl(u.foto) || `${API.BASE_URL}/assets/default-user.png`} className="w-10 h-10 rounded-full object-cover border" />
          <div>
            <p className="text-sm font-semibold">{u.nome}</p>
            <p className="text-xs opacity-80">Ver perfil</p>
          </div>
        </div>
      );
    }

    if (msg.tipo === "DESAFIO") {
      const d = desafiosCache[msg.conteudo];
      if (!d) return Shell(<div className="text-sm">Carregando desafio...</div>);
      const imagemSrc = d.imagemUrl && (d.imagemUrl.startsWith("http") ? d.imagemUrl : `${API.BASE_URL}${d.imagemUrl}`);
      return Shell(
        <div onClick={() => navigate(`/desafios/${d.id}`)} className="cursor-pointer">
          <div className="flex items-center justify-between mb-2 gap-3">
            <h3 className="font-semibold text-sm">{d.titulo}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
              {d.nivel ?? "—"}
            </span>
          </div>
          {imagemSrc && <img src={imagemSrc} className="w-60 h-36 object-cover rounded mb-2" />}
          <p className="text-sm opacity-90 mb-2">{d.descricao}</p>
          <div className="flex items-center justify-between text-[11px] opacity-75">
            <span>Pontos: {d.pontuacao ?? "-"}</span>
            <span>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>
      );
    }

    if (msg.tipo === "CARD") {
      if (msg.conteudo === "__CARD__") return Shell(<span className="text-xs opacity-80">[card sendo enviado...]</span>);
      return Shell(<img src={msg.conteudo} alt="Card do atleta" className="w-56 h-auto rounded" />);
    }

    return Shell(<p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.conteudo}</p>);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <header className="sticky top-0 z-10 bg-green-900 text-white">
        <div className="relative h-14 flex items-center justify-center px-4">
          <button
            onClick={() => setShowSidebar(true)}
            className="md:hidden absolute left-3 p-2 rounded-full hover:bg-white/10"
            title="Conversas"
          >
            <Users size={18} />
          </button>
          <h1 className="text-base font-semibold truncate">
            {alvo?.tipo === "usuario" ? alvo.usuario.nome : alvo?.tipo === "grupo" ? alvo.grupo.nome : "Conversas"}
          </h1>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:block w-80 border-r bg-white">
          <SidebarContent />
        </aside>

        <div className={`md:hidden fixed inset-0 z-40 ${showSidebar ? "" : "pointer-events-none"}`}>
          <div
            onClick={() => setShowSidebar(false)}
            className={`absolute inset-0 bg-black/30 transition-opacity ${showSidebar ? "opacity-100" : "opacity-0"}`}
          />
          <aside
            className={`absolute left-0 top-0 h-full w-72 bg-white border-r shadow-xl transform transition-transform ${
              showSidebar ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <SidebarContent />
          </aside>
        </div>

        <main className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b bg-transparent">
            <div className="text-sm text-green-900 font-medium">
              {alvo ? (alvo.tipo === "usuario" ? "Mensagem direta" : "Grupo") : "Selecione uma conversa"}
            </div>

            <div className="flex items-center gap-2">
              {alvo?.tipo === "usuario" && (
                <button
                  onClick={compartilharPerfilNoChat}
                  className="flex items-center gap-1 text-green-800 hover:underline text-sm"
                  title="Compartilhar meu card nesta conversa"
                >
                  <Share2 size={16} /> Compartilhar meu card
                </button>
              )}

              {alvo?.tipo === "grupo" && (
                <button
                  onClick={() => setModalDesafiosAberto(true)}
                  className="px-3 py-2 text-xs rounded-lg bg-green-800 text-white hover:bg-green-700"
                >
                  Desafio em grupo
                </button>
              )}
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 pb-15"
            onScroll={handleScroll}
          >
            <div className="mx-auto w-full sm:max-w-3xl space-y-3">
              {alvo ? (
                <>
                  {alvo?.tipo === "usuario" &&
                    mensagensPrivadas.map((m) => <div key={m.id}>{renderizarMensagemPrivadaWhats(m)}</div>)}
                  {alvo?.tipo === "grupo" &&
                    mensagensGrupo.map((m) => <div key={m.id}>{renderizarMensagemGrupoWhats(m)}</div>)}
                  {(carregandoMaisPriv || carregandoMaisGrupo) && (
                    <p className="text-center text-sm text-gray-400">Carregando mais...</p>
                  )}
                </>
              ) : (
                <p className="text-center text-sm text-gray-500">Selecione uma conversa para começar</p>
              )}
            </div>
          </div>

          <div className="sticky bottom-[64px] md:bottom-0 bg-transparent border-green-100 mb-10">
            <div className="mx-auto w-full sm:max-w-3xl px-3 sm:px-4 py-3 flex items-center gap-2">
              <input
                className="flex-1 bg-white border border-green-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                value={novaMensagem}
                onChange={(e) => setNovaMensagem(e.target.value)}
                placeholder="Digite sua mensagem..."
              />
              <button
                onClick={enviarMensagem}
                className="shrink-0 bg-green-900 text-white p-3 rounded-xl hover:opacity-95 active:opacity-90"
                title="Enviar"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>
            </div>
          </div>
        </main>
      </div>

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
        <ModalDesafiosGrupo
          aberto={modalDesafiosAberto}
          onFechar={fecharModalDesafios}
          grupoId={alvo.grupo.id}
          token={token}
          onCriado={recarregarMensagensDoGrupoAtual}
        />
      )}
    </div>
  );
}