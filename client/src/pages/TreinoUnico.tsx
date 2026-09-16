// client/src/pages/TreinoUnico
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  CalendarClock,
  ChevronLeft,
  Dumbbell,
  Flag,
  Info,
  NotebookText,
  Timer,
  User,
  CheckCircle2,
  BarChart3,
  Star as StarIcon,
  Play,
  Share2
} from "lucide-react";
import { API } from "../config.js";
import AcoesTreino from "../components/treinos/acoestreino.js";
import { toast } from "@/lib/toast";

import {
  useAuthGate,
} from "../context/AuthGateContext.js";

import {
  lerAcaoPendenteAuth,
  limparAcaoPendenteAuth,
} from "../utils/authSession.js";

type ExercicioItem = {
  id: string;
  nome: string;
  repeticoes?: string | null;
  series?: number | null;
  duracao?: string | null;
  descanso?: string | null;
  descricao?: string | null;
  videoUrl?: string | null;
  nivel?: string | null;
};

type OrigemInfo = {
  tipo?: "professor" | "escolinha" | "clube" | null;
  nome?: string | null;
};

type TreinoUnicoPayload = {
  tipo: "agendado" | "programado";
  id: string;
  treinoProgramadoId?: string | null;
  titulo: string;
  descricao?: string | null;
  nivel?: string | null;
  objetivo?: string | null;
  tipoTreino?: string | null;
  duracao?: number | null;
  sessaoTreinoId?: string | null;
  sessaoTreino?: { id: string; nome: string } | null;
  sessaoTreinoNome?: string | null;
  dicas?: string[] | null;
  prazoEnvio?: string | null;
  dataTreino?: string | null;
  dataExpiracao?: string | null;
  exercicios: ExercicioItem[];
  origem?: OrigemInfo | null;
  realizacoes?: number | null;
  avaliacaoMedia?: number | null;     
  avaliacaoCount?: number | null;  
  publicPreview?: boolean;
  imagemUrl?: string | null;
  pontuacao?: number | null;
  categoria?: string[];  
  conteudoProtegido?: boolean;
  minhasRealizacoes?: number | null;
  temPerfilAtleta?: boolean;
  podeIniciar?: boolean;
  avaliacoesPorAgendado?: {
    treinoAgendadoId: string;
    media: number; 
    count: number;
    avaliadorNome?: string | null;
    avaliadoEm?: string | null;
  }[]; 
};

function getTokenAtual() {
  if (
    typeof window === "undefined"
  ) {
    return "";
  }

  return String(
    localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      ""
  ).trim();
}

function useQuery() {
  const [, setLoc] = useLocation();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const get = (k: string) => params.get(k);
  const go = (href: string) => setLoc(href);
  return { get, go };
}

const ASSETS_CDN_BASE =
  import.meta.env.VITE_ASSETS_CDN_BASE_URL || "https://footera.app.br";

function isNativeApp() {
  if (typeof window === "undefined") return false;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  return (
    protocol === "capacitor:" ||
    protocol === "ionic:" ||
    hostname === "localhost" ||
    hostname === "10.0.2.2"
  );
}

