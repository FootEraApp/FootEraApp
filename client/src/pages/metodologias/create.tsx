// client/src/pages/metodologias/create.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  Plus,
  X,
  Save,
  Video as VideoIcon,
  Dumbbell,
  Trash2,
  ChevronDown,
  Play,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import BottomNav from "@/components/layout/BottomNav.js";

type Nivel = "Base" | "Avancado" | "Performance";
type PublicoAlvo = "ATLETAS" | "PROFISSIONAIS" | "AMBOS";
type ItemTipo = "VIDEO" | "TREINO";

type TreinoProgramadoPicker = {
  id: string;
  nome: string;
  descricao?: string | null;
  pontuacao?: number | null;
  criadorProfessorId?: string | null;
  origem?: OrigemTreino;
  exercicios: Array<{
    id: string;
    ordem: number;
    repeticoes: string | null;
    exercicio?: {
      id: string;
      codigo: string;
      nome: string;
      videoDemonstrativoUrl?: string | null;
      nivel?: string | null;
      tipo?: "catalogo" | "personalizado" | "temporario" | null;
    } | null;
  }>;
};

type MetItemUI = {
  id: string;
  tipo: ItemTipo;
  titulo: string;
  descricao?: string;
  videoUrl?: string;
  thumbUrl?: string;
  videoFile?: File | null;
  videoPreviewUrl?: string | null;
  duracaoMin?: number | null; // ✅ ADD
  treinoProgramadoId?: string;
  treinoNome?: string;
  treinoPontuacao?: number;
  pontos: number;
};

type SemanaUI = {
  id: string; // local
  titulo: string; // ex: "Semana 1"
  itens: MetItemUI[];
};

function getToken() {
  return (
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    ""
  );
}

