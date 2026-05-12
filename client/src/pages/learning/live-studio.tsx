// client/src/pages/learning/live-studio.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  width: 1280,
  height: 720,
};

export default function LearningLiveStudioPage() {
  const [, navigate] = useLocation();

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const placeholderStreamRef = useRef<MediaStream | null>(null);

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

  const viewerCount = aula?.totalParticipantes ?? 0;

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
    inicializarDispositivos();

    return () => {
      pararStream(cameraStreamRef.current);
      pararStream(micStreamRef.current);
      pararStream(screenStreamRef.current);
      pararStream(placeholderStreamRef.current);
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
  canvas.width = 1280;
  canvas.height = 720;

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

  try {
    broadcastClient.removeVideoInputDevice?.("camera");
  } catch (e) {
    console.warn("[IVS] Falha ao remover câmera antiga:", e);
  }

  await broadcastClient.addVideoInputDevice(
    novoVideoStream,
    "camera",
    getMainVideoPosition()
  );

  pararStream(cameraStreamRef.current);

  setCameraStream(novoVideoStream);
  cameraStreamRef.current = novoVideoStream;

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

  await broadcastClient.addAudioInputDevice(novoAudioStream, "microphone");

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
      try {
        broadcastClient.removeVideoInputDevice?.("camera");
      } catch {}

      await broadcastClient.addVideoInputDevice(
        novoVideoStream,
        "camera",
        getMainVideoPosition()
      );
    }
  } catch (e) {
    console.warn("[LIVE] Não foi possível ligar câmera real. Mantendo placeholder:", e);

    const placeholder = criarPlaceholderVideoStream("Câmera indisponível");

    setUsandoPlaceholderCamera(true);
    pararStream(cameraStreamRef.current);

    setCameraStream(placeholder);
    cameraStreamRef.current = placeholder;
    setCameraEnabled(false);

    if (previewRef.current) {
      previewRef.current.srcObject = placeholder;
      await previewRef.current.play().catch(() => null);
    }

    if (broadcastClient) {
      try {
        broadcastClient.removeVideoInputDevice?.("camera");
      } catch {}

      await broadcastClient.addVideoInputDevice(
        placeholder,
        "camera",
        getMainVideoPosition()
      );
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
  }

  async function toggleScreenShare() {
    if (screenEnabled) {
      if (broadcastClient) {
        try {
          broadcastClient.removeVideoInputDevice?.("screen");

          if (cameraStreamRef.current?.getVideoTracks().length) {
            try {
              broadcastClient.removeVideoInputDevice?.("camera");
            } catch {}

            await broadcastClient.addVideoInputDevice(cameraStreamRef.current, "camera", {
              index: 0,
              x: 0,
              y: 0,
              width: 1280,
              height: 720,
            });
          }

          console.log("[IVS] Tela removida durante a live; câmera voltou como principal.");
        } catch (e: any) {
          console.error("[IVS] Falha ao remover tela durante a live:", e);
        }
      }

      pararStream(screenStreamRef.current);
      setScreenStream(null);
      screenStreamRef.current = null;
      setScreenEnabled(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
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

      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = stream;
      }

      if (broadcastClient) {
        try {
          broadcastClient.removeVideoInputDevice?.("screen");

          await broadcastClient.addVideoInputDevice(stream, "screen", {
            index: 0,
            x: 0,
            y: 0,
            width: 1280,
            height: 720,
          });

          if (cameraStreamRef.current?.getVideoTracks().length) {
            try {
              broadcastClient.removeVideoInputDevice?.("camera");
            } catch {}

            await broadcastClient.addVideoInputDevice(cameraStreamRef.current, "camera", {
              index: 1,
              x: 920,
              y: 30,
              width: 320,
              height: 180,
            });
          }

          console.log("[IVS] Tela adicionada durante a live.");
        } catch (e: any) {
          console.error("[IVS] Falha ao adicionar tela durante a live:", e);
          setBroadcastError(e?.message || "Falha ao compartilhar tela durante a live.");
        }
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

  const streamConfig =
    IVSBroadcastClient.STANDARD_LANDSCAPE ||
    IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE ||
    IVSBroadcastClient.BASIC_LANDSCAPE ||
    mod.STANDARD_LANDSCAPE ||
    mod.BASIC_FULL_HD_LANDSCAPE ||
    mod.BASIC_LANDSCAPE ||
    {
      maxResolution: {
        width: 1280,
        height: 720,
      },
      maxFramerate: 30,
      maxBitrate: 3500,
    };

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

  client.on?.("connectionStateChange", (state: any) => {
    console.log("[IVS] connectionStateChange:", state);
  });

  client.on?.("error", (err: any) => {
    console.error("[IVS] client error:", err);
  });

  if (micStream?.getAudioTracks().length) {
    await client.addAudioInputDevice(micStream, "microphone");
    console.log("[IVS] áudio adicionado");
  }

  if (screenStream?.getVideoTracks().length) {
    await client.addVideoInputDevice(screenStream, "screen", {
      index: 0,
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });

    console.log("[IVS] tela adicionada como vídeo principal");

    if (cameraStream?.getVideoTracks().length && cameraEnabled) {
      await client.addVideoInputDevice(cameraStream, "camera", {
        index: 1,
        x: 920,
        y: 30,
        width: 320,
        height: 180,
      });

      console.log("[IVS] câmera adicionada como PiP");
    }
  } else if (cameraStream?.getVideoTracks().length) {
    await client.addVideoInputDevice(cameraStream, "camera", {
      index: 0,
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });

    console.log("[IVS] câmera adicionada como vídeo principal");
  } else {
    throw new Error("Nenhuma fonte de vídeo ativa para transmitir.");
  }

  console.log("[IVS] devices no client:", {
    videoDevice: client.getVideoInputDevice?.("camera"),
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

      const config =
        broadcastConfig.ingestEndpoint && broadcastConfig.streamKey
          ? broadcastConfig
          : await buscarBroadcastConfig();

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

if (estadoConexao !== "connected") {
  await client.stopBroadcast?.().catch(() => null);

  throw new Error(
    "A transmissão não conectou ao IVS. Tente usar Google Chrome ou Edge, sem VPN ou bloqueadores ativos."
  );
}

console.log("[IVS] Broadcast conectado com sucesso.");

const token = getToken();

await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/iniciar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          playbackUrl: config.playbackUrl || null,
          urlStream: config.playbackUrl || null,
        }),
      }).catch(() => null);

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

  async function finalizarLive() {
    try {
      setStopping(true);
      setBroadcastError(null);

      if (broadcastClient) {
        await broadcastClient.stopBroadcast();
      }

      const token = getToken();

      await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}/finalizar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).catch(() => null);

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
                <video
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full aspect-video object-cover bg-black"
                />

                {!cameraEnabled && !usandoPlaceholderCamera ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                    <div className="text-center">
                      <CameraOff className="w-12 h-12 mx-auto mb-3 opacity-80" />
                      <div className="font-bold">Câmera desligada</div>
                    </div>
                  </div>
                ) : null}

                {screenEnabled && screenStream ? (
                  <div className="absolute right-4 top-4 w-[260px] max-w-[36%] overflow-hidden rounded-2xl border-2 border-white/70 bg-black shadow-xl">
                    <video
                      ref={screenPreviewRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full aspect-video object-cover"
                    />
                    <div className="absolute left-2 bottom-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                      Tela compartilhada
                    </div>
                  </div>
                ) : null}

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

              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#216c43] mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-[#193b2e]">
                    Após a aula, a gravação poderá ser disponibilizada como replay.
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Quando o backend estiver pronto, o processo de gravação/replay pode ser automatizado
                    usando IVS + S3.
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
    </div>
  );
}
