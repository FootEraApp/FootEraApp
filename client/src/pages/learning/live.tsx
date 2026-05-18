// client/src/pages/learning/live.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  totalMensagens?: number;
  totalParticipantes?: number;

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

  const [aulaId] = useState(() => getAulaIdFromUrl());
  const [aula, setAula] = useState<AulaAoVivoDetalhe | null>(null);
  const [loadingAula, setLoadingAula] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

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

  const streamAtual = useMemo(() => {
    if (isLive) return aula?.urlStream || "";
    if (isFinished && aula?.replayDisponivel) {
      return aula?.videoGravadoUrl || aula?.urlStream || "";
    }
    return "";
  }, [aula, isLive, isFinished]);

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

    return () => window.clearInterval(interval);
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

      console.log("[IVS PLAYER] Preparando player com URL:", streamAtual);

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
}, [streamAtual]);

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
      setAula(item);
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
        alert(e?.message || "Falha ao carregar chat.");
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
      alert(e?.message || "Falha ao enviar mensagem.");
    } finally {
      setSendingMessage(false);
    }
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
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          {capaUrl ? (
            <img
              src={capaUrl}
              alt={aula?.titulo || "Capa da aula"}
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          ) : null}

          <div className="relative text-center px-6 max-w-xl">
            <CalendarClock className="w-16 h-16 mx-auto mb-4 text-amber-300" />

            <div className="text-3xl font-black">Aula agendada</div>

            <p className="text-white/80 mt-3">
              A transmissão começará em:
            </p>

            <div className="mt-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-xl font-black">
              {formatarDataHora(aula?.dataInicio)}
            </div>

            <p className="text-amber-200 font-bold mt-4">
              {tempoAteLive(aula?.dataInicio)}
            </p>
          </div>
        </div>
      );
    }

    if (isFinished && !streamAtual) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center px-6">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-emerald-300" />
            <div className="text-2xl font-black">Live finalizada</div>
            <p className="text-white/70 mt-2">
              O replay ainda não está disponível.
            </p>
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
          // Adicione o "!" aqui -> !object-cover
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
              onClick={() => navigate("/learning")}
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
              {aula?.totalParticipantes ?? 0} online
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
          <section className="space-y-5">
            <div className="rounded-[26px] bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex flex-col md:flex-row md:items-start gap-4 mb-5">
                <div className="h-20 w-20 rounded-2xl bg-[#0b4a2f] text-white flex items-center justify-center shrink-0 overflow-hidden">
                  {criadorFoto ? (
                    <img
                      src={criadorFoto}
                      alt={criadorNome}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <Radio className="w-9 h-9" />
                  )}
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

              <div className="relative overflow-hidden rounded-[24px] bg-black border border-slate-900 aspect-video">
                {renderPlayerContent()}

                <div className="absolute left-4 bottom-4 flex items-center gap-2">
                  {isLive ? (
                    <span className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white">
                      LIVE
                    </span>
                  ) : isFinished ? (
                    <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-black text-white">
                      REPLAY
                    </span>
                  ) : (
                    <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-black text-white">
                      AGENDADA
                    </span>
                  )}

                  <span className="rounded-lg bg-black/55 px-3 py-1.5 text-xs font-bold text-white inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {aula?.totalParticipantes ?? 0}
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
                            ? "O replay ainda será disponibilizado pelo responsável."
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
                      {msg.usuario?.foto ? (
                        <img
                          src={msg.usuario.foto}
                          alt={msg.usuario.nome || "Usuário"}
                          className="h-9 w-9 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-[#216c43] text-white flex items-center justify-center text-xs font-black">
                          {getInitials(msg.usuario?.nome)}
                        </div>
                      )}

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