// client/src/pages/learning/live-studio.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  Send,
  Square,
  Video,
  MoreHorizontal,
  Users,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
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
  streamKey?: string | null;
  provedorStream?: string | null;
  videoGravadoUrl?: string | null;
  thumbUrl?: string | null;
  chatAtivo: boolean;
  gravacaoAtiva: boolean;
  replayDisponivel: boolean;
  totalMensagens?: number;
  totalParticipantes?: number;
  totalOnline?: number;
  metodologia?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
  } | null;
  metodologiaAvulsa?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
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

type BroadcastConfig = {
  ingestEndpoint: string;
  streamKey: string;
  playbackUrl?: string | null;
};

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
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

function getAulaIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("aulaId") || params.get("id") || "";
}

function normalizarIvsIngestEndpoint(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/^rtmps?:\/\//i, "")
    .replace(/:443\/app\/?$/i, "")
    .replace(/\/app\/?$/i, "")
    .replace(/\/$/i, "")
    .trim();
}

const VIDEO_FULL_HD = {
  index: 0,
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
};

const CAMERA_PIP_POSITION = {
  index: 1,
  x: 930,
  y: 36,
  width: 300,
  height: 169,
};

function getCoverVideoPosition(track?: MediaStreamTrack) {
  const settings = track?.getSettings?.();

  const sourceWidth = Number(settings?.width || 1280);
  const sourceHeight = Number(settings?.height || 720);

  const canvasWidth = 1280;
  const canvasHeight = 720;

  const sourceRatio = sourceWidth / sourceHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let width = canvasWidth;
  let height = canvasHeight;
  let x = 0;
  let y = 0;

  if (sourceRatio > canvasRatio) {
    height = canvasHeight;
    width = Math.round(canvasHeight * sourceRatio);
    x = Math.round((canvasWidth - width) / 2);
  } else {
    width = canvasWidth;
    height = Math.round(canvasWidth / sourceRatio);
    y = Math.round((canvasHeight - height) / 2);
  }

  return {
    index: 0,
    x,
    y,
    width,
    height,
  };
}

export default function LearningLiveStudioPage() {
  const [, navigate] = useLocation();

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const placeholderStreamRef = useRef<MediaStream | null>(null);
  const screenCanvasStreamRef = useRef<MediaStream | null>(null);

  const programCanvasStreamRef = useRef<MediaStream | null>(null);
  const programAnimationFrameRef = useRef<number | null>(null);

  const micTestStreamRef = useRef<MediaStream | null>(null);
  const micTestAudioContextRef = useRef<AudioContext | null>(null);
  const micTestAnimationFrameRef = useRef<number | null>(null);

  const micTestSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micTestGainRef = useRef<GainNode | null>(null);

  const liveMicAudioContextRef = useRef<AudioContext | null>(null);
  const liveMicSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const liveMicGainRef = useRef<GainNode | null>(null);
  const liveMicDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const liveMicProcessedStreamRef = useRef<MediaStream | null>(null);

  const [aulaId] = useState(() => getAulaIdFromUrl());
  const [aula, setAula] = useState<AulaAoVivoDetalhe | null>(null);
  const [loadingAula, setLoadingAula] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(false);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const [usandoPlaceholderCamera, setUsandoPlaceholderCamera] = useState(false);  

  const [broadcastClient, setBroadcastClient] = useState<any>(null);
  const [broadcastConfig, setBroadcastConfig] = useState<BroadcastConfig>({
    ingestEndpoint: "",
    streamKey: "",
    playbackUrl: "",
  });

  const [manualConfigOpen, setManualConfigOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const [switchingDevice, setSwitchingDevice] = useState(false);

  const [micTestOpen, setMicTestOpen] = useState(false);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [micTestSelectedId, setMicTestSelectedId] = useState("");
  const [micTestError, setMicTestError] = useState<string | null>(null);
  const [micTestStarting, setMicTestStarting] = useState(false);

  const [micTestListening, setMicTestListening] = useState(false);

  const [micInputVolume, setMicInputVolume] = useState(70);
  const [micMonitorVolume, setMicMonitorVolume] = useState(45);

  const isLive = aula?.status === "AO_VIVO";
  const isFinished = aula?.status === "FINALIZADA";

const userAgent = navigator.userAgent.toLowerCase();

const isOpera =
  userAgent.includes("opr") ||
  userAgent.includes("opera");

const isChrome =
  userAgent.includes("chrome") &&
  !userAgent.includes("opr") &&
  !userAgent.includes("opera");

const isEdge = userAgent.includes("edg");

const navegadorPossivelmenteIncompativel = isOpera || (!isChrome && !isEdge);

  const metodologiaTitulo =
    aula?.metodologia?.titulo ||
    aula?.metodologiaAvulsa?.titulo ||
    "FootEra Learning";

  const viewerCount = aula?.totalOnline ?? 0;

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
        label: "Live finalizada",
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
    if (liveMicGainRef.current) {
      liveMicGainRef.current.gain.value = micInputVolume / 100;
    }
  }, [micInputVolume]);

  useEffect(() => {
    if (micTestGainRef.current && micTestListening) {
      micTestGainRef.current.gain.value = micMonitorVolume / 100;
    }
  }, [micMonitorVolume, micTestListening]);

  useEffect(() => {
    inicializarDispositivos();

    return () => {
      pararStream(cameraStreamRef.current);
      pararStream(micStreamRef.current);
      pararStream(screenStreamRef.current);
      pararStream(placeholderStreamRef.current);
      pararStream(screenCanvasStreamRef.current);
      pararProgramCanvasStream();
      pararAudioLiveProcessado();
      fecharTesteMicrofone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previewRef.current && cameraStream) {
      previewRef.current.srcObject = cameraStream;
      previewRef.current.play().catch(() => null);
    }
  }, [cameraStream]);

  useEffect(() => {
    if (screenPreviewRef.current && screenStream) {
      screenPreviewRef.current.srcObject = screenStream;
      screenPreviewRef.current.play().catch(() => null);
    }
  }, [screenStream]);

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
        console.warn("[LIVE STUDIO] Falha ao registrar presença:", e?.message || e);
      }
    }
  }

  async function carregarAula(showLoading = true) {
    try {
      if (showLoading) setLoadingAula(true);

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

      setBroadcastConfig((prev) => ({
        ingestEndpoint:
          prev.ingestEndpoint ||
          item?.ingestEndpoint ||
          item?.ivsIngestEndpoint ||
          "",
        streamKey: prev.streamKey || item?.streamKey || "",
        playbackUrl: prev.playbackUrl || item?.urlStream || "",
      }));
    } catch (e: any) {
      setBroadcastError(e?.message || "Erro ao carregar aula.");
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

function criarPlaceholderVideoStream(texto = "Sem câmera") {
  pararStream(placeholderStreamRef.current);

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_FULL_HD.width;
  canvas.height = VIDEO_FULL_HD.height;

  const ctx = canvas.getContext("2d");

  function desenhar() {
    if (!ctx) return;

    ctx.fillStyle = "#0b4a2f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#f5f2e8";
    ctx.font = "bold 54px Arial";
    ctx.textAlign = "center";
    ctx.fillText("FootEra Learning", canvas.width / 2, canvas.height / 2 - 35);

    ctx.font = "32px Arial";
    ctx.fillText(texto, canvas.width / 2, canvas.height / 2 + 25);

    ctx.font = "22px Arial";
    ctx.fillText("Transmissão sem câmera ativa", canvas.width / 2, canvas.height / 2 + 70);
  }

  desenhar();

  const interval = window.setInterval(desenhar, 1000);

  const stream = canvas.captureStream(30);

  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    window.clearInterval(interval);
  });

  placeholderStreamRef.current = stream;

  return stream;
}

