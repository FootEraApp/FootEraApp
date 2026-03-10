"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API } from "../../../config.js";

function getReturnTo(): string {
  const qs = new URLSearchParams(window.location.search);
  const fromQuery = qs.get("returnTo");
  if (fromQuery) return fromQuery;

  const stored = sessionStorage.getItem("treino_returnTo");
  if (stored) return stored;

  return "/admin";
}

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

async function uploadImagem(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", "Imagem");

  const res = await fetch(`${API.BASE_URL}/api/upload/imagem`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Falha ao enviar imagem.");

  const url = String(
    data?.url || data?.midia?.url || data?.path || data?.relativeUrl || ""
  ).trim();

  if (!url) throw new Error("Upload retornou sem URL da imagem.");

  return url;
}

function normalizeUrl(u?: string | null) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("http") || s.startsWith("blob:") || s.startsWith("data:")) return s;
  return `${API.BASE_URL}${s.startsWith("/") ? "" : "/"}${s}`;
}

type ProfessorMin = {
  id: string;
  nome: string;
  codigo?: string | null;
  cref?: string | null;
};

type ClubeMin = {
  id: string;
  nome: string;
  codigo?: string | null;
};

type EscolinhaMin = {
  id: string;
  nome: string;
  codigo?: string | null;
};

type TipoCriador = "Professor" | "Clube" | "Escolinha";

type ExercicioMin = {
  id: string;
  nome: string;
  codigo?: string | null;
  descricao?: string | null;
  nivel?: string | null;
  categorias?: string[] | null;
  categoria?: string[] | string | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  videoDemonstrativoUrl?: string | null;
};

type AbaExercicios = "catalogo" | "personalizados";

type ExercicioPersonalizadoItem = {
  id: string;
  nome: string;
  descricao?: string | null;
  nivel?: string | null;
  categorias?: string[];
  videoDemonstrativoUrl?: string | null;
  videoPosterUrl?: string | null;
};

type ExLinha = {
  exercicioId: string;
  ordem: number;
  repeticoes: string;
  series?: string;
  reps?: string;
  isCustom?: boolean;

  exercicioPersonalizadoId?: string | null;
  exercicioTemporarioId?: string | null;
  customTitulo?: string;
  customDesc?: string;
  customVideoFile?: File | null;
  customVideoPreviewUrl?: string | null;
  customVideoUrl?: string | null;
  customVideoPosterUrl?: string | null;
};

const opcoesCategorias = ["Sub9", "Sub11", "Sub13", "Sub15", "Sub17", "Sub20", "Livre"];
const opcoesNiveis = ["Base", "Avancado", "Performance"];
const opcoesTipoTreino = ["Técnico", "Tático", "Físico", "Mental"];

function BadgePts({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-900">
      {value} pts
    </span>
  );
}

