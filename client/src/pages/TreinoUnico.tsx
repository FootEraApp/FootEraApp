import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
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
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import AcoesTreino from "../components/treinos/acoestreino.js";

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
  avaliacoesPorAgendado?: {
    treinoAgendadoId: string;
    media: number; 
    count: number;
    avaliadorNome?: string | null;
    avaliadoEm?: string | null;
  }[]; 
};

function useQuery() {
  const [, setLoc] = useLocation();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const get = (k: string) => params.get(k);
  const go = (href: string) => setLoc(href);
  return { get, go };
}

const mediaUrl = (u?: string | null) => {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  if (u.startsWith("/assets/")) return `${APP.FRONTEND_BASE_URL}${u}`;
  if (u.startsWith("/uploads/") || u.startsWith("/upload/")) return `${API.BASE_URL}${u}`;
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;
  return `${API.BASE_URL}/${u}`;
};

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
  const agendadoId = get("agendadoId");
  const programadoId = get("programadoId");
  const token = (Storage as any).token ?? localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [treino, setTreino] = useState<TreinoUnicoPayload | null>(null);

  useEffect(() => {
    const fetchTreino = async () => {
      try {
        setLoading(true);
        setErro(null);

        if (programadoId) {
          const qs = `programadoId=${encodeURIComponent(programadoId)}`;
          const res = await fetch(`${API.BASE_URL}/api/treino-unico?${qs}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) throw new Error(`(${res.status}) ${await res.text()}`);
          const json = await res.json(); // já vem no formato TreinoUnicoPayload
          setTreino(json);
          return;
        }

        // ✅ 2) SE FOR AGENDADO: mantém seu endpoint atual
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

    if (!agendadoId && !programadoId) {
      setErro("Informe agendadoId ou programadoId na URL.");
      setLoading(false);
      return;
    }
    fetchTreino();
  }, [agendadoId, programadoId]);

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
                <strong>Realização:</strong>{" "}
                Esse treino já foi realizado {Number(treino.realizacoes ?? 0)} vezes
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
            <p className="text-sm text-gray-500">Nenhum exercício cadastrado.</p>
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
        </div>
      </main>
    </div>
  );
}