function pararProgramCanvasStream() {
  if (programAnimationFrameRef.current) {
    cancelAnimationFrame(programAnimationFrameRef.current);
    programAnimationFrameRef.current = null;
  }

  pararStream(programCanvasStreamRef.current);
  programCanvasStreamRef.current = null;
}

function criarVideoFonte(stream: MediaStream) {
  const video = document.createElement("video");

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  video.play().catch(() => null);

  return video;
}

function desenharCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const videoWidth = video.videoWidth || 1280;
  const videoHeight = video.videoHeight || 720;

  const scale = Math.max(width / videoWidth, height / videoHeight);

  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;

  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;

  ctx.drawImage(video, dx, dy, drawWidth, drawHeight);
}

function desenharRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function criarProgramaIvsStream(
  telaStream?: MediaStream | null,
  cameraRealStream?: MediaStream | null
) {
  pararProgramCanvasStream();

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_FULL_HD.width;
  canvas.height = VIDEO_FULL_HD.height;

  const ctx = canvas.getContext("2d");

  const telaVideo =
    telaStream?.getVideoTracks().length ? criarVideoFonte(telaStream) : null;

  const cameraVideo =
    cameraRealStream?.getVideoTracks().length ? criarVideoFonte(cameraRealStream) : null;

  function desenhar() {
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (telaVideo) {
      // Tela compartilhada vira o foco principal e cobre tudo.
      desenharCover(ctx, telaVideo, 0, 0, canvas.width, canvas.height);
    } else if (cameraVideo) {
      desenharCover(ctx, cameraVideo, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#0b4a2f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#f5f2e8";
      ctx.textAlign = "center";
      ctx.font = "bold 72px Arial";
      ctx.fillText("FootEra Learning", canvas.width / 2, canvas.height / 2 - 45);

      ctx.font = "40px Arial";
      ctx.fillText("Transmissão sem câmera ativa", canvas.width / 2, canvas.height / 2 + 25);
    }

    // Câmera só aparece no canto se for câmera real.
    // Placeholder NÃO entra aqui.
    if (telaVideo && cameraVideo) {
      const pipW = 420;
      const pipH = 236;
      const pipX = canvas.width - pipW - 54;
      const pipY = 54;
      const radius = 18;

      ctx.save();

      desenharRoundedRect(ctx, pipX, pipY, pipW, pipH, radius);
      ctx.clip();

      ctx.fillStyle = "#000";
      ctx.fillRect(pipX, pipY, pipW, pipH);

      desenharCover(ctx, cameraVideo, pipX, pipY, pipW, pipH);

      ctx.restore();

      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      desenharRoundedRect(ctx, pipX, pipY, pipW, pipH, radius);
      ctx.stroke();
    }

    programAnimationFrameRef.current = requestAnimationFrame(desenhar);
  }

  desenhar();

  const stream = canvas.captureStream(30);
  programCanvasStreamRef.current = stream;

  return stream;
}

async function atualizarProgramaIvs(client = broadcastClient) {
  if (!client) return;

  try {
    try {
      client.removeVideoInputDevice?.("screen");
    } catch {}

    try {
      client.removeVideoInputDevice?.("camera");
    } catch {}

    try {
      client.removeVideoInputDevice?.("program");
    } catch {}

    const telaAtual = screenStreamRef.current;

    const cameraReal =
      cameraEnabled && !usandoPlaceholderCamera
        ? cameraStreamRef.current
        : null;

    const programaStream = criarProgramaIvsStream(telaAtual, cameraReal);

    const dimensao = client.getCanvasDimensions?.() || {
      width: VIDEO_FULL_HD.width,
      height: VIDEO_FULL_HD.height,
    };
    
    await client.addVideoInputDevice(
      programaStream,
      "program",
      {
        index: 0,
        x: 0,
        y: 0,
        width: dimensao.width,
        height: dimensao.height,
      }
    );

    console.log("[IVS] Programa atualizado: tela principal + câmera real opcional.");
  } catch (e) {
    console.error("[IVS] Erro ao atualizar programa:", e);
  }
}

function criarScreenCoverStream(sourceStream: MediaStream) {
  pararStream(screenCanvasStreamRef.current);

  const video = document.createElement("video");
  video.srcObject = sourceStream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_FULL_HD.width;
  canvas.height = VIDEO_FULL_HD.height;

  const ctx = canvas.getContext("2d");

  let animationFrame = 0;

  function desenharCover() {
    if (!ctx) return;

    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const scale = Math.max(
      canvasWidth / videoWidth,
      canvasHeight / videoHeight
    );

    const drawWidth = videoWidth * scale;
    const drawHeight = videoHeight * scale;

    const dx = (canvasWidth - drawWidth) / 2;
    const dy = (canvasHeight - drawHeight) / 2;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.drawImage(video, dx, dy, drawWidth, drawHeight);

    animationFrame = requestAnimationFrame(desenharCover);
  }

  video.onloadedmetadata = async () => {
    await video.play().catch(() => null);
    desenharCover();
  };

  sourceStream.getVideoTracks()[0]?.addEventListener("ended", () => {
    cancelAnimationFrame(animationFrame);
  });

  const canvasStream = canvas.captureStream(30);
  screenCanvasStreamRef.current = canvasStream;

  return canvasStream;
}

async function inicializarDispositivos() {
  try {
    setBroadcastError(null);

    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
      throw new Error(
        "Seu navegador não suporta acesso à câmera/microfone. Use Google Chrome ou Microsoft Edge."
      );
    }

    // Pede permissão inicial só para áudio.
    // Não pedimos vídeo aqui porque câmera virtual/OBS pode travar e dar timeout.
    try {
      const permissaoAudio = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });

      permissaoAudio.getTracks().forEach((track) => track.stop());
    } catch (permissionError) {
      console.warn("[LIVE] Permissão inicial de áudio falhou:", permissionError);
    }

    const dispositivos = await navigator.mediaDevices.enumerateDevices();

    const cams = dispositivos.filter((d) => d.kind === "videoinput");
    const mics = dispositivos.filter((d) => d.kind === "audioinput");

    console.log("[LIVE] Dispositivos encontrados:", {
      cameras: cams,
      microphones: mics,
    });

    setCameras(cams);
    setMicrophones(mics);

    const cameraIdInicial = selectedCameraId || cams[0]?.deviceId || "";
    const micIdInicial = selectedMicId || mics[0]?.deviceId || "";

    setSelectedCameraId(cameraIdInicial);
    setSelectedMicId(micIdInicial);

    let abriuCameraReal = false;
    let abriuMicrofone = false;

    // 1. Tenta abrir câmera real, mas se falhar usa placeholder.
    if (cams.length > 0) {
      try {
        const novoVideoStream = await navigator.mediaDevices.getUserMedia({
          video: cameraIdInicial
            ? { deviceId: { exact: cameraIdInicial } }
            : true,
          audio: false,
        });

        novoVideoStream.getVideoTracks().forEach((track) => {
          track.enabled = cameraEnabled;
        });

        pararStream(cameraStreamRef.current);

        setUsandoPlaceholderCamera(false);
        setCameraStream(novoVideoStream);
        cameraStreamRef.current = novoVideoStream;

        if (previewRef.current) {
          previewRef.current.srcObject = novoVideoStream;
          await previewRef.current.play().catch(() => null);
        }

        abriuCameraReal = true;
      } catch (cameraError: any) {
        console.warn("[LIVE] Câmera real falhou. Usando placeholder:", cameraError);

        const placeholder = criarPlaceholderVideoStream("Câmera indisponível");

        setUsandoPlaceholderCamera(true);
        pararStream(cameraStreamRef.current);

        setCameraStream(placeholder);
        cameraStreamRef.current = placeholder;

        if (previewRef.current) {
          previewRef.current.srcObject = placeholder;
          await previewRef.current.play().catch(() => null);
        }

        setCameraEnabled(false);
      }
    } else {
      const placeholder = criarPlaceholderVideoStream("Nenhuma câmera encontrada");

      setUsandoPlaceholderCamera(true);
      pararStream(cameraStreamRef.current);

      setCameraStream(placeholder);
      cameraStreamRef.current = placeholder;

      if (previewRef.current) {
        previewRef.current.srcObject = placeholder;
        await previewRef.current.play().catch(() => null);
      }

      setCameraEnabled(false);
    }

    // 2. Tenta abrir microfone separado.
    if (mics.length > 0) {
      try {
        const novoAudioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: micIdInicial
            ? { deviceId: { exact: micIdInicial } }
            : true,
        });

        novoAudioStream.getAudioTracks().forEach((track) => {
          track.enabled = micEnabled;
        });

        pararStream(micStreamRef.current);

        setMicStream(novoAudioStream);
        micStreamRef.current = novoAudioStream;

        abriuMicrofone = true;
      } catch (micError: any) {
        console.error("[LIVE] Erro ao abrir microfone:", micError);

        setBroadcastError(
          "Não foi possível abrir o microfone selecionado. Verifique se ele não está sendo usado por outro aplicativo."
        );
      }
    }

    if (!abriuCameraReal) {
      console.warn("[LIVE] Live continuará sem câmera real, usando vídeo placeholder.");
    }

    if (mics.length === 0) {
      setBroadcastError(
        "Nenhum microfone foi encontrado. Você ainda pode compartilhar a tela, mas a live ficará sem áudio."
      );
    }

    if (abriuMicrofone) {
      console.log("[LIVE] Microfone ativo.");
    }
  } catch (e: any) {
    console.error("[LIVE] Erro geral ao inicializar dispositivos:", e);

    let mensagem =
      "Não foi possível acessar os dispositivos. Verifique as permissões do navegador.";

    if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
      mensagem =
        "Permissão negada para câmera/microfone. Clique no cadeado do navegador e permita câmera e microfone para este site.";
    }

    if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
      mensagem =
        "Nenhuma câmera ou microfone foi encontrado. Conecte os dispositivos e recarregue a página.";
    }

    if (e?.name === "SecurityError") {
      mensagem =
        "O navegador bloqueou o acesso por segurança. Use localhost, HTTPS, Google Chrome ou Microsoft Edge.";
    }

    setBroadcastError(mensagem);
  }
}