function StepPill({
  active,
  done,
  number,
  label,
}: {
  active?: boolean;
  done?: boolean;
  number: number;
  label: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition";
  const cls = done
    ? "border-green-200 bg-green-50 text-green-800"
    : active
    ? "border-green-700 bg-green-700 text-white"
    : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <span className={`${base} ${cls}`}>
      <span
        className={[
          "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
          done ? "bg-green-700 text-white" : active ? "bg-white/20 text-white" : "bg-white text-gray-700 border",
        ].join(" ")}
      >
        {done ? "✓" : number}
      </span>
      {label}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function formatProfessorLabel(p: ProfessorMin) {
  const codigo = p.codigo ? String(p.codigo) : "";
  const cref = p.cref ? String(p.cref) : "";
  const tail = [codigo && `(${codigo})`, cref && `- ${cref}`].filter(Boolean).join(" ");
  return `${p.nome}${tail ? " " + tail : ""}`;
}

function formatClubeLabel(c: ClubeMin) {
  const codigo = c.codigo ? ` (${c.codigo})` : "";
  return `${c.nome}${codigo}`;
}

function formatEscolinhaLabel(e: EscolinhaMin) {
  const codigo = e.codigo ? ` (${e.codigo})` : "";
  return `${e.nome}${codigo}`;
}

function coerceCategorias(ex: ExercicioMin): string[] {
  const raw: any = (ex as any).categorias ?? (ex as any).categoria ?? null;
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function getVideoUrlFromEx(ex: ExercicioMin | null | undefined) {
  if (!ex) return "";
  return String((ex as any).videoDemonstrativoUrl || ex.videoUrl || "").trim();
}

function parseSeriesRepsFromRepeticoes(repeticoes: string) {
  const raw = String(repeticoes || "").trim();
  const m = raw.match(/^\s*(\d+)\s*[xX]\s*(\d+)\s*$/);
  if (m) return { series: m[1], reps: m[2] };
  return { series: "", reps: "" };
}

function buildRepeticoes(series: string, reps: string) {
  const s = String(series || "").trim();
  const r = String(reps || "").trim();
  if (!s && !r) return "";
  if (s && r) return `${s}x${r}`;
  return "";
}

function getThumbUrlFromEx(ex: ExercicioMin | null | undefined) {
  if (!ex) return "";
  return String((ex as any).thumbUrl || (ex as any).capaUrl || (ex as any).imagemUrl || "").trim();
}

async function uploadVideo(
  token: string,
  file: File
): Promise<{ url: string; thumbUrl?: string | null }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", "Video");

  const res = await fetch(`${API.BASE_URL}/api/upload/video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Falha ao enviar vídeo.");

  const url = String(
    data?.url || data?.midia?.url || data?.path || data?.relativeUrl || ""
  ).trim();

  const thumbUrl = data?.thumbUrl || data?.midia?.thumbUrl || null;

  if (!url) throw new Error("Upload retornou sem URL do vídeo.");

  return { url, thumbUrl: thumbUrl ? String(thumbUrl) : null };
}

async function gerarPosterDoVideo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Falha ao carregar metadata do vídeo"));
    });

    const target = Math.min(0.2, (video.duration || 1) * 0.05);
    video.currentTime = target;

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Falha ao buscar frame do vídeo"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sem canvas ctx");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function VideoModal({
  open,
  title,
  src,
  onClose,
}: {
  open: boolean;
  title?: string;
  src: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-gray-900">
              {title || "Vídeo do exercício"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-blue-700 underline hover:text-blue-800"
          >
            Fechar
          </button>
        </div>

        <div className="p-4">
          <div className="overflow-hidden rounded-xl bg-black">
            {src ? (
              <video
                src={src}
                controls
                autoPlay
                className="h-[60vh] w-full bg-black object-contain"
              />
            ) : (
              <div className="grid h-[60vh] place-items-center text-white/80">
                Sem vídeo disponível para este exercício.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CriarOuEditarTreino() {
  const [step, setStep] = useState<1 | 2>(1);
  const [id, setId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoTreino, setTipoTreino] = useState("Técnico");
  const [duracaoMin, setDuracaoMin] = useState<number>(60);

  const [tipoCriador, setTipoCriador] = useState<TipoCriador>("Professor");
  const [criadorId, setCriadorId] = useState("");
  const [treinoFootera, setTreinoFootera] = useState(false);

  const [professorId, setProfessorId] = useState("");
  const [professoresDisponiveis, setProfessoresDisponiveis] = useState<ProfessorMin[]>([]);
  const [clubesDisponiveis, setClubesDisponiveis] = useState<ClubeMin[]>([]);
  const [escolinhasDisponiveis, setEscolinhasDisponiveis] = useState<EscolinhaMin[]>([]);

  const [profSearch, setProfSearch] = useState("");
  const [professoresColabIds, setProfessoresColabIds] = useState<string[]>([]);

  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [capaPreviewUrl, setCapaPreviewUrl] = useState<string>("");

  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<ExercicioMin[]>([]);
  const [exSearch, setExSearch] = useState("");
  const [catsSelecionadas, setCatsSelecionadas] = useState<string[]>([]);
  const [niveisSelecionados, setNiveisSelecionados] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<ExLinha[]>([]);
  const [nivelTreino, setNivelTreino] = useState("Base");

  const [abaExercicios, setAbaExercicios] = useState<AbaExercicios>("catalogo");

  const [exerciciosPersonalizados, setExerciciosPersonalizados] = useState<
    ExercicioPersonalizadoItem[]
  >([]);
  const [loadingPersonalizados, setLoadingPersonalizados] = useState(false);

  const [filtroPers, setFiltroPers] = useState("");
  const [filtroPersNivel, setFiltroPersNivel] = useState<string>("");
  const [filtroPersVideo, setFiltroPersVideo] = useState<"" | "com" | "sem">("");

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [returnTo, setReturnTo] = useState<string>("/admin");

  useEffect(() => {
    const rt = getReturnTo();
    setReturnTo(rt);
    sessionStorage.removeItem("treino_returnTo");
  }, []);

  useEffect(() => {
    if (!capaFile) {
      setCapaPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(capaFile);
    setCapaPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [capaFile]);

  const openVideo = (src: string, title: string) => {
    setVideoSrc(src);
    setVideoTitle(title);
    setVideoOpen(true);
  };

  const closeVideo = () => {
    setVideoOpen(false);
    setVideoSrc("");
    setVideoTitle("");
  };

  const pts = useMemo(() => {
    return Math.max(0, linhas.filter((l) => l.exercicioId || l.isCustom).length * 3);
  }, [linhas]);

  useEffect(() => {
    const token = getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const params = new URLSearchParams(window.location.search);
    const treinoId = params.get("id");
    if (treinoId) setId(treinoId);

    const loadTreino = async () => {
      if (!treinoId) return;

      const res = await fetch(`${API.BASE_URL}/api/treinosprogramados/${treinoId}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Erro ao carregar treino");

      setTitulo(data.nome || "");
      setDescricao(data.descricao || "");
      setNivelTreino(data.nivel || "Base");
      setProfessorId(data.professorId || "");
      setTipoTreino(data.tipoTreino ? String(data.tipoTreino) : "Técnico");
      setDuracaoMin(typeof data.duracao === "number" ? data.duracao : 60);
      setCatsSelecionadas(Array.isArray(data.categoria) ? data.categoria : []);

      if (data.professorId) {
        setTipoCriador("Professor");
        setCriadorId(String(data.professorId));
      } else if (data.clubeId) {
        setTipoCriador("Clube");
        setCriadorId(String(data.clubeId));
      } else if (data.escolinhaId) {
        setTipoCriador("Escolinha");
        setCriadorId(String(data.escolinhaId));
      }

      setTreinoFootera(Boolean(data.publico ?? data.parceiro ?? data.isFootera ?? false));

      if (Array.isArray(data.professoresColabIds)) {
        setProfessoresColabIds(data.professoresColabIds.map(String));
      } else if (Array.isArray(data.professoresRealizadores)) {
        setProfessoresColabIds(
          data.professoresRealizadores
            .map((p: any) => String(p?.id || p?.professorId || ""))
            .filter(Boolean)
        );
      }

      const loaded: ExLinha[] =
        (data.exercicios ?? []).map((row: any, i: number) => {
          const repStr = String(row.repeticoes ?? "");
          const sr = parseSeriesRepsFromRepeticoes(repStr);
          const ex = row.exercicio || row.exercicioPersonalizado || row.exercicioTemporario;
          const isCustom = !!row.exercicioPersonalizadoId || !!row.exercicioTemporarioId;

          return {
            exercicioId: String(row.exercicioId ?? ""),
            ordem: Number(row.ordem ?? i + 1),
            repeticoes: repStr,
            series: sr.series,
            reps: sr.reps,
            ...(isCustom
              ? {
                  isCustom: true,
                  exercicioPersonalizadoId: row.exercicioPersonalizadoId
                    ? String(row.exercicioPersonalizadoId)
                    : null,
                  exercicioTemporarioId: row.exercicioTemporarioId
                    ? String(row.exercicioTemporarioId)
                    : null,
                  customTitulo: String(ex?.nome ?? ""),
                  customDesc: ex?.descricao ?? "",
                  customVideoPreviewUrl: normalizeUrl(ex?.videoDemonstrativoUrl),
                  customVideoUrl: ex?.videoDemonstrativoUrl ? String(ex.videoDemonstrativoUrl) : null,
                  customVideoFile: null,
                  customVideoPosterUrl: normalizeUrl(ex?.videoPosterUrl),
                }
              : {}),
          };
        }) || [];

      setLinhas(loaded);
    };

    const loadExercicios = async () => {
      const res = await fetch(`${API.BASE_URL}/api/exercicios`, { headers });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Erro ao carregar exercícios");
      setExerciciosDisponiveis(Array.isArray(data) ? data : []);
    };

    const loadProfessores = async () => {
      const res = await fetch(`${API.BASE_URL}/api/professores`, { headers });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Erro ao carregar professores");
      setProfessoresDisponiveis(Array.isArray(data) ? data : []);
    };

    const loadClubes = async () => {
      const res = await fetch(`${API.BASE_URL}/api/clubes`, { headers });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Erro ao carregar clubes");
      setClubesDisponiveis(Array.isArray(data) ? data : []);
    };

    const loadEscolinhas = async () => {
      const res = await fetch(`${API.BASE_URL}/api/escolinhas`, { headers });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Erro ao carregar escolinhas");
      setEscolinhasDisponiveis(Array.isArray(data) ? data : []);
    };

    (async () => {
      try {
        await Promise.all([
          loadExercicios(),
          loadProfessores(),
          loadClubes(),
          loadEscolinhas(),
        ]);
        await loadTreino();
      } catch (e: any) {
        console.error(e);
        alert(e?.message || "Falha ao carregar dados");
      }
    })();
  }, []);

  useEffect(() => {
    if (abaExercicios !== "personalizados") return;
    fetchExerciciosPersonalizados();
  }, [abaExercicios]);

  const exerciciosSelecionadosSet = useMemo(() => {
    return new Set(
      linhas.filter((l) => !l.isCustom && !!l.exercicioId).map((l) => l.exercicioId)
    );
  }, [linhas]);

  const professoresFiltrados = useMemo(() => {
    const q = profSearch.trim().toLowerCase();
    if (!q) return professoresDisponiveis;
    return professoresDisponiveis.filter((p) =>
      [p.nome, p.codigo, p.cref].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [professoresDisponiveis, profSearch]);

  const opcoesCriador = useMemo(() => {
    if (tipoCriador === "Professor") {
      return professoresDisponiveis.map((p) => ({
        id: p.id,
        label: formatProfessorLabel(p),
      }));
    }

    if (tipoCriador === "Clube") {
      return clubesDisponiveis.map((c) => ({
        id: c.id,
        label: formatClubeLabel(c),
      }));
    }

    return escolinhasDisponiveis.map((e) => ({
      id: e.id,
      label: formatEscolinhaLabel(e),
    }));
  }, [tipoCriador, professoresDisponiveis, clubesDisponiveis, escolinhasDisponiveis]);

  const exerciciosFiltrados = useMemo(() => {
    const q = exSearch.trim().toLowerCase();

    return exerciciosDisponiveis.filter((ex) => {
      const hay = [ex.nome, ex.codigo, ex.descricao, ex.nivel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !hay.includes(q)) return false;

      if (niveisSelecionados.length) {
        const n = String(ex.nivel || "").trim();
        if (!niveisSelecionados.includes(n)) return false;
      }

      if (catsSelecionadas.length) {
        const cats = coerceCategorias(ex);
        const ok = catsSelecionadas.some((c) => cats.includes(c));
        if (!ok) return false;
      }

      return true;
    });
  }, [exerciciosDisponiveis, exSearch, niveisSelecionados, catsSelecionadas]);

  function revokeIfBlob(url?: string | null) {
    if (!url || !url.startsWith("blob:")) return;
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 3000);
  }

  const fetchExerciciosPersonalizados = async () => {
    const token = getToken();

    if (!token) {
      setExerciciosPersonalizados([]);
      return;
    }

    try {
      setLoadingPersonalizados(true);

      const res = await fetch(`${API.BASE_URL}/api/treinos/exercicios/personalizados`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data?.message || "Erro ao carregar exercícios personalizados");
      }

      const arr = Array.isArray(data) ? data : data?.items ?? [];

      setExerciciosPersonalizados(
        (Array.isArray(arr) ? arr : []).map((x: any) => ({
          id: String(x.id),
          nome: String(x.nome ?? "Exercício"),
          descricao: x.descricao ?? null,
          nivel: x.nivel ?? null,
          categorias: Array.isArray(x.categorias) ? x.categorias : [],
          videoDemonstrativoUrl: x.videoDemonstrativoUrl ?? null,
          videoPosterUrl: x.videoPosterUrl ?? null,
        }))
      );
    } catch (e) {
      console.error(e);
      setExerciciosPersonalizados([]);
    } finally {
      setLoadingPersonalizados(false);
    }
  };

  const limparProgresso = () => {
    if (!confirm("Tem certeza que deseja limpar o progresso deste formulário?")) return;

    setLinhas((prev) => {
      prev.forEach((l) => revokeIfBlob(l.customVideoPreviewUrl));
      return [];
    });

    setStep(1);
    setTitulo("");
    setDescricao("");
    setTipoTreino("Técnico");
    setDuracaoMin(60);

    setTipoCriador("Professor");
    setCriadorId("");
    setTreinoFootera(false);

    setProfessorId("");
    setProfSearch("");
    setProfessoresColabIds([]);
    setCapaFile(null);
    setNivelTreino("Base");
    setExSearch("");
    setCatsSelecionadas([]);
    setNiveisSelecionados([]);
  };

  const adicionarLinhaPersonalizada = () => {
    setLinhas((prev) => [
      ...prev,
      {
        exercicioId: "",
        ordem: prev.length + 1,
        repeticoes: "",
        series: "",
        reps: "",
        isCustom: true,
        customTitulo: "",
        customDesc: "",
        customVideoFile: null,
        customVideoPreviewUrl: null,
        customVideoPosterUrl: null,
      },
    ]);
  };

  const adicionarExercicioExistente = (exercicioId: string) => {
    setLinhas((prev) => {
      if (prev.some((l) => !l.isCustom && l.exercicioId === exercicioId)) {
        return prev;
      }

      const next = [...prev];
      next.push({
        exercicioId,
        ordem: next.length + 1,
        repeticoes: "",
        series: "",
        reps: "",
      });
      return next;
    });
  };

  const treinoTemPersonalizado = (id: string) => {
    return linhas.some(
      (l) => String(l.exercicioPersonalizadoId || "") === String(id)
    );
  };

  const adicionarPersonalizadoExistente = (p: ExercicioPersonalizadoItem) => {
    setLinhas((prev) => {
      const jaTem = prev.some(
        (l) => String(l.exercicioPersonalizadoId || "") === String(p.id)
      );
      if (jaTem) return prev;

      return [
        ...prev,
        {
          exercicioId: "",
          ordem: prev.length + 1,
          repeticoes: "",
          series: "",
          reps: "",
          isCustom: true,

          exercicioPersonalizadoId: String(p.id),
          exercicioTemporarioId: null,

          customTitulo: String(p.nome ?? "").trim(),
          customDesc: p.descricao ?? "",
          customVideoFile: null,
          customVideoPreviewUrl: p.videoDemonstrativoUrl ?? null,
          customVideoUrl: p.videoDemonstrativoUrl ?? null,
          customVideoPosterUrl: p.videoPosterUrl ?? null,
        },
      ];
    });
  };

  const removerLinha = (idx: number) => {
    setLinhas((prev) => {
      const toRemove = prev[idx];
      revokeIfBlob(toRemove?.customVideoPreviewUrl);
      const next = prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, ordem: i + 1 }));
      return next;
    });
  };

  const atualizarLinha = (idx: number, patch: Partial<ExLinha>) => {
    setLinhas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const setLinhaSeriesReps = (idx: number, series: string, reps: string) => {
    const repeticoes = buildRepeticoes(series, reps);
    atualizarLinha(idx, { series, reps, repeticoes });
  };

  const onUploadVideoCustom = async (idx: number, file: File | null) => {
    setLinhas((prev) => {
      const next = [...prev];
      const cur = next[idx];
      revokeIfBlob(cur?.customVideoPreviewUrl);
      next[idx] = {
        ...cur,
        customVideoFile: null,
        customVideoPreviewUrl: null,
        customVideoPosterUrl: null,
      };
      return next;
    });

    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    const token = getToken();

    let posterUrlFinal: string | null = null;
    try {
      const posterDataUrl = await gerarPosterDoVideo(file);
      const posterFile = dataUrlToFile(posterDataUrl, `thumb-${Date.now()}.jpg`);
      const uploadedPosterUrl = await uploadImagem(token, posterFile);
      posterUrlFinal = uploadedPosterUrl;
    } catch {
      posterUrlFinal = null;
    }

    setLinhas((prev) => {
      const next = [...prev];
      const cur = next[idx];
      next[idx] = {
        ...cur,
        customVideoFile: file,
        customVideoPreviewUrl: previewUrl,
        customVideoPosterUrl: posterUrlFinal,
      };
      return next;
    });
  };

  const podeIrProximo = useMemo(() => {
    if (step === 1) {
      if (!titulo.trim()) return false;
      if (!nivelTreino) return false;
      if (!criadorId) return false;
      return true;
    }
    return true;
  }, [step, titulo, nivelTreino, criadorId]);

  const onVoltar = () => {
    if (step === 1) {
      window.location.href = returnTo;
      return;
    }

    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onProximo = () => {
    if (step === 1) {
      if (!podeIrProximo) {
        alert("Preencha o título, o nível e selecione quem será o criador.");
        return;
      }

      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      alert("Título do treino é obrigatório.");
      setStep(1);
      return;
    }

    if (!criadorId.trim()) {
      alert("Selecione quem será o criador do treino.");
      setStep(1);
      return;
    }

    const temAlgum = linhas.some(
      (l) => (!!l.exercicioId && !l.isCustom) || (l.isCustom && (l.customTitulo || "").trim())
    );

    if (!temAlgum) {
      alert("Adicione ao menos 1 exercício (do banco ou personalizado).");
      setStep(2);
      return;
    }

    const token = getToken();

    const linhasComVideo = [...linhas];
    for (let idx = 0; idx < linhasComVideo.length; idx++) {
      const l = linhasComVideo[idx];
      if (l.isCustom && l.customVideoFile) {
        const up = await uploadVideo(token, l.customVideoFile);

        revokeIfBlob(l.customVideoPreviewUrl);

        linhasComVideo[idx] = {
          ...l,
          customVideoUrl: up.url,
          customVideoPreviewUrl: up.url,
          customVideoPosterUrl: l.customVideoPosterUrl ?? up.thumbUrl ?? null,
          customVideoFile: null,
        };
      }
    }

    const exerciciosPayload = await Promise.all(
      linhasComVideo.map(async (l, i) => {
        const ordem = Number(l.ordem ?? i + 1);
        const repeticoes = buildRepeticoes(String(l.series ?? ""), String(l.reps ?? ""));

        if (!l.isCustom && l.exercicioId) {
          return {
            exercicioId: l.exercicioId,
            ordem,
            repeticoes,
          };
        }

        if (l.isCustom) {
          const nome = String(l.customTitulo || "").trim();
          if (!nome) return null;

          const descricao = String(l.customDesc || "").trim() || null;
          const videoDemonstrativoUrl = String(l.customVideoUrl || "").trim() || null;
          const videoPosterUrl = String(l.customVideoPosterUrl || "").trim() || null;

          return {
            exercicioPersonalizadoId: l.exercicioPersonalizadoId ?? null,
            exercicioTemporarioId: l.exercicioTemporarioId ?? null,
            nome,
            descricao,
            videoDemonstrativoUrl,
            videoPosterUrl,
            ordem,
            repeticoes,
          };
        }

        return null;
      })
    );

    const exerciciosFinal = exerciciosPayload.filter(Boolean);

    if (exerciciosFinal.length === 0) {
      alert("Adicione ao menos 1 exercício (do banco ou personalizado) para salvar o treino.");
      setStep(2);
      return;
    }

    const tipoUsuario = tipoCriador;
    const tipoUsuarioId = criadorId.trim();

    const payload: any = {
      nome: titulo,
      descricao,
      nivel: nivelTreino,
      tipoTreino,
      duracao: duracaoMin,
      tipoUsuario,
      tipoUsuarioId,
      publico: treinoFootera,
      parceiro: treinoFootera,
      isFootera: treinoFootera,
      ...(professorId ? { criadorProfessorId: professorId } : {}),
      professoresColabIds,
      ...(catsSelecionadas.length ? { categoria: catsSelecionadas } : {}),
      exercicios: exerciciosFinal,
    };

    const url = `${API.BASE_URL}/api/treinosprogramados${id ? `/${id}` : ""}`;

    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));

      if (capaFile) {
        formData.append("imagem", capaFile);
      }

      const res = await fetch(url, {
        method: id ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Erro ao salvar treino.");

      alert(`Treino ${id ? "atualizado" : "criado"} com sucesso!`);
      window.location.href = returnTo;
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Erro ao salvar treino.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <VideoModal open={videoOpen} title={videoTitle} src={videoSrc} onClose={closeVideo} />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="sticky top-0 z-20 -mx-4 mb-6 bg-gray-50/80 px-4 pb-3 pt-2 backdrop-blur">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onVoltar}
                className="rounded-xl bg-gray-100 px-5 py-2 font-semibold text-gray-800 hover:bg-gray-200"
              >
                Voltar
              </button>

              <div className="flex flex-1 items-center justify-center gap-3">
                <StepPill active={step === 1} done={step > 1} number={1} label="Informações" />
                <span className="hidden h-px w-14 bg-gray-200 sm:block" />
                <StepPill active={step === 2} done={false} number={2} label="Exercícios" />
              </div>

              <button
                type="button"
                onClick={onProximo}
                disabled={!podeIrProximo}
                className={[
                  "rounded-xl px-6 py-2 font-semibold text-white",
                  podeIrProximo ? "bg-green-800 hover:bg-green-900" : "bg-green-600 cursor-not-allowed",
                ].join(" ")}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">
                {id ? "Editar Treino" : "Criar Novo Treino"}
              </h1>
              <p className="mt-1 text-sm text-gray-600">{id || ""}</p>
            </div>

            <div className="flex items-center gap-4">
              <BadgePts value={pts} />
              <button
                type="button"
                onClick={limparProgresso}
                className="text-sm font-semibold text-red-600 underline hover:text-red-700"
              >
                Limpar progresso
              </button>
            </div>
          </div>
        </div>

        {step === 1 ? (
          <Card title="Informações Básicas">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Título do Treino*
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                  placeholder="Título do Treino"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800">Descrição (opcional)</label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                  placeholder="Descrição do Treino"
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">
                    Tipo do Treino*
                  </label>
                  <select
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                    value={tipoTreino}
                    onChange={(e) => setTipoTreino(e.target.value)}
                  >
                    {opcoesTipoTreino.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800">
                    Duração do Treino (minutos) (opcional)
                  </label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                    value={duracaoMin}
                    onChange={(e) => setDuracaoMin(Number(e.target.value || 0))}
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">
                    Nível do Treino*
                  </label>
                  <select
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                    value={nivelTreino}
                    onChange={(e) => setNivelTreino(e.target.value)}
                  >
                    {opcoesNiveis.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800">
                    Publicação do treino*
                  </label>

                  <button
                    type="button"
                    onClick={() => setTreinoFootera((v) => !v)}
                    className={[
                      "mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition",
                      treinoFootera
                        ? "border-green-700 bg-green-50"
                        : "border-gray-200 bg-white hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {treinoFootera
                          ? "✅ Treino Footera (público)"
                          : "Treino normal (privado)"}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-600">
                        {treinoFootera
                          ? "O treino ficará marcado como Footera."
                          : "O treino ficará como treino normal."}
                      </div>
                    </div>

                    <span
                      className={[
                        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition",
                        treinoFootera
                          ? "border-green-700 bg-green-700"
                          : "border-gray-300 bg-gray-200",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                          treinoFootera ? "translate-x-6" : "translate-x-1",
                        ].join(" ")}
                      />
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">
                    Quem será o criador do treino*
                  </label>

                  <select
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                    value={tipoCriador}
                    onChange={(e) => {
                      setTipoCriador(e.target.value as TipoCriador);
                      setCriadorId("");
                    }}
                  >
                    <option value="Professor">Professor</option>
                    <option value="Clube">Clube</option>
                    <option value="Escolinha">Escolinha</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800">
                    {tipoCriador === "Professor"
                      ? "Professor criador*"
                      : tipoCriador === "Clube"
                      ? "Clube criador*"
                      : "Escolinha criadora*"}
                  </label>

                  <select
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                    value={criadorId}
                    onChange={(e) => setCriadorId(e.target.value)}
                  >
                    <option value="">
                      {tipoCriador === "Professor"
                        ? "Selecione um professor"
                        : tipoCriador === "Clube"
                        ? "Selecione um clube"
                        : "Selecione uma escolinha"}
                    </option>

                    {opcoesCriador.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Professor responsável (opcional)
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                >
                  <option value="">Nenhum professor responsável</option>
                  {professoresDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatProfessorLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Professores realizadores (colaboradores) (opcional)
                </label>

                <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-3">
                  <input
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                    placeholder="Buscar professor..."
                    value={profSearch}
                    onChange={(e) => setProfSearch(e.target.value)}
                  />

                  <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-gray-100">
                    {professoresFiltrados.length === 0 ? (
                      <div className="p-4 text-sm text-gray-600">Nenhum professor encontrado.</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {professoresFiltrados.map((p) => {
                          const checked = professoresColabIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProfessoresColabIds((prev) =>
                                      prev.includes(p.id) ? prev : [...prev, p.id]
                                    );
                                  } else {
                                    setProfessoresColabIds((prev) => prev.filter((x) => x !== p.id));
                                  }
                                }}
                              />
                              <span className="text-sm font-medium text-gray-900">
                                {formatProfessorLabel(p)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Categorias do treino (opcional)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {opcoesCategorias.map((cat) => {
                    const checked = catsSelecionadas.includes(cat);
                    return (
                      <label
                        key={cat}
                        className={[
                          "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                          checked
                            ? "border-green-700 bg-green-50 text-green-800"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCatsSelecionadas((prev) => [...prev, cat]);
                            } else {
                              setCatsSelecionadas((prev) => prev.filter((x) => x !== cat));
                            }
                          }}
                        />
                        {cat}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Capa do Treino (opcional)
                </label>

                <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    {capaPreviewUrl ? (
                      <img
                        src={capaPreviewUrl}
                        alt="Prévia da capa"
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-48 place-items-center text-sm text-gray-500">
                        Sem capa
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                      Upload da galeria
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setCapaFile(e.target.files?.[0] || null)}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setCapaFile(null)}
                      className="text-sm font-semibold text-red-600 underline hover:text-red-700"
                    >
                      Remover capa
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-gray-600">
                    Você pode escolher uma imagem da galeria. Se não escolher, o treino ficará sem capa.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card title="Exercícios Selecionados">
              {linhas.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum exercício adicionado ainda.</p>
              ) : (
                <div className="space-y-4">
                  {linhas.map((l, idx) => {
                    const ex = l.exercicioId
                      ? exerciciosDisponiveis.find((e) => e.id === l.exercicioId)
                      : null;
                    const isPersonalizadoExistente = !!l.exercicioPersonalizadoId;
                    const exVideo = getVideoUrlFromEx(ex);
                    const nivel = ex ? String(ex.nivel || "").trim() : "";
                    const isCustom = !!l.isCustom;

                    return (
                      <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start">
                          <div className="w-full md:w-[180px]">
                            <div className="relative h-[110px] w-full overflow-hidden rounded-xl bg-gray-100">
                              {!isCustom && exVideo ? (
                                <>
                                  {getThumbUrlFromEx(ex) ? (
                                    <img
                                      src={normalizeUrl(getThumbUrlFromEx(ex))}
                                      alt="Thumb do exercício"
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  ) : (
                                    <video
                                      src={normalizeUrl(exVideo)}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openVideo(normalizeUrl(exVideo), ex?.nome || "Vídeo do exercício")
                                    }
                                    className="absolute inset-0 grid place-items-center bg-black/25 text-white"
                                    title="Assistir vídeo"
                                  >
                                    <div className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur">
                                      <span className="text-2xl leading-none">▶</span>
                                    </div>
                                  </button>
                                </>
                              ) : null}

                              {isCustom && l.customVideoPreviewUrl ? (
                                <>
                                  {l.customVideoPosterUrl ? (
                                    <img
                                      src={normalizeUrl(l.customVideoPosterUrl)}
                                      alt="Thumb do vídeo"
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  ) : (
                                    <video
                                      src={normalizeUrl(l.customVideoPreviewUrl)}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openVideo(
                                        normalizeUrl(l.customVideoUrl || l.customVideoPreviewUrl || ""),
                                        l.customTitulo || "Vídeo"
                                      )
                                    }
                                    className="absolute inset-0 grid place-items-center bg-black/25 text-white"
                                    title="Assistir vídeo"
                                  >
                                    <div className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur">
                                      <span className="text-2xl leading-none">▶</span>
                                    </div>
                                  </button>
                                </>
                              ) : null}

                              {!exVideo && !(isCustom && l.customVideoPreviewUrl) ? (
                                <div className="grid h-full w-full place-items-center text-sm text-gray-600">
                                  sem vídeo
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                {l.isCustom ? (
                                  isPersonalizadoExistente ? (
                                    <div className="text-lg font-extrabold text-gray-900">
                                      {l.customTitulo || "Exercício personalizado"}
                                    </div>
                                  ) : (
                                    <input
                                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-green-600"
                                      placeholder="Nome do exercício personalizado"
                                      value={l.customTitulo || ""}
                                      onChange={(e) =>
                                        atualizarLinha(idx, { customTitulo: e.target.value })
                                      }
                                    />
                                  )
                                ) : (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-lg font-extrabold text-gray-900">{ex?.nome}</div>

                                    {nivel && (
                                      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
                                        {nivel}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="mt-1">
                                  {l.isCustom ? (
                                    isPersonalizadoExistente ? (
                                      l.customDesc ? (
                                        <p className="text-sm text-gray-700">{l.customDesc}</p>
                                      ) : null
                                    ) : (
                                      <textarea
                                        className="mt-2 min-h-[92px] w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-600"
                                        placeholder="Descrição do exercício personalizado"
                                        value={l.customDesc || ""}
                                        onChange={(e) =>
                                          atualizarLinha(idx, { customDesc: e.target.value })
                                        }
                                      />
                                    )
                                  ) : ex?.descricao ? (
                                    <p className="text-sm text-gray-700">{ex.descricao}</p>
                                  ) : null}
                                </div>

                                {l.isCustom && !isPersonalizadoExistente && (
                                  <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                                      Upload de vídeo
                                      <input
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) =>
                                          onUploadVideoCustom(idx, e.target.files?.[0] || null)
                                        }
                                      />
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => onUploadVideoCustom(idx, null)}
                                      className="text-sm font-semibold text-red-600 underline hover:text-red-700"
                                    >
                                      Remover vídeo
                                    </button>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => removerLinha(idx)}
                                className="text-sm font-semibold text-red-600 underline hover:text-red-700"
                              >
                                Remover
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700">
                                  Séries
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-600"
                                  placeholder="ex.: 3"
                                  value={l.series || ""}
                                  onChange={(e) =>
                                    setLinhaSeriesReps(idx, e.target.value, l.reps || "")
                                  }
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700">
                                  Repetições
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-600"
                                  placeholder="ex.: 12"
                                  value={l.reps || ""}
                                  onChange={(e) =>
                                    setLinhaSeriesReps(idx, l.series || "", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={adicionarLinhaPersonalizada}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200"
                >
                  + Adicionar linha (personalizado)
                </button>
              </div>
            </Card>

            <Card title="Exercícios Disponíveis">
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAbaExercicios("catalogo")}
                  className={[
                    "rounded-xl border px-4 py-2 text-sm font-bold transition",
                    abaExercicios === "catalogo"
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Exercícios (BD)
                </button>

                <button
                  type="button"
                  onClick={() => setAbaExercicios("personalizados")}
                  className={[
                    "rounded-xl border px-4 py-2 text-sm font-bold transition",
                    abaExercicios === "personalizados"
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Personalizados
                </button>
              </div>
              {abaExercicios === "catalogo" ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <div className="relative">
                          <input
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-gray-900 outline-none focus:border-green-600"
                            placeholder="Buscar por nome, nível ou descrição..."
                            value={exSearch}
                            onChange={(e) => setExSearch(e.target.value)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                            ⌕
                          </span>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600">
                        {exerciciosFiltrados.length} resultado(s)
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="mb-2 text-sm font-bold text-gray-900">Categorias</div>
                    <div className="max-h-48 overflow-auto pr-2">
                      {opcoesCategorias.map((cat) => {
                        const checked = catsSelecionadas.includes(cat);
                        return (
                          <label
                            key={cat}
                            className="flex cursor-pointer items-center gap-2 py-1 text-sm text-gray-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCatsSelecionadas((prev) =>
                                    prev.includes(cat) ? prev : [...prev, cat]
                                  );
                                } else {
                                  setCatsSelecionadas((prev) => prev.filter((x) => x !== cat));
                                }
                              }}
                            />
                            {cat}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="mb-2 text-sm font-bold text-gray-900">Níveis</div>
                    <div className="max-h-48 overflow-auto pr-2">
                      {opcoesNiveis.map((n) => {
                        const checked = niveisSelecionados.includes(n);
                        return (
                          <label
                            key={n}
                            className="flex cursor-pointer items-center gap-2 py-1 text-sm text-gray-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNiveisSelecionados((prev) =>
                                    prev.includes(n) ? prev : [...prev, n]
                                  );
                                } else {
                                  setNiveisSelecionados((prev) => prev.filter((x) => x !== n));
                                }
                              }}
                            />
                            {n}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Você pode combinar vários níveis (ex.: Base + Avancado).
                    </p>
                  </div>

                  <div className="flex items-start justify-end lg:col-span-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCatsSelecionadas([]);
                        setNiveisSelecionados([]);
                        setExSearch("");
                      }}
                      className="text-sm font-semibold text-gray-600 underline hover:text-gray-800"
                    >
                      Limpar filtros
                    </button>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="max-h-[520px] overflow-auto rounded-2xl border border-gray-200 bg-white">
                      {exerciciosFiltrados.length === 0 ? (
                        <div className="p-6 text-sm text-gray-600">
                          Nenhum exercício encontrado com esses filtros.
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {exerciciosFiltrados.map((ex) => {
                            const nivel = String(ex.nivel || "").trim();
                            const cats = coerceCategorias(ex);
                            const exVideo = getVideoUrlFromEx(ex);
                            const jaSelecionado = exerciciosSelecionadosSet.has(ex.id);

                            return (
                              <div key={ex.id} className="p-4">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                  <div className="flex gap-4">
                                    <div className="relative grid h-24 w-40 place-items-center overflow-hidden rounded-2xl bg-black/90 text-white">
                                      {exVideo ? (
                                        <>
                                          {getThumbUrlFromEx(ex) ? (
                                            <img
                                              src={normalizeUrl(getThumbUrlFromEx(ex))}
                                              alt="Thumb do exercício"
                                              className="absolute inset-0 h-full w-full object-cover"
                                            />
                                          ) : null}

                                          <button
                                            type="button"
                                            onClick={() =>
                                              openVideo(
                                                normalizeUrl(exVideo),
                                                ex.nome || "Vídeo do exercício"
                                              )
                                            }
                                            className="absolute inset-0 grid place-items-center bg-black/60"
                                            title="Assistir vídeo"
                                          >
                                            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/20">
                                              <span className="text-2xl">▶</span>
                                            </div>
                                          </button>
                                        </>
                                      ) : (
                                        <div className="text-sm text-white/80">sem vídeo</div>
                                      )}
                                    </div>

                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-lg font-extrabold text-gray-900">
                                          {ex.nome}
                                        </div>

                                        {nivel && (
                                          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
                                            {nivel}
                                          </span>
                                        )}
                                      </div>

                                      {ex.descricao && (
                                        <p className="mt-1 max-w-2xl text-sm text-gray-700">
                                          {ex.descricao}
                                        </p>
                                      )}

                                      {cats.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {cats.slice(0, 10).map((c) => (
                                            <span
                                              key={c}
                                              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700"
                                            >
                                              {c}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end">
                                    <button
                                      type="button"
                                      disabled={jaSelecionado}
                                      onClick={() => adicionarExercicioExistente(ex.id)}
                                      className={[
                                        "rounded-xl px-5 py-2 text-sm font-bold text-white",
                                        jaSelecionado
                                          ? "cursor-not-allowed bg-gray-300"
                                          : "bg-green-800 hover:bg-green-900",
                                      ].join(" ")}
                                    >
                                      {jaSelecionado ? "Adicionado" : "Adicionar"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                      placeholder="Buscar personalizado por nome/descrição..."
                      value={filtroPers}
                      onChange={(e) => setFiltroPers(e.target.value)}
                    />

                    <select
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                      value={filtroPersNivel}
                      onChange={(e) => setFiltroPersNivel(e.target.value)}
                    >
                      <option value="">Todos os níveis</option>
                      <option value="Base">Base</option>
                      <option value="Avancado">Avançado</option>
                      <option value="Performance">Performance</option>
                    </select>

                    <select
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
                      value={filtroPersVideo}
                      onChange={(e) => setFiltroPersVideo(e.target.value as "" | "com" | "sem")}
                    >
                      <option value="">Com/sem vídeo</option>
                      <option value="com">Somente com vídeo</option>
                      <option value="sem">Somente sem vídeo</option>
                    </select>
                  </div>

                  <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-gray-200 bg-white">
                    {loadingPersonalizados ? (
                      <div className="p-6 text-sm text-gray-600">
                        Carregando personalizados...
                      </div>
                    ) : exerciciosPersonalizados
                        .filter((x) => {
                          const term = filtroPers.trim().toLowerCase();
                          if (!term) return true;
                          const hay = `${x.nome ?? ""} ${x.descricao ?? ""}`.toLowerCase();
                          return hay.includes(term);
                        })
                        .filter((x) => {
                          if (!filtroPersNivel) return true;
                          return String(x.nivel ?? "") === String(filtroPersNivel);
                        })
                        .filter((x) => {
                          if (!filtroPersVideo) return true;
                          const hasVideo = !!x.videoDemonstrativoUrl;
                          return filtroPersVideo === "com" ? hasVideo : !hasVideo;
                        }).length === 0 ? (
                      <div className="p-6 text-sm text-gray-600">
                        Nenhum exercício personalizado encontrado.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {exerciciosPersonalizados
                          .filter((x) => {
                            const term = filtroPers.trim().toLowerCase();
                            if (!term) return true;
                            const hay = `${x.nome ?? ""} ${x.descricao ?? ""}`.toLowerCase();
                            return hay.includes(term);
                          })
                          .filter((x) => {
                            if (!filtroPersNivel) return true;
                            return String(x.nivel ?? "") === String(filtroPersNivel);
                          })
                          .filter((x) => {
                            if (!filtroPersVideo) return true;
                            const hasVideo = !!x.videoDemonstrativoUrl;
                            return filtroPersVideo === "com" ? hasVideo : !hasVideo;
                          })
                          .map((p) => {
                            const jaAdicionado = treinoTemPersonalizado(p.id);

                            return (
                              <div key={p.id} className="p-4">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                  <div className="flex gap-4">
                                    <div className="relative grid h-24 w-40 place-items-center overflow-hidden rounded-2xl bg-black/90 text-white">
                                      {p.videoDemonstrativoUrl ? (
                                        <>
                                          {p.videoPosterUrl ? (
                                            <img
                                              src={normalizeUrl(p.videoPosterUrl)}
                                              alt="Thumb do exercício personalizado"
                                              className="absolute inset-0 h-full w-full object-cover"
                                            />
                                          ) : null}

                                          <button
                                            type="button"
                                            onClick={() =>
                                              openVideo(
                                                normalizeUrl(p.videoDemonstrativoUrl || ""),
                                                p.nome || "Vídeo do exercício"
                                              )
                                            }
                                            className="absolute inset-0 grid place-items-center bg-black/60"
                                            title="Assistir vídeo"
                                          >
                                            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/20">
                                              <span className="text-2xl">▶</span>
                                            </div>
                                          </button>
                                        </>
                                      ) : (
                                        <div className="text-sm text-white/80">sem vídeo</div>
                                      )}
                                    </div>

                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-lg font-extrabold text-gray-900">
                                          {p.nome}
                                        </div>

                                        {p.nivel && (
                                          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
                                            {p.nivel}
                                          </span>
                                        )}
                                      </div>

                                      {p.descricao && (
                                        <p className="mt-1 max-w-2xl text-sm text-gray-700">
                                          {p.descricao}
                                        </p>
                                      )}

                                      {Array.isArray(p.categorias) && p.categorias.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {p.categorias.map((c) => (
                                            <span
                                              key={String(c)}
                                              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700"
                                            >
                                              {String(c)}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end">
                                    <button
                                      type="button"
                                      disabled={jaAdicionado}
                                      onClick={() => adicionarPersonalizadoExistente(p)}
                                      className={[
                                        "rounded-xl px-5 py-2 text-sm font-bold text-white",
                                        jaAdicionado
                                          ? "cursor-not-allowed bg-gray-300"
                                          : "bg-green-800 hover:bg-green-900",
                                      ].join(" ")}
                                    >
                                      {jaAdicionado ? "Adicionado" : "Adicionar"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}
          </Card>

            <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-xl bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-200"
              >
                Voltar para Informações
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => (window.location.href = returnTo)}
                  className="rounded-xl bg-gray-200 px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-300"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-900"
                >
                  {id ? "Salvar Alterações" : "Criar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}