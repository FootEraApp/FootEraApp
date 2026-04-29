import { useEffect, useMemo, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Lock, CheckCircle2, Star } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, APP } from "../../config.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

type ItemTipo = "VIDEO" | "TREINO" | "AULA" | "MATERIAL" | "DESAFIO" | string;

type MetodologiaEstruturaItem = {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string | null;
  tipo: ItemTipo;
  pontos?: number | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  duracaoMin?: number | null;
  arquivoUrl?: string | null;
  materialUrl?: string | null;
  treinoProgramadoId?: string | null;
  treinoProgramado?: {
    id: string;
    nome: string;
    imagemUrl?: string | null;
    codigo?: string | null;
    nivel?: string | null;
    categoria?: string | null;
    pontuacao?: number | null;
    duracao?: number | null;
    objetivo?: string | null;
    tipoTreino?: string | null;
  } | null;
  obrigatorio?: boolean;
  publicado?: boolean;
};

type MetodologiaEstrutura = {
  id: string;
  tipo: "TRILHA" | "MODULO" | string;
  titulo: string;
  descricao?: string | null;
  objetivo?: string | null;
  ordem: number;
  duracaoSemanas?: number | null;
  treinosPorSemana?: number | null;
  quantidadeMinConclusao?: number | null;
  modoExecucao?: string | null;
  pontosPorItem?: number | null;
  bonusConsistencia?: number | null;
  bonusFinal?: number | null;
  prazoInicio?: string | null;
  prazoFinal?: string | null;
  dataInicioCalculada?: string | null;
  dataFimCalculada?: string | null;
  ativo?: boolean;
  itens: MetodologiaEstruturaItem[];
};

type MetodologiaDetalhe = {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  publicoAlvo?: "ATLETAS" | "PROFISSIONAIS" | "AMBOS" | string;
  totalSemanas?: number | null;
  totalAssinantes?: number;
  mediaAvaliacao?: number | null;
  totalReviews?: number;
  pontosTotal?: number; // vindo do backend (soma dos itens)
  criadorNome?: string | null;
  tipo?: "TRILHAS_TREINO" | "CURSO_FORMACAO" | string;
  estruturaTipo?: "TRILHA" | "MODULO" | string;
  area?: string | null;
  geraCertificado?: boolean;
  geraBadge?: boolean;
  estruturas: MetodologiaEstrutura[];
  viewer: {
    // antigo
    isAssinante: boolean;
    // NOVO: acesso real (learning OU avulsa)
    temAcesso: boolean;
    // NOVO: tipo do acesso
    assinaturaTipo?: "LEARNING" | "AVULSA" | null;
    // NOVO: quando expira (pra avulsa = agora + 1 ano)
    expiraEm?: string | null;
    podeAssinarAgora: boolean;
    podeAvaliar?: boolean;
    minhaAvaliacao?: { 
      nota: number; 
      comentario: string | null;
      updatedAt: string 
    } | null;
    motivoBloqueio?: string | null; // ex: "PRECISA_LEARNING", "PRECISA_PAGAR_AVULSA", "LIMITE_MES"...
    progresso: {
      concluidos: string[];
    };
  };
};

function normalizeMediaUrl(raw?: string | null) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u) return null;

  if (u.startsWith("http://") || u.startsWith("https://")) return u;

  // ✅ uploads (backend)
  if (u.startsWith("uploads/")) return `${API.BASE_URL}/${u}`;
  if (u.startsWith("/uploads/")) return `${API.BASE_URL}${u}`;

  // ✅ assets (frontend)
  if (u.startsWith("/assets/")) return `${APP.FRONTEND_BASE_URL}${u}`;

  // fallback
  if (u.startsWith("/")) return `${APP.FRONTEND_BASE_URL}${u}`;

  return u;
}

function formatDateBR(raw?: string | null) {
  if (!raw) return null;

  const s = String(raw).trim();
  if (!s) return null;

  // se vier em ISO UTC, pega só YYYY-MM-DD sem converter fuso
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleDateString("pt-BR");
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  // arredonda pra 0.5
  const half = Math.round(v * 2) / 2;
  const full = Math.floor(half);
  const hasHalf = half - full === 0.5;

  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;

        // cheia
        if (idx <= full) {
          return <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />;
        }

        // meia
        if (idx === full + 1 && hasHalf) {
          return (
            <span key={i} className="relative inline-block w-4 h-4">
              <Star className="absolute inset-0 w-4 h-4 text-gray-300 fill-gray-300" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              </span>
            </span>
          );
        }

        // vazia
        return <Star key={i} className="w-4 h-4 text-gray-300" />;
      })}
    </div>
  );
}