function getMainVideoPosition() {
  if (screenStreamRef.current?.getVideoTracks().length) {
    return {
      index: 1,
      x: 920,
      y: 30,
      width: 320,
      height: 180,
    };
  }

  return {
    index: 0,
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
  };
}

async function trocarCameraDuranteLive(cameraId: string) {
  if (!broadcastClient) return false;

  let novoVideoStream: MediaStream;

  try {
    novoVideoStream = await navigator.mediaDevices.getUserMedia({
      video: cameraId ? { deviceId: { exact: cameraId } } : true,
      audio: false,
    });

    novoVideoStream.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });

    setUsandoPlaceholderCamera(false);
  } catch (e) {
    console.warn("[IVS] Câmera falhou durante a live. Usando placeholder:", e);

    novoVideoStream = criarPlaceholderVideoStream("Câmera indisponível");
    setCameraEnabled(false);
    setUsandoPlaceholderCamera(true);
  }


  pararStream(cameraStreamRef.current);

  setCameraStream(novoVideoStream);
  cameraStreamRef.current = novoVideoStream;

  await atualizarProgramaIvs(broadcastClient);

  if (previewRef.current) {
    previewRef.current.srcObject = novoVideoStream;
    await previewRef.current.play().catch(() => null);
  }

  return true;
}

async function trocarMicrofoneDuranteLive(micId: string) {
  if (!broadcastClient) return false;

  const novoAudioStream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: micId ? { deviceId: { exact: micId } } : true,
  });

  novoAudioStream.getAudioTracks().forEach((track) => {
    track.enabled = micEnabled;
  });

  try {
    broadcastClient.removeAudioInputDevice?.("microphone");
  } catch (e) {
    console.warn("[IVS] Falha ao remover microfone antigo:", e);
  }

  const audioProcessado = criarAudioLiveComVolume(novoAudioStream);

  await broadcastClient.addAudioInputDevice(audioProcessado, "microphone");

  pararStream(micStreamRef.current);

  setMicStream(novoAudioStream);
  micStreamRef.current = novoAudioStream;

  return true;
}

async function trocarDispositivo(
  cameraId = selectedCameraId,
  micId = selectedMicId,
  tipo?: "camera" | "microfone" | "ambos"
) {
  if (switchingDevice) return;

  try {
    setSwitchingDevice(true);
    setBroadcastError(null);

    const liveAtiva = isLive || !!broadcastClient;

    if (liveAtiva && broadcastClient) {
      if (tipo === "camera") {
        await trocarCameraDuranteLive(cameraId);
      } else if (tipo === "microfone") {
        await trocarMicrofoneDuranteLive(micId);
      } else {
        await trocarCameraDuranteLive(cameraId);
        await trocarMicrofoneDuranteLive(micId);
      }

      return;
    }

    if (tipo === "camera" || tipo === "ambos" || !tipo) {
      let novoVideoStream: MediaStream;

      try {
        novoVideoStream = await navigator.mediaDevices.getUserMedia({
          video: cameraId ? { deviceId: { exact: cameraId } } : true,
          audio: false,
        });

        novoVideoStream.getVideoTracks().forEach((track) => {
          track.enabled = cameraEnabled;
        });

        setUsandoPlaceholderCamera(false);
      } catch (cameraError) {
        console.warn("[LIVE] Falha ao trocar câmera. Usando placeholder:", cameraError);

        novoVideoStream = criarPlaceholderVideoStream("Câmera indisponível");
        setCameraEnabled(false);
        setUsandoPlaceholderCamera(true);
      }

      pararStream(cameraStreamRef.current);

      setCameraStream(novoVideoStream);
      cameraStreamRef.current = novoVideoStream;

      if (previewRef.current) {
        previewRef.current.srcObject = novoVideoStream;
        await previewRef.current.play().catch(() => null);
      }
    }

    if (tipo === "microfone" || tipo === "ambos" || !tipo) {
      try {
        const novoAudioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: micId ? { deviceId: { exact: micId } } : true,
        });

        novoAudioStream.getAudioTracks().forEach((track) => {
          track.enabled = micEnabled;
        });

        pararStream(micStreamRef.current);

        setMicStream(novoAudioStream);
        micStreamRef.current = novoAudioStream;
      } catch (micError: any) {
        console.error("[LIVE] Falha ao trocar microfone:", micError);

        setBroadcastError(
          "Falha ao trocar microfone. Verifique se ele não está sendo usado por outro aplicativo."
        );
      }
    }
  } finally {
    setSwitchingDevice(false);
  }
}

  function pararStream(stream: MediaStream | null) {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  }

