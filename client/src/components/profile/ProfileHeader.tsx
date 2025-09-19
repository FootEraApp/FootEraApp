import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Users, Settings, Edit, Bell, Mail, CircleX, CircleCheck, Send, Eye, UserPlus, Share2 } from "lucide-react";
import { Button } from "../ui/button.js";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";

interface Usuario {
  id: string;
  nome: string;
  foto?: string | null;
}

type Kpi = { label: string; value: number };

interface ProfileHeaderProps {
  nome: string;
  idade?: number;
  posicao?: string;
  time?: string;
  pontuacao?: number;
  scoreTitle?: string;
  kpis?: Kpi[];
  avatar?: string | null;
  foto?: string | null;
  isOwnProfile?: boolean;
  perfilId: string;
}

function Badge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full leading-none flex items-center justify-center shadow">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function ProfileHeader({
  perfilId,
  nome,
  idade,
  posicao,
  time,
  pontuacao = 0,
  scoreTitle = "Pontuação FootEra",
  kpis,
  avatar,
  foto,
  isOwnProfile = false,
}: ProfileHeaderProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [pontosTotal, setPontosTotal] = useState<number>(pontuacao ?? 0);
  const [ehFavorito, setEhFavorito] = useState(false);
  const { id: idDaUrl } = useParams<{ id?: string }>();
  const [seguindo, setSeguindo] = useState<boolean | null>(null);
  const [treinoJunto, setTreinoJunto] = useState<boolean | null>(null);
  const [observando, setObservando] = useState<boolean | null>(null);
  const [notifCount, setNotifCount] = useState<number>(0);
  const [unreadDM, setUnreadDM] = useState<number>(0);
  const [badgeCount, setBadgeCount] = useState(0);

  const storageKey = `tj_${Storage.usuarioId}_${perfilId}`;

  const [confirmBox, setConfirmBox] = useState<{
    open: boolean;
    text: string;
    onYes: () => Promise<void> | void;
  } | null>(null);

  const [podeObservar, setPodeObservar] = useState(false);

  useEffect(() => {
    const onBadge = (e: Event) => {
      const total = (e as CustomEvent<number>).detail ?? 0;
      setBadgeCount(total);
    };
    window.addEventListener("badge:update", onBadge as EventListener);
    return () => window.removeEventListener("badge:update", onBadge as EventListener);
  }, []);

  useEffect(() => {
    if (!isOwnProfile) return;
    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw 0;
        const arr = await r.json();
        const me = Storage.usuarioId;
        const pend = (arr || []).filter((x: any) => {
          const s = String(x.status || "").toLowerCase();
          const isPend = !s || /pend|solic|aguard|nov/i.test(s);
          const destIsMe = [x.destinatarioId, x.usuarioId, x.userId].includes(me);
          return isPend && destIsMe;
        }).length;
        setNotifCount(pend);
      } catch {
        setNotifCount(0);
      }
    })();
  }, [isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/mensagem/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          const count = typeof j === "number" ? j : (j?.count ?? 0);
          setUnreadDM(count);
          return;
        }
      } catch {}

      try {
        const r = await fetch(`${API.BASE_URL}/api/mensagem/unread`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const arr = await r.json();
          setUnreadDM(Array.isArray(arr) ? arr.length : 0);
          return;
        }
      } catch {}
      setUnreadDM(0);
    })();
  }, [isOwnProfile]);

    useEffect(() => {
    if (isOwnProfile || !perfilId) return;
    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        let done = false;

        const r1 = await fetch(
          `${API.BASE_URL}/api/seguidores/status?seguidoUsuarioId=${encodeURIComponent(perfilId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (r1.ok) {
          const j = await r1.json();
          setSeguindo(!!(j?.seguindo || j?.isFollowing));
          done = true;
        }

        if (!done) {
          const r2 = await fetch(`${API.BASE_URL}/api/seguidores/seguindo`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r2.ok) {
            const lista = await r2.json();
            const ids = new Set(
              (Array.isArray(lista) ? lista : []).map(
                (x: any) => x.seguidoUsuarioId ?? x.id ?? x.usuarioId ?? x.userId
              )
            );
            setSeguindo(ids.has(perfilId));
            done = true;
          }
        }

        if (!done) setSeguindo(false);
      } catch {
        setSeguindo(false);
      }
    })();
  }, [perfilId, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile || !perfilId) return;
    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/solicitacoes-treino/minhas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const arr = await r.json();
          const ativo = (arr || []).some((x: any) => {
          const envolve = [x.destinatarioId, x.solicitanteId, x.usuarioId, x.userId].includes(perfilId);
          const s = String(x.status || "");
          const ligado = /aceit|aprov|ativ|pend|solic|aguard/i.test(s);
          return envolve && ligado;
        });
          setTreinoJunto(ativo || localStorage.getItem(storageKey) === "1");
        } else {
          setTreinoJunto(false);
        }
      } catch {
        setTreinoJunto(false);
      }
    })();
  }, [perfilId, isOwnProfile]);

  useEffect(() => {
    if (!podeObservar || isOwnProfile) return;
    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/observados`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const lista = r.ok ? await r.json() : [];
        setObservando(Array.isArray(lista) && lista.some((x: any) =>
          x?.id === perfilId || x?.usuarioId === perfilId
        ));
      } catch {
        setObservando(false);
      }
    })();
  }, [perfilId, podeObservar, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile || !perfilId) {
      setPodeObservar(false);
      return;
    }
    const token = Storage.token;
    if (!token) return;

    fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(perfilId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPodeObservar(data?.tipo === "Atleta"))
      .catch(() => setPodeObservar(false));
  }, [perfilId, isOwnProfile]);

  const iniciarChat = () => {
    const me = Storage.usuarioId;
    if (!me) { alert("Faça login para enviar mensagens."); return; }
    localStorage.setItem("mensagens_open_target", JSON.stringify({ tipo: "usuario", id: perfilId }));
    try {
      const key = "mensagens_recent_usuarios";
      const atual: Usuario[] = JSON.parse(localStorage.getItem(key) || "[]");
      const novo: Usuario = { id: perfilId, nome, foto: foto ?? avatar ?? null };
      const dedup = [novo, ...atual.filter(u => u.id !== novo.id)].slice(0, 50);
      localStorage.setItem(key, JSON.stringify(dedup));
    } catch {}
    window.location.href = "/mensagens";
  };

  useEffect(() => { setPontosTotal(pontuacao ?? 0); }, [pontuacao]);

  useEffect(() => {
    if (kpis && kpis.length) return;
    const token = Storage.token;
    if (!perfilId || !token) return;
    fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(perfilId)}/pontuacao`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const performance = Number(data.performance) || 0;
        const disciplina  = Number(data.disciplina)  || 0;
        const responsab   = Number(data.responsabilidade) || 0;
        setPontosTotal(performance + disciplina + responsab);
      })
      .catch(() => {});
  }, [perfilId, kpis]);

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

  async function deixarDeSeguir(alvoId: string) {
    const token = Storage.token;
    const r = await fetch(`${API.BASE_URL}/api/seguidores/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ seguidoUsuarioId: alvoId }),
    });
    return r.ok;
  }

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
    } catch {
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
    setSelecionados((prev) => {
      const novo = new Set(prev);
      novo.has(idUsuario) ? novo.delete(idUsuario) : novo.add(idUsuario);
      return novo;
    });
  };

  const enviarCompartilhamentoPorDM = async () => {
    if (selecionados.size === 0) { alert("Selecione ao menos uma pessoa."); return; }
    const token = Storage.token;
    if (!token) { alert("Faça login para compartilhar."); return; }
    try {
      setEnviandoDM(true);
      await Promise.all(
        Array.from(selecionados).map((paraId) =>
          fetch(`${API.BASE_URL}/api/mensagem`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paraId, conteudo: perfilId, tipo: "USUARIO" }),
          })
        )
      );
      alert("Perfil compartilhado por mensagem!");
      setModalAberto(false);
    } finally {
      setEnviandoDM(false);
    }
  };

  const imageSrc = formatarUrlFoto(foto ?? avatar, "usuarios");

  const alvoUsuarioId = isOwnProfile ? (Storage.usuarioId as string) : (idDaUrl as string);

  useEffect(() => {
    const token = Storage.token || localStorage.getItem("token") || sessionStorage.getItem("token") || "";
    if (!token) return;

    const load = () => {
      fetch(`${API.BASE_URL}/api/notificacoes/badge`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => setBadgeCount(d?.solicitacoes ?? 0))
        .catch(() => setBadgeCount(0));
    };

    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, []);


  useEffect(() => {
    if (!alvoUsuarioId) return;
    const token = Storage.token;
    if (!token) return;
    fetch(`${API.BASE_URL}/api/favoritos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((ids: string[]) => setEhFavorito(ids.includes(alvoUsuarioId)))
      .catch(() => {});
  }, [alvoUsuarioId]);

  async function toggleFavorito() {
    if (!alvoUsuarioId) return;
    const token = Storage.token;
    if (!token) { alert("Faça login para favoritar."); return; }
    await fetch(`${API.BASE_URL}/api/favoritos/${alvoUsuarioId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setEhFavorito(v => !v);
  }

  const seguirUsuario = async (): Promise<boolean> => {
    const token = Storage.token;
    const seguidorUsuarioId = Storage.usuarioId;
    if (!token || !seguidorUsuarioId) { alert("Faça login para seguir."); return false; }

    const resp = await fetch(`${API.BASE_URL}/api/seguidores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ seguidoUsuarioId: perfilId }),
    });

    if (resp.ok) return true;
    const body = await readBodySafe(resp);
    return isDuplicado(resp, body);
  };

const toggleSeguir = async () => {
  if (seguindo) {
    const ok = await deixarDeSeguir(perfilId);
    if (ok) setSeguindo(false);
    return;
  }
  const ok = await seguirUsuario();
  if (ok) setSeguindo(true);
};

const solicitarTreino = async (): Promise<boolean> => {
  const token = Storage.token;
  if (!token) { alert("Faça login para solicitar treino."); return false; }

  const resp = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ destinatarioId: perfilId }),
  });

  if (resp.ok) return true;
  const body = await readBodySafe(resp);
  return isDuplicado(resp, body);
};

const toggleTreino = async () => {
  if (treinoJunto) {
    const ok = await cancelarSolicitacaoTreino(perfilId);
    if (ok) {
      setTreinoJunto(false);
      localStorage.removeItem(storageKey);
    }
    return;
  }
  const ok = await solicitarTreino();
  if (ok) {
    setTreinoJunto(true);
    localStorage.setItem(storageKey, "1");
  }
};

const observarAtleta = async (): Promise<"ok"|"dup"|"auth"|"err"> => {
  const token = Storage.token;
  if (!token) return "auth";

  const resp = await fetch(`${API.BASE_URL}/api/observados`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ atletaUsuarioId: perfilId }),
  });

  if (resp.status === 201) return "ok";
  if (resp.status === 409) return "dup";
  if (resp.status === 401) return "auth";
  return "err";
};

const toggleObservar = async () => {
  if (observando) {
    const prev = observando;
    setObservando(false);
    const atletaId = await resolverAtletaIdObservadoAtual();
    if (!atletaId) { setObservando(prev); alert("Não foi possível identificar o vínculo."); return; }
    const del = await fetch(`${API.BASE_URL}/api/observados/${atletaId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${Storage.token}` },
    });
    if (!del.ok) setObservando(prev);
    return;
  }

  const prev = observando;
  setObservando(true);
  const r = await observarAtleta();
  if (r === "auth") { setObservando(prev); alert("Faça login novamente."); }
  if (r === "err")  { setObservando(prev); alert("Não foi possível observar agora."); }
  if (r === "dup")  { setObservando(true); }
};

  async function resolverAtletaIdObservadoAtual(): Promise<string | null> {
    const token = Storage.token;
    try {
      const r = await fetch(`${API.BASE_URL}/api/observados`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lista = r.ok ? await r.json() : [];

      const item = (Array.isArray(lista) ? lista : []).find((x: any) =>
        [x?.id, x?.usuarioId, x?.atletaUsuarioId].includes(perfilId)
      );

      return item?.atletaId ?? item?.idAtleta ?? item?.atleta?.id ?? null;
    } catch {
      return null;
    }
  }

  const btnBase =
  "rounded-full font-semibold focus:outline-none focus:ring-2 focus:ring-white/40 transition " +
  "inline-flex items-center justify-center gap-2";

  return (
    <div className="footera-bg-green p-6 flex flex-col items-center relative">
       {isOwnProfile && (
        <div>
          <div className="absolute top-4 left-4 flex gap-2">
            <Link href="/mensagens">
              <Button
                variant="ghost"
                size="icon"
                className="relative bg-white/10 hover:bg-white/20 text-white rounded-full"
                title="Mensagens"
              >
                <Mail />
                <Badge count={unreadDM} />
              </Button>
            </Link>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <Link href="/notificacoes">
              <Button
                variant="ghost"
                size="icon"
                className="relative bg-white/10 hover:bg-white/20 text-white rounded-full"
                title="Notificações"
              >
                <Bell />
                <Badge count={badgeCount} />
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
          {idade && `${idade} anos`}
          {idade && posicao ? " • " : ""}
          {posicao}
          {posicao && time ? " • " : ""}
          {time}
        </p>
      )}

      <div className="w-full mt-4">
        {kpis && kpis.length ? (
          <div className="grid grid-cols-3 gap-3">
            {kpis.map((k, i) => (
              <div key={i} className="rounded-xl bg-white/15 border border-footera-cream/40 p-3 text-center">
                <div className="footera-text-cream text-2xl font-bold">{k.value ?? 0}</div>
                <div className="footera-text-cream/80 text-xs mt-1">{k.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <h2 className="footera-text-cream text-center mb-2">{scoreTitle}</h2>
            <div className="footera-bg-green border border-footera-cream rounded-lg p-3 flex justify-center">
              <span className="footera-text-cream text-3xl font-bold">{pontosTotal} pts</span>
            </div>
          </>
        )}
      </div>

{!isOwnProfile && (
  <div className="w-full max-w-2xl px-3 mt-4 mb-2">
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        onClick={toggleFavorito}
        className={`text-xl sm:text-2xl ${ehFavorito ? "text-yellow-400" : "text-white/70"} px-2`}
        title={ehFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        aria-label={ehFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        ★
      </button>
      <button
        disabled={seguindo === null}
        aria-pressed={!!seguindo}
        onClick={toggleSeguir}
        className={`${btnBase} ${seguindo ? "bg-white/10 text-white border border-white/40" : "bg-green-600 text-green-900"}
                    px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
        title={seguindo ? "Deixar de seguir" : "Seguir"}
      >
        <UserPlus size={16} />
        <span className="truncate">{seguindo ? "Seguindo" : "Seguir"}</span>
      </button>

      <button
        onClick={iniciarChat}
        className={`${btnBase} bg-green-500 text-green-900 px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
      >
        <Send size={16} />
        <span className="truncate">Enviar mensagem</span>
      </button>
      
      <button
        disabled={treinoJunto === null}
        aria-pressed={!!treinoJunto}
        onClick={toggleTreino}
        className={`${btnBase} ${treinoJunto ? "bg-white/10 text-white border border-white/40" : "bg-green-400 text-green-900"}
                    px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
        title={treinoJunto ? "Cancelar treino em conjunto" : "Solicitar treino em conjunto"}
      >
        <Users size={16} />
        <span className="truncate">{treinoJunto ? "Já treino junto" : "Treinar juntos"}</span>
      </button>

      {podeObservar && (
        <button
          disabled={observando === null}
          aria-pressed={!!observando}
          onClick={toggleObservar}
          className={`${btnBase} ${observando ? "bg-white/10 text-white border border-white/40" : "bg-green-300 text-green-900"}
                      px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
          title={observando ? "Parar de observar" : "Observar este atleta"}
        >
          <Eye size={16} />
          <span className="truncate">{observando ? "Observando" : "Observar"}</span>
        </button>
      )}

      <button
        onClick={abrirModalCompartilhar}
        className={`${btnBase} bg-amber-300 text-green-900
                    px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
      >
        <Share2 size={16} />
        <span className="truncate">Compartilhar</span>
      </button>
    </div>
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
