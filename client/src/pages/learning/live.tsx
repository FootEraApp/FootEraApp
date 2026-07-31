import { toast } from "@/lib/toast";
// client/src/pages/learning/live.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  PlayCircle,
  Radio,
  Send,
  Users,
  Video,
} from "lucide-react";
import { API } from "@/config.js";
import CoverImage from "../../components/shared/CoverImage";
import Avatar from "../../components/shared/Avatar";

type AulaAoVivoStatus = "AGENDADA" | "AO_VIVO" | "FINALIZADA" | "CANCELADA";

type AulaAoVivoDetalhe = {
  id: string;
  titulo: string;
  descricao?: string | null;
  status: AulaAoVivoStatus;
  dataInicio: string;
  dataFim?: string | null;
  iniciouEm?: string | null;
  finalizouEm?: string | null;
  urlStream?: string | null;
  videoGravadoUrl?: string | null;
  thumbUrl?: string | null;
  chatAtivo: boolean;
  gravacaoAtiva: boolean;
  replayDisponivel: boolean;
  ivsRecordingStatus?:
    | "CONFIGURADA"
    | "PROCESSANDO"
    | "DISPONIVEL"
    | "NAO_CONFIGURADA"
    | string
    | null;
  totalMensagens?: number;
  totalParticipantes?: number;
  totalOnline?: number;
  metodologia?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
    criadorUsuario?: {
      nome?: string | null;
      foto?: string | null;
    } | null;
  } | null;
  metodologiaAvulsa?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
    criadorUsuario?: {
      nome?: string | null;
      foto?: string | null;
    } | null;
  } | null;
  estrutura?: {
    id: string;
    titulo?: string | null;
  } | null;
  estruturaAvulsa?: {
    id: string;
    titulo?: string | null;
  } | null;
  item?: {
    id: string;
    titulo?: string | null;
    tipo?: string | null;
  } | null;
  itemAvulsa?: {
    id: string;
    titulo?: string | null;
    tipo?: string | null;
  } | null;
  metodologiaId?: string | null;
  metodologiaAvulsaId?: string | null;
  estruturaId?: string | null;
  estruturaAvulsaId?: string | null;
  itemId?: string | null;
  itemAvulsaId?: string | null;
};

type ChatMessage = {
  id: string;
  usuarioId: string;
  usuario?: {
    nome?: string | null;
    foto?: string | null;
    tipo?: string | null;
  };
  mensagem: string;
  tipo?: "TEXTO" | "SISTEMA" | "ALERTA";
  criadoEm: string;
};

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function getAulaIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("aulaId") || params.get("id") || "";
}