async function pararBroadcastSeguro(client: any) {
  if (!client?.stopBroadcast) return;

  try {
    const result = client.stopBroadcast();

    if (result && typeof result.then === "function") {
      await result;
    }
  } catch (e) {
    console.warn("[IVS] Erro ignorado ao parar broadcast:", e);
  }
}

function pararAudioLiveProcessado() {
  pararStream(liveMicProcessedStreamRef.current);
  liveMicProcessedStreamRef.current = null;

  if (liveMicGainRef.current) {
    try {
      liveMicGainRef.current.disconnect();
    } catch {}
    liveMicGainRef.current = null;
  }

  if (liveMicSourceRef.current) {
    try {
      liveMicSourceRef.current.disconnect();
    } catch {}
    liveMicSourceRef.current = null;
  }

  if (liveMicAudioContextRef.current) {
    liveMicAudioContextRef.current.close().catch(() => null);
    liveMicAudioContextRef.current = null;
  }

  liveMicDestinationRef.current = null;
}

function criarAudioLiveComVolume(stream: MediaStream) {
  pararAudioLiveProcessado();

  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextClass) {
    return stream;
  }

  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);
  const gain = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();

  gain.gain.value = micInputVolume / 100;

  source.connect(gain);
  gain.connect(destination);

  liveMicAudioContextRef.current = audioContext;
  liveMicSourceRef.current = source;
  liveMicGainRef.current = gain;
  liveMicDestinationRef.current = destination;
  liveMicProcessedStreamRef.current = destination.stream;

  return destination.stream;
}

  function pararMonitoramentoMicrofone() {
    if (micTestAnimationFrameRef.current) {
      cancelAnimationFrame(micTestAnimationFrameRef.current);
      micTestAnimationFrameRef.current = null;
    }

    if (micTestGainRef.current) {
      try {
        micTestGainRef.current.disconnect();
      } catch {}
      micTestGainRef.current = null;
    }

    if (micTestSourceRef.current) {
      try {
        micTestSourceRef.current.disconnect();
      } catch {}
      micTestSourceRef.current = null;
    }

    if (micTestAudioContextRef.current) {
      micTestAudioContextRef.current.close().catch(() => null);
      micTestAudioContextRef.current = null;
    }

    pararStream(micTestStreamRef.current);
    micTestStreamRef.current = null;

    setMicTestListening(false);
    setMicTestLevel(0);
  }

async function iniciarMonitoramentoMicrofone(micId?: string) {
  try {
    setMicTestStarting(true);
    setMicTestError(null);

    pararMonitoramentoMicrofone();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Seu navegador não permite testar microfone nesta página.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: micId
        ? {
            deviceId: { exact: micId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
    });

    micTestStreamRef.current = stream;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Seu navegador não suporta monitoramento de áudio.");
    }

    const audioContext = new AudioContextClass();
    micTestAudioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const gain = audioContext.createGain();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;

    // Começa mutado para não dar retorno automaticamente.
    gain.gain.value = 0;

    source.connect(analyser);
    source.connect(gain);
    gain.connect(audioContext.destination);

    micTestSourceRef.current = source;
    micTestGainRef.current = gain;
    setMicTestListening(false);

    const dataArray = new Uint8Array(analyser.fftSize);

    function atualizarVolume() {
      analyser.getByteTimeDomainData(dataArray);

      let soma = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const valor = (dataArray[i] - 128) / 128;
        soma += valor * valor;
      }

      const rms = Math.sqrt(soma / dataArray.length);

      const volume = Math.min(100, Math.round(rms * 320));

      setMicTestLevel(volume);

      micTestAnimationFrameRef.current = requestAnimationFrame(atualizarVolume);
    }

    atualizarVolume();
  } catch (e: any) {
    console.error("[MIC TEST] Erro ao testar microfone:", e);

    let mensagem = "Não foi possível testar o microfone selecionado.";

    if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
      mensagem =
        "Permissão negada para o microfone. Clique no cadeado do navegador e permita o uso do microfone.";
    }

    if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
      mensagem =
        "Nenhum microfone foi encontrado. Conecte um microfone e tente novamente.";
    }

    if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
      mensagem =
        "O microfone está sendo usado por outro aplicativo. Feche Discord, OBS, Teams ou outro app e tente novamente.";
    }

    setMicTestError(mensagem);
    setMicTestLevel(0);
  } finally {
    setMicTestStarting(false);
  }
}

async function abrirTesteMicrofone() {
  const idInicial = selectedMicId || microphones[0]?.deviceId || "";

  setMicTestSelectedId(idInicial);
  setMicTestOpen(true);

  await iniciarMonitoramentoMicrofone(idInicial);
}

function fecharTesteMicrofone() {
  pararMonitoramentoMicrofone();
  setMicTestOpen(false);
  setMicTestError(null);
}

async function trocarMicrofoneDoTeste(micId: string) {
  setMicTestSelectedId(micId);
  setMicTestListening(false);
  await iniciarMonitoramentoMicrofone(micId);
}

async function toggleEscutarMicrofoneTeste() {
  try {
    if (!micTestAudioContextRef.current || !micTestGainRef.current) {
      await iniciarMonitoramentoMicrofone(micTestSelectedId);
    }

    if (micTestAudioContextRef.current?.state === "suspended") {
      await micTestAudioContextRef.current.resume();
    }

    const next = !micTestListening;

    if (micTestGainRef.current) {
      // Volume baixo para evitar microfonia. Use fone de ouvido.
      micTestGainRef.current.gain.value = next ? micMonitorVolume / 100 : 0;
    }

    setMicTestListening(next);
  } catch (e) {
    console.error("[MIC TEST] Erro ao alternar escuta do microfone:", e);
    setMicTestError("Não foi possível reproduzir o áudio do microfone.");
  }
}

async function aplicarMicrofoneTestado() {
  if (!micTestSelectedId) return;

  setSelectedMicId(micTestSelectedId);

  await trocarDispositivo(selectedCameraId, micTestSelectedId, "microfone");

  fecharTesteMicrofone();
}

