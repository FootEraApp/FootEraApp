// client/src/pages/treino/treino-metodologia.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MoreVertical, X } from "lucide-react";
import { API } from "../../config.js";

type ExercicioItem = {
  id: string;
  nome: string;
  objetivo?: string | null;
  videoDemonstrativoUrl?: string | null;
  imgDemonstrativaUrl?: string | null;
  repeticoes?: string | null;
  series?: number | null;
  duracao?: string | null;
  descanso?: string | null;
};

type TreinoProgramadoDetalhe = {
  id: string;
  nome: string;
  codigo?: string | null;
  descricao?: string | null;
  objetivo?: string | null;
  imagemUrl?: string | null;
  nivel?: string | null;
  categoria?: string[] | string | null;
  pontuacao?: number | null;
  duracao?: number | null;
  exercicios: ExercicioItem[];
};

type Checklist = Record<string, boolean>;

const Storage = {
  get token() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  },
};

const TIMER_KEY = (id: string) => `footera:treino-metodologia:timer:${id}`;
const CHECKLIST_KEY = (id: string) => `footera:treino-metodologia:checklist:${id}`;

function resolveUploadUrl(raw?: string | null) {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/assets/")) return raw;
  if (raw.startsWith("/uploads/")) return `${API.BASE_URL}${raw}`;
  if (raw.startsWith("/exercicios/")) return `${API.BASE_URL}${raw}`;
  return `${API.BASE_URL}/${String(raw).replace(/^\/+/, "")}`;
}

function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
}

function isYouTubeUrl(u?: string | null) {
  if (!u) return false;
  return /(?:youtube\.com|youtu\.be)/i.test(u);
}

function toYouTubeEmbed(u: string) {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v") || "";
      if (id) return `https://www.youtube.com/embed/${id}`;
      const shorts = url.pathname.match(/\/shorts\/([^/]+)/);
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
  } catch {}
  return u;
}

function formatSerieXReps(series?: number | null, repeticoes?: string | null) {
  const reps = String(repeticoes ?? "").trim();
  if (!reps) return "";
  if (/\d+\s*x\s*\d+/i.test(reps)) return reps;
  if (series && series > 0) return `${series}x${reps}`;
  return reps;
}