function getInitials(nome?: string | null) {
  const parts = String(nome || "U")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function formatarDataHora(value?: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarHora(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tempoAteLive(dataInicio?: string | null) {
  if (!dataInicio) return "";

  const inicio = new Date(dataInicio).getTime();
  const agora = Date.now();
  const diff = inicio - agora;

  if (Number.isNaN(inicio)) return "";
  if (diff <= 0) return "A live deve começar em instantes.";

  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (dias > 0) return `Começa em ${dias} dia${dias > 1 ? "s" : ""}.`;
  if (horas > 0) return `Começa em ${horas} hora${horas > 1 ? "s" : ""}.`;
  return `Começa em ${Math.max(minutos, 1)} minuto${minutos > 1 ? "s" : ""}.`;
}

function carregarScriptIvsPlayer(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;

    if (w.IVSPlayer) {
      resolve(w.IVSPlayer);
      return;
    }

    const scriptExistente = document.querySelector(
      'script[data-ivs-player="true"]'
    ) as HTMLScriptElement | null;

    if (scriptExistente) {
      scriptExistente.addEventListener("load", () => {
        if (w.IVSPlayer) resolve(w.IVSPlayer);
        else reject(new Error("IVS Player carregou, mas não ficou disponível."));
      });

      scriptExistente.addEventListener("error", () => {
        reject(new Error("Falha ao carregar o script do IVS Player."));
      });

      return;
    }

    const script = document.createElement("script");
    script.src = "https://player.live-video.net/1.51.0/amazon-ivs-player.min.js";
    script.async = true;
    script.dataset.ivsPlayer = "true";

    script.onload = () => {
      if (w.IVSPlayer) {
        resolve(w.IVSPlayer);
      } else {
        reject(new Error("IVS Player carregou, mas não ficou disponível."));
      }
    };

    script.onerror = () => {
      reject(new Error("Falha ao carregar o script do IVS Player."));
    };

    document.body.appendChild(script);
  });
}

export default function LearningLivePage() {
  const [, navigate] = useLocation();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressoMarcadoRef = useRef(false);
  const timerConclusaoAoVivoRef = useRef<number | null>(null);
  const aulaAoVivoTimerKeyRef = useRef<string | null>(null);
  const aulaAtualRef = useRef<AulaAoVivoDetalhe | null>(null);

  const [aulaId] = useState(() => getAulaIdFromUrl());
  const [aula, setAula] = useState<AulaAoVivoDetalhe | null>(null);
  const [loadingAula, setLoadingAula] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [
    replaySincronizando,
    setReplaySincronizando,
  ] = useState(false);

  const [
    replayMensagem,
    setReplayMensagem,
  ] = useState<string | null>(
    null
  );

  const isLive = aula?.status === "AO_VIVO";
  const isScheduled = aula?.status === "AGENDADA";
  const isFinished = aula?.status === "FINALIZADA";
  const isCanceled = aula?.status === "CANCELADA";

  const metodologiaTitulo =
    aula?.metodologia?.titulo ||
    aula?.metodologiaAvulsa?.titulo ||
    "FootEra Learning";

  const capaUrl =
    aula?.metodologia?.capaUrl ||
    aula?.metodologiaAvulsa?.capaUrl ||
    aula?.thumbUrl ||
    null;

  const criadorNome =
    aula?.metodologia?.criadorUsuario?.nome ||
    aula?.metodologiaAvulsa?.criadorUsuario?.nome ||
    "Professor FootEra";

  const criadorFoto =
    aula?.metodologia?.criadorUsuario?.foto ||
    aula?.metodologiaAvulsa?.criadorUsuario?.foto ||
    null;

  const streamAtual =
    useMemo(() => {
      if (isLive) {
        return aula?.urlStream || "";
      }

      /*
      * Depois da finalização, nunca reutiliza
      * a URL da transmissão ao vivo.
      *
      * O playbackUrl do canal IVS não é a URL
      * da gravação.
      */
      if (
        isFinished &&
        aula?.replayDisponivel
      ) {
        return (
          aula?.videoGravadoUrl ||
          ""
        );
      }

      return "";
    }, [
      aula?.urlStream,
      aula?.videoGravadoUrl,
      aula?.replayDisponivel,
      isLive,
      isFinished,
    ]);

  const liveBadge = useMemo(() => {
    if (!aula) return null;

    if (aula.status === "AO_VIVO") {
      return {
        label: "Ao vivo agora",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    }

    if (aula.status === "AGENDADA") {
      return {
        label: `Agendada para ${formatarDataHora(aula.dataInicio)}`,
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }

    if (aula.status === "FINALIZADA") {
      return {
        label: aula.replayDisponivel ? "Replay disponível" : "Live finalizada",
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
    }

    return {
      label: "Cancelada",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }, [aula]);

  useEffect(() => {
    aulaAtualRef.current = aula;
  }, [aula]);

  useEffect(() => {
    if (!aulaId) {
      setLoadingAula(false);
      setPageError("Aula ao vivo não encontrada.");
      return;
    }

    carregarAula();
    carregarMensagens();

    const interval = window.setInterval(() => {
      carregarAula(false);
      carregarMensagens(false);
    }, 8000);

    return () => { window.clearInterval(interval); limparTimerConclusaoAoVivo(); };
  }, [aulaId]);

  useEffect(() => {
    if (!aulaId) return;

    if (
      aula?.status !==
      "FINALIZADA"
    ) {
      return;
    }

    if (aula.replayDisponivel) {
      return;
    }

    if (!aula.gravacaoAtiva) {
      return;
    }

    if (
      aula.ivsRecordingStatus ===
      "NAO_CONFIGURADA"
    ) {
      return;
    }

    /*
    * Verifica imediatamente e depois
    * a cada 30 segundos.
    */
    void sincronizarReplay(false);

    const intervalo =
      window.setInterval(() => {
        void sincronizarReplay(false);
      }, 30_000);

    return () => {
      window.clearInterval(
        intervalo
      );
    };
  }, [
    aulaId,
    aula?.status,
    aula?.replayDisponivel,
    aula?.gravacaoAtiva,
    aula?.ivsRecordingStatus,
  ]);
  
  useEffect(() => {
    if (!aulaId) return;

    registrarPresenca(false);

    const interval = window.setInterval(() => {
      registrarPresenca(false);
    }, 12000);

    return () => {
      window.clearInterval(interval);

      const token = getToken();
      if (!token) return;

      fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/presenca/sair`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        keepalive: true,
      }).catch(() => null);
    };
  }, [aulaId]);

  useEffect(() => {
    if (!streamAtual || !videoRef.current) return;

    let player: any = null;
    let cancelled = false;

    async function prepararPlayerIvs() {
      try {
        setPlayerLoading(true);
        setPlayerError(null);

        const video = videoRef.current;
        if (!video) return;

        const IVSPlayer = await carregarScriptIvsPlayer();

        if (cancelled) return;

        if (IVSPlayer.isPlayerSupported && !IVSPlayer.isPlayerSupported) {
          throw new Error("Seu navegador não suporta o Amazon IVS Player.");
        }

        player = IVSPlayer.create();

        const PlayerState = IVSPlayer.PlayerState;
        const PlayerEventType = IVSPlayer.PlayerEventType;

        player.attachHTMLVideoElement(video);

        player.addEventListener(PlayerState.READY, () => {
          console.log("[IVS PLAYER] READY");
        });

        player.addEventListener(PlayerState.PLAYING, () => {
          console.log("[IVS PLAYER] PLAYING");
          setPlayerLoading(false);
          setPlayerError(null);
        });

        player.addEventListener(PlayerState.BUFFERING, () => {
          console.log("[IVS PLAYER] BUFFERING");
          setPlayerLoading(true);
        });

        player.addEventListener(PlayerState.ENDED, () => {
          console.log("[IVS PLAYER] ENDED");
          setPlayerLoading(false);

          const aulaAtual = aula;

          if (aulaAtual?.status === "FINALIZADA" && aulaAtual?.replayDisponivel) {
            marcarAulaAoVivoComoConcluida(aulaAtual);
          }
        });

        player.addEventListener(PlayerEventType.ERROR, (err: any) => {
          console.error("[IVS PLAYER] ERROR:", err);
          setPlayerLoading(false);
          setPlayerError("Erro ao reproduzir a transmissão. Tente recarregar a página.");
        });

        player.setAutoplay?.(true);
        player.setVolume?.(0);

        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;

        player.load(streamAtual);

        try {
          await player.play();
          console.log("[IVS PLAYER] play chamado com sucesso.");
        } catch (err) {
          console.warn("[IVS PLAYER] autoplay bloqueado:", err);
          setPlayerLoading(false);
          setPlayerError("Clique no botão de play para iniciar a transmissão.");
        }

        window.setTimeout(() => {
          try {
            console.log("[IVS PLAYER] version:", player.getVersion?.());
            console.log("[IVS PLAYER] state:", player.getState?.());
            console.log("[IVS PLAYER] liveLatency:", player.getLiveLatency?.());
            console.log("[IVS PLAYER] sessionId:", player.getSessionId?.());
          } catch {}
        }, 5000);
      } catch (e: any) {
        console.error("[IVS PLAYER] Falha:", e);
        setPlayerError(e?.message || "Erro ao carregar player da live.");
        setPlayerLoading(false);
      }
    }

    prepararPlayerIvs();

    return () => {
      cancelled = true;

      try {
        player?.pause?.();
        player?.delete?.();
      } catch {}

      player = null;
    };
  }, [streamAtual, aula?.id, aula?.status, aula?.replayDisponivel]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;
    if (!aula) return;
    if (aula.status !== "FINALIZADA") return;
    if (!aula.replayDisponivel) return;

    const aulaAtual = aula;

    function handleReplayEnded() {
      marcarAulaAoVivoComoConcluida(aulaAtual);
    }

    video.addEventListener("ended", handleReplayEnded);

    return () => {
      video.removeEventListener("ended", handleReplayEnded);
    };
  }, [aula?.id, aula?.status, aula?.replayDisponivel, streamAtual]);

  async function marcarAulaAoVivoComoConcluida(aulaAtual: AulaAoVivoDetalhe) {
    if (progressoMarcadoRef.current) {
      console.log("[LIVE PROGRESSO] Já marcado nesta sessão, ignorando.");
      return;
    }

    const token = getToken();

    if (!token) {
      console.warn("[LIVE PROGRESSO] Sem token. Não dá para concluir item.");
      return;
    }

    const metodologiaId =
      aulaAtual.metodologia?.id || aulaAtual.metodologiaId || "";

    const metodologiaAvulsaId =
      aulaAtual.metodologiaAvulsa?.id || aulaAtual.metodologiaAvulsaId || "";

    const estruturaId =
      aulaAtual.estrutura?.id || aulaAtual.estruturaId || "";

    const estruturaAvulsaId =
      aulaAtual.estruturaAvulsa?.id || aulaAtual.estruturaAvulsaId || "";

    const itemId =
      aulaAtual.item?.id || aulaAtual.itemId || "";

    const itemAvulsaId =
      aulaAtual.itemAvulsa?.id || aulaAtual.itemAvulsaId || "";

    const isAvulsa = Boolean(
      metodologiaAvulsaId &&
      itemAvulsaId
    );

    const isLearning = Boolean(
      metodologiaId &&
      itemId
    );

    if (!isAvulsa && !isLearning) {
      console.warn("[LIVE PROGRESSO] Aula sem vínculo completo com metodologia.", {
        aulaAtual,
      });
      return;
    }

    try {
      progressoMarcadoRef.current = true;

      const url = isAvulsa
        ? `${API.BASE_URL}/api/metodologias/metodologias-avulsas/${metodologiaAvulsaId}/concluir-item`
        : `${API.BASE_URL}/api/metodologias/${metodologiaId}/concluir-item`;
        
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: isAvulsa ? itemAvulsaId : itemId,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        progressoMarcadoRef.current = false;

        console.warn("[LIVE PROGRESSO] Não foi possível concluir aula ao vivo:", {
          status: res.status,
          json,
        });

        return;
      }

      const itemConcluidoId = isAvulsa ? itemAvulsaId : itemId;
      const metodologiaConcluidaId = isAvulsa ? metodologiaAvulsaId : metodologiaId;

      try {
        const storageKey = isAvulsa
          ? `footera:metodologia-avulsa:${metodologiaConcluidaId}:concluidos`
          : `footera:metodologia:${metodologiaConcluidaId}:concluidos`;

        const atuais = JSON.parse(localStorage.getItem(storageKey) || "[]");
        const lista = Array.isArray(atuais) ? atuais.map(String) : [];

        localStorage.setItem(
            storageKey,
            JSON.stringify(Array.from(new Set([...lista, String(itemConcluidoId)])))
          );
        } catch {}

    } catch (err) {
      progressoMarcadoRef.current = false;
      console.warn("[LIVE PROGRESSO] Erro ao marcar progresso da aula ao vivo:", err);
    }
  }

  function limparTimerConclusaoAoVivo() {
    if (timerConclusaoAoVivoRef.current) {
      window.clearTimeout(timerConclusaoAoVivoRef.current);
      timerConclusaoAoVivoRef.current = null;
    }

    aulaAoVivoTimerKeyRef.current = null;
  }

  function programarConclusaoAulaAoVivo(aulaAtual: AulaAoVivoDetalhe) {
    if (!aulaAtual?.id) {
      console.warn("[LIVE PROGRESSO] Não programou conclusão: aula sem id.");
      return;
    }

    if (progressoMarcadoRef.current) {
      console.log("[LIVE PROGRESSO] Não programou: progresso já marcado.");
      return;
    }

    if (aulaAtual.status !== "AO_VIVO") {
      console.log("[LIVE PROGRESSO] Não programou timer porque status não é AO_VIVO:", {
        status: aulaAtual.status,
        aulaId: aulaAtual.id,
      });

      limparTimerConclusaoAoVivo();
      return;
    }

    const timerKey = `${aulaAtual.id}:AO_VIVO`;

    if (
      aulaAoVivoTimerKeyRef.current === timerKey &&
      timerConclusaoAoVivoRef.current
    ) {
      return;
    }

    limparTimerConclusaoAoVivo();

    aulaAoVivoTimerKeyRef.current = timerKey;

    timerConclusaoAoVivoRef.current = window.setTimeout(() => {
      const aulaMaisAtual = aulaAtualRef.current || aulaAtual;

      marcarAulaAoVivoComoConcluida(aulaMaisAtual);
    }, 5 * 60 * 1000);
  }

  async function registrarPresenca(showError = false) {
    if (!aulaId) return;

    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/presenca`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao registrar presença.");
      }

      setAula((prev) =>
        prev
          ? {
              ...prev,
              totalOnline:
                typeof json?.totalOnline === "number"
                  ? json.totalOnline
                  : prev.totalOnline,
              totalParticipantes:
                typeof json?.totalParticipantes === "number"
                  ? json.totalParticipantes
                  : prev.totalParticipantes,
            }
          : prev
      );
    } catch (e: any) {
      if (showError) {
        console.warn("[LIVE] Falha ao registrar presença:", e?.message || e);
      }
    }
  }

  async function sincronizarReplay(
    mostrarErro = false
  ) {
    if (
      !aulaId ||
      replaySincronizando
    ) {
      return;
    }

    const token = getToken();

    if (!token) {
      return;
    }

    try {
      setReplaySincronizando(true);

      const resposta = await fetch(
        `${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/replay/sincronizar`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const json =
        await resposta
          .json()
          .catch(() => ({}));

      /*
      * 202 significa que a AWS ainda está
      * processando os arquivos.
      */
      if (resposta.status === 202) {
        setReplayMensagem(
          json?.message ||
            "A gravação ainda está sendo processada."
        );

        setAula((anterior) =>
          anterior
            ? {
                ...anterior,
                ivsRecordingStatus:
                  "PROCESSANDO",
              }
            : anterior
        );

        return;
      }

      if (!resposta.ok) {
        const mensagem =
          json?.message ||
          "Não foi possível sincronizar o replay.";

        setReplayMensagem(
          mensagem
        );

        if (mostrarErro) {
          toast.error(mensagem);
        }

        return;
      }

      const item =
        json?.item ?? null;

      setReplayMensagem(
        "Replay disponível."
      );

      /*
      * O retorno do update contém os campos
      * novos. Faz merge para preservar as
      * relações já carregadas da aula.
      */
      if (item) {
        setAula((anterior) =>
          anterior
            ? {
                ...anterior,
                ...item,
              }
            : item
        );
      } else {
        await carregarAula(false);
      }
    } catch (error: any) {
      const mensagem =
        error?.message ||
        "Erro ao verificar o replay.";

      setReplayMensagem(
        mensagem
      );

      if (mostrarErro) {
        toast.error(mensagem);
      }
    } finally {
      setReplaySincronizando(false);
    }
  }
  
  async function carregarAula(showLoading = true) {
    try {
      if (showLoading) setLoadingAula(true);
      setPageError(null);

      const token = getToken();

      const res = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao carregar aula ao vivo.");
      }

      const item = json?.item || json?.aula || json;

      const acessoRes = await fetch(
        `${API.BASE_URL}/api/learning/eventos/aulas/${aulaId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const acessoJson = await acessoRes.json().catch(() => ({}));
      const acessoItem = acessoJson?.item || acessoJson?.evento || acessoJson;

      if (
        acessoRes.ok &&
        acessoItem?.acesso &&
        !acessoItem.acesso.temAcesso &&
        !acessoItem.acesso.isOwner &&
        !acessoItem.acesso.isConvidadoFootEra
      ) {
        const texto = String(item?.titulo || item?.descricao || "").toLowerCase();
        const isCopa = texto.includes("copa");

        if (isCopa) {
          navigate(`/learning/evento/sala-copa?aulaId=${encodeURIComponent(aulaId)}`);
        } else {
          navigate(`/learning/evento/${encodeURIComponent(aulaId)}`);
        }

        return;
      }
      setAula(item);
      programarConclusaoAulaAoVivo(item);
    } catch (e: any) {
      setPageError(e?.message || "Erro ao carregar aula ao vivo.");
    } finally {
      if (showLoading) setLoadingAula(false);
    }
  }

  async function carregarMensagens(showError = false) {
    if (!aulaId) return;

    try {
      const token = getToken();

      const res = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/mensagens`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao carregar chat.");
      }

      const lista = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.mensagens)
          ? json.mensagens
          : Array.isArray(json)
            ? json
            : [];

      setMessages(lista);
    } catch (e: any) {
      if (showError) {
        toast.error(e?.message || "Falha ao carregar chat.");
      }
    }
  }

  async function enviarMensagem() {
    const texto = chatInput.trim();
    if (!texto || sendingMessage || !aulaId) return;

    try {
      setSendingMessage(true);

      const token = getToken();

      const res = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/mensagens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mensagem: texto,
          tipo: "TEXTO",
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao enviar mensagem.");
      }

      setChatInput("");
      await carregarMensagens(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar mensagem.");
    } finally {
      setSendingMessage(false);
    }
  }

  function voltarParaOrigem() {
    const metodologiaAvulsaId =
      aula?.metodologiaAvulsa?.id || aula?.metodologiaAvulsaId || "";

    const metodologiaId =
      aula?.metodologia?.id || aula?.metodologiaId || "";

    if (metodologiaAvulsaId) {
      navigate(`/learning/${metodologiaAvulsaId}?origem=avulsa`);
      return;
    }

    if (metodologiaId) {
      navigate(`/learning/${metodologiaId}`);
      return;
    }

    navigate("/learning");
  }

  function renderPlayerContent() {
    if (isCanceled) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center px-6">
            <AlertCircle className="w-14 h-14 mx-auto mb-4 text-slate-300" />
            <div className="text-2xl font-black">Live cancelada</div>
            <p className="text-white/70 mt-2">
              Esta aula ao vivo foi cancelada pelo responsável.
            </p>
          </div>
        </div>
      );
    }

    if (isScheduled) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white overflow-hidden">
          <CoverImage
            src={capaUrl}
            alt={aula?.titulo || "Capa da aula"}
            pasta="metodologias"
            className="absolute inset-0 h-full w-full opacity-25"
          />

          <div className="relative w-full max-w-[92%] sm:max-w-xl text-center px-3 sm:px-6 py-3">
            <CalendarClock className="w-8 h-8 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4 text-amber-300" />

            <div className="text-lg sm:text-3xl font-black leading-tight">
              Aula agendada
            </div>

            <p className="text-white/80 mt-1 sm:mt-3 text-xs sm:text-base">
              A transmissão começará em:
            </p>

            <div className="mt-2 sm:mt-3 rounded-xl sm:rounded-2xl border border-white/20 bg-white/10 px-3 sm:px-5 py-2 sm:py-4 text-sm sm:text-xl font-black leading-tight break-words">
              {formatarDataHora(aula?.dataInicio)}
            </div>

            <p className="text-amber-200 font-bold mt-2 sm:mt-4 text-xs sm:text-base leading-tight">
              {tempoAteLive(aula?.dataInicio)}
            </p>
          </div>
        </div>
      );
    }

    if (
      isFinished &&
      !streamAtual
    ) {
      const gravacaoNaoConfigurada =
        aula?.ivsRecordingStatus ===
        "NAO_CONFIGURADA";

      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="max-w-lg px-6 text-center">
            {replaySincronizando ? (
              <Loader2 className="mx-auto mb-4 h-14 w-14 animate-spin text-emerald-300" />
            ) : (
              <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-300" />
            )}

            <div className="text-2xl font-black">
              Live finalizada
            </div>

            <p className="mt-2 text-white/70">
              {gravacaoNaoConfigurada
                ? "Esta live não foi gravada pela AWS IVS, portanto não existe replay automático."
                : replayMensagem ||
                  "A gravação está sendo processada. Esta página verificará automaticamente quando o replay estiver pronto."}
            </p>

            {!gravacaoNaoConfigurada && (
              <button
                type="button"
                disabled={
                  replaySincronizando
                }
                onClick={() =>
                  void sincronizarReplay(
                    true
                  )
                }
                className="mt-5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-60"
              >
                {replaySincronizando
                  ? "Verificando..."
                  : "Verificar replay agora"}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (!streamAtual) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center px-6">
            <Video className="w-14 h-14 mx-auto mb-4 text-slate-300" />
            <div className="text-2xl font-black">Sem transmissão disponível</div>
            <p className="text-white/70 mt-2">
              Aguarde a live ser iniciada pelo responsável.
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          playsInline
          poster={aula?.thumbUrl || capaUrl || undefined}
          className="absolute inset-0 h-full w-full bg-black !object-cover"
          style={{
            objectFit: "cover",
            objectPosition: "center",
          }}
        />

        {playerLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
            <div className="rounded-2xl bg-black/50 px-5 py-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando transmissão...
            </div>
          </div>
        ) : null}

        {playerError ? (
          <div className="absolute inset-x-4 top-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold">Erro no player</div>
              <div className="text-sm">{playerError}</div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (!aulaId) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] p-5">
        <div className="max-w-4xl mx-auto rounded-2xl bg-white border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-900">
            Aula ao vivo não encontrada
          </h1>

          <p className="text-slate-600 mt-2">
            Abra essa página usando uma URL com <strong>?aulaId=ID_DA_AULA</strong>.
          </p>

          <button
            type="button"
            onClick={() => navigate("/learning")}
            className="mt-5 h-11 px-4 rounded-xl bg-green-900 text-white font-semibold"
          >
            Voltar para Learning
          </button>
        </div>
      </div>
    );
  }

  if (loadingAula) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] flex items-center justify-center">
        <div className="rounded-2xl bg-white border border-slate-200 px-6 py-5 shadow-sm flex items-center gap-3 text-slate-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando aula ao vivo...
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] p-5">
        <div className="max-w-4xl mx-auto rounded-2xl bg-white border border-red-200 p-6">
          <div className="flex items-start gap-3 text-red-700">
            <AlertCircle className="w-6 h-6 mt-0.5" />
            <div>
              <h1 className="text-xl font-bold">Erro ao abrir live</h1>
              <p className="mt-1 text-sm">{pageError}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/learning")}
            className="mt-5 h-11 px-4 rounded-xl bg-green-900 text-white font-semibold"
          >
            Voltar para Learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-10">
      <div className="bg-[#073b25] text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={voltarParaOrigem}
              className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/70">
                FootEra Learning
              </div>
              <div className="text-lg font-extrabold leading-tight">
                Aula ao vivo
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {liveBadge ? (
              <span className={`rounded-full border px-3 py-1 text-sm font-bold ${liveBadge.className}`}>
                {liveBadge.label}
              </span>
            ) : null}

            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold inline-flex items-center gap-2">
              <Users className="w-4 h-4" />
              {aula?.totalOnline ?? 0} online
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
          <section className="space-y-5">
            <div className="rounded-[22px] sm:rounded-[26px] bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex flex-col md:flex-row md:items-start gap-4 mb-5">
                <div className="h-20 w-20 rounded-2xl bg-[#0b4a2f] text-white flex items-center justify-center shrink-0 overflow-hidden">
                  <Avatar
                    foto={criadorFoto}
                    alt={criadorNome}
                    className="h-full w-full rounded-2xl"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#216c43] font-bold mb-1">
                    {metodologiaTitulo}
                  </div>

                  <h1 className="text-3xl md:text-4xl font-black text-slate-950 leading-tight">
                    {aula?.titulo || "Aula ao vivo"}
                  </h1>

                  <div className="text-sm text-slate-500 mt-1">
                    Com {criadorNome}
                  </div>

                  {aula?.descricao ? (
                    <p className="text-slate-600 mt-3">{aula.descricao}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 mt-4">
                    {liveBadge ? (
                      <span className={`rounded-xl border px-3 py-2 text-sm font-bold ${liveBadge.className}`}>
                        {liveBadge.label}
                      </span>
                    ) : null}

                    {isLive ? (
                      <span className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 inline-flex items-center gap-2">
                        <Radio className="w-4 h-4" />
                        Transmissão em andamento
                      </span>
                    ) : null}

                    {isFinished && aula?.replayDisponivel ? (
                      <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 inline-flex items-center gap-2">
                        <PlayCircle className="w-4 h-4" />
                        Assistir replay
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl sm:rounded-[24px] bg-black border border-slate-900 aspect-video">
                {renderPlayerContent()}

                <div className="absolute right-2 top-2 sm:right-4 sm:top-4 flex items-center gap-1.5 sm:gap-2 z-20">
                  {isLive ? (
                    <span className="rounded-md sm:rounded-lg bg-red-600 px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-xs font-black text-white shadow">
                      LIVE
                    </span>
                  ) : isFinished ? (
                    <span className="rounded-md sm:rounded-lg bg-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-xs font-black text-white shadow">
                      REPLAY
                    </span>
                  ) : (
                    <span className="rounded-md sm:rounded-lg bg-white/15 px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-xs font-black text-white shadow">
                      AGENDADA
                    </span>
                  )}

                  <span className="rounded-md sm:rounded-lg bg-black/55 px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-xs font-bold text-white inline-flex items-center gap-1 sm:gap-1.5 shadow">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                    {aula?.totalOnline ?? 0}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
                {isLive ? (
                  <Radio className="w-6 h-6 text-red-600 mt-0.5 shrink-0" />
                ) : isScheduled ? (
                  <Clock className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-[#216c43] mt-0.5 shrink-0" />
                )}

                <div>
                  <div className="font-bold text-[#193b2e]">
                    {isLive
                      ? "A aula está ao vivo agora."
                      : isScheduled
                        ? "A aula ainda não começou."
                        : isFinished
                          ? "A aula foi finalizada."
                          : "Status da aula"}
                  </div>

                  <div className="text-sm text-slate-600 mt-1">
                    {isLive
                      ? "Acompanhe a transmissão e envie suas perguntas pelo chat."
                      : isScheduled
                        ? `Início previsto: ${formatarDataHora(aula?.dataInicio)}.`
                        : isFinished && aula?.replayDisponivel
                          ? "O replay já está disponível para assistir novamente."
                          : isFinished
                            ? aula?.ivsRecordingStatus ===
                              "NAO_CONFIGURADA"
                              ? "Esta transmissão não possui gravação configurada."
                              : replayMensagem ||
                                "A gravação está sendo processada automaticamente."
                            : "Acompanhe as informações dessa aula ao vivo."}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[24px] bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-black text-[#193b2e]">Resumo da aula</div>
                  <div className="text-sm text-slate-500">Informações da transmissão</div>
                </div>

                <Radio className={isLive ? "w-5 h-5 text-red-600" : "w-5 h-5 text-slate-400"} />
              </div>

              <div className="p-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Status</span>
                  <span className="font-bold text-slate-800">{aula?.status || "-"}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Início previsto</span>
                  <span className="font-bold text-slate-800 text-right">
                    {formatarDataHora(aula?.dataInicio)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Término previsto</span>
                  <span className="font-bold text-slate-800 text-right">
                    {aula?.dataFim ? formatarDataHora(aula.dataFim) : "Não definido"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Participantes</span>
                  <span className="font-bold text-slate-800">
                    {aula?.totalParticipantes ?? 0}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Chat</span>
                  <span className="font-bold text-slate-800">
                    {aula?.chatAtivo ? "Ativo" : "Desativado"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Replay</span>
                  <span className="font-bold text-slate-800">
                    {aula?.replayDisponivel ? "Disponível" : "Ainda não disponível"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="font-black text-[#193b2e] flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Chat / Perguntas
                </div>

                <div className="text-sm text-slate-500">
                  {messages.length} mensagens
                </div>
              </div>

              <div className="h-[430px] overflow-y-auto p-5 space-y-4">
                {messages.length ? (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3">
                      <Avatar
                        foto={msg.usuario?.foto}
                        alt={msg.usuario?.nome || "Usuário"}
                        className="h-9 w-9"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-sm text-slate-800 truncate">
                            {msg.usuario?.nome || "Usuário"}
                          </div>
                          <div className="text-xs text-slate-400 shrink-0">
                            {formatarHora(msg.criadoEm)}
                          </div>
                        </div>

                        <div
                          className={`mt-1 text-sm leading-relaxed ${
                            msg.tipo === "ALERTA"
                              ? "text-amber-700"
                              : msg.tipo === "SISTEMA"
                                ? "text-slate-500 italic"
                                : "text-slate-700"
                          }`}
                        >
                          {msg.mensagem}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-slate-500">
                    <div>
                      <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      Nenhuma mensagem ainda.
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") enviarMensagem();
                    }}
                    disabled={!aula?.chatAtivo}
                    placeholder={aula?.chatAtivo ? "Escreva sua pergunta..." : "Chat desativado"}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none disabled:bg-slate-100"
                  />

                  <button
                    type="button"
                    onClick={enviarMensagem}
                    disabled={sendingMessage || !aula?.chatAtivo || !chatInput.trim()}
                    className="h-12 w-12 rounded-xl bg-[#216c43] text-white flex items-center justify-center disabled:bg-slate-300"
                  >
                    {sendingMessage ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}