export default function MetodologiaUnicaPage() {
  const [, navigate] = useLocation();
  const [matchLearning, paramsLearning] = useRoute("/learning/:id");
  const [matchOld, paramsOld] = useRoute("/metodologias/:id");

  const params = matchLearning ? paramsLearning : paramsOld;
  const id = params?.id;
  const searchParams = new URLSearchParams(window.location.search);
  const isAvulsa =
    searchParams.get("origemTipo") === "AVULSA" ||
    searchParams.get("origem") === "avulsa" ||
    window.location.search.includes("origemTipo=AVULSA") ||
    window.location.search.includes("origem=avulsa");
  const veioDoAdmin = searchParams.get("from") === "admin";
  const adminPreview = veioDoAdmin;
  const token =
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MetodologiaDetalhe | null>(null);
  const [busy, setBusy] = useState(false);
  const [thumbFromVideo, setThumbFromVideo] = useState<Record<string, string>>({});
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerItem, setPlayerItem] = useState<MetodologiaEstruturaItem | null>(null);
  const [maxTime, setMaxTime] = useState(0); // trava seek
  const [playerEstruturaId, setPlayerEstruturaId] = useState<string | null>(null);
  const [videoConcluindo, setVideoConcluindo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoConcluindoRef = useRef(false);
  const maxTimeRef = useRef(0);
  const playerEstruturaIdRef = useRef<string | null>(null);
  const playerItemIdRef = useRef<string | null>(null);

  async function concluirItem(estruturaId: string, itemId: string) {
    if (!id) return;
    if (!data?.viewer?.temAcesso) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const isAvulsaAtual =
        params.get("origemTipo") === "AVULSA" ||
        params.get("origem") === "avulsa" ||
        window.location.search.includes("origemTipo=AVULSA") ||
        window.location.search.includes("origem=avulsa");
      const base = isAvulsaAtual
        ? `${API.BASE_URL}/api/metodologias/metodologias-avulsas/${id}`
        : `${API.BASE_URL}/api/metodologias/${id}`;

      const r = await fetch(
        `${base}/estruturas/${estruturaId}/concluir-item`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ itemId }),
        }
      );

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "Falha ao concluir item");

      setData((prev) => {
        if (!prev) return prev;

        const backendConcluidos: string[] = Array.isArray(j?.progresso?.concluidos)
          ? j.progresso.concluidos.map((v: any) => String(v))
          : [];

        const prevIds: string[] = Array.isArray(prev.viewer?.progresso?.concluidos)
          ? prev.viewer.progresso.concluidos.map((v) => String(v))
          : [];

        const concluidos: string[] = Array.from(
          new Set<string>([
            ...prevIds,
            ...backendConcluidos,
            String(itemId),
          ])
        );

        return {
          ...prev,
          viewer: {
            ...prev.viewer,
            progresso: {
              ...prev.viewer.progresso,
              concluidos,
            },
          },
        };
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Erro ao marcar como concluído");
    }
  }

  async function concluirVideoAtual() {
    const estruturaIdAtual = playerEstruturaIdRef.current;
    const itemIdAtual = playerItemIdRef.current;

    if (!estruturaIdAtual || !itemIdAtual) return;
    if (videoConcluindoRef.current) return;

    try {
      videoConcluindoRef.current = true;
      setVideoConcluindo(true);

      await concluirItem(estruturaIdAtual, itemIdAtual);
    } finally {
      setPlayerOpen(false);
      setPlayerItem(null);
      setPlayerEstruturaId(null);
      setVideoConcluindo(false);
      videoConcluindoRef.current = false;
      maxTimeRef.current = 0;
      playerEstruturaIdRef.current = null;
      playerItemIdRef.current = null;
      setMaxTime(0);
    }
  }

  async function gerarThumbDoVideo(itemId: string, videoUrl: string) {
    try {
        setThumbFromVideo((prev) => {
            if (prev[itemId]) return prev;
            return prev; // mantém igual por enquanto
        });

        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.src = normalizeMediaUrl(videoUrl) || videoUrl;
        video.muted = true;
        video.playsInline = true;

        await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("video error")), { once: true });
        });

        video.currentTime = 0.1;

        await new Promise<void>((resolve) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
        });

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

        setThumbFromVideo((prev) => ({ ...prev, [itemId]: dataUrl }));
    } catch {
        // se falhar, fica fallback
    }
    }

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  function handleVoltar() {
    if (veioDoAdmin) {
      navigate("/admin");
      return;
    }

    navigate("/learning");
  }

  async function loadMetodologia() {
    if (!id || id === "minhas") {
      navigate(adminPreview ? "/admin" : "/learning");
      return;
    }

    setLoading(true);
    try {
      const search = new URLSearchParams(window.location.search);
      const fromAdmin = search.get("from") === "admin";
      const isAvulsa =
        search.get("origemTipo") === "AVULSA" ||
        search.get("origem") === "avulsa" ||
        window.location.search.includes("origemTipo=AVULSA") ||
        window.location.search.includes("origem=avulsa");

      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token") || "";

      const url = fromAdmin
        ? `${API.BASE_URL}/api/admin/metodologias/${id}?origemTipo=${isAvulsa ? "AVULSA" : "LEARNING"}`
        : isAvulsa
          ? `${API.BASE_URL}/api/metodologias/metodologias-avulsas/${id}`
          : `${API.BASE_URL}/api/metodologias/${id}/detalhe`;

      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        alert(j?.message || "Erro ao carregar metodologia");
        navigate(adminPreview ? "/admin" : "/learning");
        return;
      }

      const raw = j?.item ?? j;

      const normalizado = {
        ...raw,
        totalAssinantes: raw?._count?.assinantes ?? raw?.totalAssinantes ?? 0,
        totalReviews: raw?.totalReviews ?? 0,
        mediaAvaliacao: raw?.mediaAvaliacao ?? 0,
        pontosTotal:
          raw?.pontosTotal ??
          (raw?.estruturas || []).flatMap((e: any) => e.itens || []).reduce(
            (acc: number, it: any) =>
              acc +
              Number(
                it?.pontos ??
                  (String(it?.tipo || "").toUpperCase() === "TREINO"
                    ? it?.treinoProgramado?.pontuacao
                    : 0) ?? 0
              ),
            0
          ),
        criadorNome: raw?.criadorNome ?? raw?.criadorUsuario?.nome ?? null,
        viewer: {
          isAssinante: raw?.viewer?.isAssinante ?? adminPreview,
          temAcesso: raw?.viewer?.temAcesso ?? adminPreview,
          assinaturaTipo: raw?.viewer?.assinaturaTipo ?? (isAvulsa ? "AVULSA" : "LEARNING"),
          expiraEm: raw?.viewer?.expiraEm ?? null,
          podeAssinarAgora: raw?.viewer?.podeAssinarAgora ?? false,
          podeAvaliar: raw?.viewer?.podeAvaliar ?? false,
          minhaAvaliacao:
            raw?.viewer?.minhaAvaliacao ??
            (raw?.minhaAvaliacao ?? null),
          motivoBloqueio: raw?.viewer?.motivoBloqueio ?? null,
          progresso: {
            concluidos: Array.isArray(raw?.viewer?.progresso?.concluidos)
              ? raw.viewer.progresso.concluidos.map((v: any) => String(v))
              : [],
          },
        },
      };

      setData((prev) => {
        const backendIds = Array.isArray(normalizado?.viewer?.progresso?.concluidos)
          ? normalizado.viewer.progresso.concluidos.map((v: any) => String(v))
          : [];

        const prevIds = Array.isArray(prev?.viewer?.progresso?.concluidos)
          ? prev.viewer.progresso.concluidos.map((v: any) => String(v))
          : [];

        const mergedIds = Array.from(new Set([...prevIds, ...backendIds]));

        return {
          ...normalizado,
          viewer: {
            ...normalizado.viewer,
            progresso: {
              ...normalizado.viewer.progresso,
              concluidos: mergedIds,
            },
          },
        };
      });
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar metodologia");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetodologia();
  }, [id, headers, navigate, isAvulsa, adminPreview]);

  useEffect(() => {
  if (!playerOpen) return;

  const video = videoRef.current;
  if (!video) return;

  const handleLoadedMetadata = () => {
    maxTimeRef.current = 0;
    setMaxTime(0);
    videoConcluindoRef.current = false;
    setVideoConcluindo(false);
  };

  const handleTimeUpdate = async () => {
    const duration = Number(video.duration || 0);
    const current = Number(video.currentTime || 0);

    if (current > maxTimeRef.current) {
      maxTimeRef.current = current;
      setMaxTime(current);
    }

    const chegouNoFim =
      duration > 0 &&
      current >= Math.max(duration - 0.3, duration * 0.99);

    if (chegouNoFim && !videoConcluindoRef.current) {
      await concluirVideoAtual();
    }
  };

  const handleSeeking = () => {
    if (video.currentTime > maxTimeRef.current + 0.25) {
      video.currentTime = maxTimeRef.current;
    }
  };

  const handleEnded = async () => {
    if (!videoConcluindoRef.current) {
      await concluirVideoAtual();
    }
  };

  video.addEventListener("loadedmetadata", handleLoadedMetadata);
  video.addEventListener("timeupdate", handleTimeUpdate);
  video.addEventListener("seeking", handleSeeking);
  video.addEventListener("ended", handleEnded);

  return () => {
    video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    video.removeEventListener("timeupdate", handleTimeUpdate);
    video.removeEventListener("seeking", handleSeeking);
    video.removeEventListener("ended", handleEnded);
  };
}, [playerOpen]);

  const estruturasOrdenadas = useMemo(() => {
  const estruturas = data?.estruturas || [];

  return estruturas
    .filter((estrutura) => adminPreview || estrutura.ativo !== false)
    .map((estrutura) => ({
      ...estrutura,
      itens: (estrutura.itens || [])
        .filter((it) => adminPreview || it.publicado !== false)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}, [data, adminPreview]);

  const allItens = useMemo(
    () => estruturasOrdenadas.flatMap((estrutura) => estrutura.itens || []),
    [estruturasOrdenadas]
  );

  useEffect(() => {
    const videosSemThumb = allItens.filter((it) => {
      const isVideo = ["VIDEO", "AULA"].includes(String(it.tipo).toUpperCase());
      return isVideo && it.publicado !== false && !it.thumbUrl && !!it.videoUrl;
    });

    videosSemThumb.forEach((it) => {
      if (thumbFromVideo[it.id]) return;
      gerarThumbDoVideo(it.id, it.videoUrl!);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItens, thumbFromVideo]);

  const concluIds = useMemo(() => new Set(data?.viewer?.progresso?.concluidos || []), [data]);

  const totalItens = allItens.length;
  const totalConcluidos = useMemo(() => (data?.viewer?.progresso?.concluidos?.length || 0), [data]);
  const pct = totalItens > 0 
    ? Math.round((totalConcluidos / totalItens) * 100) 
    : 0;
  const metodologiaCompleta = pct >= 100;
  const jaAvaliou = !!data?.viewer?.minhaAvaliacao;

  async function assinarMetodologia() {
    if (!data || !id) return;

    const motivo = String(data.viewer?.motivoBloqueio || "");
    if (motivo === "JA_ASSINADA") {
      navigate(adminPreview ? "/admin" : "/learning")
      return;
    }

    // 1) Se o backend disser que não pode assinar agora, decide o destino certo:
    if (!data.viewer.podeAssinarAgora) {
        const motivo = String(data.viewer?.motivoBloqueio || "");
        const label =
        data.viewer?.isAssinante
            ? "✅ Assinada"
            : (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES")
            ? "Ver minhas metodologias"
            : (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR")
                ? "Ativar Learning"
                : "Assinar metodologia";

        // A) Não tem Learning ativo -> vai pro pagamento (com return)
        if (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR") {
        navigate(`/pagamentos?produto=learning&returnTo=/learning/${id}`);
        return;
        }
        
        if (motivo === "PRECISA_PAGAR_AVULSA") {
          navigate(`/pagamentos?produto=metodologia&id=${id}&origem=avulsa&returnTo=/learning/${id}?origem=avulsa`);
          return;
        }

        // B) Já atingiu limite (1/1 ou 3/3) -> vai pra Minhas Metodologias
        if (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES") {
        alert("Você já atingiu o limite de metodologias do seu plano neste ciclo.");
        navigate(adminPreview ? "/admin" : "/learning")
        return;
        }

        // fallback
        navigate("/pagamentos");
        return;
    }

    // 2) Pode assinar: tenta “selecionar” essa metodologia
    try {
        setBusy(true);

        const r = await fetch(
          `${API.BASE_URL}/api/metodologias/${id}/assinar${isAvulsa ? "?origem=avulsa" : ""}`,
          {
            method: "POST",
            headers,
          }
        );

        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
        // Se backend responder que precisa pagar, também joga pro pagamento
        if (j?.code === "PRECISA_PAGAR" || j?.code === "PRECISA_LEARNING") {
            navigate(`/pagamentos?produto=learning&returnTo=/learning/${id}`);
            return;
        }

        // Se backend responder limite
        if (j?.code === "LIMITE_METODOLOGIAS") {
            alert(j?.message || "Você já atingiu o limite do seu plano.");
            navigate(adminPreview ? "/admin" : "/learning")
            return;
        }

        alert(j?.message || "Não foi possível assinar");
        return;
        }

        // sucesso: redireciona para Minhas Metodologias (ou recarrega detalhe)
        alert("✅ Metodologia adicionada em 'Minhas Metodologias'!");
        navigate(adminPreview ? "/admin" : "/learning")
    } catch (e) {
        console.error(e);
        alert("Erro ao assinar");
    } finally {
        setBusy(false);
    }
    }

    function getItemImage(
      it: MetodologiaEstruturaItem,
      thumbFromVideo: Record<string, string>
    ) {
      const tipoUpper = String(it.tipo || "").toUpperCase();

      if (tipoUpper === "VIDEO" || tipoUpper === "AULA") {
        return normalizeMediaUrl(it.thumbUrl || thumbFromVideo[it.id] || null) || AVATAR_FALLBACK;
      }

      if (tipoUpper === "MATERIAL") {
        return normalizeMediaUrl(it.thumbUrl || null) || AVATAR_FALLBACK;
      }

      if (tipoUpper === "TREINO") {
        return normalizeMediaUrl(it.treinoProgramado?.imagemUrl || null) || AVATAR_FALLBACK;
      }

      if (tipoUpper === "DESAFIO") {
        return normalizeMediaUrl(it.thumbUrl || null) || AVATAR_FALLBACK;
      }

      return AVATAR_FALLBACK;
    }

  function bloquearAcao(): boolean {
    return !data?.viewer?.temAcesso;
  }

  if (loading) return <div className="p-6">Carregando metodologia...</div>;
  if (!data) return <div className="p-6">Metodologia não encontrada.</div>;

  const rating = Number(data.mediaAvaliacao ?? 0);
  const reviews = Number(data.totalReviews ?? 0);
  const pontosTotal = Number(data.pontosTotal ?? 0);
  const assinaturas = Number(data.totalAssinantes ?? 0);
  const capaHeader = normalizeMediaUrl(data.capaUrl) || AVATAR_FALLBACK;
  const podeAvaliar = !!data?.viewer?.podeAvaliar; // vindo do backend

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <button
        type="button"
        onClick={handleVoltar}
        className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-[#216c43] text-[#216c43] bg-white"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* HEADER */}
      <div className="mt-4 rounded-2xl border bg-white p-4 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="w-full md:w-80 shrink-0">
            <img
              src={capaHeader}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = AVATAR_FALLBACK;
              }}
              className="w-full aspect-[16/9] rounded-2xl border object-cover bg-white"
              alt={data.titulo}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-white">
                    {String(data.publicoAlvo ?? "AMBOS")}
                  </span>
                  <h1 className="text-xl md:text-2xl font-bold truncate">{data.titulo}</h1>
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                  <Stars value={rating} />
                  <span className="font-semibold text-gray-800">{rating.toFixed(1)}</span>
                  <span>({reviews})</span>
                  <span className="text-gray-400">•</span>
                  <span><b>{assinaturas}</b> assinaturas</span>
                </div>

                <div className="mt-2 text-sm text-gray-700 space-y-1">
                <div>
                  {data.estruturaTipo === "MODULO"
                    ? `${estruturasOrdenadas.length} módulos`
                    : `${estruturasOrdenadas.length} trilhas`}
                </div>

                <div>
                    + <b>{pontosTotal}</b> pts no total
                </div>

                {data.criadorNome ? (
                    <div>
                    Criado por: <b>{data.criadorNome}</b>
                    </div>
                ) : null}
                </div>
                {data.descricao ? (
                  <p className="mt-3 text-sm text-gray-600">{data.descricao}</p>
                ) : null}
              </div>

              {!adminPreview && (
              <div className="flex flex-col items-end gap-2">
                <button
                  disabled={busy || !!data?.viewer?.temAcesso}
                  onClick={assinarMetodologia}
                  className="px-4 py-2 rounded-full bg-green-800 text-white font-semibold hover:bg-green-900 disabled:opacity-60"
                >
                  {(() => {
                    const motivo = String(data.viewer?.motivoBloqueio || "");

                    if (data.viewer?.temAcesso) {
                      return data.viewer?.assinaturaTipo === "AVULSA"
                        ? "✅ Metodologia avulsa ativa"
                        : "✅ Metodologia no Learning";
                    }

                    if (motivo === "PRECISA_PAGAR_AVULSA") return "Comprar metodologia";
                    if (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR") return "Ativar Learning";
                    if (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES") {
                      return "Ver minhas metodologias";
                    }

                    return isAvulsa ? "Comprar metodologia" : "Ativar Learning";
                  })()}
                </button>

                {!adminPreview && (!data.viewer?.isAssinante || !data.viewer?.temAcesso) && (
                  <div className="text-xs text-gray-500 text-right max-w-[240px]">
                   {(() => {
                      const motivo = String(data.viewer?.motivoBloqueio || "");

                      if (motivo === "PRECISA_LEARNING" || motivo === "PRECISA_PAGAR") {
                        return "Para acessar esta metodologia, você precisa ter um plano Learning ativo e selecionar esta metodologia dentro do limite mensal do seu plano.";
                      }

                      if (motivo === "LIMITE_METODOLOGIAS" || motivo === "JA_ESCOLHIDA_NO_MES") {
                        return "Você já atingiu o limite de metodologias Learning do seu plano neste ciclo. Vá para 'Minhas metodologias' para revisar suas escolhas.";
                      }

                      if (motivo === "PRECISA_PAGAR_AVULSA") {
                        return "Para acessar esta metodologia, você precisa comprar esta metodologia avulsa especificamente. Ela não entra no plano Learning.";
                      }

                      return isAvulsa
                        ? "Esta é uma metodologia avulsa e só é liberada com a compra dela."
                        : "Esta é uma metodologia Learning e só é liberada para usuários com plano Learning.";
                    })()}

                  </div>
                )}
              </div>
              )}
            </div>
          
            {adminPreview && (
              <div className="flex flex-col items-end gap-2">
                <span className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold">
                  Visualização administrativa
                </span>
                <div className="text-xs text-gray-500 text-right max-w-[240px]">
                  Como administrador, você pode visualizar todos os conteúdos desta metodologia.
                </div>
              </div>
            )}

            {/* PROGRESSO */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>
                  {totalConcluidos}/{totalItens} concluídos
                </span>
                <span>{pct}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-green-700" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* ✅ FINALIZAR METODOLOGIA (COLE AQUI) */}
            <div className="mt-4">
              <button
                disabled={!data.viewer.temAcesso || !metodologiaCompleta || jaAvaliou}
                onClick={() => {
                    if (!data.viewer.temAcesso) return;

                    if (!metodologiaCompleta) {
                      alert("Conclua todos os itens obrigatórios para finalizar a metodologia.");
                      return;
                    }

                    const pontos = Number(data.pontosTotal || 0);

                    const partes: string[] = [
                      `Você concluiu a metodologia e ganhou ${pontos} pontos!`,
                    ];

                    if (data.geraBadge && data.geraCertificado) {
                      partes.push("Você também ganhou uma badge e um certificado.");
                    } else if (data.geraBadge) {
                      partes.push("Você também ganhou uma badge.");
                    } else if (data.geraCertificado) {
                      partes.push("Você também ganhou um certificado.");
                    }

                    alert(partes.join(" "));

                    const temRecompensa = data.geraBadge || data.geraCertificado;

                    navigate(
                      `/learning/avaliar?metodologiaId=${encodeURIComponent(data.id)}` +
                        `${isAvulsa ? "&origem=avulsa" : ""}` +
                        `${adminPreview ? "&from=admin" : ""}` +
                        `${temRecompensa ? "&reward=1" : ""}`
                    );
                  }}
                className={`w-full h-12 rounded-xl font-semibold text-white ${
                  !data.viewer.temAcesso || !metodologiaCompleta || jaAvaliou
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-green-800 hover:bg-green-900"
                }`}
              >
                {jaAvaliou
                  ? "Metodologia já avaliada"
                  : metodologiaCompleta
                    ? "Finalizar metodologia"
                    : "Conclua todos os itens"}
              </button>

              {!metodologiaCompleta && (
                <div className="mt-2 text-xs text-gray-500">
                  Conclua todos os itens da metodologia para liberar o botão.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {estruturasOrdenadas.map((estrutura, estruturaIndex) => (
          <div key={estrutura.id} className="rounded-2xl border bg-white p-4 shadow-sm">
           <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="font-semibold text-gray-900">
                  {estrutura.tipo === "MODULO"
                    ? `Módulo ${estruturaIndex + 1}`
                    : `Trilha ${estruturaIndex + 1}`}
                </div>
              </div>

              <div className="text-sm text-gray-600">{estrutura.titulo}</div>

                {estrutura.objetivo ? (
                  <div className="mt-1 text-sm text-gray-500">{estrutura.objetivo}</div>
                ) : null}

                {(estrutura.dataInicioCalculada || estrutura.dataFimCalculada) && (
                  <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
                    {estrutura.dataInicioCalculada ? (
                      <div>
                        <span className="font-medium">Início:</span>{" "}
                        {formatDateBR(estrutura.dataInicioCalculada)}
                      </div>
                    ) : null}

                    {estrutura.dataFimCalculada ? (
                      <div>
                        <span className="font-medium">Prazo final:</span>{" "}
                        {formatDateBR(estrutura.dataFimCalculada)}
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                  {estrutura.duracaoSemanas ? (
                    <span className="px-2 py-1 rounded-full border bg-gray-50">
                      {estrutura.duracaoSemanas} semanas
                    </span>
                  ) : null}

                  {estrutura.treinosPorSemana ? (
                    <span className="px-2 py-1 rounded-full border bg-gray-50">
                      {estrutura.treinosPorSemana} por semana
                    </span>
                  ) : null}

                  {estrutura.modoExecucao ? (
                    <span className="px-2 py-1 rounded-full border bg-gray-50">
                      {String(estrutura.modoExecucao).replaceAll("_", " ")}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="text-xs text-gray-600">
                {estrutura.itens.filter((i) => concluIds.has(i.id)).length}/{estrutura.itens.length} concluídos
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {estrutura.itens.map((it) => {
                const tipoUpper = String(it.tipo || "").toUpperCase();
                const isVideo = tipoUpper === "VIDEO" || tipoUpper === "AULA";
                const isMaterial = tipoUpper === "MATERIAL";
                const isTreino = tipoUpper === "TREINO";
                const isDesafio = tipoUpper === "DESAFIO";
                const concluido = concluIds.has(it.id);
                const locked = !adminPreview && !data.viewer.temAcesso;
                const thumbRaw = isVideo
                  ? (it.thumbUrl || thumbFromVideo[it.id] || null)
                  : isMaterial
                  ? (it.thumbUrl || null)
                  : isTreino
                  ? (it.treinoProgramado?.imagemUrl || null)
                  : isDesafio
                  ? (it.thumbUrl || null)
                  : null;

                const imgSrc = getItemImage(it, thumbFromVideo);
                const pontosItem = Number(
                  it?.pontos ??
                    (String(it?.tipo || "").toUpperCase() === "TREINO"
                      ? it?.treinoProgramado?.pontuacao
                      : 0) ??
                    0
                );

                return (
                  <div key={it.id} className="rounded-xl border p-3 flex items-center gap-3">
                    <img
                      src={imgSrc}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = AVATAR_FALLBACK;
                      }}
                      className="h-16 w-28 rounded-lg border object-cover bg-white flex-shrink-0"
                      alt={it.titulo}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{it.titulo}</div>
                          {it.descricao ? (
                            <div className="text-sm text-gray-600 line-clamp-2">{it.descricao}</div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="rounded-full border border-[#d8c9a7] bg-[#f6f1e4] text-[#a76500] text-sm px-3 py-1 whitespace-nowrap">
                            + {pontosItem} pts
                          </span>

                          {concluido ? (
                            <span className="px-2 py-1 rounded-full text-xs border bg-emerald-50 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Concluído
                            </span>
                          ) : locked ? (
                            <span className="px-2 py-1 rounded-full text-xs border bg-gray-50 text-gray-700 flex items-center gap-1">
                              <Lock className="w-4 h-4" /> Bloqueado
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">
                          {isVideo && it.duracaoMin ? `${it.duracaoMin} min` : ""}
                        </div>

                        <div className="flex gap-2">
                          {isVideo && (
                            <button
                              disabled={locked}
                              className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold hover:bg-green-900 disabled:opacity-60"
                              onClick={() => {
                                if (locked) return;
                                videoConcluindoRef.current = false;
                                maxTimeRef.current = 0;
                                playerEstruturaIdRef.current = estrutura.id;
                                playerItemIdRef.current = it.id;

                                setVideoConcluindo(false);
                                setMaxTime(0);
                                setPlayerItem(it as any);
                                setPlayerEstruturaId(estrutura.id);
                                setPlayerOpen(true);
                              }}
                            >
                              {concluido ? "Ver novamente" : "Assistir"}
                            </button>
                          )}

                          {isTreino && (
                            <button
                              disabled={locked}
                              className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold hover:bg-green-900 disabled:opacity-60"
                              onClick={() => {
                                if (locked) return;
                                if (!it.treinoProgramadoId) {
                                  alert("Este item não possui treino vinculado.");
                                  return;
                                }

                                navigate(
                                  `/treinos/metodologia` +
                                    `?treinoProgramadoId=${encodeURIComponent(it.treinoProgramadoId)}` +
                                    `&metodologiaId=${encodeURIComponent(data.id)}` +
                                    `&estruturaId=${encodeURIComponent(estrutura.id)}` +
                                    `&metodologiaItemId=${encodeURIComponent(it.id)}` +
                                    `${isAvulsa ? `&origem=avulsa` : ""}` +
                                    `${adminPreview ? `&from=admin` : ""}`
                                );
                              }}
                            >
                              {concluido ? "Treino enviado" : "Iniciar"}
                            </button>
                          )}

                          {isMaterial && (
                            <button
                              disabled={locked}
                              className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold hover:bg-green-900 disabled:opacity-60"
                              onClick={async () => {
                                if (locked) return;

                                const url = normalizeMediaUrl(it.arquivoUrl || it.materialUrl) || "#";
                                window.open(url, "_blank", "noopener,noreferrer");

                                await concluirItem(estrutura.id, it.id);
                              }}
                            >
                              {concluido ? "Concluído" : "Abrir material"}
                            </button>
                          )}

                          {isDesafio && (
                            <button
                              disabled={locked}
                              className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold hover:bg-green-900 disabled:opacity-60"
                              onClick={() => {
                                if (locked) return;

                                navigate(
                                  `/submissao?desafioId=${it.id}` +
                                  `&metodologiaId=${data.id}` +
                                  `&estruturaId=${estrutura.id}` +
                                  `&metodologiaItemId=${it.id}` +
                                  `&tipo=desafio` +
                                  `${isAvulsa ? `&origemTipo=AVULSA` : ``}` +
                                  `${adminPreview ? `&from=admin` : ``}`
                                );
                              }}
                            >
                              {concluido ? "Ver submissão" : "Enviar submissão"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!data.viewer.temAcesso && !adminPreview && (
              <div className="mt-3 text-xs text-gray-500">
                * Assine para desbloquear os conteúdos desta metodologia.
              </div>
            )}
          </div>
        ))}
      </div>

      {playerOpen && playerItem && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-semibold truncate">{playerItem.titulo}</div>
              <button
                className="px-3 py-1 rounded-lg border text-sm"
                onClick={() => {
                  setPlayerOpen(false);
                  setPlayerItem(null);
                  setPlayerEstruturaId(null);
                  setVideoConcluindo(false);
                  videoConcluindoRef.current = false;
                  maxTimeRef.current = 0;
                  playerEstruturaIdRef.current = null;
                  playerItemIdRef.current = null;
                  setMaxTime(0);
                }}
              >
                Fechar
              </button>
            </div>

            <div className="bg-black">
              <video
                ref={videoRef}
                src={normalizeMediaUrl(playerItem.videoUrl) || playerItem.videoUrl || ""}
                preload="metadata"
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                autoPlay
                className="w-full max-h-[70vh]"
              />
            </div>

            <div className="p-3 text-xs text-gray-600">
              Você precisa assistir até o final para marcar como concluído.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}