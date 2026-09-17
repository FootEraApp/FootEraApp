import {
  useEffect,
  useState,
} from "react";
import axios from "axios";
import {
  useLocation,
} from "wouter";
import {
  API,
} from "../config.js";
import {
  EventoTipo,
  labelEventoTipo,
} from "@/utils/eventos.js";
import {
  useAuthGate,
} from "../context/AuthGateContext.js";
import {
  lerAcaoPendenteAuth,
  limparAcaoPendenteAuth,
} from "../utils/authSession.js";
import {
  toast,
} from "@/lib/toast";

type Evento = {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  descricao?: string | null;
  dataEvento: string;
  inscricaoInicio?: string | null;
  inscricaoFim?: string | null;
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
  vagas?: number | null;
  valorInscricao?: number | string | null;
  requisitos?: string[] | null;
  clubeId?: string | null;
  escolinhaId?: string | null;
  creatorUsuarioId?: string | null;

  totalInscritos?: number;
  vagasDisponiveis?: number | null;

  inscrito?: boolean;
  inscricaoStatus?: string | null;

  inscricoesAbertas?: boolean;
  podeGerenciar?: boolean;

  organizador?: {
    tipo: string;
    id: string;
    nome: string;
    logo?: string | null;
    nomeDeUsuario?: string | null;
  } | null;

  status?:
    | "ABERTO"
    | "ENCERRADO"
    | "CANCELADO";

  linkInscricao?: string | null;
};


function lerToken() {
  if (
    typeof window === "undefined"
  ) {
    return "";
  }

  return (
    localStorage.getItem(
      "token"
    ) ||
    sessionStorage.getItem(
      "token"
    ) ||
    ""
  );
}