async function toggleCamera() {
  const next = !cameraEnabled;

  if (!next) {
    cameraStream?.getVideoTracks().forEach((track) => {
      track.enabled = false;
    });

    setCameraEnabled(false);
    return;
  }

  try {
    const novoVideoStream = await navigator.mediaDevices.getUserMedia({
      video: selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : true,
      audio: false,
    });

    novoVideoStream.getVideoTracks().forEach((track) => {
      track.enabled = true;
    });

    pararStream(cameraStreamRef.current);

    setUsandoPlaceholderCamera(false);
    setCameraStream(novoVideoStream);
    cameraStreamRef.current = novoVideoStream;
    setCameraEnabled(true);

    if (previewRef.current) {
      previewRef.current.srcObject = novoVideoStream;
      await previewRef.current.play().catch(() => null);
    }

    if (broadcastClient) {
      await atualizarProgramaIvs(broadcastClient);
    }
  } catch (e) {
    console.warn("[LIVE] Não foi possível ligar câmera real. Mantendo placeholder:", e);

    const placeholder = criarPlaceholderVideoStream("Câmera indisponível");

    setUsandoPlaceholderCamera(true);
    pararStream(cameraStreamRef.current);

    setCameraStream(placeholder);
    cameraStreamRef.current = placeholder;

    if (broadcastClient) {
      await atualizarProgramaIvs(broadcastClient);
    }

    setCameraEnabled(false);

    if (previewRef.current) {
      previewRef.current.srcObject = placeholder;
      await previewRef.current.play().catch(() => null);
    }
  }
}

  function toggleMic() {
    if (!micStream) return;

    const next = !micEnabled;

    micStream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });

    setMicEnabled(next);

    if (next) {
      fecharTesteMicrofone();
    }
  }

  async function toggleScreenShare() {
    if (screenEnabled) {
      pararStream(screenCanvasStreamRef.current);
      screenCanvasStreamRef.current = null;

      pararStream(screenStreamRef.current);
      setScreenStream(null);
      screenStreamRef.current = null;
      setScreenEnabled(false);

      if (broadcastClient) {
        try {
          await atualizarProgramaIvs(broadcastClient);
          console.log("[IVS] Tela removida; programa atualizado.");
        } catch (e: any) {
          console.error("[IVS] Falha ao atualizar programa após remover tela:", e);
        }
      }

      return;
    }
  
    if (broadcastClient) {
      await atualizarProgramaIvs(broadcastClient);
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setScreenEnabled(false);
        setScreenStream(null);
        screenStreamRef.current = null;
      });

      setScreenStream(stream);
      screenStreamRef.current = stream;
      setScreenEnabled(true);

      if (broadcastClient) {
        await atualizarProgramaIvs(broadcastClient);
      }

      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = stream;
      }

    } catch {
      // usuário cancelou
    }
  }
  

  async function buscarBroadcastConfig() {
    const token = getToken();

    const res = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/broadcast-config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.message || "Erro ao buscar configuração da transmissão.");
    }

    const config = json?.item || json?.config || json;

    if (!config?.ingestEndpoint || !config?.streamKey) {
      throw new Error("Configuração IVS incompleta. Falta ingestEndpoint ou streamKey.");
    }

    setBroadcastConfig({
      ingestEndpoint: config.ingestEndpoint,
      streamKey: config.streamKey,
      playbackUrl: config.playbackUrl || config.urlStream || "",
    });

    return {
      ingestEndpoint: config.ingestEndpoint,
      streamKey: config.streamKey,
      playbackUrl: config.playbackUrl || config.urlStream || "",
    };
  }

async function criarBroadcastClient(config: BroadcastConfig) {
console.log("🚨 TESTE NOVO CÓDIGO LIVE STUDIO 1080P - ENTROU AQUI 🚨");

  if (!cameraStream?.getVideoTracks().length && !screenStream?.getVideoTracks().length) {
    throw new Error("Ligue a câmera ou compartilhe a tela antes de iniciar a live.");
  }

  const mod: any = await import("amazon-ivs-web-broadcast");

  const IVSBroadcastClient =
    mod.IVSBroadcastClient ||
    mod.default?.IVSBroadcastClient ||
    mod.default ||
    mod;

  if (!IVSBroadcastClient?.create) {
    console.log("[IVS] módulo carregado:", mod);
    throw new Error("IVS Broadcast SDK não carregou corretamente.");
  }

//  const streamConfig =
//    IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE ||
//    mod.BASIC_FULL_HD_LANDSCAPE ||
//    IVSBroadcastClient.STANDARD_LANDSCAPE ||
//    mod.STANDARD_LANDSCAPE ||
//    IVSBroadcastClient.BASIC_LANDSCAPE ||
//    mod.BASIC_LANDSCAPE ||
//    {
//      maxResolution: {
//        width: VIDEO_FULL_HD.width,
//        height: VIDEO_FULL_HD.height,
//      },
//      maxFramerate: 30,
//      maxBitrate: 6000,
//    };

const streamConfig = {
  maxResolution: {
    width: VIDEO_FULL_HD.width,
    height: VIDEO_FULL_HD.height,
  },
  maxFramerate: 30,
  maxBitrate: 8500,
};

console.log("[IVS DEBUG] streamConfig FINAL usado:", streamConfig);
console.log("[IVS DEBUG] VIDEO_FULL_HD:", VIDEO_FULL_HD);

  const endpointIvs = normalizarIvsIngestEndpoint(config.ingestEndpoint);
  const streamKeyLimpa = String(config.streamKey || "").trim();

  if (!endpointIvs) {
    throw new Error("Ingest endpoint do IVS não informado.");
  }

  if (!streamKeyLimpa) {
    throw new Error("Stream key do IVS não informada.");
  }

  // Para o teste, força a câmera ligada se ela for a fonte principal.
  if (
    !screenStream?.getVideoTracks().length &&
    cameraStream?.getVideoTracks().length &&
    !usandoPlaceholderCamera
  ) {
    cameraStream.getVideoTracks().forEach((track) => {
      track.enabled = true;
    });

    setCameraEnabled(true);
  }

  // Para o teste, força o microfone ligado.
  if (micStream?.getAudioTracks().length) {
    micStream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    setMicEnabled(true);
  }

  console.log("[IVS] Criando client corrigido:", {
    endpointOriginal: config.ingestEndpoint,
    endpointIvs,
    streamConfig,
    streamConfigKeys: Object.keys(streamConfig || {}),
    hasClientStaticPreset: !!IVSBroadcastClient.STANDARD_LANDSCAPE,
    cameraVideoTracks: cameraStream?.getVideoTracks().map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      settings: track.getSettings?.(),
    })) || [],
    micAudioTracks: micStream?.getAudioTracks().map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      settings: track.getSettings?.(),
    })) || [],
    screenVideoTracks: screenStream?.getVideoTracks().map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      settings: track.getSettings?.(),
    })) || [],
  });

  const client = IVSBroadcastClient.create({
    streamConfig,
    ingestEndpoint: endpointIvs,
  });

console.log("[IVS DEBUG] canvasDimensions logo após create:", client.getCanvasDimensions?.());
console.log("[IVS DEBUG] client criado com streamConfig:", streamConfig);

  client.on?.("connectionStateChange", (state: any) => {
    console.log("[IVS] connectionStateChange:", state);
  });

  client.on?.("error", (err: any) => {
    console.error("[IVS] client error:", err);
  });

  if (micStream?.getAudioTracks().length) {
    const audioProcessado = criarAudioLiveComVolume(micStream);

    await client.addAudioInputDevice(audioProcessado, "microphone");

    console.log("[IVS] áudio adicionado com volume:", micInputVolume);
  }

  const telaAtual = screenStreamRef.current;

  const cameraReal =
    cameraEnabled && !usandoPlaceholderCamera
      ? cameraStreamRef.current
      : null;

  const temTela = !!telaAtual?.getVideoTracks().length;
  const temCameraReal = !!cameraReal?.getVideoTracks().length;
  const temCameraQualquer = !!cameraStreamRef.current?.getVideoTracks().length;

  if (!temTela && !temCameraReal && !temCameraQualquer) {
    throw new Error("Nenhuma fonte de vídeo ativa para transmitir.");
  }

  const programaStream = criarProgramaIvsStream(telaAtual, cameraReal);