function formatHHMMSS(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatCabecalhoData(date: Date) {
  const data = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(".", "");

  const hora = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${data} • ${hora}`;
}

function parseTreinoProgramadoResponse(raw: any): TreinoProgramadoDetalhe {
  const t = raw?.item ?? raw?.treino ?? raw?.data ?? raw ?? {};
  const exerciciosBrutos = Array.isArray(t?.exercicios) ? t.exercicios : [];

  const exercicios: ExercicioItem[] = exerciciosBrutos.map((row: any, idx: number) => {
    const ex =
      row?.exercicio ??
      row?.exercicioPersonalizado ??
      row?.exercicioTemporario ??
      row ??
      {};

    return {
      id: String(ex?.id ?? row?.id ?? `ex-${idx}`),
      nome: ex?.nome ?? row?.nome ?? "Exercício",
      objetivo: ex?.objetivo ?? row?.objetivo ?? null,
      videoDemonstrativoUrl:
        ex?.videoDemonstrativoUrl ??
        ex?.videoUrl ??
        row?.videoDemonstrativoUrl ??
        row?.videoUrl ??
        null,
      imgDemonstrativaUrl:
        ex?.imgDemonstrativaUrl ??
        ex?.imagemUrl ??
        row?.imgDemonstrativaUrl ??
        row?.imagemUrl ??
        null,
      repeticoes: row?.repeticoes ?? null,
      series: row?.series ?? null,
      duracao: row?.duracao ?? null,
      descanso: row?.descanso ?? null,
    };
  });

  return {
    id: String(t?.id ?? ""),
    nome: t?.nome ?? "Treino",
    codigo: t?.codigo ?? null,
    descricao: t?.descricao ?? null,
    objetivo: t?.objetivo ?? null,
    imagemUrl: t?.imagemUrl ?? null,
    nivel: t?.nivel ?? null,
    categoria: t?.categoria ?? null,
    pontuacao: t?.pontuacao ?? null,
    duracao: t?.duracao ?? null,
    exercicios,
  };
}

export default function TreinoMetodologiaPage() {
  const [, navigate] = useLocation();

  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const treinoProgramadoId = qs.get("treinoProgramadoId") || "";
  const metodologiaId = qs.get("metodologiaId") || "";
  const estruturaId = qs.get("estruturaId") || "";
  const metodologiaItemId = qs.get("metodologiaItemId") || "";

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [treino, setTreino] = useState<TreinoProgramadoDetalhe | null>(null);
  const [treinoAgendadoId, setTreinoAgendadoId] = useState<string>("");
  const [startedAtIso, setStartedAtIso] = useState<string | null>(null);
  const [status, setStatus] = useState<"PENDING" | "IN_PROGRESS" | "READY_TO_SUBMIT">("PENDING");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [videoModal, setVideoModal] = useState<{ nome: string; url: string } | null>(null);
  const tickRef = useRef<number | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${Storage.token}`,
      "Content-Type": "application/json",
    }),
    []
  );

  const checklistDone = useMemo(() => {
    const exs = treino?.exercicios ?? [];
    if (!exs.length) return false;
    return exs.every((ex) => !!checklist[ex.id]);
  }, [treino, checklist]);

  useEffect(() => {
    if (!treinoProgramadoId) {
      alert("Treino da metodologia inválido.");

      const backParams = new URLSearchParams();
      if (origem) backParams.set("origem", origem);
      if (from) backParams.set("from", from);
      if (origemTipo) backParams.set("origemTipo", origemTipo);

      navigate(`/learning${backParams.toString() ? `?${backParams.toString()}` : ""}`);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API.BASE_URL}/api/treinos/programados/${treinoProgramadoId}`, {
          headers: { Authorization: `Bearer ${Storage.token}` },
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(j?.message || "Erro ao carregar treino.");
        }

        const parsed = parseTreinoProgramadoResponse(j);
        setTreino(parsed);

        const initialChecklist: Checklist = {};
        parsed.exercicios.forEach((ex) => {
          initialChecklist[ex.id] = false;
        });
        setChecklist(initialChecklist);

        try {
          const rawChecklist = localStorage.getItem(CHECKLIST_KEY(treinoProgramadoId));
          if (rawChecklist) {
            const parsedChecklist = JSON.parse(rawChecklist);
            setChecklist((prev) => ({ ...prev, ...parsedChecklist }));
          }

          const rawStart = localStorage.getItem(TIMER_KEY(treinoProgramadoId));
          if (rawStart) {
            const startMs = Number(rawStart);
            if (!Number.isNaN(startMs) && startMs > 0) {
              setStartedAtIso(new Date(startMs).toISOString());
              setStatus("IN_PROGRESS");
              setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
            }
          }
        } catch {}
      } catch (e: any) {
        console.error(e);
        alert(e?.message || "Erro ao carregar treino da metodologia.");
        navigate(`/learning/${metodologiaId || ""}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, metodologiaId, treinoProgramadoId]);

  useEffect(() => {
    if (status !== "IN_PROGRESS") {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    let startMs = Number(localStorage.getItem(TIMER_KEY(treinoProgramadoId)) || "");
    if (!startMs || Number.isNaN(startMs)) {
      startMs = Date.now();
      localStorage.setItem(TIMER_KEY(treinoProgramadoId), String(startMs));
    }

    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedSec(sec);
    };

    update();
    const intervalId = window.setInterval(update, 1000);
    tickRef.current = intervalId as any;

    return () => {
      window.clearInterval(intervalId);
      tickRef.current = null;
    };
  }, [status, treinoProgramadoId]);

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_KEY(treinoProgramadoId), JSON.stringify(checklist));
    } catch {}
  }, [checklist, treinoProgramadoId]);

  async function garantirTreinoAgendado(): Promise<string> {
    if (treinoAgendadoId) return treinoAgendadoId;

    const r = await fetch(
      `${API.BASE_URL}/api/treinos/programados/${treinoProgramadoId}/iniciar-via-metodologia`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          metodologiaId,
          estruturaId,
          metodologiaItemId,
        }),
      }
    );

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(j?.message || "Erro ao preparar treino da metodologia.");
    }

    const agId = String(j?.treinoAgendadoId || j?.treino?.id || "");
    if (!agId) {
      throw new Error("TreinoAgendado não retornado pelo servidor.");
    }

    setTreinoAgendadoId(agId);
    return agId;
  }

  async function iniciarTreino() {
    try {
      setSalvando(true);
      const agId = await garantirTreinoAgendado();

      const r = await fetch(`${API.BASE_URL}/api/treinos/${agId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Storage.token}` },
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.message || "Erro ao iniciar treino.");
      }

      const startedAt = j?.startedAt || new Date().toISOString();
      setStartedAtIso(startedAt);
      localStorage.setItem(TIMER_KEY(treinoProgramadoId), String(new Date(startedAt).getTime()));
      setStatus("IN_PROGRESS");
      setElapsedSec(0);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Não foi possível iniciar o treino.");
    } finally {
      setSalvando(false);
    }
  }

  async function finalizarTreino() {
    try {
      if (!checklistDone) {
        alert("Marque todos os exercícios antes de finalizar.");
        return;
      }

      setSalvando(true);
      const agId = await garantirTreinoAgendado();

      const r = await fetch(`${API.BASE_URL}/api/treinos/${agId}/finish`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          metodologiaId,
          estruturaId,
          metodologiaItemId,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.message || "Erro ao finalizar treino.");
      }

      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }

      try {
        localStorage.removeItem(TIMER_KEY(treinoProgramadoId));
        localStorage.removeItem(CHECKLIST_KEY(treinoProgramadoId));
      } catch {}

       setStartedAtIso(null);
       setStatus("READY_TO_SUBMIT");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Não foi possível finalizar o treino.");
    } finally {
      setSalvando(false);
    }
  }

  function irParaSubmissao() {
    if (!treinoAgendadoId) {
      alert("Treino ainda não foi preparado corretamente.");
      return;
    }

    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }

    try {
      localStorage.removeItem(TIMER_KEY(treinoProgramadoId));
    } catch {}

    const params = new URLSearchParams();
    params.set("treinoAgendadoId", treinoAgendadoId);

    if (elapsedSec > 0) params.set("tempoSeg", String(elapsedSec));
    if (metodologiaId) params.set("metodologiaId", metodologiaId);
    if (estruturaId) params.set("estruturaId", estruturaId);
    if (metodologiaItemId) params.set("metodologiaItemId", metodologiaItemId);

    const currentSearch = new URLSearchParams(window.location.search);
    const fromAdmin = currentSearch.get("from") === "admin";
    const origem = currentSearch.get("origem");
    const origemTipo = currentSearch.get("origemTipo");

    if (fromAdmin) params.set("from", "admin");

    if (origem) {
      params.set("origem", origem);
    }

    if (origemTipo) {
      params.set("origemTipo", origemTipo);
    }

    // fallback para avulsa, caso a URL venha só com origem=avulsa
    if (!origemTipo && origem === "avulsa") {
      params.set("origemTipo", "AVULSA");
    }

    navigate(`/submissao?${params.toString()}`);
  }

  function toggleChecklist(exId: string) {
    if (status === "READY_TO_SUBMIT") return;
    setChecklist((prev) => ({ ...prev, [exId]: !prev[exId] }));
  }

  function abrirMidia(ex: ExercicioItem) {
    const url = resolveUploadUrl(ex.videoDemonstrativoUrl || ex.imgDemonstrativaUrl || "");
    if (!url) {
      alert("Este exercício ainda não possui vídeo ou imagem cadastrados.");
      return;
    }
    setVideoModal({ nome: ex.nome, url });
  }

  const cabecalhoData = useMemo(() => formatCabecalhoData(new Date()), []);
  const origem = qs.get("origem") || "";
  const origemTipo = qs.get("origemTipo") || "";
  const from = qs.get("from") || "";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-gray-600">
        Carregando treino...
      </div>
    );
  }

  if (!treino) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-gray-600">
        Treino não encontrado.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              const backParams = new URLSearchParams();

              if (origem) backParams.set("origem", origem);
              if (from) backParams.set("from", from);
              if (origemTipo) backParams.set("origemTipo", origemTipo);

              navigate(
                `/learning/${metodologiaId}${
                  backParams.toString() ? `?${backParams.toString()}` : ""
                }`
              );
            }}
            className="h-12 w-12 rounded-xl border flex items-center justify-center text-green-900"
            aria-label="Voltar"
          >
            <X className="w-6 h-6 rotate-45" />
          </button>

          <div className="text-center">
            <div className="text-2xl font-semibold text-green-800">{cabecalhoData}</div>
            {status === "IN_PROGRESS" && (
              <div className="text-sm text-gray-500 mt-1">
                Tempo correndo: {formatHHMMSS(elapsedSec)}
              </div>
            )}
            {status === "READY_TO_SUBMIT" && (
              <div className="text-sm text-gray-500 mt-1">
                Tempo realizado: {formatHHMMSS(elapsedSec)}
              </div>
            )}
          </div>

          <button
            className="h-12 w-12 rounded-xl border flex items-center justify-center text-green-900"
            aria-label="Menu"
            type="button"
          >
            <MoreVertical className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-32">
        <h1 className="text-3xl md:text-[42px] font-semibold text-green-900 mb-6">{treino.nome}</h1>

        <div className="space-y-5">
          {treino.exercicios.map((ex) => {
            const serieRep = formatSerieXReps(ex.series, ex.repeticoes);
            const done = !!checklist[ex.id];
            const mediaUrl = resolveUploadUrl(ex.videoDemonstrativoUrl || ex.imgDemonstrativaUrl || "");
            const hasMedia = !!mediaUrl;

            return (
              <div
                key={ex.id}
                className="rounded-2xl border border-[#b8c8be] bg-white px-4 py-4 flex items-start gap-4"
              >
                <button
                  onClick={() => toggleChecklist(ex.id)}
                  className={`mt-1 shrink-0 h-8 w-8 rounded-full border flex items-center justify-center ${
                    done ? "bg-green-700 border-green-700 text-white" : "bg-white border-gray-300 text-gray-400"
                  }`}
                  aria-label={done ? "Desmarcar exercício" : "Marcar exercício"}
                >
                  {done ? "✓" : "◌"}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="text-xl md:text-[24px] font-semibold text-green-900">{ex.nome}</div>

                  {serieRep ? (
                    <div className="text-base md:text-lg text-gray-600 mt-1">Repetições: {serieRep}</div>
                  ) : null}

                  {!!ex.duracao && (
                    <div className="text-base md:text-lg text-gray-600 mt-1">Duração: {ex.duracao}</div>
                  )}

                  {!!ex.descanso && (
                    <div className="text-base md:text-lg text-gray-600 mt-1">Descanso: {ex.descanso}</div>
                  )}

                  {!!ex.objetivo && (
                    <div className="text-sm text-gray-500 mt-2">{ex.objetivo}</div>
                  )}
                </div>

                <button
                    onClick={() => abrirMidia(ex)}
                    className={`shrink-0 text-base md:text-lg mt-2 ${
                        hasMedia
                        ? "text-green-700 underline"
                        : "text-gray-400 cursor-not-allowed"
                    }`}
                    >
                    Ver vídeo
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => {
              const backParams = new URLSearchParams();

              if (origem) backParams.set("origem", origem);
              if (from) backParams.set("from", from);
              if (origemTipo) backParams.set("origemTipo", origemTipo);

              navigate(
                `/learning/${metodologiaId}${
                  backParams.toString() ? `?${backParams.toString()}` : ""
                }`
              );
            }}
            className="h-14 px-4 rounded-xl border text-gray-700 bg-white flex-1"
          >
            Voltar
          </button>

          {status === "PENDING" && (
            <button
              onClick={iniciarTreino}
              disabled={salvando}
              className="h-14 px-5 rounded-xl text-white font-semibold flex-[1.4] bg-green-700 hover:bg-green-800 disabled:opacity-60"
            >
              {salvando ? "Iniciando..." : "Iniciar"}
            </button>
          )}

          {status === "IN_PROGRESS" && (
            <button
              onClick={finalizarTreino}
              disabled={salvando || !checklistDone}
              className="h-14 px-5 rounded-xl text-white font-semibold flex-[1.4] bg-green-700 hover:bg-green-800 disabled:opacity-60"
            >
              {salvando ? "Finalizando..." : "Finalizar"}
            </button>
          )}

          {status === "READY_TO_SUBMIT" && (
            <button
              onClick={irParaSubmissao}
              className="h-14 px-5 rounded-xl text-white font-semibold flex-[1.4] bg-green-700 hover:bg-green-800"
            >
              Enviar submissão
            </button>
          )}
        </div>

        {status === "IN_PROGRESS" && !checklistDone && (
          <div className="max-w-4xl mx-auto mt-2 text-xs text-gray-500">
            Marque todos os exercícios antes de finalizar o treino.
          </div>
        )}
      </div>

      {videoModal && (
        <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setVideoModal(null)}
        >
            <div
            className="relative bg-white rounded-2xl w-full max-w-[720px] max-h-[85vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            >
            <button
                onClick={() => setVideoModal(null)}
                className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white/95 border shadow flex items-center justify-center"
                aria-label="Fechar vídeo"
                type="button"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="px-4 pt-4 pb-2 border-b">
                <div className="font-semibold text-green-900 pr-12">{videoModal.nome}</div>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(85vh-64px)]">
                {isYouTubeUrl(videoModal.url) ? (
                <iframe
                    src={toYouTubeEmbed(videoModal.url)}
                    className="w-full aspect-video rounded-xl border bg-black"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={videoModal.nome}
                />
                ) : isVideoUrl(videoModal.url) ? (
                <video controls className="w-full max-h-[70vh] rounded-xl border bg-black">
                    <source src={videoModal.url} />
                    Seu navegador não suporta vídeo.
                </video>
                ) : (
                <img
                    src={videoModal.url}
                    alt={videoModal.nome}
                    className="w-full max-h-[70vh] rounded-xl border object-contain"
                />
                )}
            </div>
            </div>
        </div>
        )}
    </div>
  );
}