export default function PaginaEventoDetalhe({
  eventoId,
}: {
  eventoId: string;
}) {
  const [, navigate] =
    useLocation();

  const {
    requireAuth,
  } = useAuthGate();

  const token =
    lerToken();

  const [ev, setEv] =
    useState<Evento | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    participando,
    setParticipando,
  ] = useState(false);

  useEffect(() => {
    if (!eventoId) {
      setLoading(false);
      return;
    }

    let ativo = true;

    setLoading(true);

    const headers =
      token
        ? {
            Authorization:
              `Bearer ${token}`,
          }
        : undefined;

    axios
      .get(
        `${API.BASE_URL}/api/eventos/${encodeURIComponent(
          eventoId
        )}`,
        {
          headers,
        }
      )
      .then(({ data }) => {
        if (!ativo) return;

        setEv(
          data ?? null
        );
      })
      .catch((error) => {
        if (!ativo) return;

        console.error(
          "Erro ao carregar evento:",
          error
        );

        setEv(null);
      })
      .finally(() => {
        if (ativo) {
          setLoading(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [
    eventoId,
    token,
  ]);

  async function compartilharEvento() {
    const evento = ev;

    if (!evento) {
      return;
    }

    const url =
      `${window.location.origin}/evento/${encodeURIComponent(
        evento.id
      )}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            `${evento.titulo} na FootEra`,

          text:
            `Confira o evento "${evento.titulo}" na FootEra.`,

          url,
        });

        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          url
        );

        toast.success(
          "Link do evento copiado."
        );

        return;
      }

      window.prompt(
        "Copie o link do evento:",
        url
      );
    } catch (error: any) {
      if (
        error?.name !==
        "AbortError"
      ) {
        toast.error(
          "Não foi possível compartilhar o evento."
        );
      }
    }
  }

  async function participarEvento(
    retomando = false
  ) {
    const evento = ev;

    if (!evento) {
      return;
    }
    const retorno =
      `/evento/${encodeURIComponent(
        evento.id
      )}`;

    const options = {
      message:
        "Entre na FootEra para participar deste evento.",

      returnTo:
        retorno,

      action: {
        type:
          "JOIN_EVENT" as const,

        eventoId:
          String(evento.id),
      },
    };

    if (
      !retomando &&
      !requireAuth(options)
    ) {
      return;
    }

    const tokenAtual =
      lerToken();

    if (!tokenAtual) {
      requireAuth(options);
      return;
    }

    try {
      setParticipando(true);

      const response =
        await fetch(
          `${API.BASE_URL}/api/eventos/${encodeURIComponent(
            evento.id
          )}/participar`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${tokenAtual}`,
            },
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (
        data?.external &&
        data?.linkInscricao
      ) {
        limparAcaoPendenteAuth();

        window.open(
          data.linkInscricao,
          "_blank",
          "noopener,noreferrer"
        );

        return;
      }

      if (
        response.status ===
          402 &&
        data?.code ===
          "PAYMENT_REQUIRED"
      ) {
        limparAcaoPendenteAuth();

        const retorno =
          `/evento/${encodeURIComponent(
            evento.id
          )}`;

        const planoId =
          `EVENTO:${evento.id}`;

        navigate(
          `/pagamentos?produto=evento` +
            `&planoId=${encodeURIComponent(
              planoId
            )}` +
            `&returnTo=${encodeURIComponent(
              retorno
            )}`
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Não foi possível participar."
        );
      }

      limparAcaoPendenteAuth();

      setEv(
        (atual) =>
          atual
            ? {
                ...atual,

                inscrito: true,

                inscricaoStatus:
                  data.status ||
                  "CONFIRMADA",

                totalInscritos:
                  data.totalInscritos ??
                  atual.totalInscritos,

                vagasDisponiveis:
                  data.vagasDisponiveis ??
                  atual.vagasDisponiveis,
              }
            : atual
      );

      toast.success(
        "Inscrição confirmada."
      );
    } catch (error: any) {
      limparAcaoPendenteAuth();

      toast.error(
        error?.message ||
          "Não foi possível realizar a inscrição."
      );
    } finally {
      setParticipando(false);
    }
  }

  const abrirConvocacao =
    () => {
      if (!ev?.id) {
        return;
      }

      const retorno =
        `/evento/${encodeURIComponent(
          ev.id
        )}`;

      if (
        !requireAuth({
          message:
            "Entre na FootEra para convocar atletas para este evento.",

          returnTo:
            retorno,

          action: {
            type:
              "OPEN_EVENT_CONVOCATION",

            eventoId:
              String(ev.id),
          },
        })
      ) {
        return;
      }

      if (
        !ev.podeGerenciar
      ) {
        toast.error(
          "Seu tipo de perfil não possui permissão para convocar atletas."
        );

        return;
      }

      navigate(
        `/eventos/convocar?eventoId=${encodeURIComponent(
          ev.id
        )}`
      );
    };

  useEffect(() => {
    if (
      !token ||
      !ev?.id
    ) {
      return;
    }

    const action =
      lerAcaoPendenteAuth();

    if (
      !action ||
      action.type !==
        "JOIN_EVENT" ||
      action.eventoId !==
        String(ev.id)
    ) {
      return;
    }

    void participarEvento(
      true
    );

    // participarEvento é intencionalmente
    // executada somente quando token/evento mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    ev?.id,
  ]);

  useEffect(() => {
    if (
      !token ||
      !ev?.id
    ) {
      return;
    }

    const action =
      lerAcaoPendenteAuth();

    if (
      !action ||
      action.type !==
        "OPEN_EVENT_CONVOCATION" ||
      action.eventoId !==
        String(ev.id)
    ) {
      return;
    }

    limparAcaoPendenteAuth();

    if (
      !ev.podeGerenciar
    ) {
      toast.error(
        "Seu tipo de perfil não possui permissão para convocar atletas."
      );

      return;
    }

    const confirmar =
      window.confirm(
        "Você entrou na FootEra. Deseja continuar e convocar atletas para este evento?"
      );

    if (!confirmar) {
      return;
    }

    navigate(
      `/eventos/convocar?eventoId=${encodeURIComponent(
        ev.id
      )}`
    );
  }, [
    token,
    ev?.id,
    navigate,
  ]);


  if (loading) {
    return (
      <div className="p-6">
        Carregando evento...
      </div>
    );
  }


  if (!ev) {
    return (
      <div className="p-6 text-red-600">
        Evento não encontrado.
      </div>
    );
  }


  const fmtDataHora = (
    iso?: string | null
  ) =>
    iso
      ? new Date(
          iso
        ).toLocaleString()
      : null;


  const valorNum =
    typeof ev.valorInscricao ===
    "string"
      ? parseFloat(
          ev.valorInscricao
        )
      : ev.valorInscricao ??
        null;


  const valorFmt =
    valorNum != null
      ? new Intl.NumberFormat(
          "pt-BR",
          {
            style:
              "currency",

            currency:
              "BRL",
          }
        ).format(
          Number.isFinite(
            valorNum
          )
            ? valorNum
            : 0
        )
      : "—";


  const temRequisitos =
    Array.isArray(
      ev.requisitos
    ) &&
    ev.requisitos.length >
      0;

  const mostrarConvocar =
    Boolean(
      token &&
      ev.podeGerenciar
    );

  return (
    <div className="p-6 max-w-2xl mx-auto bg-cream text-green-900">
      <h1 className="text-3xl font-extrabold">
        {ev.titulo}
      </h1>

      <p className="mt-1 text-sm opacity-80">
        {fmtDataHora(
          ev.dataEvento
        )}{" "}
        •{" "}
        {labelEventoTipo(
          ev.tipo
        )}
      </p>

      <div className="mt-6 grid gap-3 bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg font-green">
            Informações
          </h2>

          {mostrarConvocar && (
            <button
              type="button"
              onClick={
                abrirConvocacao
              }
              className="px-3 py-2 rounded bg-green-700 text-white text-sm hover:bg-green-800"
            >
              Convocar atletas
            </button>
          )}
        </div>

        {ev.status && (
          <p className="text-sm">
            <b>Status: </b>
            {ev.status}
          </p>
        )}

        {ev.descricao && (
          <p className="text-sm">
            <b>Descrição: </b>
            {ev.descricao}
          </p>
        )}

        {(ev.cidade ||
          ev.estado) && (
          <p className="text-sm">
            <b>Cidade:</b>{" "}
            {[
              ev.cidade,
              ev.estado,
            ]
              .filter(Boolean)
              .join(" - ")}
          </p>
        )}

        {ev.endereco && (
          <div className="text-sm">
            <b>
              Endereço/Local:
            </b>{" "}
            {ev.endereco}
          </div>
        )}

        {(ev.inscricaoInicio ||
          ev.inscricaoFim) && (
          <div className="text-sm">
            <b>
              Inscrições:
            </b>{" "}
            {ev.inscricaoInicio
              ? fmtDataHora(
                  ev.inscricaoInicio
                )
              : "—"}{" "}
            até{" "}
            {ev.inscricaoFim
              ? fmtDataHora(
                  ev.inscricaoFim
                )
              : "—"}
          </div>
        )}

        <div className="text-sm">
          <b>
            Valor da inscrição:
          </b>{" "}
          {valorNum === 0
            ? "Gratuito"
            : valorFmt}
        </div>

        <div className="text-sm">
          <b>Vagas disponíveis:</b>{" "}
            {ev.vagas != null
              ? `${ev.vagasDisponiveis ?? 0} de ${ev.vagas}`
              : "Sem limite informado"}
        </div>

        {ev.organizador && (
          <div className="flex items-center gap-3">
            {ev.organizador.logo && (
              <img
                src={ev.organizador.logo}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            )}

            <div>
              <div className="text-xs text-gray-500">
                Organizado por
              </div>

              <div className="font-semibold">
                {ev.organizador.nome}
              </div>
            </div>
          </div>
        )}

        {temRequisitos && (
          <div className="text-sm">
            <b>
              Requisitos:
            </b>

            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              {ev.requisitos!.map(
                (
                  requisito,
                  index
                ) => (
                  <li
                    key={
                      index
                    }
                  >
                    {
                      requisito
                    }
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={
              compartilharEvento
            }
            className="px-4 py-3 rounded-xl border border-green-700 text-green-800 font-semibold"
          >
            Compartilhar
          </button>

          {ev.podeGerenciar ? (
            <>
              <button
                type="button"
                onClick={
                  abrirConvocacao
                }
                className="px-4 py-3 rounded-xl bg-green-700 text-white font-semibold"
              >
                Convocar atletas
              </button>

              <button
                type="button"
                onClick={() => {
                  if (ev.clubeId) {
                    navigate(
                      `/eventos/clubes/${ev.clubeId}`
                    );
                  } else if (
                    ev.escolinhaId
                  ) {
                    navigate(
                      `/eventos/escolas/${ev.escolinhaId}`
                    );
                  } else {
                    navigate(
                      "/creator/eventos"
                    );
                  }
                }}
                className="px-4 py-3 rounded-xl border border-green-700 text-green-800 font-semibold"
              >
                Gerenciar evento
              </button>
            </>
          ) : ev.inscrito ? (
            <button
              disabled
              className="px-4 py-3 rounded-xl bg-green-100 text-green-800 font-semibold"
            >
              Inscrito
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                void participarEvento(
                  false
                )
              }
              disabled={
                participando ||
                ev.inscricoesAbertas ===
                  false ||
                ev.vagasDisponiveis ===
                  0
              }
              className="px-4 py-3 rounded-xl bg-green-800 text-white font-semibold disabled:opacity-50"
            >
              {participando
                ? "Inscrevendo..."
                : ev.vagasDisponiveis ===
                    0
                ? "Vagas esgotadas"
                : ev.inscricoesAbertas ===
                    false
                ? "Inscrições indisponíveis"
                : Number(
                    ev.valorInscricao ?? 0
                  ) > 0
                ? "Inscrever-se"
                : "Participar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}