console.log("[IVS DEBUG] programaStream tracks:", programaStream.getVideoTracks().map((track) => ({
  id: track.id,
  label: track.label,
  enabled: track.enabled,
  readyState: track.readyState,
  settings: track.getSettings?.(),
})));

  const dimensao = client.getCanvasDimensions?.() || {
    width: VIDEO_FULL_HD.width,
    height: VIDEO_FULL_HD.height,
  };

console.log("[IVS DEBUG] posição enviada para addVideoInputDevice:", {
  index: 0,
  x: 0,
  y: 0,
  width: dimensao.width,
  height: dimensao.height,
});

  await client.addVideoInputDevice(
    programaStream,
    "program",
    {
      index: 0,
      x: 0,
      y: 0,
      width: dimensao.width,
      height: dimensao.height,
    }
  );

  console.log("[IVS] Programa adicionado como único vídeo principal.", {
    temTela,
    temCameraReal,
    usandoPlaceholderCamera,
  });

  console.log("[IVS] devices no client:", {
    programDevice: client.getVideoInputDevice?.("program"),
    cameraDevice: client.getVideoInputDevice?.("camera"),
    screenDevice: client.getVideoInputDevice?.("screen"),
    audioDevice: client.getAudioInputDevice?.("microphone"),
    canvasDimensions: client.getCanvasDimensions?.(),
  });

  setBroadcastClient(client);
  return client;
}

  async function iniciarLive() {
    try {
      setStarting(true);
      setBroadcastError(null);

      const config = await buscarBroadcastConfig();

      const client = await criarBroadcastClient(config);

const streamKeyLimpa = String(config.streamKey || "").trim();

console.log("[IVS] Tentando iniciar broadcast:", {
  endpointOriginal: config.ingestEndpoint,
  endpointNormalizado: normalizarIvsIngestEndpoint(config.ingestEndpoint),
  playbackUrl: config.playbackUrl,
  hasStreamKey: !!streamKeyLimpa,
  streamKeyLength: streamKeyLimpa.length,
});

const startResult = await client.startBroadcast(streamKeyLimpa);

console.log("[IVS] Resultado startBroadcast:", startResult);

if (startResult) {
  throw new Error(
    startResult?.message ||
      startResult?.name ||
      JSON.stringify(startResult) ||
      "O IVS recusou o início da transmissão."
  );
}

await new Promise((resolve) => setTimeout(resolve, 8000));

const estadoConexao = client.getConnectionState?.();
const sessionId = client.getSessionId?.();

console.log("[IVS] Connection state após 8s:", estadoConexao);
console.log("[IVS] Session ID após 8s:", sessionId);

const transmissaoAceita =
  estadoConexao === "connected" ||
  estadoConexao === "active" ||
  !!sessionId;

if (!transmissaoAceita) {
  await pararBroadcastSeguro(client);

  throw new Error(
    "A transmissão não conectou ao IVS. Tente usar Google Chrome ou Edge, sem VPN ou bloqueadores ativos."
  );
}

console.log("[IVS] Broadcast conectado com sucesso.");

const token = getToken();

const iniciarRes = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/iniciar`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({
    playbackUrl: config.playbackUrl || null,
    urlStream: config.playbackUrl || null,
  }),
});

const iniciarJson = await iniciarRes.json().catch(() => ({}));

if (!iniciarRes.ok) {
  throw new Error(iniciarJson?.message || "A transmissão conectou, mas não foi possível marcar a aula como ao vivo.");
}

      setAula((prev) =>
        prev
          ? {
              ...prev,
              status: "AO_VIVO",
              iniciouEm: new Date().toISOString(),
              urlStream: config.playbackUrl || prev.urlStream,
            }
          : prev
      );
    } catch (e: any) {
      setBroadcastError(e?.message || "Falha ao iniciar transmissão.");
    } finally {
      setStarting(false);
    }
  }

  async function sincronizarReplayComTentativas(tentativas = 3) {
    const token = getToken();

    if (!aulaId) return false;

    if (aula?.replayDisponivel && (aula.videoGravadoUrl || aula.urlStream)) {
      setBroadcastError(null);
      return true;
    }

    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      try {
        const syncRes = await fetch(
          `${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/sincronizar-replay`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        const syncJson = await syncRes.json().catch(() => ({}));

        if (syncRes.ok && syncJson?.item) {
          const item = syncJson.item;

          setAula((prev) =>
            prev
              ? {
                  ...prev,
                  replayDisponivel: item?.replayDisponivel === true,
                  videoGravadoUrl: item?.videoGravadoUrl || prev.videoGravadoUrl,
                  thumbUrl: item?.thumbUrl || prev.thumbUrl,
                }
              : prev
          );

          setBroadcastError(null);
          await carregarAula(false);

          return item?.replayDisponivel === true;
        }

        if (syncRes.status === 202 || syncJson?.processing) {
          setBroadcastError(
            syncJson?.message ||
              "Replay ainda está processando no S3. Aguarde alguns minutos."
          );

          return false;
        }

        console.warn(`[REPLAY] Tentativa ${tentativa} falhou:`, syncJson);
      } catch (e) {
        console.warn(`[REPLAY] Tentativa ${tentativa} com erro:`, e);
      }

      if (tentativa < tentativas) {
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }

    setBroadcastError("Live finalizada. O replay ainda está processando no S3.");
    return false;
  }

  async function finalizarLive() {
    try {
      setStopping(true);
      setBroadcastError(null);

      if (broadcastClient) {
        await pararBroadcastSeguro(broadcastClient);
      }

      const token = getToken();

      const finalizarRes = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/finalizar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const finalizarJson = await finalizarRes.json().catch(() => ({}));

      if (!finalizarRes.ok) {
        throw new Error(finalizarJson?.message || "Erro ao finalizar aula ao vivo.");
      }

      setBroadcastError("Live finalizada. Processando replay no S3...");

      window.setTimeout(() => {
        sincronizarReplayComTentativas(5);
      }, 60000);

      setAula((prev) =>
        prev
          ? {
              ...prev,
              status: "FINALIZADA",
              finalizouEm: new Date().toISOString(),
            }
          : prev
      );

      setBroadcastClient(null);
    } catch (e: any) {
      setBroadcastError(e?.message || "Falha ao finalizar transmissão.");
    } finally {
      setStopping(false);
    }
  }

  async function copiar(texto?: string | null) {
    if (!texto) return;
    await navigator.clipboard.writeText(texto);
    alert("Copiado!");
  }

  function abrirPaginaDaLive() {
    if (!aulaId) return;

    navigate(`/learning/live?aulaId=${encodeURIComponent(aulaId)}`);
  }

  if (!aulaId) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] p-5">
        <div className="max-w-4xl mx-auto rounded-2xl bg-white border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-900">Aula ao vivo não encontrada</h1>
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
          Carregando estúdio da live...
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
                Estúdio da aula ao vivo
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
              {viewerCount} online
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
          <section className="space-y-5">
            <div className="rounded-[26px] bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex flex-col md:flex-row md:items-start gap-4 mb-5">
                <div className="h-20 w-20 rounded-2xl bg-[#0b4a2f] text-white flex items-center justify-center shrink-0">
                  <Radio className="w-9 h-9" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#216c43] font-bold mb-1">
                    {metodologiaTitulo}
                  </div>

                  <h1 className="text-3xl md:text-4xl font-black text-slate-950 leading-tight">
                    {aula?.titulo || "Aula ao vivo"}
                  </h1>

                  {aula?.descricao ? (
                    <p className="text-slate-600 mt-2">{aula.descricao}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 mt-4">
                    {liveBadge ? (
                      <span className={`rounded-xl border px-3 py-2 text-sm font-bold ${liveBadge.className}`}>
                        {liveBadge.label}
                      </span>
                    ) : null}

                    {aula?.gravacaoAtiva ? (
                      <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 inline-flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Gravação automática ativa
                      </span>
                    ) : (
                      <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                        Gravação desativada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {broadcastError ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold">Atenção</div>
                    <div className="text-sm">{broadcastError}</div>
                  </div>
                </div>
              ) : null}

              {broadcastError ? (
                <button
                  type="button"
                  onClick={inicializarDispositivos}
                  className="mb-4 h-11 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Tentar liberar câmera/microfone novamente
                </button>
              ) : null}

{navegadorPossivelmenteIncompativel ? (
  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
    <div>
      <div className="font-bold">Recomendamos usar Google Chrome</div>
      <div className="text-sm mt-1">
        Para transmitir aulas ao vivo, use preferencialmente Google Chrome ou Microsoft Edge,
        sem VPN, bloqueador de anúncios ou proteção WebRTC ativa. Alguns navegadores, como Opera GX,
        podem bloquear a transmissão mesmo com câmera e microfone funcionando.
      </div>
    </div>
  </div>
) : null}

<div className="relative overflow-hidden rounded-[24px] bg-[#021e14] border border-slate-900">
  {screenEnabled && screenStream ? (
    <>
      <video
        ref={screenPreviewRef}
        autoPlay
        muted
        playsInline
        className="w-full aspect-video object-contain bg-black"
      />

      {cameraEnabled && !usandoPlaceholderCamera && cameraStream ? (
        <div className="absolute right-4 top-4 w-[260px] max-w-[36%] overflow-hidden rounded-2xl border-2 border-white/70 bg-black shadow-xl">
          <video
            ref={previewRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video object-cover"
          />
          <div className="absolute left-2 bottom-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">
            Câmera
          </div>
        </div>
      ) : null}
    </>
  ) : (
    <>
      <video
        ref={previewRef}
        autoPlay
        muted
        playsInline
        className="w-full aspect-video object-contain bg-black"
      />

      {!cameraEnabled && !usandoPlaceholderCamera ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
          <div className="text-center">
            <CameraOff className="w-12 h-12 mx-auto mb-3 opacity-80" />
            <div className="font-bold">Câmera desligada</div>
          </div>
        </div>
      ) : null}
    </>
  )}

                <div className="absolute left-4 bottom-4 flex items-center gap-2">
                  {isLive ? (
                    <span className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white">
                      LIVE
                    </span>
                  ) : (
                    <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-black text-white">
                      PREVIEW
                    </span>
                  )}

                  <span className="rounded-lg bg-black/55 px-3 py-1.5 text-xs font-bold text-white inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {viewerCount}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="h-16 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1 text-sm font-semibold text-slate-700"
                >
                  {cameraEnabled && !usandoPlaceholderCamera ? (
                    <Camera className="w-5 h-5 text-[#216c43]" />
                  ) : (
                    <CameraOff className="w-5 h-5 text-red-600" />
                  )}

                  {usandoPlaceholderCamera
                    ? "Sem câmera"
                    : `Câmera ${cameraEnabled ? "ligada" : "desligada"}`}
                </button>

                <button
                  type="button"
                  onClick={toggleMic}
                  className="h-16 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1 text-sm font-semibold text-slate-700"
                >
                  {micEnabled ? <Mic className="w-5 h-5 text-[#216c43]" /> : <MicOff className="w-5 h-5 text-red-600" />}
                  Microfone {micEnabled ? "ligado" : "desligado"}
                </button>

                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className="h-16 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1 text-sm font-semibold text-slate-700"
                >
                  <MonitorUp className={`w-5 h-5 ${screenEnabled ? "text-[#216c43]" : "text-slate-600"}`} />
                  {screenEnabled ? "Parar tela" : "Compartilhar tela"}
                </button>

                {!isLive ? (
                  <button
                    type="button"
                    onClick={iniciarLive}
                    disabled={starting || isFinished}
                    className="h-16 rounded-2xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white flex flex-col items-center justify-center gap-1 text-sm font-bold"
                  >
                    {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />}
                    {starting ? "Iniciando..." : "Iniciar live"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finalizarLive}
                    disabled={stopping}
                    className="h-16 rounded-2xl bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white flex flex-col items-center justify-center gap-1 text-sm font-bold"
                  >
                    {stopping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
                    {stopping ? "Finalizando..." : "Finalizar live"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setManualConfigOpen((v) => !v)}
                  className="h-16 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1 text-sm font-semibold text-slate-700"
                >
                  <MoreHorizontal className="w-5 h-5" />
                  Config. IVS
                </button>
              </div>

{!micEnabled ? (
  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <MicOff className="w-5 h-5" />
      </div>

      <div>
        <div className="font-black text-amber-900">
          Microfone desligado
        </div>
        <div className="text-sm text-amber-800/80">
          Você pode testar se o áudio está captando antes de ligar o microfone na live.
        </div>
      </div>
    </div>

    <button
      type="button"
      onClick={abrirTesteMicrofone}
      className="h-11 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
    >
      Testar microfone
    </button>
  </div>
) : null}

<div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
  <div className="flex items-center justify-between gap-3 mb-3">
    <div>
      <div className="font-black text-[#193b2e]">
        Volume do microfone
      </div>
      <div className="text-sm text-slate-500">
        Controla o volume enviado para a live.
      </div>
    </div>

    <div
      className={`text-sm font-black ${
        micInputVolume > 85 ? "text-red-600" : "text-slate-600"
      }`}
    >
      {micInputVolume}%
    </div>
  </div>

  <input
    type="range"
    min={0}
    max={100}
    value={micInputVolume}
    onChange={(e) => setMicInputVolume(Number(e.target.value))}
    className="w-full accent-[#216c43]"
  />

  <div className="mt-2 flex justify-between text-xs text-slate-400">
    <span>Baixo</span>
    <span>Recomendado: 60% a 80%</span>
    <span>Alto</span>
  </div>

  {micInputVolume > 85 ? (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">
      O volume está alto e pode estourar. Tente reduzir para 70%.
    </div>
  ) : null}
</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Câmera
                  </label>
                  <select
                    value={selectedCameraId}
                    disabled={switchingDevice}
                    onChange={(e) => {
                      const novoCameraId = e.target.value;
                      setSelectedCameraId(novoCameraId);
                      trocarDispositivo(novoCameraId, selectedMicId, "camera");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {cameras.length === 0 ? (
                      <option value="">Nenhuma câmera encontrada</option>
                    ) : (
                      cameras.map((cam, index) => (
                        <option key={cam.deviceId || index} value={cam.deviceId}>
                          {cam.label || `Câmera ${index + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Microfone
                  </label>
                  <select
                    value={selectedMicId}
                    disabled={switchingDevice}
                    onChange={(e) => {
                      const novoMicId = e.target.value;
                      setSelectedMicId(novoMicId);
                      trocarDispositivo(selectedCameraId, novoMicId, "microfone");
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {microphones.length === 0 ? (
                      <option value="">Nenhum microfone encontrado</option>
                    ) : (
                      microphones.map((mic, index) => (
                        <option key={mic.deviceId || index} value={mic.deviceId}>
                          {mic.label || `Microfone ${index + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {manualConfigOpen ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-bold text-[#193b2e] mb-2">Configuração IVS temporária</div>
                  <p className="text-sm text-slate-600 mb-4">
                    Enquanto o backend ainda não gera o canal/stream key, você pode colar manualmente
                    o ingest endpoint e a stream key do IVS para testar a transmissão.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Ingest endpoint
                      </label>
                      <input
                        value={broadcastConfig.ingestEndpoint}
                        onChange={(e) =>
                          setBroadcastConfig((prev) => ({
                            ...prev,
                            ingestEndpoint: e.target.value,
                          }))
                        }
                        placeholder="Ex.: xxxxx.global-contribute.live-video.net"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Stream key
                      </label>
                      <input
                        value={broadcastConfig.streamKey}
                        onChange={(e) =>
                          setBroadcastConfig((prev) => ({
                            ...prev,
                            streamKey: e.target.value,
                          }))
                        }
                        placeholder="Cole a stream key do IVS"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Playback URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={broadcastConfig.playbackUrl || ""}
                          onChange={(e) =>
                            setBroadcastConfig((prev) => ({
                              ...prev,
                              playbackUrl: e.target.value,
                            }))
                          }
                          placeholder="URL HLS para os alunos assistirem"
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => copiar(broadcastConfig.playbackUrl)}
                          className="h-12 w-12 rounded-xl border border-slate-300 bg-white flex items-center justify-center"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#216c43] mt-0.5 shrink-0" />

                  <div className="flex-1">
                    <div className="font-bold text-[#193b2e]">
                      Após a aula, a gravação poderá ser disponibilizada como replay.
                    </div>

                    <div className="text-sm text-slate-600 mt-1">
                      Quando o replay estiver disponível, o criador também pode abrir a página normal da live
                      para assistir como os alunos.
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={abrirPaginaDaLive}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#216c43] px-4 py-3 text-sm font-black text-white hover:bg-[#185333]"
                      >
                        <Video className="w-4 h-4" />
                        {aula?.status === "FINALIZADA" && aula?.replayDisponivel
                          ? "Ver replay da live"
                          : "Ver página da live"}
                      </button>
                    </div>

                    {aula?.status === "FINALIZADA" && aula?.replayDisponivel ? (
                      <p className="mt-2 text-xs font-semibold text-emerald-800">
                        Replay disponível. Clique para assistir na página pública da aula.
                      </p>
                    ) : aula?.status === "FINALIZADA" ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        A live foi finalizada, mas o replay ainda pode estar processando.
                      </p>
                    ) : null}
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
                  <div className="text-sm text-slate-500">Controle da transmissão</div>
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
                  <span>Participantes</span>
                  <strong>{aula?.totalParticipantes ?? 0}</strong>
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
                    placeholder={aula?.chatAtivo ? "Escreva uma mensagem..." : "Chat desativado"}
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

{micTestOpen ? (
  <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-lg rounded-[26px] bg-white shadow-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500 font-bold">
            Teste de áudio
          </div>
          <h2 className="text-xl font-black text-[#193b2e]">
            Testar microfone
          </h2>
        </div>

        <button
          type="button"
          onClick={fecharTesteMicrofone}
          className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black"
        >
          ×
        </button>
      </div>

      <div className="p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Microfone para teste
          </label>

          <select
            value={micTestSelectedId}
            onChange={(e) => trocarMicrofoneDoTeste(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
          >
            {microphones.length === 0 ? (
              <option value="">Nenhum microfone encontrado</option>
            ) : (
              microphones.map((mic, index) => (
                <option key={mic.deviceId || index} value={mic.deviceId}>
                  {mic.label || `Microfone ${index + 1}`}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-slate-800">
              Nível de entrada
            </div>

            <div className="text-sm font-bold text-slate-500">
              {micTestStarting ? "Iniciando..." : `${micTestLevel}%`}
            </div>
          </div>

          <div className="h-5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                micTestLevel > 70
                  ? "bg-red-500"
                  : micTestLevel > 35
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.max(4, micTestLevel)}%` }}
            />
          </div>

          <div className="mt-3 text-sm text-slate-600">
            {micTestLevel > 85
              ? "O áudio está muito alto e pode estourar. Reduza o volume do microfone."
              : "Fale perto do microfone. Se a barra mexer, o áudio está sendo captado."}
          </div>
          <div className="mt-2 text-xs text-amber-700 font-semibold">
            Para escutar seu próprio microfone, use fone de ouvido para evitar eco ou microfonia.
          </div>
        </div>

<div className="rounded-2xl border border-slate-200 bg-white p-4">
  <div className="flex items-center justify-between mb-2">
    <div>
      <div className="font-bold text-slate-800">
        Volume para escutar
      </div>
      <div className="text-sm text-slate-500">
        Controla o volume do retorno no seu fone.
      </div>
    </div>

    <div className="text-sm font-black text-slate-600">
      {micMonitorVolume}%
    </div>
  </div>

  <input
    type="range"
    min={0}
    max={100}
    value={micMonitorVolume}
    onChange={(e) => setMicMonitorVolume(Number(e.target.value))}
    className="w-full accent-[#216c43]"
  />

  <div className="mt-2 text-xs text-amber-700 font-semibold">
    Use fone de ouvido. Se usar alto-falante, pode gerar eco ou microfonia.
  </div>
</div>

        {micTestError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">{micTestError}</div>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => iniciarMonitoramentoMicrofone(micTestSelectedId)}
            disabled={micTestStarting}
            className="h-12 flex-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-700 disabled:bg-slate-100"
          >
            {micTestStarting ? "Testando..." : "Testar novamente"}
          </button>

          <button
            type="button"
            onClick={toggleEscutarMicrofoneTeste}
            disabled={micTestStarting || !!micTestError}
            className={`h-12 flex-1 rounded-xl font-bold disabled:bg-slate-100 disabled:text-slate-400 ${
              micTestListening
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            }`}
          >
            {micTestListening ? "Parar de escutar" : "Escutar meu microfone"}
          </button>

          <button
            type="button"
            onClick={aplicarMicrofoneTestado}
            disabled={!micTestSelectedId || switchingDevice}
            className="h-12 flex-1 rounded-xl bg-[#216c43] hover:bg-[#185334] text-white font-bold disabled:bg-slate-300"
          >
            Usar este microfone
          </button>
        </div>
      </div>
    </div>
  </div>
) : null}

    </div>
  );
}
