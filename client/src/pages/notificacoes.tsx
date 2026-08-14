import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft, X } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav.js";
import Avatar from "../components/shared/Avatar.js";
import { toast } from "@/lib/toast";

type StatusSolicitacao = "pendente" | "ativa";

interface Solicitacao {
  id: string;
  remetenteId: string;
  status: StatusSolicitacao;
  criadaEm?: string;
  remetente: {
    id: string;
    nomeDeUsuario: string;
    foto: string | null;
  };
}

type NotificacaoItem = {
  id: string;
  titulo: string;
  mensagem: string;
  link?: string | null;
  createdAt?: string | null;
  lida?: boolean | null;
  tipo?: string | null;
  actorId?: string | null;
  actor?: {
    id: string;
    nomeDeUsuario: string;
    nome?: string | null;
    foto?: string | null;
  } | null;
};

function formatarDataCurta(iso?: string | null) {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function getIndicacaoIdFromLink(link?: string | null) {
  if (!link) return null;
  try {
    const full = link.startsWith("http")
      ? new URL(link)
      : new URL(link, window.location.origin);
    return full.searchParams.get("indicacaoId");
  } catch {
    return null;
  }
}

function getColaboracaoIdFromLink(
  link?: string | null
) {
  if (!link) {
    return null;
  }

  try {
    const full =
      link.startsWith("http")
        ? new URL(link)
        : new URL(
            link,
            window.location.origin
          );

    return full.searchParams.get(
      "colaboracaoId"
    );
  } catch {
    return null;
  }
}

function limparMensagem(mensagem: string) {
  return (mensagem || "")
    .replace(/\s*Acesse:\s*\/eventos\/[a-f0-9-]+\.?/gi, "")
    .replace(/\s*Acesse:\s*\/\S+/gi, "")
    .trim();
}

function isConvocacao(n: { tipo?: string | null; titulo: string; mensagem: string }) {
  if (String(n.tipo || "").toUpperCase() === "CONVOCACAO") return true;
  const t = `${n.titulo} ${n.mensagem}`.toLowerCase();
  return t.includes("convoc");
}

export default function PaginaNotificacoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [, setLocation] = useLocation();
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [apagandoSelecionadas, setApagandoSelecionadas] = useState(false);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingDeleteSolicitacao, setPendingDeleteSolicitacao] = useState<string | null>(null);
  const [confirmandoApagarLote, setConfirmandoApagarLote] = useState(false);
  const [pendingSeguirDeVolta, setPendingSeguirDeVolta] = useState<{ actorId: string; actorLabel: string } | null>(null);

  useEffect(() => {
    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const resp = await fetch(
          `${API.BASE_URL}/api/solicitacoes-treino/recebidas`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(
            `GET /solicitacoes-treino/recebidas falhou (${resp.status}): ${txt}`
          );
        }

        const data: Solicitacao[] = await resp.json();
        setSolicitacoes(data);
      } catch (err) {
        console.error("Erro ao buscar solicitações:", err);
      }
    })();
  }, []);

  const apagarNotificacao = async (notifId: string) => {
    const token = Storage.token;
    if (!token) return;

    const prev = notificacoes;

    setNotificacoes((p) => p.filter((n) => n.id !== notifId));
    setSelecionadas((prevSel) => {
      const next = new Set(prevSel);
      next.delete(notifId);
      return next;
    });

    try {
      const r = await fetch(
        `${API.BASE_URL}/api/notificacoes/${encodeURIComponent(notifId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!r.ok) {
        setNotificacoes(prev);
        console.warn("Falha ao apagar notificação:", r.status, await r.text());
        toast.error("Não foi possível apagar a notificação agora.");
      }
    } catch (e) {
      setNotificacoes(prev);
      console.error("Erro ao apagar notificação:", e);
      toast.error("Erro ao apagar a notificação.");
    }
  };

  const marcarComoLida = async (notifId: string) => {
    const token = Storage.token;
    if (!token) return;

    setNotificacoes((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, lida: true } : n))
    );

    try {
      const r = await fetch(
        `${API.BASE_URL}/api/notificacoes/${encodeURIComponent(notifId)}/lida`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!r.ok) {
        setNotificacoes((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, lida: false } : n))
        );
        console.warn("Falha ao marcar como lida:", r.status, await r.text());
      }
    } catch (e) {
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, lida: false } : n))
      );
      console.error("Erro ao marcar como lida:", e);
    }
  };

  const seguirDeVolta =
    async (
      userToFollowId: string
    ) => {
      const token =
        Storage.token;

      if (!token) return;

      try {
        const r = await fetch(
          `${API.BASE_URL}/api/seguidores`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              seguidoUsuarioId:
                userToFollowId,
            }),
          }
        );

        const data =
          await r
            .json()
            .catch(() => ({}));

        if (!r.ok) {
          toast.error(
            data?.error ||
              "Não foi possível seguir de volta."
          );

          return;
        }

        if (
          data?.pendente === true
        ) {
          toast.success(
            "Solicitação enviada!"
          );
        } else {
          toast.success(
            "Agora você também está seguindo essa pessoa!"
          );
        }
      } catch (e) {
        console.error(e);

        toast.error(
          "Erro ao seguir de volta."
        );
      }
    };

  const NOTIFS_BASE = `${API.BASE_URL}/api/notificacoes/me`;

  useEffect(() => {
    const token = Storage.token;
    if (!token) {
      setLoadingNotificacoes(false);
      return;
    }

    (async () => {
      try {
        const r = await fetch(NOTIFS_BASE, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!r.ok) {
          console.warn("GET /notificacoes/me falhou:", r.status, await r.text());
          return;
        }

        const json = await r.json();
        const items: NotificacaoItem[] = Array.isArray(json?.items)
          ? json.items
          : [];

        setNotificacoes(items);
      } catch (e) {
        console.error("Erro ao buscar notificações", e);
      } finally {
        setLoadingNotificacoes(false);
      }
    })();
  }, []);

  useEffect(() => {
    const naoLidas = (notificacoes || []).filter((n) => n.lida === false).length;
    const totalNotificacoes = naoLidas + (solicitacoes?.length || 0);

    window.dispatchEvent(
      new CustomEvent("badge:update", { detail: totalNotificacoes })
    );
  }, [notificacoes, solicitacoes]);

  const responderSolicitacao = async (id: string, aceitar: boolean) => {
    const token = Storage.token;
    if (!token) {
      toast.error("Você precisa estar logado.");
      return;
    }

    try {
      const url = `${API.BASE_URL}/api/solicitacoes-treino/${id}/${
        aceitar ? "aceitar" : "recusar"
      }`;

      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(
          `Falha ao ${aceitar ? "aceitar" : "recusar"} (HTTP ${
            resp.status
          }): ${txt}`
        );
      }

      setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
      window.dispatchEvent(new Event("footera:vinculo-treino-alterado"));
    } catch (err) {
      console.error("Erro ao responder solicitação:", err);
      toast.error("Não foi possível processar a solicitação agora.");
    }
  };

  const responderColaboracaoOlheiro =
    async (
      solicitacaoId: string,
      aceitar: boolean,
      notificacaoId: string
    ) => {
      const token =
        Storage.token;

      if (!token) {
        toast.error(
          "Você precisa estar logado."
        );
        return;
      }

      try {
        const acao =
          aceitar
            ? "aceitar"
            : "recusar";

        const resp =
          await fetch(
            `${API.BASE_URL}/api/olheiros/colaboracao/solicitacoes/${encodeURIComponent(
              solicitacaoId
            )}/${acao}`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await resp
            .json()
            .catch(
              () => ({})
            );

        if (!resp.ok) {
          toast.error(
            data?.error ||
              "Não foi possível responder à solicitação."
          );

          return;
        }

        setNotificacoes(
          (prev) =>
            prev.filter(
              (n) =>
                n.id !==
                notificacaoId
            )
        );

        toast.success(
          aceitar
            ? "Colaboração aceita!"
            : "Colaboração recusada."
        );
      } catch (e) {
        console.error(
          "Erro ao responder colaboração:",
          e
        );

        toast.error(
          "Não foi possível responder à solicitação."
        );
      }
    };

  const irParaPerfil = (id: string) => setLocation(`/perfil/${id}`);
  const notificacoesSelecionaveis =
    notificacoes.filter(
      (n) =>
        String(
          n.tipo || ""
        ).toUpperCase() !==
        "COLABORACAO_OLHEIRO"
    );

  const totalSelecionadas =
    selecionadas.size;

  const todasSelecionadas =
    notificacoesSelecionaveis.length >
      0 &&
    notificacoesSelecionaveis.every(
      (n) =>
        selecionadas.has(n.id)
    );

  const alternarSelecao = (notifId: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);

      if (next.has(notifId)) {
        next.delete(notifId);
      } else {
        next.add(notifId);
      }

      return next;
    });
  };

  const selecionarTodas = () => {
    setSelecionadas(
      new Set(
        notificacoesSelecionaveis.map(
          (n) => n.id
        )
      )
    );
  };

  const limparSelecao = () => {
    setSelecionadas(new Set());
  };

  const sairModoSelecao = () => {
    setModoSelecao(false);
    limparSelecao();
    setConfirmandoApagarLote(false);
  };

  const marcarTodasComoLidas = async () => {
    const token = Storage.token;
    if (!token) return;

    const estadoAnterior = notificacoes;
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));

    try {
      const r = await fetch(`${API.BASE_URL}/api/notificacoes/me/lidas`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) {
        setNotificacoes(estadoAnterior);
        toast.error("Não foi possível marcar as notificações como lidas.");
      }
    } catch (e) {
      setNotificacoes(estadoAnterior);
      console.error("Erro ao marcar todas como lidas:", e);
    }
  };

  const apagarNotificacoesSelecionadas = async () => {
    const token = Storage.token;
    if (!token) return;

    const ids =
      Array.from(
        selecionadas
      ).filter((id) => {
        const notificacao =
          notificacoes.find(
            (n) => n.id === id
          );

        return (
          String(
            notificacao?.tipo || ""
          ).toUpperCase() !==
          "COLABORACAO_OLHEIRO"
        );
      });

    const prevNotificacoes = notificacoes;
    const prevSelecionadas = selecionadas;

    setApagandoSelecionadas(true);
    setNotificacoes((prev) => prev.filter((n) => !prevSelecionadas.has(n.id)));
    setSelecionadas(new Set());

    try {
      const r = await fetch(`${API.BASE_URL}/api/notificacoes/lote`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });

      if (!r.ok) {
        setNotificacoes(prevNotificacoes);
        setSelecionadas(prevSelecionadas);

        console.warn(
          "Falha ao apagar notificações selecionadas:",
          r.status,
          await r.text()
        );

        toast.error("Não foi possível apagar as notificações selecionadas agora.");
        return;
      }

      setModoSelecao(false);
      setConfirmandoApagarLote(false);
    } catch (e) {
      setNotificacoes(prevNotificacoes);
      setSelecionadas(prevSelecionadas);
      console.error("Erro ao apagar notificações selecionadas:", e);
      toast.error("Erro ao apagar as notificações selecionadas.");
    } finally {
      setApagandoSelecionadas(false);
    }
  };

  const BotaoSelecaoNotificacao = ({ id }: { id: string }) => {
    if (!modoSelecao) return null;

    const marcada = selecionadas.has(id);

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          alternarSelecao(id);
        }}
        className={`absolute top-3 left-3 h-7 w-7 rounded-full border-2 flex items-center justify-center ${
          marcada
            ? "bg-green-800 border-green-800 text-white"
            : "bg-white border-green-800 text-transparent"
        }`}
        aria-label={marcada ? "Remover da seleção" : "Selecionar notificação"}
        title={marcada ? "Remover da seleção" : "Selecionar"}
      >
        ✓
      </button>
    );
  };

  const BotaoApagarNotificacao = ({
    id,
  }: {
    id: string;
  }) => {
    if (pendingDelete === id) {
      return (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              apagarNotificacao(id);
              setPendingDelete(null);
            }}
            className="h-7 px-2 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
          >
            Apagar
          </button>

          <button
            type="button"
            onClick={() =>
              setPendingDelete(null)
            }
            className="h-7 px-2 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300"
          >
            Não
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() =>
          setPendingDelete(id)
        }
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white hover:bg-gray-100 text-green-900 shadow"
        aria-label="Apagar notificação"
        title="Apagar"
      >
        <X className="h-4 w-4" />
      </button>
    );
  };

  const BotaoApagarSolicitacao = ({ id }: { id: string }) => {
    if (pendingDeleteSolicitacao === id) {
      return (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => { responderSolicitacao(id, false); setPendingDeleteSolicitacao(null); }}
            className="h-7 px-2 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
          >
            Remover
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteSolicitacao(null)}
            className="h-7 px-2 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300"
          >
            Não
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPendingDeleteSolicitacao(id); }}
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white hover:bg-gray-100 text-green-900 shadow"
        aria-label="Remover solicitação"
        title="Remover"
      >
        <X className="h-4 w-4" />
      </button>
    );
  };

  return (
    <div
      className="max-w-xl mx-auto p-4"
      style={{
        paddingBottom:
          "calc(110px + env(safe-area-inset-bottom))",
      }}
    >

      {pendingSeguirDeVolta && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-900">
            Deseja seguir <strong>{pendingSeguirDeVolta.actorLabel}</strong> de volta?
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              className="rounded-lg bg-green-700 text-white text-xs px-3 py-1.5 hover:bg-green-800"
              onClick={async () => {
                await seguirDeVolta(pendingSeguirDeVolta.actorId);
                setPendingSeguirDeVolta(null);
              }}
            >
              Seguir
            </button>
            <button
              className="rounded-lg bg-gray-200 text-gray-700 text-xs px-3 py-1.5 hover:bg-gray-300"
              onClick={() => setPendingSeguirDeVolta(null)}
            >
              Não
            </button>
          </div>
        </div>
      )}

      <header className="bg-green-900 text-white rounded mb-4 px-3 py-3 flex items-center justify-between gap-3">
        <Link
          href="/perfil"
          aria-label="Voltar para perfil"
          className="inline-flex h-10 w-10 items-center justify-center
            rounded-full bg-white/10 text-white
            hover:bg-white/20 focus:outline-none
            focus:ring-2 focus:ring-white/30 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="text-xl font-bold flex-1 text-center">
          Notificações
        </h1>

        {notificacoesSelecionaveis.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (modoSelecao) {
                sairModoSelecao();
              } else {
                setModoSelecao(true);
              }
            }}
            className="h-9 px-3 rounded-full bg-white/10 text-white text-xs font-semibold
              hover:bg-white/20 border border-white/20 shrink-0"
          >
            {modoSelecao ? "Cancelar" : "Selecionar notificações"}
          </button>
        ) : (
          <div className="w-[84px] shrink-0" />
        )}
      </header>

      {!modoSelecao && notificacoes.some((n) => n.lida === false) && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={marcarTodasComoLidas}
            className="text-xs text-green-800 underline underline-offset-2 hover:text-green-900"
          >
            Marcar todas como lidas
          </button>
        </div>
      )}

      {modoSelecao && notificacoesSelecionaveis.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={todasSelecionadas ? limparSelecao : selecionarTodas}
            className="rounded-full border border-green-800 bg-white px-3 py-1.5 text-xs font-semibold text-green-900"
          >
            {todasSelecionadas ? "Limpar" : "Todas"}
          </button>

          <p className="text-xs font-semibold text-green-900">
            {totalSelecionadas} selecionada(s)
          </p>

          {confirmandoApagarLote ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={apagandoSelecionadas}
                onClick={apagarNotificacoesSelecionadas}
                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {apagandoSelecionadas ? "Apagando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoApagarLote(false)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={totalSelecionadas === 0 || apagandoSelecionadas}
              onClick={() => setConfirmandoApagarLote(true)}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Apagar
            </button>
          )}
        </div>
      )}

      {notificacoes.length > 0 && (
        <div className="mb-6 space-y-3">
          {notificacoes.map((n) => {
            const data = formatarDataCurta((n as any).createdAt || (n as any).criadaEm || null);
            const msgLimpa = limparMensagem(n.mensagem || "");
            const ehConv = isConvocacao({
              tipo: n.tipo,
              titulo: n.titulo || "",
              mensagem: n.mensagem || "",
            });

            const isFollow = String(n.tipo || "").toUpperCase() === "FOLLOW";
            const actor = n.actor;
            const actorId = actor?.id || n.actorId || null;
            const actorLabel = actor?.nomeDeUsuario ? `@${actor.nomeDeUsuario}` : "Usuário";

            if (isFollow && actorId) {
              return (
                <div
                  key={n.id}
                  className={`relative z-0 bg-white shadow-md rounded-2xl p-4 ${
                    modoSelecao ? "pl-12" : ""
                  } border border-green-200`}
                >
                  <BotaoSelecaoNotificacao id={n.id} />
                  <BotaoApagarNotificacao id={n.id} />

                  <div className="flex items-center gap-3 pr-10">
                    <Avatar
                      foto={n.actor?.foto}
                      alt={`Foto de ${actorLabel}`}
                      className="w-12 h-12 bg-white"
                    />

                    <div className="flex-1">
                      <p className="font-semibold text-green-900 flex items-center gap-2">
                        {n.titulo || "Novo seguidor"}
                        {n.lida === false && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Novo
                          </span>
                        )}
                      </p>

                      {!!data && <p className="text-xs text-gray-500 mt-0.5">{data}</p>}

                      <p className="text-sm text-gray-700 mt-2">
                        {actorLabel} quer te seguir
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="rounded-lg bg-green-800 text-white text-sm px-4 py-2 hover:bg-green-900"
                          onClick={async () => {
                            await marcarComoLida(n.id);
                            setLocation(`/perfil/${actorId}`);
                          }}
                        >
                          Ver perfil
                        </button>

                        <button
                          className="rounded-lg bg-green-600 text-white text-sm px-4 py-2 hover:bg-green-700"
                          onClick={async () => {
                            const token = Storage.token;
                            if (!token) return;

                            await fetch(`${API.BASE_URL}/api/seguidores/aceitar`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                notificacaoId: n.id,
                                seguidorUsuarioId: actorId,
                              }),
                            });

                            setNotificacoes((prev) => prev.filter((x) => x.id !== n.id));
                            setPendingSeguirDeVolta({ actorId, actorLabel });
                          }}
                        >
                          Aceitar
                        </button>

                        <button
                          className="rounded-lg bg-red-600 text-white text-sm px-4 py-2 hover:bg-red-700"
                          onClick={async () => {
                            const token = Storage.token;
                            if (!token) return;

                            await fetch(`${API.BASE_URL}/api/seguidores/recusar`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                notificacaoId: n.id,
                                seguidorUsuarioId: actorId,
                              }),
                            });

                            setNotificacoes((prev) => prev.filter((x) => x.id !== n.id));
                          }}
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const isBillingWarning = String(n.tipo || "").toLowerCase() === "billing_warning";
            const isBillingBlocked = String(n.tipo || "").toLowerCase() === "billing_blocked";

            const linkResolvido =
              (isBillingWarning || isBillingBlocked) && n.link === "/assinatura"
                ? "/pagamentos"
                : n.link;

            const tipoNotificacao = String(n.tipo || "").toUpperCase();
            const linkStr = String(linkResolvido || "");
            const tituloStr = String(n.titulo || "").toLowerCase();
            const mensagemStr = String(n.mensagem || "").toLowerCase();

            const isTreinoNotif =
              tipoNotificacao.includes("TREINO") ||
              linkStr.startsWith("/treinos") ||
              linkStr.includes("/treino") ||
              tituloStr.includes("treino") ||
              mensagemStr.includes("treino");

            const isMensagemNotif =
              tipoNotificacao.includes("MENSAGEM") ||
              linkStr.startsWith("/mensagens") ||
              tituloStr.includes("mensagem");

            const isPerfilNotif =
              linkStr.startsWith("/perfil");

            const isLearningNotif =
              linkStr.startsWith("/learning") ||
              tituloStr.includes("aula ao vivo") ||
              mensagemStr.includes("aula ao vivo");

            const textoAcao = isBillingWarning || isBillingBlocked
              ? "Abrir pagamentos:"
              : isTreinoNotif
              ? "Visualizar treino:"
              : isMensagemNotif
              ? "Visualizar mensagem:"
              : isPerfilNotif
              ? "Visualizar perfil:"
              : isLearningNotif
              ? "Visualizar aula:"
              : "Visualizar o evento:";

            const textoBotao = isBillingWarning || isBillingBlocked
              ? "Abrir pagamentos"
              : isTreinoNotif
              ? "Abrir treino"
              : isMensagemNotif
              ? "Abrir mensagem"
              : isPerfilNotif
              ? "Abrir perfil"
              : isLearningNotif
              ? "Abrir aula"
              : "Abrir evento";

            const isColaboracaoOlheiro =
              String(
                n.tipo || ""
              ).toUpperCase() ===
              "COLABORACAO_OLHEIRO";

            const colaboracaoId =
              getColaboracaoIdFromLink(
                n.link
              );

            if (
              isColaboracaoOlheiro &&
              colaboracaoId
            ) {
              return (
                <div
                  key={n.id}
                  className="
                    relative
                    bg-white
                    shadow-md
                    rounded-2xl
                    p-4
                    border
                    border-green-200
                  "
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      foto={
                        n.actor?.foto
                      }
                      alt={
                        n.actor
                          ?.nome ||
                        n.actor
                          ?.nomeDeUsuario ||
                        "Olheiro"
                      }
                      className="w-12 h-12 bg-white"
                    />

                    <div className="flex-1">
                      <p className="font-semibold text-green-900 flex items-center gap-2">
                        {n.titulo ||
                          "Pedido de colaboração"}

                        {n.lida ===
                          false && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Novo
                          </span>
                        )}
                      </p>

                      {!!data && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {data}
                        </p>
                      )}

                      <p className="text-sm text-gray-700 mt-2">
                        {limparMensagem(
                          n.mensagem ||
                            ""
                        )}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {actorId && (
                          <button
                            type="button"
                            className="
                              rounded-lg
                              border
                              border-green-200
                              bg-white
                              text-green-900
                              text-sm
                              px-4
                              py-2
                              hover:bg-green-50
                            "
                            onClick={() =>
                              setLocation(
                                `/perfil/${actorId}`
                              )
                            }
                          >
                            Ver perfil
                          </button>
                        )}

                        <button
                          type="button"
                          className="
                            rounded-lg
                            bg-green-600
                            text-white
                            text-sm
                            px-4
                            py-2
                            hover:bg-green-700
                          "
                          onClick={() =>
                            responderColaboracaoOlheiro(
                              colaboracaoId,
                              true,
                              n.id
                            )
                          }
                        >
                          Aceitar
                        </button>

                        <button
                          type="button"
                          className="
                            rounded-lg
                            bg-red-600
                            text-white
                            text-sm
                            px-4
                            py-2
                            hover:bg-red-700
                          "
                          onClick={() =>
                            responderColaboracaoOlheiro(
                              colaboracaoId,
                              false,
                              n.id
                            )
                          }
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            const isIndicacaoOlheiro = String(n.tipo || "").toUpperCase() === "INDICACAO_OLHEIRO";
            const indicacaoId = getIndicacaoIdFromLink(n.link);

            if (isIndicacaoOlheiro && indicacaoId) {
              return (
                <div
                  key={n.id}
                  className={`relative z-0 bg-white shadow-md rounded-2xl p-4 ${
                    modoSelecao ? "pl-12" : ""
                  } border border-green-200`}
                >
                  <BotaoSelecaoNotificacao id={n.id} />
                  <BotaoApagarNotificacao id={n.id} />

                  <div className="pr-10">
                    <p className="font-semibold text-green-900 flex items-center gap-2">
                      {n.titulo || "Nova indicação"}
                      {n.lida === false && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Novo
                        </span>
                      )}
                    </p>

                    {!!data && <p className="text-xs text-gray-500 mt-0.5">{data}</p>}

                    <p className="text-sm text-gray-700 mt-2">
                      {limparMensagem(n.mensagem || "")}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-lg bg-green-600 text-white text-sm px-4 py-2 hover:bg-green-700"
                        onClick={async () => {
                          const token = Storage.token;
                          if (!token) return;

                          const r = await fetch(`${API.BASE_URL}/api/indicacoes/${encodeURIComponent(indicacaoId)}/status`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ status: "APROVADA" }),
                          });

                          if (!r.ok) {
                            toast.error("Não foi possível aceitar a indicação.");
                            return;
                          }

                          await marcarComoLida(n.id);
                          setNotificacoes((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x))
                          );
                          toast.success("Indicação aceita com sucesso.");
                        }}
                      >
                        Aceitar
                      </button>

                      <button
                        className="rounded-lg bg-red-600 text-white text-sm px-4 py-2 hover:bg-red-700"
                        onClick={async () => {
                          const token = Storage.token;
                          if (!token) return;

                          const r = await fetch(`${API.BASE_URL}/api/indicacoes/${encodeURIComponent(indicacaoId)}/status`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ status: "REJEITADA" }),
                          });

                          if (!r.ok) {
                            toast.error("Não foi possível recusar a indicação.");
                            return;
                          }

                          await marcarComoLida(n.id);
                          setNotificacoes((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x))
                          );
                          toast.success("Indicação recusada.");
                        }}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={n.id}
                className={`relative z-0 bg-white shadow-md rounded-2xl p-4 ${
                  modoSelecao ? "pl-12" : ""
                } border ${
                  isBillingBlocked
                    ? "border-red-300 bg-red-50"
                    : isBillingWarning
                    ? "border-yellow-300 bg-yellow-50"
                    : ehConv
                    ? "border-green-200"
                    : "border-transparent"
                }`}
              >
                <BotaoSelecaoNotificacao id={n.id} />
                <BotaoApagarNotificacao id={n.id} />

                <div className="flex items-start gap-3">
                  <div className="flex-1 pr-10">
                    <p className="font-semibold text-green-900 flex items-center gap-2">
                      {n.titulo}
                      {ehConv && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          Convocação
                        </span>
                      )}
                      {n.lida === false && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Novo
                        </span>
                      )}
                    </p>

                    {!!data && (
                      <p className="text-xs text-gray-500 mt-0.5">{data}</p>
                    )}

                    {!!msgLimpa &&
                      (() => {
                        const parts = msgLimpa.split(/Data\/Hora:\s*/i);
                        const texto = (parts[0] || "").trim();
                        const dataHora = (parts[1] || "").trim();

                        return (
                          <div className="text-sm text-gray-700 mt-2 leading-relaxed space-y-2">
                            {!!texto && <p>{texto}</p>}
                            {!!dataHora && (
                              <p>
                                <strong>Data/Hora:</strong> {dataHora}
                              </p>
                            )}
                          </div>
                        );
                      })()}

                    {linkResolvido && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-700">
                          {textoAcao}
                        </p>

                        <Link
                          href={linkResolvido}
                          onClick={() => marcarComoLida(n.id)}
                          className="inline-flex mt-2 items-center justify-center rounded-lg bg-green-800
                            text-white text-sm px-4 py-2 hover:bg-green-900"
                        >
                          {textoBotao}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loadingNotificacoes ? (
        <p className="text-gray-400 text-sm">Carregando notificações...</p>
      ) : solicitacoes.length === 0 && notificacoes.length === 0 ? (
        <p className="text-gray-500">Nenhuma notificação no momento.</p>
      ) : solicitacoes.length > 0 ? (
        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const podeResponder =
              solicitacao.status === "pendente" ||
              solicitacao.status === "ativa";

            return (
              <div
                key={solicitacao.id}
                className="relative z-0 bg-white shadow-md rounded-xl p-4 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
                onClick={() => irParaPerfil(solicitacao.remetenteId)}
              >
                <BotaoApagarSolicitacao id={solicitacao.id} />

                <div className="flex items-center gap-4 pr-10">
                  <Avatar
                    foto={solicitacao.remetente.foto}
                    alt={`Foto de ${solicitacao.remetente.nomeDeUsuario}`}
                    className="w-12 h-12 bg-white"
                  />

                  <div>
                    <p className="font-semibold">
                      {solicitacao.remetente.nomeDeUsuario}
                    </p>
                    <p className="text-sm text-gray-600">
                      {solicitacao.status === "pendente"
                        ? "quer treinar junto com você"
                        : "solicitação ativa — responda"}
                    </p>
                  </div>
                </div>

                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {podeResponder && (
                    <>
                      <button
                        className="bg-green-500 hover:bg-green-600 text-white rounded px-3 py-1"
                        onClick={() =>
                          responderSolicitacao(solicitacao.id, true)
                        }
                      >
                        Aceitar
                      </button>
                      <button
                        className="bg-red-500 hover:bg-red-600 text-white rounded px-3 py-1"
                        onClick={() =>
                          responderSolicitacao(solicitacao.id, false)
                        }
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <BottomNav active="notificacoes" />
    </div>
  );
}
