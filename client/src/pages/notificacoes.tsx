// client/src/pages/notificacoes
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import {
  ArrowLeft,
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
} from "lucide-react";
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
  criadaEm?: string | null;
  lida?: boolean | null;
};

function formatarDataCurta(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function limparMensagem(mensagem: string) {
  return (mensagem || "")
    .replace(/\s*Acesse:\s*\/eventos\/[a-f0-9-]+\.?/gi, "")
    .replace(/\s*Acesse:\s*\/\S+/gi, "")
    .trim();
}

function isConvocacao(n: { titulo: string; mensagem: string }) {
  const t = `${n.titulo} ${n.mensagem}`.toLowerCase();
  return t.includes("convoc") || t.includes("você foi convoc") || t.includes("voce foi convoc");
}

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
          {
            headers: { Authorization: `Bearer ${token}` },
          }
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

  const marcarComoLida = async (notifId: string) => {
              const token = Storage.token;
              if (!token) return;

              setNotificacoes((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, lida: true } : n))
              );

              try {
                const r = await fetch(`${API.BASE_URL}/api/notificacoes/${encodeURIComponent(notifId)}/lida`, {
                  method: "PATCH",
                  headers: { Authorization: `Bearer ${token}` },
                });

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
        console.log("NOTIFS:", json?.items);

        setNotificacoes(Array.isArray(json?.items) ? json.items : []);
      } catch (e) {
        console.error("Erro ao buscar notificações", e);
      }
    })();
  }, []);

  useEffect(() => {
    const temFlagLida = notificacoes.some((n) => typeof n?.lida === "boolean");
    const naoLidas = notificacoes.filter((n) => n?.lida === false).length;
    const qtdNotifs = temFlagLida ? naoLidas : notificacoes.length;
    const totalNotificacoes = qtdNotifs + solicitacoes.length;

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
            const data = formatarDataCurta(n.criadaEm || null);
            const msgLimpa = limparMensagem(n.mensagem || "");
            const ehConv = isConvocacao({ titulo: n.titulo || "", mensagem: n.mensagem || "" });

            return (
              <div
                key={n.id}
                className={`bg-white shadow-md rounded-2xl p-4 border ${
                  ehConv ? "border-green-200" : "border-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
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
                      <p className="text-xs text-gray-500 mt-0.5">
                        {data}
                      </p>
                    )}

                    {!!msgLimpa && (() => {
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

                    {n.link && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-700">
                            Visualizar o evento:{" "}
                        </p>
                        <Link
                          href={n.link}
                          onClick={() => marcarComoLida(n.id)}
                          className="inline-flex mt-2 items-center justify-center rounded-lg bg-green-800
                            text-white text-sm px-4 py-2 hover:bg-green-900"
                        >
                          Abrir evento
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

      {solicitacoes.length === 0 ? (
        <p className="text-gray-500">Nenhuma solicitação no momento.</p>
      ) : (
        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const foto = solicitacao.remetente?.foto;
            const fotoSrc = foto ? formatarUrlFoto(foto, "usuarios") : "";

            const podeResponder =
              solicitacao.status === "pendente" ||
              solicitacao.status === "ativa";

            return (
              <div
                key={solicitacao.id}
                className="bg-white shadow-md rounded-xl p-4 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
                onClick={() => irParaPerfil(solicitacao.remetenteId)}
              >
                <div className="flex items-center gap-4">
                  {foto ? (
                    <img
                      src={fotoSrc}
                      alt={`Foto de ${solicitacao.remetente.nomeDeUsuario}`}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center">
                      {(solicitacao.remetente.nomeDeUsuario || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

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
      )}

      <BottomNav />

    </div>
  );
}
