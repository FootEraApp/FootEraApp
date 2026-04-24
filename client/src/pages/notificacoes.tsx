import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import { ArrowLeft, X } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav.js";

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
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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

function limparMensagem(mensagem: string) {
  return (mensagem || "")
    .replace(/\s*Acesse:\s*\/eventos\/[a-f0-9-]+\.?/gi, "")
    .replace(/\s*Acesse:\s*\/\S+/gi, "")
    .trim();
}

function isConvocacao(n: { titulo: string; mensagem: string }) {
  const t = `${n.titulo} ${n.mensagem}`.toLowerCase();
  return (
    t.includes("convoc") ||
    t.includes("você foi convoc") ||
    t.includes("voce foi convoc")
  );
}

const FALLBACK_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";

export default function PaginaNotificacoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [, setLocation] = useLocation();
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);

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
        alert("Não foi possível apagar a notificação agora.");
      }
    } catch (e) {
      setNotificacoes(prev);
      console.error("Erro ao apagar notificação:", e);
      alert("Erro ao apagar a notificação.");
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

  const seguirDeVolta = async (userToFollowId: string) => {
    const token = Storage.token;
    if (!token) return;

    try {
      const r = await fetch(`${API.BASE_URL}/api/seguidores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ seguidoUsuarioId: userToFollowId }),
      });

      if (!r.ok) {
        const txt = await r.text();
        alert(`Não foi possível seguir de volta (${r.status}): ${txt}`);
        return;
      }

      alert("Agora você também está seguindo essa pessoa ✅");
    } catch (e) {
      console.error(e);
      alert("Erro ao seguir de volta.");
    }
  };

  const removerSeguidor = async (seguidorUsuarioId: string) => {
    const token = Storage.token;
    if (!token) return;

    try {
      const r = await fetch(
        `${API.BASE_URL}/api/seguidores/seguidores/${encodeURIComponent(seguidorUsuarioId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!r.ok) {
        const txt = await r.text();
        alert(`Não foi possível remover seguidor (${r.status}): ${txt}`);
        return;
      }

      alert("Seguidor removido ✅");
    } catch (e) {
      console.error(e);
      alert("Erro ao remover seguidor.");
    }
  };

  const NOTIFS_BASE = `${API.BASE_URL}/api/notificacoes/me`;

  useEffect(() => {
    const token = Storage.token;
    if (!token) return;

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
      alert("Você precisa estar logado para responder a solicitação.");
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
    } catch (err) {
      console.error("Erro ao responder solicitação:", err);
      alert("Não foi possível processar a solicitação agora.");
    }
  };

  const irParaPerfil = (id: string) => setLocation(`/perfil/${id}`);

  return (
    <div className="max-w-xl mx-auto p-4 pb-24">
      <header className="bg-green-900 text-white rounded mb-4 px-3 py-3 flex items-center relative">
        <Link
          href="/perfil"
          aria-label="Voltar para perfil"
          className="inline-flex h-10 w-10 items-center justify-center
            rounded-full bg-white/10 text-white
            hover:bg-white/20 focus:outline-none
            focus:ring-2 focus:ring-white/30 z-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold pointer-events-none">
          Notificações
        </h1>
      </header>

      {notificacoes.length > 0 && (
        <div className="mb-6 space-y-3">
          {notificacoes.map((n) => {
            const data = formatarDataCurta((n as any).createdAt || (n as any).criadaEm || null);
            const msgLimpa = limparMensagem(n.mensagem || "");
            const ehConv = isConvocacao({
              titulo: n.titulo || "",
              mensagem: n.mensagem || "",
            });

            const isFollow = String(n.tipo || "").toUpperCase() === "FOLLOW";
            const actor = n.actor;
            const actorId = actor?.id || n.actorId || null;

            const actorFotoRaw = String(actor?.foto ?? "").trim();
            const actorFotoOk =
              actorFotoRaw &&
              actorFotoRaw !== "null" &&
              actorFotoRaw !== "undefined" &&
              actorFotoRaw !== "0";

            const actorFotoSrc = actorFotoOk
              ? formatarUrlFoto(actorFotoRaw, "usuarios")
              : FALLBACK_AVATAR;

            const actorLabel = actor?.nomeDeUsuario ? `@${actor.nomeDeUsuario}` : "Usuário";

            if (isFollow && actorId) {
              return (
                <div
                  key={n.id}
                  className="relative bg-white shadow-md rounded-2xl p-4 border border-green-200"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Apagar esta notificação?")) apagarNotificacao(n.id);
                    }}
                    className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full
                      bg-white hover:bg-gray-100 text-green-900 shadow"
                    aria-label="Apagar notificação"
                    title="Apagar"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-3 pr-10">
                    <img
                      src={actorFotoSrc}
                      alt={`Foto de ${actorLabel}`}
                      className="w-12 h-12 rounded-full object-cover bg-white"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement & { dataset: any };
                        if (img.dataset?.fallbackApplied) return;
                        img.dataset.fallbackApplied = "1";
                        img.src = FALLBACK_AVATAR;
                      }}
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

                            if (confirm("Deseja seguir essa pessoa de volta?")) {
                              await seguirDeVolta(actorId);
                            }
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

            const isIndicacaoOlheiro = String(n.tipo || "").toUpperCase() === "INDICACAO_OLHEIRO";
            const indicacaoId = getIndicacaoIdFromLink(n.link);
                    
            if (isIndicacaoOlheiro && indicacaoId) {
              return (
                <div
                  key={n.id}
                  className="relative bg-white shadow-md rounded-2xl p-4 border border-green-200"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Apagar esta notificação?")) apagarNotificacao(n.id);
                    }}
                    className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white hover:bg-gray-100 text-green-900 shadow"
                    aria-label="Apagar notificação"
                    title="Apagar"
                  >
                    <X className="h-4 w-4" />
                  </button>

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
                            alert("Não foi possível aceitar a indicação.");
                            return;
                          }

                          await marcarComoLida(n.id);
                          setNotificacoes((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x))
                          );
                          alert("Indicação aceita com sucesso.");
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
                            alert("Não foi possível recusar a indicação.");
                            return;
                          }

                          await marcarComoLida(n.id);
                          setNotificacoes((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x))
                          );
                          alert("Indicação recusada.");
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
                className={`relative bg-white shadow-md rounded-2xl p-4 border ${
                  isBillingBlocked
                    ? "border-red-300 bg-red-50"
                    : isBillingWarning
                    ? "border-yellow-300 bg-yellow-50"
                    : ehConv
                    ? "border-green-200"
                    : "border-transparent"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Apagar esta notificação?"))
                      apagarNotificacao(n.id);
                  }}
                  className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full
                  bg-white hover:bg-gray-100 text-green-900 shadow" 
                  aria-label="Apagar notificação"
                  title="Apagar"
                >
                  <X className="h-4 w-4" />
                </button>

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
                          {isBillingWarning || isBillingBlocked ? "Abrir pagamentos:" : "Visualizar o evento:"}
                        </p>
                        <Link
                          href={linkResolvido}
                          onClick={() => marcarComoLida(n.id)}
                          className="inline-flex mt-2 items-center justify-center rounded-lg bg-green-800
                            text-white text-sm px-4 py-2 hover:bg-green-900"
                        >
                          {isBillingWarning || isBillingBlocked ? "Abrir pagamentos" : "Abrir evento"}
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

      {solicitacoes.length === 0 && notificacoes.length === 0 ? (
        <p className="text-gray-500">Nenhuma notificação no momento.</p>
      ) : solicitacoes.length > 0 ? (
        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const fotoRaw = String(solicitacao.remetente?.foto ?? "").trim();
            const temFotoValida =
              fotoRaw &&
              fotoRaw !== "null" &&
              fotoRaw !== "undefined" &&
              fotoRaw !== "0";

            const fotoSrc = temFotoValida
              ? formatarUrlFoto(fotoRaw, "usuarios")
              : FALLBACK_AVATAR;

            const podeResponder =
              solicitacao.status === "pendente" ||
              solicitacao.status === "ativa";

            return (
              <div
                key={solicitacao.id}
                className="relative bg-white shadow-md rounded-xl p-4 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
                onClick={() => irParaPerfil(solicitacao.remetenteId)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Remover esta solicitação?")) {
                      responderSolicitacao(solicitacao.id, false);
                    }
                  }}
                  className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full
                  bg-white hover:bg-gray-100 text-green-900 shadow"
                  aria-label="Remover solicitação"
                  title="Remover"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-4 pr-10">
                  <img
                    src={fotoSrc}
                    alt={`Foto de ${solicitacao.remetente.nomeDeUsuario}`}
                    className="w-12 h-12 rounded-full object-cover bg-white"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement & {
                        dataset: any;
                      };
                      if (img.dataset?.fallbackApplied) return;
                      img.dataset.fallbackApplied = "1";
                      img.src = FALLBACK_AVATAR;
                    }}
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

      <BottomNav />
    </div>
  );
}