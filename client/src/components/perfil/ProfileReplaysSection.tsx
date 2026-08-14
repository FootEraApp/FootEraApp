import {
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import { Link } from "wouter";
import {
  CalendarClock,
  Clock3,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { API } from "../../config.js";
import CoverImage from "../shared/CoverImage.js";

type ReplayPerfil = {
  id: string;
  titulo: string;
  descricao?: string | null;

  dataInicio?: string | null;
  iniciouEm?: string | null;
  finalizouEm?: string | null;

  duracaoSegundos: number;

  thumbUrl?: string | null;

  acessoPago: boolean;
  precoAcesso: number;

  replayExpiraEm: string;
  segundosRestantes: number;

  metodologiaTitulo?: string | null;

  criador?: {
    id?: string | null;
    nome?: string | null;
    nomeDeUsuario?: string | null;
    foto?: string | null;
    tipo?: string | null;
  } | null;

  temAcesso?: boolean;
  isOwner?: boolean;
  isConvidadoFootEra?: boolean;
};

type Props = {
  creatorUsuarioId?:
    | string
    | null;

  limiteInicial?: number;
};

function getToken() {
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

function formatarData(
  valor?: string | null
) {
  if (!valor) return "—";

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return "—";
  }

  return data.toLocaleString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatarDuracao(
  segundos: number
) {
  const total =
    Math.max(
      0,
      Math.floor(
        segundos || 0
      )
    );

  const horas =
    Math.floor(
      total / 3600
    );

  const minutos =
    Math.floor(
      (
        total % 3600
      ) / 60
    );

  const segundosRestantes =
    total % 60;

  if (horas > 0) {
    return [
      String(horas),
      String(minutos).padStart(
        2,
        "0"
      ),
      String(
        segundosRestantes
      ).padStart(2, "0"),
    ].join(":");
  }

  return [
    String(minutos),
    String(
      segundosRestantes
    ).padStart(2, "0"),
  ].join(":");
}

function formatarTempoRestante(
  expiraEm: string,
  agora: number
) {
  const fim =
    new Date(
      expiraEm
    ).getTime();

  if (
    !Number.isFinite(fim)
  ) {
    return "";
  }

  const diferenca =
    Math.max(
      0,
      fim - agora
    );

  const minutos =
    Math.floor(
      diferenca /
        60_000
    );

  const horas =
    Math.floor(
      minutos / 60
    );

  const dias =
    Math.floor(
      horas / 24
    );

  if (dias > 0) {
    return `Expira em ${dias} dia${
      dias === 1
        ? ""
        : "s"
    }`;
  }

  if (horas > 0) {
    return `Expira em ${horas} hora${
      horas === 1
        ? ""
        : "s"
    }`;
  }

  return `Expira em ${Math.max(
    minutos,
    1
  )} minuto${
    minutos === 1
      ? ""
      : "s"
  }`;
}

function formatarDinheiro(
  valor: number
) {
  return Number(
    valor || 0
  ).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

export default function ProfileReplaysSection({
  creatorUsuarioId,
  limiteInicial = 5,
}: Props) {
  const [
    replays,
    setReplays,
  ] = useState<
    ReplayPerfil[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mostrarTodos,
    setMostrarTodos,
  ] = useState(false);

  const [
    agora,
    setAgora,
  ] = useState(
    Date.now()
  );

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setAgora(
            Date.now()
          );
        },
        60_000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  useEffect(() => {
    const usuarioId = String(
      creatorUsuarioId || ""
    ).trim();

    if (!usuarioId) {
      setReplays([]);
      setLoading(false);
      setError("");
      return;
    }

    let cancelado = false;
    let requisicaoEmAndamento = false;
    let primeiraCarga = true;
    let teveSucesso = false;

    async function carregar() {
      if (requisicaoEmAndamento) {
        return;
      }

      requisicaoEmAndamento = true;

      try {
        if (primeiraCarga) {
          setLoading(true);
        }

        const resposta = await axios.get(
          `${API.BASE_URL}/api/aulas-ao-vivo/replays/criador/${encodeURIComponent(
            usuarioId
          )}`
        );

        const items = Array.isArray(resposta.data?.items)
          ? resposta.data.items
          : [];

        const token = getToken();

        const detalhados = await Promise.all(
          items.map(
            async (replay: ReplayPerfil) => {
              try {
                const acessoResposta = await axios.get(
                  `${API.BASE_URL}/api/learning/eventos/aulas/${encodeURIComponent(
                    replay.id
                  )}`,
                  {
                    headers: token
                      ? {
                          Authorization: `Bearer ${token}`,
                        }
                      : undefined,
                  }
                );

                const item =
                  acessoResposta.data?.item ??
                  acessoResposta.data?.evento ??
                  null;

                return {
                  ...replay,

                  temAcesso:
                    item?.acesso?.temAcesso === true,

                  isOwner:
                    item?.acesso?.isOwner === true ||
                    item?.isOwner === true,

                  isConvidadoFootEra:
                    item?.acesso?.isConvidadoFootEra === true,
                };
              } catch {
                return replay;
              }
            }
          )
        );

        if (cancelado) {
          return;
        }

        setReplays(detalhados);
        setError("");

        teveSucesso = true;
      } catch (error) {
        console.error(
          "Erro ao carregar replays:",
          error
        );

        if (!cancelado && !teveSucesso) {
          setReplays([]);
          setError(
            "Não foi possível carregar os replays."
          );
        }
      } finally {
        requisicaoEmAndamento = false;

        if (!cancelado && primeiraCarga) {
          setLoading(false);
        }

        primeiraCarga = false;
      }
    }

    void carregar();

    const intervalId = window.setInterval(() => {
      void carregar();
    }, 10_000);

    const handleFocus = () => {
      void carregar();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void carregar();
      }
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      cancelado = true;

      window.clearInterval(
        intervalId
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [creatorUsuarioId]);

  const replaysValidos =
    useMemo(
      () =>
        replays.filter(
          (replay) =>
            new Date(
              replay.replayExpiraEm
            ).getTime() >
            agora
        ),
      [
        replays,
        agora,
      ]
    );

  const exibidos =
    mostrarTodos
      ? replaysValidos
      : replaysValidos.slice(
          0,
          limiteInicial
        );

  if (
    !loading &&
    !error &&
    replaysValidos.length ===
      0
  ) {
    return null;
  }

  return (
    <section className="mt-5 rounded-2xl border border-green-100 bg-white/90 shadow-sm">
      <div className="border-b border-green-100 px-4 py-3">
        <h3 className="font-semibold text-green-900">
          Replays disponíveis
        </h3>

        <p className="mt-1 text-xs text-green-900/65">
          Os replays ficam disponíveis por sete dias após a finalização.
        </p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-green-900/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando replays…
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">
            {error}
          </div>
        ) : (
          <ul className="grid gap-4">
            {exibidos.map(
              (replay) => {
                const gratuito =
                  !replay.acessoPago ||
                  Number(
                    replay.precoAcesso ||
                      0
                  ) <= 0;

                const podeAssistir =
                  gratuito ||
                  replay.temAcesso ||
                  replay.isOwner ||
                  replay
                    .isConvidadoFootEra;

                const href =
                  podeAssistir
                    ? `/learning/live?aulaId=${encodeURIComponent(
                        replay.id
                      )}`
                    : `/learning/evento/${encodeURIComponent(
                        replay.id
                      )}`;

                const nomeCriador =
                  replay.criador
                    ?.nome ||
                  replay.criador
                    ?.nomeDeUsuario ||
                  "Creator FootEra";

                return (
                  <li
                    key={
                      replay.id
                    }
                    className="overflow-hidden rounded-xl border border-green-100 bg-white"
                  >
                    <div className="grid sm:grid-cols-[180px_1fr]">
                      <div className="relative h-40 bg-slate-900 sm:h-full">
                        <CoverImage
                          src={
                            replay.thumbUrl
                          }
                          alt={
                            replay.titulo
                          }
                          pasta="metodologias"
                          className="h-full w-full object-cover"
                        />

                        <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2 py-1 text-[11px] font-bold text-white">
                          REPLAY
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-col gap-3 p-4">
                        <div>
                          <h4 className="truncate font-bold text-green-950">
                            {
                              replay.titulo
                            }
                          </h4>

                          <div className="mt-1 text-sm text-green-900/70">
                            Por{" "}
                            <b>
                              {
                                nomeCriador
                              }
                            </b>
                          </div>
                        </div>

                        <div className="grid gap-1 text-xs text-green-900/70 sm:grid-cols-2">
                          <div className="flex items-center gap-1">
                            <CalendarClock className="h-4 w-4" />
                            Início:{" "}
                            {formatarData(
                              replay.iniciouEm ||
                                replay.dataInicio
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <CalendarClock className="h-4 w-4" />
                            Final:{" "}
                            {formatarData(
                              replay.finalizouEm
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock3 className="h-4 w-4" />
                            Duração:{" "}
                            {formatarDuracao(
                              replay.duracaoSegundos
                            )}
                          </div>

                          <div className="font-semibold text-amber-700">
                            {formatarTempoRestante(
                              replay.replayExpiraEm,
                              agora
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="w-fit rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
                            {gratuito
                              ? "Gratuito"
                              : formatarDinheiro(
                                  replay.precoAcesso
                                )}
                          </span>

                          <Link
                            href={
                              href
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
                          >
                            <PlayCircle className="h-4 w-4" />

                            {podeAssistir
                              ? "Ver replay"
                              : `Pagar ${formatarDinheiro(
                                  replay.precoAcesso
                                )}`}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              }
            )}
          </ul>
        )}

        {replaysValidos.length >
          limiteInicial && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() =>
                setMostrarTodos(
                  (valor) =>
                    !valor
                )
              }
              className="rounded-lg border border-green-200 px-4 py-2 text-sm font-semibold text-green-900 hover:bg-green-50"
            >
              {mostrarTodos
                ? "Mostrar menos"
                : `Ver todos (${replaysValidos.length})`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}