async function uploadVideoMetodologia(file: File) {
  const token = getToken();
  if (!token) throw new Error("Sem token.");

  const form = new FormData();
  form.append("video", file);

  const r = await fetch(`${API.BASE_URL}/api/upload/metodologias/video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.error || "Falha ao subir vídeo");

  return {
    relativeUrl: String(j?.relativeUrl || j?.url || ""),
    url: String(j?.url || j?.relativeUrl || ""),
    filename: String(j?.filename || ""),
    thumbUrl: String(j?.thumbUrl || j?.thumbRelativeUrl || ""),
  };
}

function normalizeImgUrl(raw?: string | null) {
  if (!raw) return null;

  const u = String(raw).trim();
  if (!u) return null;

  // já é absoluta
  if (u.startsWith("http://") || u.startsWith("https://")) return u;

  // começa com / -> aponta pro backend
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;

  // sem / (ex: "uploads/xxx" ou "assets/xxx") -> força backend
  return `${API.BASE_URL}/${u}`;
}

async function uploadCapaMetodologia(file: File) {
  const token = getToken();
  if (!token) throw new Error("Sem token.");

  const fd = new FormData();
  fd.append("capa", file); // ✅ o nome do campo (multer) vai ser "capa"

  const r = await fetch(`${API.BASE_URL}/api/upload/metodologias/capa`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const js = await r.json().catch(() => null);
  if (!r.ok) throw new Error(js?.message || js?.error || "Falha no upload da capa.");

  return {
    relativeUrl: String(js?.relativeUrl || ""),
    url: String(js?.url || ""),
    filename: String(js?.filename || ""),
    thumbUrl: String(js?.thumbUrl || js?.thumbRelativeUrl || ""),
  };
}

function getTipoUsuarioId() {
  return (
    (Storage as any).tipoUsuarioId ??
    localStorage.getItem("tipoUsuarioId") ??
    sessionStorage.getItem("tipoUsuarioId") ??
    ""
  );
}

function getTipoUsuario() {
  return (
    (Storage as any).tipoUsuario ??
    localStorage.getItem("tipoUsuario") ??
    sessionStorage.getItem("tipoUsuario") ??
    ""
  );
}

type OrigemTreino = "CRIADOR" | "COLABORADOR" | "PARCEIRO_PUBLICO" | "OUTRO";

function resolveOrigemTreino(t: any, tipoUsuarioRaw: string, tipoUsuarioId: string): OrigemTreino {
  const me = String(tipoUsuarioId || "").trim();
  const tipoUsuario = String(tipoUsuarioRaw || "").trim().toLowerCase();

  const isOwner =
    (tipoUsuario === "professor" && String(t?.professorId || "") === me) ||
    (tipoUsuario === "clube" && String(t?.clubeId || "") === me) ||
    ((tipoUsuario === "escolinha" || tipoUsuario === "escola") && String(t?.escolinhaId || "") === me);

  const isColab =
    tipoUsuario === "professor" &&
    Array.isArray(t?.professores) &&
    t.professores.some((p: any) => String(p?.professorId || "") === me);

  const isParceiroPublico = Boolean(t?.parceiro) === true && !!t?.professorId;

  if (isOwner) return "CRIADOR";
  if (isColab) return "COLABORADOR";
  if (isParceiroPublico) return "PARCEIRO_PUBLICO";
  return "OUTRO";
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function pontosItemFromTipo(tipo: ItemTipo, treinoPontuacao?: number) {
  if (tipo === "VIDEO") return 15;
  return typeof treinoPontuacao === "number" ? treinoPontuacao : 0;
}

function normalizeMediaUrl(raw?: string | null) {
  if (!raw) return "";
  const u = String(raw).trim();
  if (!u) return "";

  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;
  return `${API.BASE_URL}/${u}`;
}

function guessThumbFromVideo(videoUrl?: string | null) {
  const cleaned = normalizeMediaUrl(videoUrl);
  const file = cleaned.split("/").pop() || "";
  const base = file.replace(/\.[a-z0-9]+$/i, "");
  // ✅ PADRÃO ÚNICO (ver seção das pastas): /uploads/thumbs/metodologias/...
  return base ? `/uploads/thumbs/metodologias/${base}.jpg` : "";
}

export default function CriarMetodologia() {
  const [, navigate] = useLocation();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState<Nivel>("Base");
  const [publicoAlvo, setPublicoAlvo] = useState<PublicoAlvo>("AMBOS");
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [capaPreviewUrl, setCapaPreviewUrl] = useState<string | null>(null);
  /** =========================
   * Treinos para select
   * ========================= */
  const [treinos, setTreinos] = useState<TreinoProgramadoPicker[]>([]);
  const [carregandoTreinos, setCarregandoTreinos] = useState(false);
  const [uploadingByItem, setUploadingByItem] = useState<Record<string, boolean>>({});

  const metodologiaId = useMemo(() => {
    return new URLSearchParams(window.location.search).get("id");
  }, []);

  useEffect(() => {
    async function guard() {
      const token = getToken();
      if (!token) {
        alert("Faça login novamente.");
        window.location.href = "/login";
        return;
      }

      const r = await fetch(`${API.BASE_URL}/api/permissoes/metodologias/criar`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.canCreate) {
        alert("Você não tem permissão para criar metodologias. Disponível apenas para Professor Parceiro ou planos Pro.");
        window.location.href = "/metodologias/minhas"; // ajuste rota real
        return;
      }
    }

    guard();
  }, []);

  useEffect(() => {
    if (!metodologiaId) return;

    (async () => {
      try {
        const token = getToken();

        // ✅ melhor: pegar o detalhe (porque geralmente vem itens completos)
        const r = await fetch(
          `${API.BASE_URL}/api/metodologias/${metodologiaId}/detalhe`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          alert(j?.message || "Erro ao carregar metodologia para edição.");
          return;
        }

        const m = j?.item ?? j;

        setTitulo(m.titulo ?? "");
        setDescricao(m.descricao ?? "");
        setPublicoAlvo((m.publicoAlvo ?? "AMBOS") as PublicoAlvo);
        setNivel((m.nivel ?? "Base") as Nivel);
        setCapaUrl(m.capaUrl ?? null);
        setCapaFile(null);
        setCapaPreviewUrl(null);

        const itens = Array.isArray(m.itens) ? m.itens : [];
        // agrupa por semana
        const bySemana = new Map<number, MetItemUI[]>();

        for (const it of itens) {
          const semanaNum = Number(it.semana ?? 1);

          const tipo = String(it.tipo).toUpperCase() as ItemTipo;

          const treinoPontuacao =
            typeof it.treinoProgramado?.pontuacao === "number"
              ? it.treinoProgramado.pontuacao
              : typeof it.pontos === "number" && tipo === "TREINO"
              ? it.pontos
              : 0;
          const videoUrl = (it.videoUrl ?? "") as string;
          const ui: MetItemUI = {
            id: uid("item"), // ✅ id local do React
            tipo,
            titulo: it.titulo ?? (tipo === "TREINO" ? it.treinoProgramado?.nome ?? "Treino" : "Vídeo"),
            descricao: it.descricao ?? "",
            thumbUrl: (it.thumbUrl ?? "") || guessThumbFromVideo(videoUrl),
            videoUrl,
            videoFile: null,
            videoPreviewUrl: null,
            treinoProgramadoId: it.treinoProgramadoId ?? undefined,
            treinoNome: it.treinoProgramado?.nome ?? undefined,
            treinoPontuacao,
            pontos:
              typeof it.pontos === "number"
                ? it.pontos
                : pontosItemFromTipo(tipo, treinoPontuacao),
          };

          const arr = bySemana.get(semanaNum) ?? [];
          arr.push(ui);
          bySemana.set(semanaNum, arr);
        }

        // monta SemanaUI[] no formato do seu state
        const semanasUI: SemanaUI[] = Array.from(bySemana.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([semanaNum, arr], idx) => ({
            id: uid("semana"),
            titulo: `Semana ${idx + 1}`,
            itens: arr, // se quiser ordenar por ordem do backend, você precisa incluir it.ordem na ui
          }));

        // se não veio nada, garante uma semana
        setSemanas(semanasUI.length ? semanasUI : [{ id: uid("semana"), titulo: "Semana 1", itens: [] }]);

      } catch (e) {
        console.error(e);
        alert("Erro ao carregar metodologia para edição.");
      }
    })();
  }, [metodologiaId]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      setCarregandoTreinos(true);
      try {
        const r = await fetch(`${API.BASE_URL}/api/treinosprogramados?scope=picker`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const js = await r.json().catch(() => null);
        if (!r.ok) return;

        const tipoUsuarioId = getTipoUsuarioId();
        const tipoUsuario = getTipoUsuario();

        const items =
          js?.items || js?.treinos || (Array.isArray(js) ? js : []) || [];

        const onlyMine = (items || []).filter((t: any) => {
          const origem = resolveOrigemTreino(t, tipoUsuario, tipoUsuarioId);
          return origem === "CRIADOR" || origem === "COLABORADOR" || origem === "PARCEIRO_PUBLICO";
        });

        const mapped: TreinoProgramadoPicker[] = (onlyMine || []).map((t: any) => ({
          id: String(t.id),
          nome: String(t.nome ?? t.titulo ?? "Treino"),
          descricao: t.descricao ?? null,
          pontuacao:
            typeof t.pontuacao === "number"
              ? t.pontuacao
              : typeof t.pontuacao === "string"
              ? Number(t.pontuacao)
              : null,
          criadorProfessorId: t.criadorProfessorId ?? null,
          origem: resolveOrigemTreino(t, tipoUsuario, tipoUsuarioId),
          exercicios: Array.isArray(t.exercicios)
          ? t.exercicios.map((e: any) => {
              const ex =
                e.exercicio ??
                e.exercicioPersonalizado ??
                e.exercicioTemporario ??
                e.personalizado ??
                e.temporario ??
                null;

              return {
                id: String(e.id),
                ordem: Number(e.ordem ?? 0),
                repeticoes: e.repeticoes ?? null,
                exercicio: ex
              ? {
                  id: String(
                    ex.id ??
                    e.exercicioId ??
                    e.exercicioPersonalizadoId ??
                    e.exercicioTemporarioId ??
                    e.id
                  ),
                  codigo: String(ex.codigo ?? ""),
                  nome: String(
                    ex.nome ??
                    e.nome ??
                    e.titulo ??
                    "Exercício"
                  ),
                  videoDemonstrativoUrl:
                    ex.videoDemonstrativoUrl ??
                    ex.videoUrl ??
                    e.videoDemonstrativoUrl ??
                    e.videoUrl ??
                    null,
                  nivel:
                    ex.nivel ??
                    e.nivel ??
                    null,
                  tipo:
                    e.exercicioTemporario || e.temporario
                      ? "temporario"
                      : e.exercicioPersonalizado || e.personalizado
                      ? "personalizado"
                      : "catalogo",
                }
              : {
                  id: String(
                    e.exercicioId ??
                    e.exercicioPersonalizadoId ??
                    e.exercicioTemporarioId ??
                    e.id
                  ),
                  codigo: String(e.codigo ?? ""),
                  nome: String(e.nome ?? e.titulo ?? "Exercício"),
                  videoDemonstrativoUrl:
                    e.videoDemonstrativoUrl ??
                    e.videoUrl ??
                    null,
                  nivel: e.nivel ?? null,
                  tipo: e.exercicioTemporarioId ? "temporario" : e.exercicioPersonalizadoId ? "personalizado" : "catalogo",
                },
              };
            })
          : [],
        }));

        const prioridade: Record<OrigemTreino, number> = {
          CRIADOR: 0,
          COLABORADOR: 1,
          PARCEIRO_PUBLICO: 2,
          OUTRO: 3,
        };

        mapped.sort((a, b) => {
          const pa = prioridade[a.origem ?? "OUTRO"];
          const pb = prioridade[b.origem ?? "OUTRO"];
          if (pa !== pb) return pa - pb;

          // desempate opcional: por nome
          return a.nome.localeCompare(b.nome, "pt-BR");
        });

        if (!cancelled) setTreinos(mapped);
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setCarregandoTreinos(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** =========================
   * Semanas / Itens
   * ========================= */
  const [semanas, setSemanas] = useState<SemanaUI[]>(() => [
    { id: uid("semana"), titulo: "Semana 1", itens: [] },
  ]);

  // ✅ aba ativa (tipo Google)
  const [activeSemanaId, setActiveSemanaId] = useState<string>(() => {
    const first = semanas?.[0]?.id;
    return first || "";
  });

  useEffect(() => {
    if (!semanas.length) return;
    const exists = semanas.some((s) => s.id === activeSemanaId);
    if (!exists) setActiveSemanaId(semanas[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanas]);

  function addSemana() {
    const newId = uid("semana");
    setSemanas((prev) => {
      const nextIndex = prev.length + 1;
      return [...prev, { id: newId, titulo: `Semana ${nextIndex}`, itens: [] }];
    });
    setActiveSemanaId(newId);
  }

  function removeSemana(semanaId: string) {
    setSemanas((prev) => {
      const idxRemovida = prev.findIndex((s) => s.id === semanaId);
      const next = prev.filter((s) => s.id !== semanaId);

      const renum = next.map((s, idx) => ({ ...s, titulo: `Semana ${idx + 1}` }));

      if (activeSemanaId === semanaId) {
        const fallback =
          renum[Math.min(idxRemovida, renum.length - 1)] || renum[0];
        if (fallback?.id) setActiveSemanaId(fallback.id);
      }

      return renum;
    });
  }

  function addVideoItem(semanaId: string) {
    setSemanas((prev) =>
      prev.map((s) => {
        if (s.id !== semanaId) return s;

        const novo: MetItemUI = {
          id: uid("item"),
          tipo: "VIDEO",
          titulo: "Vídeo",
          descricao: "",
          videoUrl: "",
          thumbUrl: "",
          videoFile: null,
          videoPreviewUrl: null,
          pontos: 15,
        };

        return { ...s, itens: [...s.itens, novo] };
      })
    );
  }

  // ✅ agora o treino NÃO cria card vazio.
  // ele abre o "picker" e só adiciona depois que escolher um treino.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSemanaId, setPickerSemanaId] = useState<string | null>(null);
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null); // treino expandido
  const [treinoDrawerOpenItemId, setTreinoDrawerOpenItemId] = useState<string | null>(null);
  /** =========================
   * Modal de vídeo do exercício
   * ========================= */
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  function normalizeVideoUrl(raw?: string | null) {
    if (!raw) return null;

    const u = String(raw).trim();
    if (!u) return null;

    // absoluta
    if (u.startsWith("http://") || u.startsWith("https://")) return u;

    // relativo com / (ex: "/assets/...")
    if (u.startsWith("/")) return `${API.BASE_URL}${u}`;

    // relativo sem / (ex: "assets/..." ou "uploads/...")
    return `${API.BASE_URL}/${u}`;
  }

  function openVideo(raw?: string | null) {
    const url = normalizeVideoUrl(raw);
    if (!url) return;
    setVideoUrl(url);
    setVideoOpen(true);
  }

  function closeVideo() {
    setVideoOpen(false);
    setVideoUrl(null);
  }

  function isYouTube(url: string) {
    const u = url.toLowerCase();
    return u.includes("youtube.com") || u.includes("youtu.be");
  }

  function toYouTubeEmbed(url: string) {
    try {
      // youtu.be/ID
      if (url.includes("youtu.be/")) {
        const id = url.split("youtu.be/")[1]?.split(/[?&]/)[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      // youtube.com/watch?v=ID
      const v = new URL(url).searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    } catch {}
    return url;
  }

  function toggleTreinoDrawer(itemId: string) {
    setTreinoDrawerOpenItemId((prev) => (prev === itemId ? null : itemId));
  }

  function getTreinoDetalheById(treinoId?: string) {
    if (!treinoId) return null;
    return treinos.find((t) => String(t.id) === String(treinoId)) || null;
  }

  function openTreinoPicker(semanaId: string) {
    setPickerSemanaId(semanaId);
    setPickerOpenId(null);
    setPickerOpen(true);
  }

  function closeTreinoPicker() {
    setPickerOpen(false);
    setPickerSemanaId(null);
    setPickerOpenId(null);
  }

  function addTreinoFromPicker(t: TreinoProgramadoPicker) {
    if (!pickerSemanaId) return;
    const treinoId = String(t.id);

    setSemanas((prev) =>
      prev.map((s) => {
        if (s.id !== pickerSemanaId) return s;

        const jaExiste = s.itens.some(
          (i) => i.tipo === "TREINO" && i.treinoProgramadoId === treinoId
        );
        if (jaExiste) return s;

        const pontos = pontosItemFromTipo("TREINO", t.pontuacao ?? undefined);

        const novo: MetItemUI = {
          id: uid("item"),
          tipo: "TREINO",
          titulo: t.nome,
          descricao: "", // ✅ item tem descrição opcional (observações), treino já tem a dele no backend
          treinoProgramadoId: treinoId,
          treinoNome: t.nome,
          treinoPontuacao: typeof t.pontuacao === "number" ? t.pontuacao : 0,
          pontos,
        };

        return { ...s, itens: [...s.itens, novo] };
      })
    );

    closeTreinoPicker();
  }

  function removeItem(semanaId: string, itemId: string) {
    setSemanas((prev) =>
      prev.map((s) =>
        s.id === semanaId
          ? { ...s, itens: s.itens.filter((i) => i.id !== itemId) }
          : s
      )
    );
  }

  function updateItem(
    semanaId: string,
    itemId: string,
    patch: Partial<MetItemUI>
  ) {
    setSemanas((prev) =>
      prev.map((s) => {
        if (s.id !== semanaId) return s;
        return {
          ...s,
          itens: s.itens.map((i) => {
            if (i.id !== itemId) return i;

            const merged = { ...i, ...patch };

            const treinoPont =
              merged.tipo === "TREINO" ? merged.treinoPontuacao : undefined;

            merged.pontos = pontosItemFromTipo(merged.tipo, treinoPont);

            return merged;
          }),
        };
      })
    );
  }

  const semanaAtiva = useMemo(() => {
    return semanas.find((s) => s.id === activeSemanaId) ?? semanas[0];
  }, [semanas, activeSemanaId]);

  /** =========================
   * Pontos totais / validações
   * ========================= */
  const pontosTotais = useMemo(() => {
    return semanas.reduce((acc, s) => {
      const sumSemana = s.itens.reduce((a, i) => a + (i.pontos || 0), 0);
      return acc + sumSemana;
    }, 0);
  }, [semanas]);

  const canSubmit = useMemo(() => {
    if (titulo.trim().length < 3) return false;
    if (!nivel) return false;
    if (!publicoAlvo) return false;
    return true;
  }, [titulo, nivel, publicoAlvo]);

  /** =========================
   * Salvar
   * ========================= */
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function checarTituloDuplicado(token: string, tituloNovo: string, excluirId?: string | null) {
    // tenta reaproveitar endpoint de criadas
    const r = await fetch(`${API.BASE_URL}/api/metodologias/criadas`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const js = await r.json().catch(() => null);
    if (!r.ok) return false; // se falhar, não bloqueia

    const arr: any[] = Array.isArray(js) ? js : js.items ?? [];
    const wanted = tituloNovo.trim().toLowerCase();

    return arr.some((m) => {
      const id = String(m.id ?? "");
      const t = String(m.titulo ?? m.nome ?? "").trim().toLowerCase();
      if (excluirId && id === String(excluirId)) return false;
      return t === wanted;
    });
  }

  async function salvar() {
    // evita clique duplo
    if (salvando) return;

    setSalvando(true);        // ✅ liga imediatamente
    setErro(null);
    setOkMsg(null);

    try {
      const token = getToken();
      if (!token) throw new Error("Sem token. Faça login novamente.");

      if (!canSubmit) throw new Error("Preencha título e selecione público e nível.");

      const dup = await checarTituloDuplicado(token, titulo, metodologiaId);
      if (dup) throw new Error("Já existe uma metodologia com esse nome. Escolha outro nome.");

      const videoUrlByLocalId: Record<string, string> = {};
      const thumbUrlByLocalId: Record<string, string> = {}; // ✅ ADICIONE

      // =======================
      // 0) Upload da capa (se escolheu arquivo)
      // =======================
      let finalCapaUrl: string | null = capaUrl;

      if (capaFile) {
        const up = await uploadCapaMetodologia(capaFile);
        finalCapaUrl = (up.relativeUrl || up.url || null) ? (up.relativeUrl || up.url) : null;

        setCapaUrl(finalCapaUrl);
        setCapaFile(null);
        setCapaPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }

      // =======================
      // 1) Upload dos vídeos (UMA VEZ SÓ)
      // =======================
      for (const s of semanas) {
        for (const it of s.itens) {
          if (it.tipo !== "VIDEO") continue;

          // se tem arquivo, sobe e guarda a url final
          if (it.videoFile) {
            setUploadingByItem((prev) => ({ ...prev, [it.id]: true }));
            try {
              const up = await uploadVideoMetodologia(it.videoFile);
              const finalUrl = up.relativeUrl || up.url;
              const finalThumb =
                (up.thumbUrl && up.thumbUrl.trim())
                  ? up.thumbUrl.trim()
                  : (it.thumbUrl?.trim() ? it.thumbUrl.trim() : guessThumbFromVideo(finalUrl));

              videoUrlByLocalId[it.id] = finalUrl;
              if (finalThumb) thumbUrlByLocalId[it.id] = finalThumb;

              // ✅ atualiza o item corretamente (semana + item)
              updateItem(s.id, it.id, {
                videoUrl: finalUrl,
                thumbUrl: finalThumb || "",
                videoFile: null,
              });
            } finally {
              setUploadingByItem((prev) => ({ ...prev, [it.id]: false }));
            }
          } else if (it.videoUrl?.trim()) {
            const finalUrl = it.videoUrl.trim();
            videoUrlByLocalId[it.id] = finalUrl;

            const finalThumb =
              it.thumbUrl?.trim() ? it.thumbUrl.trim() : guessThumbFromVideo(finalUrl);

            if (finalThumb) thumbUrlByLocalId[it.id] = finalThumb;

            // opcional: sincroniza UI também
            if (!it.thumbUrl?.trim() && finalThumb) {
              updateItem(s.id, it.id, { thumbUrl: finalThumb });
            }
          }
        }
      }

      // =======================
      // 2) Salva Metodologia (PUT/POST)
      // =======================
      const payloadMetodologia = {
        titulo: titulo.trim(),
        descricao: (descricao || "").trim() || null,
        nivel,
        publicoAlvo,
        categorias: [],
        totalSemanas: semanas.length,
        capaUrl: finalCapaUrl,
      };

      const isEdit = !!metodologiaId;
      const urlMet = isEdit
        ? `${API.BASE_URL}/api/metodologias/${metodologiaId}`
        : `${API.BASE_URL}/api/metodologias`;

      const methodMet = isEdit ? "PUT" : "POST";

      const r = await fetch(urlMet, {
        method: methodMet,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadMetodologia),
      });

      const js = await r.json().catch(() => null);
      if (!r.ok) {
        throw new Error(js?.message || js?.error || "Não foi possível salvar a metodologia.");
      }

      const finalMetId =
        (isEdit ? metodologiaId! : null) ??
        js?.item?.id ??
        js?.id ??
        js?.metodologia?.id;

      if (!finalMetId) throw new Error("Não retornou ID da metodologia.");

      // =======================
      // 3) Se edição: limpa itens antigos
      // =======================
      if (isEdit) {
        const del = await fetch(`${API.BASE_URL}/api/metodologias/${finalMetId}/itens`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        const jdel = await del.json().catch(() => null);
        if (!del.ok) {
          throw new Error(jdel?.message || "Não foi possível limpar os itens antigos.");
        }
      }

      // =======================
      // 4) Recria itens
      // =======================
      const flatItems: Array<{
        semana: number;
        ordem: number;
        titulo: string;
        descricao?: string | null;
        tipo: "TREINO" | "VIDEO";
        videoUrl?: string | null;
        thumbUrl?: string | null;
        treinoProgramadoId?: string | null;
        pontos?: number | null;
        publicado?: boolean;
      }> = [];

      semanas.forEach((s, idxSemana) => {
        const semanaNum = idxSemana + 1;
        s.itens.forEach((it, idxItem) => {
          flatItems.push({
            semana: semanaNum,
            ordem: idxItem + 1,
            titulo: it.titulo.trim(),
            descricao: (it.descricao || "").trim() || null,
            tipo: it.tipo,
            videoUrl: it.tipo === "VIDEO" ? (videoUrlByLocalId[it.id] || null) : null,
            thumbUrl: it.tipo === "VIDEO" ? (thumbUrlByLocalId[it.id] || null) : null,
            treinoProgramadoId: it.tipo === "TREINO" ? it.treinoProgramadoId || null : null,
            pontos: it.pontos ?? null,
            publicado: true,
          });
        });
      });

      for (const item of flatItems) {
        const rr = await fetch(`${API.BASE_URL}/api/metodologias/${finalMetId}/itens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item),
        });

        const jsi = await rr.json().catch(() => null);
        if (!rr.ok) {
          throw new Error(
            jsi?.message ||
              jsi?.error ||
              `Falha ao criar item "${item.titulo}" (semana ${item.semana}).`
          );
        }
      }

      // ✅ feedback imediato + navegação
      const msg = isEdit
        ? "Alterações salvas com sucesso!"
        : "Metodologia criada com sucesso!";

      setOkMsg(`✅ ${msg}`);
      alert(msg);

      navigate("/treinos");
      setTimeout(() => window.location.reload(), 50);
    } catch (e: any) {
      const msg = e?.message || "Erro ao salvar metodologia.";
      setErro(msg);
      alert(msg); // ✅ feedback imediato também no erro
    } finally {
      setSalvando(false); // ✅ sempre volta ao normal
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="w-full px-3 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="pt-3 sticky top-0 z-20 bg-neutral-50/90 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/treinos/Minhas-Metodologias")}
              className="inline-flex items-center justify-center p-2 rounded-xl border bg-white hover:bg-gray-50"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-green-900">
                Criar Metodologia
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Configure dados comuns no topo e monte as semanas abaixo.
              </p>
            </div>
          </div>
        </div>

        {/* ===== Topo: Dados comuns ===== */}
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-4 sm:p-6">
          {erro && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {erro}
            </div>
          )}
          {okMsg && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
              {okMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Nome da Metodologia *
              </label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Metodologia Base - Domínio e Passe"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
              <div className="text-xs text-gray-500 mt-1">
                Mínimo 3 caracteres.
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">
                Público-alvo *
              </label>
              <div className="mt-1 relative">
                <select
                  value={publicoAlvo}
                  onChange={(e) => setPublicoAlvo(e.target.value as PublicoAlvo)}
                  className="w-full appearance-none border rounded-xl px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-green-200 bg-white"
                >
                  <option value="ATLETAS">Para Atletas</option>
                  <option value="PROFISSIONAIS">Para Profissionais</option>
                  <option value="AMBOS">Para Ambos</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Serve para filtrar no catálogo (atletas/instrutores).
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">
                Nível *
              </label>
              <div className="mt-1 relative">
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value as Nivel)}
                  className="w-full appearance-none border rounded-xl px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-green-200 bg-white"
                >
                  <option value="Base">Base</option>
                  <option value="Avancado">Avançado</option>
                  <option value="Performance">Performance</option>

                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                (Base / Avançado / Performance / Livre)
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Descrição
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Explique o que entrega, duração, recomendação..."
                className="mt-1 w-full min-h-[110px] border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-800">
                Capa da Metodologia (opcional)
              </label>

              <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Upload */}
                <div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      setErro(null);

                      // validação simples (opcional)
                      const maxMb = 5;
                      const sizeMb = file.size / 1024 / 1024;
                      if (sizeMb > maxMb) {
                        setErro(`A capa deve ter no máximo ${maxMb}MB.`);
                        e.currentTarget.value = "";
                        return;
                      }

                      // preview local
                      const preview = URL.createObjectURL(file);

                      // se já tinha um preview antes, revoga
                      setCapaPreviewUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return preview;
                      });

                      setCapaFile(file);

                      // permitir selecionar o mesmo arquivo novamente
                      e.currentTarget.value = "";
                    }}
                  />

                  <div className="text-xs text-gray-500 mt-1">
                    PNG/JPG/WEBP (até 5MB). Se não enviar, fica sem capa.
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
                      onClick={() => {
                        // limpa capa escolhida localmente
                        setCapaFile(null);
                        setCapaPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return null;
                        });
                      }}
                      disabled={!capaFile && !capaPreviewUrl}
                    >
                      Remover upload
                    </button>

                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold text-red-700"
                      onClick={() => {
                        // remove capa do banco (deixa null)
                        setCapaUrl(null);
                        setCapaFile(null);
                        setCapaPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return null;
                        });
                      }}
                      disabled={!capaUrl && !capaFile && !capaPreviewUrl}
                      title="Remove a capa atual (salvando vai virar null)"
                    >
                      Remover capa atual
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-2xl border bg-neutral-50 p-3">
                  <div className="text-xs font-semibold text-gray-700">Pré-visualização</div>

                  {capaPreviewUrl ? (
                    <div className="mt-2 rounded-xl overflow-hidden border bg-white">
                      <img
                        src={capaPreviewUrl}
                        alt="Preview da capa"
                        className="w-full h-40 object-cover"
                      />
                    </div>
                  ) : normalizeImgUrl(capaUrl) ? (
                    <div className="mt-2 rounded-xl overflow-hidden border bg-white">
                      <img
                        src={normalizeImgUrl(capaUrl)!}
                        alt="Capa atual"
                        className="w-full h-40 object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500">
                      Nenhuma capa definida.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border bg-neutral-50 p-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    Pontos totais estimados
                  </div>
                  <div className="text-xs text-gray-500">
                    Vídeo = 15 pts / Treino = pontuação do treino programado
                  </div>
                </div>
                <div className="text-lg font-bold text-green-900">
                  +{pontosTotais} pts
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Baixo: Semanas (ABAS HORIZONTAIS) ===== */}
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-4 sm:p-6">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Semanas e Conteúdos
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Clique nas abas para alternar as semanas.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-x-auto">
                <div className="inline-flex items-center gap-2 pb-1">
                  {semanas.map((s, idx) => {
                    const isActive = s.id === activeSemanaId;
                    const pts = s.itens.reduce((a, i) => a + (i.pontos || 0), 0);

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSemanaId(s.id)}
                        className={[
                          "shrink-0 px-3 py-2 rounded-xl border text-sm font-semibold",
                          "transition",
                          isActive
                            ? "bg-green-800 text-white border-green-800"
                            : "bg-white hover:bg-gray-50 text-gray-800 border-gray-200",
                        ].join(" ")}
                        title={`${s.titulo} • +${pts} pts`}
                      >
                        {`Semana ${idx + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={addSemana}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-800 text-white font-semibold hover:bg-green-900"
              >
                <Plus className="w-4 h-4" />
                Semana
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Dica: role horizontalmente se tiver muitas semanas.
            </div>
          </div>

          {/* Conteúdo da semana ativa */}
          {semanaAtiva ? (
            <div className="mt-4 rounded-2xl border bg-white">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b">
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {semanaAtiva.titulo}
                  </div>
                  <div className="text-xs text-gray-500">
                    {semanaAtiva.itens.length} item(s) • +
                    {semanaAtiva.itens.reduce((a, i) => a + (i.pontos || 0), 0)}{" "}
                    pts
                  </div>
                </div>

                <div className="flex gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => addVideoItem(semanaAtiva.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
                  >
                    <VideoIcon className="w-4 h-4" />
                    Vídeo (+15)
                  </button>

                  <button
                    type="button"
                    onClick={() => openTreinoPicker(semanaAtiva.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
                  >
                    <Dumbbell className="w-4 h-4" />
                    Treino
                  </button>

                  <button
                    type="button"
                    onClick={() => removeSemana(semanaAtiva.id)}
                    disabled={semanas.length === 1}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold
                      ${
                        semanas.length === 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white hover:bg-gray-50 text-red-700"
                      }`}
                    title={
                      semanas.length === 1
                        ? "Você precisa ter ao menos 1 semana"
                        : "Excluir semana"
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {semanaAtiva.itens.length === 0 ? (
                  <div className="rounded-xl border bg-neutral-50 p-4 text-sm text-gray-600">
                    Nenhum item ainda. Use <b>Vídeo</b> ou <b>Treino</b>.
                  </div>
                ) : null}

                {semanaAtiva.itens.map((it, idxItem) => (
                  <div key={it.id} className="rounded-2xl border bg-white p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl border bg-neutral-50 flex items-center justify-center">
                          {it.tipo === "VIDEO" ? (
                            <VideoIcon className="w-4 h-4 text-gray-700" />
                          ) : (
                            <Dumbbell className="w-4 h-4 text-gray-700" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs px-2 py-1 rounded-full border bg-white">
                              {it.tipo === "VIDEO" ? "VÍDEO" : "TREINO"}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full border bg-green-50 text-green-900">
                              +{it.pontos} pts
                            </span>
                            <span className="text-xs text-gray-400">
                              Item {idxItem + 1}
                            </span>
                          </div>

                          {/* ✅ TREINO: título vira "somente leitura" e mostra o treino selecionado */}
                          {it.tipo === "TREINO" ? (
                            <div className="mt-2">
                              <div className="text-xs font-semibold text-gray-700">
                                Treino selecionado
                              </div>
                              <div className="mt-1 rounded-xl border bg-neutral-50 px-3 py-2 text-sm">
                                <div className="font-semibold text-gray-900">
                                  {it.treinoNome || it.titulo}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {it.treinoProgramadoId ? `ID: ${it.treinoProgramadoId}` : ""}
                                  {typeof it.treinoPontuacao === "number"
                                    ? ` • +${it.treinoPontuacao} pts`
                                    : ""}
                                </div>
                              </div>

                              {(() => {
                                const treinoDetalhe = getTreinoDetalheById(it.treinoProgramadoId);
                                const isOpen = treinoDrawerOpenItemId === it.id;
                                const exCount = treinoDetalhe?.exercicios?.length ?? 0;

                                return (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleTreinoDrawer(it.id)}
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
                                    >
                                      <ChevronDown
                                        className={[
                                          "w-4 h-4 text-gray-600 transition",
                                          isOpen ? "rotate-180" : "",
                                        ].join(" ")}
                                      />
                                      {isOpen ? "Ocultar conteúdo" : `Ver conteúdo (${exCount})`}
                                    </button>

                                    {isOpen ? (
                                      <div className="mt-2 rounded-xl border bg-white overflow-hidden">
                                        {treinoDetalhe?.descricao ? (
                                          <div className="px-3 py-2 text-xs text-gray-700 bg-neutral-50 border-b">
                                            <b>Descrição do treino:</b> {treinoDetalhe.descricao}
                                          </div>
                                        ) : null}

                                        <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-neutral-50 border-b">
                                          Exercícios
                                        </div>

                                        {exCount === 0 ? (
                                          <div className="px-3 py-3 text-sm text-gray-600">
                                            Este treino não possui exercícios cadastrados (ou não vieram no payload).
                                          </div>
                                        ) : (
                                          <div className="divide-y">
                                            {(treinoDetalhe?.exercicios || [])
                                              .slice()
                                              .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                                              .map((e) => (
                                              <div key={e.id} className="px-3 py-3">
                                                <div className="flex items-start justify-between gap-3">
                                                  <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                      {e.ordem ? `${e.ordem}. ` : ""}
                                                      {e.exercicio?.nome || "Exercício"}
                                                    </div>

                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                      {e.exercicio?.codigo ? (
                                                        <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-gray-700">
                                                          {e.exercicio.codigo}
                                                        </span>
                                                      ) : null}

                                                      <span className="text-[11px] px-2 py-1 rounded-full border bg-neutral-50 text-gray-700">
                                                        Reps: {e.repeticoes ? e.repeticoes : "-"}
                                                      </span>

                                                      {e.exercicio?.nivel ? (
                                                        <span className="text-[11px] px-2 py-1 rounded-full border bg-green-50 text-green-900">
                                                          Nível: {e.exercicio.nivel}
                                                        </span>
                                                      ) : null}
                                                    </div>

                                                    {e.exercicio?.videoDemonstrativoUrl ? (
                                                      <button
                                                        type="button"
                                                        onClick={() => openVideo(e.exercicio?.videoDemonstrativoUrl)}
                                                        className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-xs font-semibold"
                                                      >
                                                        <Play className="w-4 h-4" />
                                                        Ver vídeo
                                                      </button>
                                                    ) : (
                                                      <div className="text-[11px] text-gray-400 mt-2">Sem vídeo demonstrativo</div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })()}

                            </div>
                          ) : (
                            <div className="mt-2">
                              <label className="text-xs font-semibold text-gray-700">
                                Título do item *
                              </label>
                              <input
                                value={it.titulo}
                                onChange={(e) =>
                                  updateItem(semanaAtiva.id, it.id, {
                                    titulo: e.target.value,
                                  })
                                }
                                placeholder="Ex: Aula 1 - Controle Orientado"
                                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      {it.tipo === "TREINO" ? (
                        <button
                          type="button"
                          onClick={() => openTreinoPicker(semanaAtiva.id)}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold"
                          title="Trocar treino"
                        >
                          <Dumbbell className="w-4 h-4" />
                          Trocar treino
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => removeItem(semanaAtiva.id, it.id)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm font-semibold text-red-700"
                      >
                        <X className="w-4 h-4" />
                        Remover
                      </button>
                    </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {it.tipo !== "TREINO" ? (
                        <div className="lg:col-span-2">
                          <label className="text-xs font-semibold text-gray-700">
                            Descrição (opcional)
                          </label>
                          <textarea
                            value={it.descricao || ""}
                            onChange={(e) =>
                              updateItem(semanaAtiva.id, it.id, { descricao: e.target.value })
                            }
                            placeholder="Instruções, objetivo, observações..."
                            className="mt-1 w-full min-h-[90px] border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                          />
                        </div>
                      ) : null}

                      {it.tipo === "VIDEO" ? (
                        <>
                          <div className="lg:col-span-2">
                            <label className="text-xs font-semibold text-gray-700">
                              Upload do vídeo *
                            </label>

                            <div className="mt-1 flex flex-col sm:flex-row gap-2 sm:items-center">
                              <input
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime"
                                className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;

                                  setErro(null);

                                  // ✅ cria preview local (não sobe nada pro backend)
                                  const previewUrl = URL.createObjectURL(file);

                                  // ✅ salva o arquivo + preview dentro do item
                                  updateItem(semanaAtiva.id, it.id, {
                                    videoFile: file,
                                    videoPreviewUrl: previewUrl,

                                    // opcional: se você quer limpar a URL final quando troca o arquivo
                                    videoUrl: "",
                                  });

                                  // permitir re-selecionar o mesmo arquivo
                                  e.currentTarget.value = "";
                                }}
                              />


                            </div>

                            <div className="text-[11px] text-gray-500 mt-1">
                              Aceita <b>mp4/webm/mov</b>. O backend salva em <b>/assets/metodologias/videos</b>.
                            </div>
                          </div>

                          {/* Preview / player (CREATE e EDIT) */}
                          <div className="lg:col-span-2">
                            {(() => {
                              const srcPreview =
                                it.videoPreviewUrl ||
                                (it.videoUrl?.trim() ? normalizeMediaUrl(it.videoUrl) : "");

                              return srcPreview ? (
                                <div className="mt-2 rounded-xl border bg-black overflow-hidden">
                                  <video
                                    className="w-full aspect-video"
                                    src={srcPreview}
                                    controls
                                    onLoadedMetadata={(e) => {
                                      const dur = (e.currentTarget.duration || 0) / 60;
                                      if (Number.isFinite(dur) && dur > 0) {
                                        updateItem(semanaAtiva.id, it.id, { duracaoMin: Math.round(dur) });
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 mt-2">Nenhum vídeo selecionado ainda.</div>
                              );
                            })()}
                          </div>
                        </>
                      ) : null}

                      {/* ✅ TREINO não tem select dentro do card mais */}
                      {it.tipo === "TREINO" ? (
                        <div className="lg:col-span-2">
                          <div className="text-[11px] text-gray-500">
                            Este item é um treino programado já selecionado.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/treinos/Minhas-Metodologias")}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 font-semibold"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={!canSubmit || salvando}
              onClick={salvar}
              className={`px-4 py-2 rounded-xl font-semibold inline-flex items-center justify-center gap-2
                ${
                  canSubmit && !salvando
                    ? "bg-green-800 text-white hover:bg-green-900"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
            >
              <Save className="w-4 h-4" />
              {salvando ? "Salvando..." : (metodologiaId ? "Salvar alterações" : "Criar metodologia")}
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Dica: se você quiser salvar “público-alvo” no banco de forma correta,
            a gente adiciona um campo no schema (enum) e faz migration.
          </div>
        </div>
      </div>

      {/* ✅ Modal Picker de Treino */}
      {pickerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeTreinoPicker}
          />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border p-4 sm:p-5 m-0 sm:m-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-gray-900">
                  Selecionar treino programado
                </div>
                <div className="text-xs text-gray-500">
                  Escolha um treino seu para adicionar na semana.
                </div>
              </div>
              <button
                type="button"
                onClick={closeTreinoPicker}
                className="p-2 rounded-xl border bg-white hover:bg-gray-50"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-800">Meus treinos</div>
              <div className="text-[11px] text-gray-500 mt-1">
                Só aparecem treinos que você criou, que você é colaborador, ou treinos públicos de professor parceiro. Clique para ver os exercícios.
              </div>

              <div className="mt-3 max-h-[55vh] overflow-auto pr-1 space-y-2">
                {carregandoTreinos ? (
                  <div className="rounded-xl border bg-neutral-50 p-3 text-sm text-gray-600">
                    Carregando treinos...
                  </div>
                ) : treinos.length === 0 ? (
                  <div className="rounded-xl border bg-neutral-50 p-3 text-sm text-gray-600">
                    Nenhum treino seu disponível.
                  </div>
                ) : (
                  treinos.map((t) => {
                    const isOpen = pickerOpenId === t.id;
                    const exCount = t.exercicios?.length ?? 0;

                    return (
                      <div key={t.id} className="rounded-2xl border bg-white">
                        {/* HEADER */}
                        <button
                          type="button"
                          onClick={() => setPickerOpenId(isOpen ? null : t.id)}
                          className="w-full text-left p-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {t.nome}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {typeof t.pontuacao === "number" ? `+${t.pontuacao} pts` : "+0 pts"}
                              {" • "}
                              {exCount} exercício(s)
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {t.origem === "CRIADOR" ? (
                              <span className="text-xs px-2 py-1 rounded-full border bg-blue-50 text-blue-900">
                                CRIADOR
                              </span>
                            ) : t.origem === "COLABORADOR" ? (
                              <span className="text-xs px-2 py-1 rounded-full border bg-amber-50 text-amber-900">
                                COLABORADOR
                              </span>
                            ) : t.origem === "PARCEIRO_PUBLICO" ? (
                              <span className="text-xs px-2 py-1 rounded-full border bg-emerald-50 text-emerald-900">
                                PARCEIRO (PÚBLICO)
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-700">
                                TREINO
                              </span>
                            )}
                            <ChevronDown
                              className={[
                                "w-4 h-4 text-gray-500 transition",
                                isOpen ? "rotate-180" : "",
                              ].join(" ")}
                            />
                          </div>
                        </button>

                        {/* GAVETA */}
                        {isOpen ? (
                          <div className="px-3 pb-3">
                            {t.descricao ? (
                              <div className="text-xs text-gray-700 bg-neutral-50 border rounded-xl p-2">
                                <b>Descrição do treino:</b> {t.descricao}
                              </div>
                            ) : null}

                            <div className="mt-2 rounded-xl border bg-white overflow-hidden">
                              <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-neutral-50 border-b">
                                Exercícios
                              </div>

                              <div className="divide-y">
                                {(t.exercicios || [])
                                  .slice()
                                  .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                                  .map((e) => (
                                    <div key={e.id} className="px-3 py-2">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold text-gray-900">
                                            {e.ordem ? `${e.ordem}. ` : ""}{e.exercicio?.nome || "Exercício"}
                                          </div>
                                          <div className="text-xs text-gray-600">
                                            {e.exercicio?.codigo ? `${e.exercicio.codigo} • ` : ""}
                                            {e.repeticoes ? `Reps: ${e.repeticoes}` : "Reps: -"}
                                            {e.exercicio?.nivel ? ` • Nível: ${e.exercicio.nivel}` : ""}
                                          </div>

                                          {e.exercicio?.videoDemonstrativoUrl ? (
                                            <div className="text-[11px] text-gray-500 mt-1 truncate">
                                              Vídeo: {e.exercicio.videoDemonstrativoUrl}
                                            </div>
                                          ) : null}
                                        </div>

                                        {/* (Opcional) se quiser abrir vídeo depois, dá pra colocar um botão aqui */}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => addTreinoFromPicker(t)}
                                className="px-4 py-2 rounded-xl font-semibold inline-flex items-center justify-center gap-2 bg-green-800 text-white hover:bg-green-900"
                              >
                                <Dumbbell className="w-4 h-4" />
                                Adicionar este treino
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 text-[11px] text-gray-500">
                A pontuação adicionada no item será a <b>pontuação do treino programado</b>.
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={closeTreinoPicker}
                className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 font-semibold"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      ) : null}

      {/* ✅ Modal Vídeo Exercício */}
      {videoOpen && videoUrl ? (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeVideo} />
          <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border overflow-hidden m-0 sm:m-4">
            <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-2">
              <div className="text-sm sm:text-base font-bold text-gray-900">
                Vídeo do exercício
              </div>
              <button
                type="button"
                onClick={closeVideo}
                className="p-2 rounded-xl border bg-white hover:bg-gray-50"
                aria-label="Fechar vídeo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 sm:p-4 bg-black">
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
                {isYouTube(videoUrl) ? (
                  <iframe
                    className="w-full h-full"
                    src={toYouTubeEmbed(videoUrl)}
                    title="Vídeo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video className="w-full h-full" controls src={videoUrl} />
                )}
              </div>
            </div>

            <div className="p-3 sm:p-4 flex justify-end bg-white">
              <button
                type="button"
                onClick={closeVideo}
                className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}



      <BottomNav active="treinos" />
    </div>
  );
}