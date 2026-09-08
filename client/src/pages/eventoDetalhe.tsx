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

import Storage from "../../../server/utils/storage.js";

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

  status?:
    | "ABERTO"
    | "ENCERRADO"
    | "CANCELADO";

  linkInscricao?: string | null;
};


function lerToken() {
  return (
    Storage.token ||
    localStorage.getItem(
      "token"
    ) ||
    sessionStorage.getItem(
      "token"
    ) ||
    ""
  );
}


function lerTipoUsuario() {
  const raw =
    String(
      (Storage as any)
        .tipoSalvo ??
      localStorage.getItem(
        "tipoUsuario"
      ) ??
      sessionStorage.getItem(
        "tipoUsuario"
      ) ??
      ""
    )
      .trim()
      .toLowerCase();

  if (raw === "escola") {
    return "escolinha";
  }

  return raw;
}


function podeConvocar(
  tipo: string
) {
  return [
    "clube",
    "escolinha",
    "professor",
    "admin",
  ].includes(tipo);
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

  const tipoUsuario =
    lerTipoUsuario();

  const [ev, setEv] =
    useState<Evento | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);


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


  const abrirConvocacao =
    () => {
      if (!ev?.id) {
        return;
      }

      const retorno =
        `/eventos/${encodeURIComponent(
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
        !podeConvocar(
          lerTipoUsuario()
        )
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
        "OPEN_EVENT_CONVOCATION" ||
      action.eventoId !==
        String(ev.id)
    ) {
      return;
    }

    limparAcaoPendenteAuth();

    if (
      !podeConvocar(
        lerTipoUsuario()
      )
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
    !token ||
    podeConvocar(
      tipoUsuario
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
          <b>Vagas:</b>{" "}
          {ev.vagas != null
            ? ev.vagas
            : "—"}
        </div>

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

        {ev.linkInscricao && (
          <div className="pt-2">
            <a
              className="inline-block px-4 py-2 rounded bg-green-800 text-white"
              href={
                ev.linkInscricao
              }
              target="_blank"
              rel="noreferrer"
            >
              Inscrever-se
            </a>
          </div>
        )}
      </div>
    </div>
  );
}