function mediaUrl(raw?: string | null) {
  if (!raw) return "";

  const p = String(raw).trim().replace(/\\/g, "/");
  if (!p) return "";

  if (
    p.startsWith("blob:") ||
    p.startsWith("data:") ||
    p.startsWith("http://") ||
    p.startsWith("https://")
  ) {
    return p;
  }

  if (p.startsWith("/assets/")) {
    return isNativeApp()
      ? `${ASSETS_CDN_BASE}${p}`
      : p;
  }

  if (p.startsWith("assets/")) {
    return isNativeApp()
      ? `${ASSETS_CDN_BASE}/${p}`
      : `/${p}`;
  }

  if (p.startsWith("/uploads/") || p.startsWith("/upload/")) {
    return `${API.BASE_URL}${p}`;
  }

  if (p.startsWith("uploads/") || p.startsWith("upload/")) {
    return `${API.BASE_URL}/${p}`;
  }

  if (p.startsWith("/")) {
    return `${API.BASE_URL}${p}`;
  }

  return `${API.BASE_URL}/${p}`;
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const start = i;
        const frac = Math.max(0, Math.min(1, v - start));

        return (
          <span key={i} className="relative inline-block w-5 h-5">
            <StarIcon className="w-5 h-5 text-zinc-300" />
            {frac > 0 ? (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${frac * 100}%` }}
              >
                <StarIcon className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export default function TreinoUnico() {
  const { get } = useQuery();

  const {
    requireAuth,
    handleAuthError,
  } = useAuthGate();

  const token =
    getTokenAtual();

  const [
    iniciando,
    setIniciando,
  ] = useState(false);

  const agendadoId =
    get("agendadoId");

  const programadoId =
    get("programadoId");

  const [
    matchPublico,
    paramsPublico,
  ] =
    useRoute<{
      id: string;
    }>("/treino/:id");

  const treinoPublicoId =
    matchPublico
      ? paramsPublico?.id
      : null;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [treino, setTreino] = useState<TreinoUnicoPayload | null>(null);

  useEffect(() => {
    const fetchTreino = async () => {
      try {
        setLoading(true);
        setErro(null);

        if (treinoPublicoId) {
          const url =
            `${API.BASE_URL}/api/treino-unico/publico/${encodeURIComponent(
              treinoPublicoId
            )}`;

          let res =
            await fetch(
              url,
              {
                headers:
                  token
                    ? {
                        Authorization:
                          `Bearer ${token}`,
                      }
                    : {},
              }
            );

          // Se houver um token antigo/inválido,
          // a página continua podendo ser vista como visitante.
          if (
            res.status === 401 &&
            token
          ) {
            res =
              await fetch(url);
          }

          if (!res.ok) {
            throw new Error(
              `(${res.status}) ${await res.text()}`
            );
          }

          const json =
            await res.json();

          setTreino(json);
          return;
        }

        if (programadoId) {
          const qs = `programadoId=${encodeURIComponent(programadoId)}`;
          const res = await fetch(`${API.BASE_URL}/api/treino-unico?${qs}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) throw new Error(`(${res.status}) ${await res.text()}`);
          const json = await res.json();
          setTreino(json);
          return;
        }

        const qs = `agendadoId=${encodeURIComponent(agendadoId || "")}`;
        const res = await fetch(`${API.BASE_URL}/api/treino-unico?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`(${res.status}) ${await res.text()}`);
        const json = (await res.json()) as TreinoUnicoPayload;
        setTreino(json);
      } catch (e: any) {
        console.error(e);
        setErro(e?.message || "Falha ao carregar o treino.");
      } finally {
        setLoading(false);
      }
    };

    if (!agendadoId && !programadoId && !treinoPublicoId) {
      setErro("Informe agendadoId ou programadoId na URL.");
      setLoading(false);
      return;
    }
    fetchTreino();
  }, [agendadoId, programadoId, treinoPublicoId, token]);

  const formatarDataHora = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

  const resumoAvaliacoesProgramado = useMemo(() => {
    const rows = treino?.avaliacoesPorAgendado ?? [];
    if (!rows.length) return null;

    const totalCount = rows.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
    if (!totalCount) return null;

    const somaPonderada = rows.reduce((acc, r) => {
      const c = Number(r.count) || 0;
      const m = Number(r.media) || 0;
      return acc + m * c;
    }, 0);

    const mediaGeral = somaPonderada / totalCount;
    return { mediaGeral, totalCount };
  }, [treino?.avaliacoesPorAgendado]);

  const iniciarTreinoPublico =
    useCallback(
      async (
        retomandoAposAuth = false
      ) => {
        const treinoProgramadoId =
          String(
            treino?.treinoProgramadoId ||
              treinoPublicoId ||
              ""
          ).trim();

        if (!treinoProgramadoId) {
          return;
        }

        if (
          treino?.conteudoProtegido
        ) {
          toast.error(
            "Este treino faz parte de uma metodologia. Acesse-o pelo Learning."
          );

          return;
        }

        const retorno =
          `/treino/${encodeURIComponent(
            treinoProgramadoId
          )}`;

        const authOptions = {
          message:
            "Entre na FootEra para iniciar este treino. Depois de entrar, você volta para esta página.",

          returnTo:
            retorno,

          action: {
            type:
              "START_PUBLIC_TRAINING" as const,

            treinoProgramadoId,
          },
        };

        if (
          !retomandoAposAuth &&
          !requireAuth(
            authOptions
          )
        ) {
          return;
        }

        const tokenAtual =
          getTokenAtual();

        if (!tokenAtual) {
          requireAuth(
            authOptions
          );

          return;
        }

        try {
          setIniciando(true);

          const response =
            await fetch(
              `${API.BASE_URL}/api/treinos/programados/${encodeURIComponent(
                treinoProgramadoId
              )}/iniciar-publico`,
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
            response.status === 401
          ) {
            handleAuthError(
              {
                status: 401,
                response: {
                  status: 401,
                  data,
                },
              },
              authOptions
            );

            return;
          }

          if (!response.ok) {
            if (
              data?.code ===
              "ATLETA_REQUIRED"
            ) {
              limparAcaoPendenteAuth();

              toast.error(
                data?.message ||
                  "Você precisa ter um perfil de Atleta para realizar este treino."
              );

              return;
            }

            if (
              data?.code ===
              "LEARNING_REQUIRED"
            ) {
              limparAcaoPendenteAuth();

              toast.error(
                data?.message ||
                  "Este treino deve ser acessado pelo Learning."
              );

              return;
            }

            throw new Error(
              data?.message ||
                "Não foi possível iniciar o treino."
            );
          }

          limparAcaoPendenteAuth();

          const treinoAgendadoId =
            String(
              data?.treinoAgendadoId ||
                ""
            ).trim();

          if (
            treinoAgendadoId
          ) {
            const startedAtMs =
              data?.startedAt
                ? new Date(
                    data.startedAt
                  ).getTime()
                : Date.now();

            localStorage.setItem(
              `footera:treinoTimerStart:${treinoAgendadoId}`,
              String(
                Number.isFinite(
                  startedAtMs
                )
                  ? startedAtMs
                  : Date.now()
              )
            );
          }

          window.location.href =
            treinoAgendadoId
              ? `/treinos?openAgendadoId=${encodeURIComponent(
                  treinoAgendadoId
                )}`
              : `/treinos?openAgendadoByProgramadoId=${encodeURIComponent(
                  treinoProgramadoId
                )}`;
        } catch (error: any) {
          console.error(
            "Erro ao iniciar treino público:",
            error
          );

          toast.error(
            error?.message ||
              "Não foi possível iniciar o treino."
          );
        } finally {
          setIniciando(false);
        }
      },
      [
        treino,
        treinoPublicoId,
        requireAuth,
        handleAuthError,
      ]
    );

  const compartilharTreino =
    useCallback(
      async () => {
        if (!treino) {
          return;
        }

        const id =
          treino.treinoProgramadoId ||
          treinoPublicoId ||
          treino.id;

        const url =
          `${window.location.origin}/treino/${encodeURIComponent(
            String(id)
          )}`;

        const shareData = {
          title:
            `${treino.titulo} na FootEra`,

          text:
            `Confira o treino "${treino.titulo}" na FootEra.`,

          url,
        };

        try {
          if (
            navigator.share
          ) {
            await navigator.share(
              shareData
            );

            return;
          }

          if (
            navigator.clipboard
          ) {
            await navigator.clipboard.writeText(
              url
            );

            toast.success(
              "Link do treino copiado."
            );

            return;
          }

          window.prompt(
            "Copie o link do treino:",
            url
          );
        } catch (error: any) {
          if (
            error?.name !==
            "AbortError"
          ) {
            console.error(
              "Erro ao compartilhar:",
              error
            );

            toast.error(
              "Não foi possível compartilhar o treino."
            );
          }
        }
      },
      [
        treino,
        treinoPublicoId,
      ]
    );

  useEffect(() => {
    if (
      !treino ||
      !treinoPublicoId ||
      !getTokenAtual()
    ) {
      return;
    }

    const action =
      lerAcaoPendenteAuth();

    if (
      !action ||
      action.type !==
        "START_PUBLIC_TRAINING"
    ) {
      return;
    }

    const treinoAtualId =
      String(
        treino.treinoProgramadoId ||
          treinoPublicoId
      );

    if (
      action.treinoProgramadoId !==
      treinoAtualId
    ) {
      return;
    }

    void iniciarTreinoPublico(
      true
    );
  }, [
    treino,
    treinoPublicoId,
    iniciarTreinoPublico,
  ]);
  if (loading) return <div className="p-4 text-center">Carregando treino...</div>;
  if (erro)
    return (
      <div className="p-4">
        <button
          onClick={() => history.back()}
          className="inline-flex items-center gap-2 text-green-800 mb-3"
        >
          <ChevronLeft className="w-5 h-5" /> Voltar
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{erro}</div>
      </div>
  );
  if (!treino) return null;

  const isAgendado = treino.tipo === "agendado";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 bg-white/90 backdrop-blur border-b p-3 flex items-center gap-3 z-10">
        <button
          onClick={() => history.back()}
          className="text-green-800 hover:text-green-900 inline-flex items-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-green-900">Detalhes do Treino</h1>
      </header>

      <main className="mx-auto p-4 sm:p-6 w-full max-w-5xl space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6">
          <h2 className="text-2xl font-bold text-green-900">{treino.titulo}</h2>
          {treino.descricao && (
            <p className="text-sm sm:text-base text-gray-700 mt-2">{treino.descricao}</p>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm sm:text-base">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-green-700" />
              <span>
                <strong>Nível:</strong> {treino.nivel || "-"}
              </span>
            </div>

            {(treino.sessaoTreinoNome || treino.sessaoTreino?.nome) && (
              <div className="flex items-center gap-2">
                <NotebookText className="w-4 h-4 text-green-700" />
                <span>
                  <strong>Sessão:</strong>{" "}
                  {treino.sessaoTreinoNome || treino.sessaoTreino?.nome}
                </span>
              </div>
            )}
            {treino.tipoTreino && (
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-green-700" />
                <span>
                  <strong>Tipo do treino:</strong> {treino.tipoTreino}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-green-700" />
              <span>
                <strong>Duração:</strong>{" "}
                {typeof treino.duracao === "number" ? `${treino.duracao} min` : "-"}
              </span>
            </div>

            {treino.prazoEnvio && (
              <div className="flex items-center gap-2 md:col-span-2">
                <CalendarClock className="w-4 h-4 text-green-700" />
                <span>
                  <strong>Prazo/Agendamento:</strong> {formatarDataHora(treino.prazoEnvio)}
                </span>
              </div>
            )}

            {treino.origem?.nome && (
              <div className="flex items-center gap-2 md:col-span-2">
                <User className="w-4 h-4 text-green-700" />
                <span>
                  <strong>Origem:</strong> {treino.origem.nome}
                  {treino.origem.tipo ? ` (${treino.origem.tipo})` : ""}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 md:col-span-2">
              <CheckCircle2 className="w-4 h-4 text-green-700" />
              <span className="text-gray-800">
                {typeof treino.minhasRealizacoes ===
                  "number" ? (
                    <>
                      <strong>
                        Suas realizações:
                      </strong>{" "}

                      Você já realizou este treino{" "}
                      {treino.minhasRealizacoes}{" "}
                      {treino.minhasRealizacoes === 1
                        ? "vez"
                        : "vezes"}
                    </>
                  ) : (
                    <>
                      <strong>
                        Realizações:
                      </strong>{" "}

                      Este treino já foi realizado{" "}
                      {Number(
                        treino.realizacoes ?? 0
                      )}{" "}
                      {Number(
                        treino.realizacoes ?? 0
                      ) === 1
                        ? "vez"
                        : "vezes"}
                    </>
                  )}
              </span>
            </div>

            {isAgendado ? (
              <div className="flex items-center gap-2 md:col-span-2">
                <StarIcon className="w-4 h-4 text-green-700 fill-white" />
                <span className="text-gray-800">
                  <strong>Avaliação:</strong>
                </span>

                {typeof treino.avaliacaoMedia === "number" && (treino.avaliacaoCount ?? 0) > 0 ? (
                  <div className="flex items-center gap-2">
                    <Stars value={treino.avaliacaoMedia} />
                    <span className="text-sm text-gray-700">
                      {treino.avaliacaoMedia.toFixed(2)} / 5 ({treino.avaliacaoCount} avaliações)
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-700">Sem avaliações ainda</span>
                )}
              </div>
            ) : (
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center gap-2 text-gray-800">
                  <BarChart3 className="w-4 h-4 text-green-700 fill-white" />
                  <span className="text-gray-800">
                    <strong>Avaliação média:</strong>
                  </span>

                  {resumoAvaliacoesProgramado ? (
                    <span className="text-sm text-gray-700">
                      {resumoAvaliacoesProgramado.mediaGeral.toFixed(2)} / 5
                    </span>
                  ) : (
                    <span className="text-sm text-gray-700">-</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-gray-800">
                  <StarIcon className="w-4 h-4 text-green-700 fill-white" />
                  <strong>Avaliações por atletas:</strong>

                  {(treino.avaliacoesPorAgendado ?? []).length === 0 ? (
                    <span className="text-sm text-gray-700">Sem avaliações ainda</span>
                  ) : null}
                </div>

                {(treino.avaliacoesPorAgendado ?? []).length ? (
                  <div className="space-y-2">
                    {treino.avaliacoesPorAgendado!.map((a, idx) => {
                      const nome = (a.avaliadorNome || "Atleta").trim();

                      const dataAvaliacao =
                        a.avaliadoEm
                          ? new Date(a.avaliadoEm).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : null;

                      return (
                        <div
                          key={a.treinoAgendadoId || String(idx)}
                          className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-sm text-gray-800 font-medium truncate">
                              {nome}
                            </div>

                            {dataAvaliacao ? (
                              <div className="text-xs text-gray-500 whitespace-nowrap">
                                • {dataAvaliacao}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <Stars value={a.media} />
                            <span className="text-sm text-gray-700">{Number(a.media).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            {treino.objetivo && (
              <div className="flex items-center gap-2 md:col-span-2">
                <Info className="w-4 h-4 text-green-700" />
                <span>
                  <strong>Objetivo:</strong> {treino.objetivo}
                </span>
              </div>
            )}
          </div>

          {Array.isArray(treino.dicas) && treino.dicas.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold text-gray-800 mb-2 inline-flex items-center gap-2">
                <NotebookText className="w-4 h-4" /> Dicas
              </h3>
              <ul className="list-disc list-inside text-sm sm:text-base text-gray-700 space-y-1">
                {treino.dicas.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6">
          <h3 className="font-semibold text-gray-800 mb-3 inline-flex items-center gap-2 text-lg">
            <Dumbbell className="w-5 h-5" /> Exercícios
          </h3>

          {treino.exercicios.length ? (
            <div className="space-y-5">
              {treino.exercicios.map((ex, i) => {
                const src = mediaUrl(ex.videoUrl);

                return (
                  <article
                    key={ex.id || `${i}-${ex.nome}`}
                    className="border rounded-xl overflow-hidden bg-white shadow-sm"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-4">
                      <div className="md:col-span-5">
                        {src ? (
                          <div className="w-full bg-black">
                            <video
                              className="w-full rounded-none md:rounded-l-xl"
                              style={{ aspectRatio: "16 / 9" }}
                              src={src}
                              controls
                              preload="metadata"
                              playsInline
                            />
                          </div>
                        ) : (
                          <div
                            className="w-full bg-gray-200 flex items-center justify-center text-xs text-gray-600"
                            style={{ aspectRatio: "16 / 9" }}
                          >
                            sem vídeo
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-7 p-4">
                        <div className="font-semibold text-gray-900 text-base sm:text-lg">
                          {i + 1}. {ex.nome}
                        </div>

                        {ex.nivel ? (
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="font-medium">Nível:</span> {ex.nivel}
                          </div>
                        ) : null}
                        
                        <div className="mt-1 text-sm text-gray-700">
                          <div className="mt-1 text-sm text-gray-700 space-y-1">
                            {ex.series != null && ex.series !== 0 ? (
                              <div>
                                <span className="font-medium">Séries:</span> {ex.series}
                              </div>
                            ) : null}

                            {ex.repeticoes ? (
                              <div>
                                <span className="font-medium">Repetições:</span> {ex.repeticoes}
                              </div>
                            ) : null}

                            {ex.duracao ? (
                              <div>
                                <span className="font-medium">Duração:</span> {ex.duracao}
                              </div>
                            ) : null}

                            {ex.descanso ? (
                              <div>
                                <span className="font-medium">Descanso:</span> {ex.descanso}
                              </div>
                            ) : null}

                            {ex.descricao ? (
                              <p className="mt-2 whitespace-pre-line leading-relaxed">{ex.descricao}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {treino.conteudoProtegido
                ? "Os exercícios deste treino fazem parte de um conteúdo protegido."
                : "Nenhum exercício cadastrado."}
            </p>
          )}
        </section>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={() => history.back()}
            className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-100"
          >
            Voltar
          </button>

          {isAgendado && (
            <div className="flex items-center justify-between gap-3">
              <AcoesTreino treinoId={treino.id} />
              <button
                onClick={() => { window.location.href = `/submissao?treinoAgendadoId=${treino.id}`; }}
                className="px-4 py-2 rounded bg-green-800 hover:bg-green-900 text-white"
              >
                Fazer Submissão
              </button>
            </div>
          )}

          {treinoPublicoId && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={
                  compartilharTreino
                }
                className="
                  inline-flex items-center
                  justify-center gap-2
                  rounded-lg border
                  border-green-700
                  px-4 py-2
                  font-medium
                  text-green-800
                  hover:bg-green-50
                "
              >
                <Share2 className="w-4 h-4" />
                Compartilhar
              </button>

              <button
                type="button"
                onClick={() =>
                  void iniciarTreinoPublico(
                    false
                  )
                }
                disabled={
                  iniciando ||
                  treino.conteudoProtegido ===
                    true
                }
                className={`
                  inline-flex items-center
                  justify-center gap-2
                  rounded-lg px-5 py-2
                  font-semibold text-white
                  ${
                    iniciando ||
                    treino.conteudoProtegido
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-800 hover:bg-green-900"
                  }
                `}
              >
                <Play className="w-4 h-4" />

                {treino.conteudoProtegido
                  ? "Disponível pelo Learning"
                  : iniciando
                  ? "Iniciando..."
                  : "Iniciar treino"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
