import { toast } from "@/lib/toast";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import { API } from "../config.js";

const Storage = {
  get token() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  },
  get tipoUsuarioId() {
    return (
      localStorage.getItem("tipoUsuarioId") ||
      sessionStorage.getItem("tipoUsuarioId") ||
      ""
    );
  },
  get tipoUsuarioRaw() {
    return (
      localStorage.getItem("usuarioTipoRaw") ||
      sessionStorage.getItem("usuarioTipoRaw") ||
      localStorage.getItem("tipoUsuario") ||
      sessionStorage.getItem("tipoUsuario") ||
      ""
    );
  },
};

export default function PaginaSubmissao() {
  const qc = useQueryClient();
  const ATTEMPT_LIMIT = 2;
  const STORAGE_KEY_PREFIX = "footera:desafioAttempts";
  const IDB_NAME = "footera-media";
  const IDB_STORE = "desafio-videos";
  const IDB_VERSION = 1;

  const [, navigate] = useLocation();
  const [treinoAgendadoId, setTreinoAgendadoId] = useState<string | null>(null);
  const [treinoProgramadoId, setTreinoProgramadoId] = useState<string | null>(null);
  const [desafioId, setDesafioId] = useState<string | null>(null);
  const [modeParam, setModeParam] = useState<"camera" | "galeria" | null>(null);
  const [atletaId, setAtletaId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [tempoTexto, setTempoTexto] = useState("");
  const [tempoSegFixado, setTempoSegFixado] = useState<number | null>(null);
  const [reps, setReps] = useState<string>("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [awardPontos, setAwardPontos] =
    useState<number>(0);

  const [treinoNome, setTreinoNome] =
    useState<string>("");

  const [atletaNome, setAtletaNome] =
    useState<string>("");

  const [
    duracaoProgramadaMinutos,
    setDuracaoProgramadaMinutos,
  ] = useState<number | null>(
    null
  );

  const [awardAtletas, setAwardAtletas] =
    useState<
      {
        atletaId: string;
        nome: string;
      }[]
    >([]);
  const isSessaoTreino = Boolean(sessaoId);
  const [isRecording, setIsRecording] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const arquivoInputRef = useRef<HTMLInputElement | null>(null);
  const [treinoMode, setTreinoMode] = useState<"upload" | "live">("upload");
  const [treinoIsRecording, setTreinoIsRecording] = useState(false);
  const [treinoRecordedBlob, setTreinoRecordedBlob] = useState<Blob | null>(null);
  const [treinoRecordedUrl, setTreinoRecordedUrl] = useState<string | null>(null);
  const [treinoRecError, setTreinoRecError] = useState<string | null>(null);
  const [metodologiaId, setMetodologiaId] = useState<string | null>(null);
  const [estruturaId, setEstruturaId] = useState<string | null>(null);
  const [metodologiaItemId, setMetodologiaItemId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const treinoMediaStreamRef = useRef<MediaStream | null>(null);
  const treinoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const treinoChunksRef = useRef<BlobPart[]>([]);
  const treinoLiveVideoRef = useRef<HTMLVideoElement | null>(null);
  const isDesafio = Boolean(desafioId);
  const isTreino = Boolean(treinoAgendadoId) || Boolean(sessaoId);
  
  const isSecureContext =
    typeof window !== "undefined" &&
    (window.location.protocol === "https:" || window.location.hostname === "localhost");
  
  const dualStorage = {
    getItem(key: string): string | null {
      let a: string | null = null;
      let b: string | null = null;
      try { a = window.localStorage?.getItem(key) ?? null; } catch {}
      try { b = window.sessionStorage?.getItem(key) ?? null; } catch {}
      const na = a != null ? Number(a) : NaN;
      const nb = b != null ? Number(b) : NaN;
      const ca = Number.isFinite(na) ? na : 0;
      const cb = Number.isFinite(nb) ? nb : 0;
      const best = Math.max(ca, cb);
      return String(best);
    },
    setItem(key: string, value: string) {
      try { window.localStorage?.setItem(key, value); } catch {}
      try { window.sessionStorage?.setItem(key, value); } catch {}
    },
    removeItem(key: string) {
      try { window.localStorage?.removeItem(key); } catch {}
      try { window.sessionStorage?.removeItem(key); } catch {}
    },
  };

  const attemptKey = (dId: string, aId: string) =>
    `${STORAGE_KEY_PREFIX}:${dId}:${aId}`;

  const loadAttempts = (dId: string, aId: string): number => {
    const raw = dualStorage.getItem(attemptKey(dId, aId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.min(ATTEMPT_LIMIT, Math.max(0, n)) : 0;
  };

  const saveAttempts = (dId: string, aId: string, n: number) =>
    dualStorage.setItem(
      attemptKey(dId, aId),
      String(Math.min(ATTEMPT_LIMIT, Math.max(0, n)))
    );

  function isPdfFile(file?: File | null) {
    return !!file && (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    );
  }

  function isImageFile(file?: File | null) {
    return !!file && file.type.startsWith("image/");
  }

  function isVideoFile(file?: File | null) {
    return !!file && file.type.startsWith("video/");
  }

  function parseTempoToSeconds(v: string): number | undefined {
    const s = v.trim();
    if (!s) return undefined;
    if (s.includes(":")) {
      const [mRaw, secRaw] = s.split(":");
      const m = Number(mRaw);
      const sec = Number(secRaw);
      if (Number.isFinite(m) && Number.isFinite(sec)) return m * 60 + sec;
      return undefined;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  function secondsToMMSS(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  type SavedVideo = { blob: Blob; type: string; createdAt: number };

  function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  async function idbPut(key: string, value: SavedVideo) {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
    db.close();
  }

  async function idbGet(key: string): Promise<SavedVideo | null> {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    const val = await new Promise<any>((res, rej) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return val;
  }

  async function idbDel(key: string) {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
    db.close();
  }

  const videoKey = (dId: string, aId: string) => `desafioVideo:${dId}:${aId}`;

  async function saveRecordedVideo(dId: string, aId: string, blob: Blob) {
    try {
      await idbPut(videoKey(dId, aId), {
        blob,
        type: blob.type || "video/webm",
        createdAt: Date.now(),
      });
    } catch (e) {
      console.warn("Falha ao salvar vídeo no IDB", e);
    }
  }

  async function loadRecordedVideo(dId: string, aId: string): Promise<Blob | null> {
    try {
      const saved = await idbGet(videoKey(dId, aId));
      return saved?.blob ?? null;
    } catch (e) {
      console.warn("Falha ao ler vídeo do IDB", e);
      return null;
    }
  }

  async function clearRecordedVideo(dId: string, aId: string) {
    try {
      await idbDel(videoKey(dId, aId));
    } catch {}
  }

  function pickBestMimeType(): string | undefined {
    const recAny = MediaRecorder as any;
    const sup = recAny?.isTypeSupported?.bind(MediaRecorder);
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    for (const c of candidates) {
      if (sup?.(c)) return c;
    }
    return undefined;
  }

  function describeGUMError(err: any) {
    const n = err?.name || err?.toString?.() || "";
    if (!isSecureContext) {
      return "Para usar a câmera, acesse via HTTPS (ou localhost em desenvolvimento).";
    }
    if (n.includes("NotAllowedError") || n.includes("PermissionDeniedError")) {
      return "Permissão negada. Clique no ícone de câmera no navegador e selecione 'Permitir'.";
    }
    if (n.includes("NotFoundError") || n.includes("DevicesNotFoundError")) {
      return "Nenhuma câmera/microfone foi encontrada ou está desativada no sistema.";
    }
    if (n.includes("NotReadableError") || n.includes("TrackStartError")) {
      return "A câmera/microfone está em uso por outro aplicativo.";
    }
    if (n.includes("OverconstrainedError")) {
      return "A câmera solicitada não existe neste dispositivo.";
    }
    return "Não foi possível acessar a câmera/microfone.";
  }

  async function openMediaStream(preferBack = true): Promise<MediaStream> {
    if (!isSecureContext) {
      throw new Error("InsecureContext");
    }

    const tries: MediaStreamConstraints[] = [
      {
        video: { facingMode: preferBack ? { ideal: "environment" } : { ideal: "user" } },
        audio: true,
      },
      { video: { facingMode: { ideal: "user" } }, audio: true },
      { video: true, audio: true },
      { video: true, audio: false },
    ];

    let lastErr: any;
    for (const c of tries) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (e) {
        lastErr = e;
      }
    }

    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const hasCam = devs.some((d) => d.kind === "videoinput");
      if (!hasCam) throw new Error("Nenhuma câmera encontrada no dispositivo.");
    } catch {}
    throw lastErr;
  }

  async function habilitarCameraLive(kind: "treino" | "desafio") {
    const setErr = kind === "treino" ? setTreinoRecError : setRecError;
    const videoRef = kind === "treino" ? treinoLiveVideoRef : liveVideoRef;
    const streamRef = kind === "treino" ? treinoMediaStreamRef : mediaStreamRef;

    setErr(null);
    try {
      const stream = await openMediaStream(true);
      streamRef.current = stream;
      if (videoRef.current) {
        (videoRef.current as any).srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error(err);
      setErr(describeGUMError(err));
    }
  }

  useEffect(() => {
  let cancelled = false;

  const run = async () => {
    const params = new URLSearchParams(window.location.search);
    setMetodologiaId(params.get("metodologiaId"));
    setEstruturaId(params.get("estruturaId"));
    setMetodologiaItemId(params.get("metodologiaItemId"));
    const tId = params.get("treinoAgendadoId");
    const dId = params.get("desafioId");
    const mode = params.get("mode") as "camera" | "galeria" | null;
    const tempoSegParam = Number(params.get("tempoSeg") || 0);
    const sId = params.get("sessaoId");
    const pontosParam = Number(params.get("pontos") || 0);
    const treinoNomeParam =
      params.get(
        "treinoNome"
      );

    const atletaNomeParam =
      params.get(
        "atletaNome"
      );
    const duracaoProgramadaParam =
      Number(
        params.get(
          "duracaoProgramadaMinutos"
        ) || 0
      );
    const atletasParam = params.get("atletas");
    const mId = params.get("metodologiaId");
    const eId = params.get("estruturaId");
    const mItemId = params.get("metodologiaItemId");
    const tpId = params.get("treinoProgramadoId");

    setTreinoProgramadoId(tpId);
    setMetodologiaId(mId);
    setEstruturaId(eId);
    setMetodologiaItemId(mItemId);

    if (sId) setSessaoId(sId);
    if (Number.isFinite(pontosParam)) setAwardPontos(pontosParam);
    if (
      Number.isFinite(
        duracaoProgramadaParam
      ) &&
      duracaoProgramadaParam > 0
    ) {
      setDuracaoProgramadaMinutos(
        duracaoProgramadaParam
      );
    }
    if (
      treinoNomeParam
    ) {
      setTreinoNome(
        treinoNomeParam
      );
    }

    if (
      atletaNomeParam
    ) {
      setAtletaNome(
        atletaNomeParam
      );
    }
    if (sId) {
      try {
        const token =
          Storage.token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";

        const res = await fetch(`${API.BASE_URL}/api/sessoes-turma/${sId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!cancelled && res.ok) {
          const js = await res.json();

          const pontos = js?.treino?.pontuacao ?? js?.pontos ?? 0;
          setAwardPontos(Number(pontos) || 0);

          const lista = Array.isArray(js?.presentes)
            ? js.presentes
            : Array.isArray(js?.alunos)
              ? js.alunos.filter((a: any) => a?.presente)
              : [];

          setAwardAtletas(
            lista
              .map((a: any) => ({
                atletaId: String(a.atletaId ?? a.id ?? ""),
                nome: a.nome ?? a.usuario?.nome ?? "Atleta",
              }))
              .filter((x: any) => x.atletaId)
          );
        }
      } catch (e) {
      }
    }

    if (atletasParam) {
      try {
        const arr = JSON.parse(decodeURIComponent(atletasParam));
        if (Array.isArray(arr) && !cancelled) {
          const norm = arr
            .map((a: any) => ({
              atletaId: String(a.atletaId ?? a.id ?? ""),
              nome: a.nome ?? a.usuario?.nome ?? "Atleta",
            }))
            .filter((a: any) => a.atletaId);
          if (norm.length) setAwardAtletas(norm);
        }
      } catch {}
    }

    setTreinoAgendadoId(tId);
    setDesafioId(dId);
    setModeParam(mode);

    if (Number.isFinite(tempoSegParam) && tempoSegParam > 0) {
      setTempoSegFixado(tempoSegParam);
      setTempoTexto(secondsToMMSS(tempoSegParam));
    }

    const tipoUsuarioRaw = String(Storage.tipoUsuarioRaw || "").toLowerCase();
    const tipoId = Storage.tipoUsuarioId || null;

    if (tipoUsuarioRaw === "atleta" && tipoId) {
      setAtletaId(String(tipoId));
    } else {
      setAtletaId(null);
    }

    if (mode === "camera") {
      if (dId) habilitarCameraLive("desafio");
      if (tId || sId) {
        setTreinoMode("live");
        habilitarCameraLive("treino");
      }
    }
  };

  run();

  return () => {
    cancelled = true;

    stopStream();
    stopTreinoStream();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    if (treinoRecordedUrl) URL.revokeObjectURL(treinoRecordedUrl);
    if (preview) URL.revokeObjectURL(preview);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    if (desafioId && atletaId) {
      const n = loadAttempts(desafioId, atletaId);
      if (n !== attemptsUsed) setAttemptsUsed(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desafioId, atletaId]);

  useEffect(() => {
    if (isDesafio && desafioId && atletaId) {
      saveAttempts(desafioId, atletaId, attemptsUsed);
    }
  }, [attemptsUsed, isDesafio, desafioId, atletaId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (desafioId && atletaId) {
        const blob = await loadRecordedVideo(desafioId, atletaId);
        if (!cancelled && blob) {
          setRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setRecordedUrl(url);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [desafioId, atletaId]);

  async function startRecording() {
    setRecError(null);
    try {
      if (!("MediaRecorder" in window)) {
        setRecError(
          "Seu navegador não suporta gravação direta. Tente atualizar o navegador."
        );
        return;
      }
      if (attemptsUsed >= ATTEMPT_LIMIT) {
        setRecError("Limite de 2 tentativas atingido.");
        return;
      }

      chunksRef.current = [];
      setRecordedBlob(null);
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(null);
      }

      const stream = await openMediaStream(true);
      mediaStreamRef.current = stream;

      if (liveVideoRef.current) {
        (liveVideoRef.current as any).srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }

      const best = pickBestMimeType();
      const recorder = best
        ? new MediaRecorder(stream, { mimeType: best })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: best || undefined });
          setRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setRecordedUrl(url);
          setIsRecording(false);

          setAttemptsUsed((prev) => {
            const next = Math.min(ATTEMPT_LIMIT, prev + 1);
            if (isDesafio && desafioId && atletaId) {
              saveAttempts(desafioId, atletaId, next);
            }
            return next;
          });

          if (desafioId && atletaId) {
            await saveRecordedVideo(desafioId, atletaId, blob);
          }
        } catch {
          setRecError("Falha ao processar o vídeo gravado.");
        } finally {
          stopStream();
        }
      };

      recorder.start(1000);
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      setRecError(describeGUMError(err));
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      setIsRecording(false);
      stopStream();
    }
  }

  function stopStream() {
    const s = mediaStreamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      (liveVideoRef.current as any).srcObject = null;
    }
  }

  async function descartarETentarDeNovo() {
    if (attemptsUsed >= ATTEMPT_LIMIT) return;
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
    if (desafioId && atletaId) {
      await clearRecordedVideo(desafioId, atletaId);
    }
  }

  function handleArquivoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    handleArquivoChange(f);
  }

  const handleArquivoChange = (file: File | null) => {
    setArquivo(file);

    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }

    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  function removerArquivoSelecionado() {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setArquivo(null);
    setPreview(null);

    if (arquivoInputRef.current) {
      arquivoInputRef.current.value = "";
    }
  }

  async function startRecordingTreino() {
    setTreinoRecError(null);
    try {
      if (!("MediaRecorder" in window)) {
        setTreinoRecError(
          "Seu navegador não suporta gravação direta. Tente atualizar o navegador."
        );
        return;
      }

      treinoChunksRef.current = [];
      setTreinoRecordedBlob(null);
      if (treinoRecordedUrl) {
        URL.revokeObjectURL(treinoRecordedUrl);
        setTreinoRecordedUrl(null);
      }

      const stream = await openMediaStream(true);
      treinoMediaStreamRef.current = stream;

      if (treinoLiveVideoRef.current) {
        (treinoLiveVideoRef.current as any).srcObject = stream;
        await treinoLiveVideoRef.current.play().catch(() => {});
      }

      const best = pickBestMimeType();
      const recorder = best
        ? new MediaRecorder(stream, { mimeType: best })
        : new MediaRecorder(stream);
      treinoMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) treinoChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(treinoChunksRef.current, {
            type: best || undefined,
          });
          setTreinoRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setTreinoRecordedUrl(url);
          setTreinoIsRecording(false);
        } catch {
          setTreinoRecError("Falha ao processar o vídeo gravado.");
        } finally {
          stopTreinoStream();
        }
      };

      recorder.start(1000);
      setTreinoIsRecording(true);
    } catch (err: any) {
      console.error(err);
      setTreinoRecError(describeGUMError(err));
    }
  }

  function stopRecordingTreino() {
    const rec = treinoMediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      setTreinoIsRecording(false);
      stopTreinoStream();
    }
  }

  function stopTreinoStream() {
    const s = treinoMediaStreamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      treinoMediaStreamRef.current = null;
    }
    if (treinoLiveVideoRef.current) {
      (treinoLiveVideoRef.current as any).srcObject = null;
    }
  }

  function descartarTreinoVideo() {
    if (treinoRecordedUrl) {
      URL.revokeObjectURL(treinoRecordedUrl);
      setTreinoRecordedUrl(null);
    }
    setTreinoRecordedBlob(null);
  }

  async function concluirItemDaMetodologia(): Promise<boolean> {
    try {
      if (!metodologiaId || !estruturaId || !metodologiaItemId) return false;

      const params = new URLSearchParams(window.location.search);
      const isAvulsa =
        params.get("origemTipo") === "AVULSA" ||
        params.get("origem") === "avulsa" ||
        window.location.search.includes("origemTipo=AVULSA") ||
        window.location.search.includes("origem=avulsa");

      const base = isAvulsa
        ? `${API.BASE_URL}/api/metodologias/metodologias-avulsas/${metodologiaId}`
        : `${API.BASE_URL}/api/metodologias/${metodologiaId}`;

      const r = await fetch(
        `${base}/estruturas/${estruturaId}/concluir-item`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Storage.token || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            itemId: metodologiaItemId,
            origemTipo: isAvulsa ? "AVULSA" : "LEARNING",
          }),
        }
      );

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.warn("[metodologia] falha ao concluir item:", j);

        return false;
      }

      return Boolean(
        (j as any)?.metodologiaCompleta ??
        (j as any)?.progresso?.metodologiaCompleta
      );
    } catch (e) {
      console.warn("[metodologia] erro ao concluir item:", e);
      return false;
    }
  }

  async function atualizarCachesDoPerfil() {
    await Promise.all([
      qc.invalidateQueries({
        queryKey: ["treinosAgendados"],
      }),

      qc.invalidateQueries({
        queryKey: ["perfilResumoTreinos"],
      }),

      qc.invalidateQueries({
        queryKey: ["pontuacaoPerfil"],
      }),

      qc.invalidateQueries({
        queryKey: ["perfilAtividades"],
      }),

      qc.invalidateQueries({
        queryKey: ["conquistas-earned"],
      }),
    ]);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("treino:submetido"));
      window.dispatchEvent(new Event("perfil:refresh"));
    }
  }

  const handleEnviar = async () => {
    if (enviando) return;

    if (isSessaoTreino && awardAtletas.length === 0) {
      toast.error("Nenhum atleta presente foi encontrado para esta sessão.");
      return;
    }

    if (!isSessaoTreino && isDesafio && !atletaId && !metodologiaId) {
      toast.error("Selecione o atleta.");
      return;
    }

    setEnviando(true);

    try {
      const formData = new FormData();
      if (observacao.trim()) {
        formData.append("observacao", observacao.trim());
      }

      let url = "";

      if (isDesafio) {
        if (!desafioId) {
          toast.error("Desafio inválido.");
          return;
        }

        formData.append("desafioId", desafioId);

        if (atletaId) {
          formData.append("atletaId", atletaId);
        }

        const seg =
          tempoSegFixado != null ? tempoSegFixado : parseTempoToSeconds(tempoTexto);
        if (seg != null) formData.append("tempoSeg", String(seg));

        if (arquivo) {
          formData.append("arquivo", arquivo);
        }
        url = `${API.BASE_URL}/api/submissoes/desafio`;
      } else if (isTreino) {
        if (arquivo) {
          formData.append(
            "arquivo",
            arquivo
          );
        }

        const seg =
          tempoSegFixado != null ? tempoSegFixado : parseTempoToSeconds(tempoTexto);
        if (seg != null) formData.append("tempoSeg", String(seg));
        if (reps) formData.append("repeticoes", reps);

        if (isSessaoTreino) {
          formData.append(
            "sessaoId",
            sessaoId!
          );

          formData.append(
            "atletas",
            JSON.stringify(
              awardAtletas
            )
          );
          url = `${API.BASE_URL}/api/submissoes/treino/sessao`;
        } else {
          if (!treinoAgendadoId) {
            toast.error("Treino agendado inválido.");
            return;
          }

          formData.append("treinoAgendadoId", treinoAgendadoId);
          if (metodologiaId) formData.append("metodologiaId", metodologiaId);
          if (estruturaId) formData.append("estruturaId", estruturaId);
          if (metodologiaItemId) formData.append("metodologiaItemId", metodologiaItemId);

          const search = new URLSearchParams(window.location.search);
          const isAvulsa =
            search.get("origemTipo") === "AVULSA" ||
            search.get("origem") === "avulsa" ||
            window.location.search.includes("origemTipo=AVULSA") ||
            window.location.search.includes("origem=avulsa");

          if (isAvulsa) {
            formData.append("origemTipo", "AVULSA");
          }

          url = `${API.BASE_URL}/api/submissoes/treino`;
        }
      } else {
        toast.error("Nada para enviar.");
        return;
      }

      if (metodologiaId && estruturaId && metodologiaItemId && isDesafio) {
        const metodologiaFormData = new FormData();
        metodologiaFormData.append("observacao", observacao);
        metodologiaFormData.append("desafioId", desafioId!);
        metodologiaFormData.append("itemId", metodologiaItemId);

        if (atletaId) {
          metodologiaFormData.append("atletaId", atletaId);
        }

        const seg =
          tempoSegFixado != null ? tempoSegFixado : parseTempoToSeconds(tempoTexto);
        if (seg != null) metodologiaFormData.append("tempoSeg", String(seg));

        if (arquivo) {
          metodologiaFormData.append("file", arquivo);
        }

        const search = new URLSearchParams(window.location.search);
        const fromAdmin = search.get("from") === "admin";
        const isAvulsa =
          search.get("origemTipo") === "AVULSA" ||
          search.get("origem") === "avulsa" ||
          window.location.search.includes("origemTipo=AVULSA") ||
          window.location.search.includes("origem=avulsa");

        const metodologiaBase = isAvulsa
          ? `${API.BASE_URL}/api/metodologias/metodologias-avulsas/${metodologiaId}`
          : `${API.BASE_URL}/api/metodologias/${metodologiaId}`;

        const metodologiaRes = await fetch(
          `${metodologiaBase}/estruturas/${estruturaId}/submissoes`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Storage.token || ""}`,
            },
            body: metodologiaFormData,
          }
        );

        const metodologiaJson = await metodologiaRes.json().catch(() => ({}));

        if (!metodologiaRes.ok) {
          throw new Error(
            metodologiaJson?.message || "Erro ao enviar submissão da metodologia"
          );
        }

        if (fromAdmin) {
          if (isAvulsa) {
            navigate(`/learning/${metodologiaId}?from=admin&origem=avulsa`);
          } else {
            navigate(`/learning/${metodologiaId}?from=admin`);
          }
          return;
        }

        if (isAvulsa) {
          navigate(`/learning/${metodologiaId}?origem=avulsa`);
        } else {
          navigate(`/learning/${metodologiaId}`);
        }
        return;
      }

      const res = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${Storage.token || ""}`,
        },
      });

      const js = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (js as any)?.error ||
            (js as any)?.erro ||
            (js as any)?.message ||
            "Erro ao enviar submissão."
        );
      }

      if (
        isTreino &&
        Number.isFinite(
          Number(
            (js as any)
              ?.pontosCreditados
          )
        )
      ) {
        const creditados =
          Number(
            (js as any)
              .pontosCreditados
          );

        const base =
          Number(
            (js as any)
              ?.pontosBase ?? 0
          );

        const tevePenalidade =
          (js as any)
            ?.penalidadeAtraso ===
          true;

        if (tevePenalidade) {
          toast.success(
            `Treino concluído! Você recebeu ${creditados} ${
              creditados === 1
                ? "ponto"
                : "pontos"
            } de ${base} possíveis por causa do tempo de conclusão.`
          );
        } else {
          toast.success(
            `Treino concluído! Você recebeu ${creditados} ${
              creditados === 1
                ? "ponto"
                : "pontos"
            }.`
          );
        }
      }

      let metodologiaCompleta = false;
      if (metodologiaId && estruturaId && metodologiaItemId) {
        metodologiaCompleta = await concluirItemDaMetodologia();
      }

      await atualizarCachesDoPerfil();

      if (metodologiaCompleta && metodologiaId) {
        const qsAvaliar = new URLSearchParams();
        const search = new URLSearchParams(window.location.search);
        const fromAdmin = search.get("from") === "admin";
        const isAvulsa =
          search.get("origemTipo") === "AVULSA" ||
          search.get("origem") === "avulsa" ||
          window.location.search.includes("origemTipo=AVULSA") ||
          window.location.search.includes("origem=avulsa");

        qsAvaliar.set("metodologiaId", metodologiaId);
        if (isAvulsa) qsAvaliar.set("origem", "avulsa");
        if (fromAdmin) qsAvaliar.set("from", "admin");

        navigate(`/learning/avaliar?${qsAvaliar.toString()}`);
        return;
      }

      const search = new URLSearchParams(window.location.search);
      const fromAdmin = search.get("from") === "admin";
      const isAvulsa =
        search.get("origemTipo") === "AVULSA" ||
        search.get("origem") === "avulsa" ||
        window.location.search.includes("origemTipo=AVULSA") ||
        window.location.search.includes("origem=avulsa");

      if (metodologiaId) {
        if (fromAdmin) {
          if (isAvulsa) {
            navigate(`/learning/${metodologiaId}?from=admin&origem=avulsa`);
          } else {
            navigate(`/learning/${metodologiaId}?from=admin`);
          }
          return;
        }

        if (isAvulsa) {
          navigate(`/learning/${metodologiaId}?origem=avulsa`);
        } else {
          navigate(`/learning/${metodologiaId}`);
        }
        return;
      }

      const submissaoId =
        String(
          (js as any)?.submissao?.id ??
            (js as any)?.id ??
            (js as any)?.submissaoTreinoId ??
            ""
        ) || "";

      if (!treinoAgendadoId) {
        navigate("/treinos");
        return;
      }

      navigate(
        `/treinos/avaliar?treinoAgendadoId=${encodeURIComponent(
          treinoAgendadoId
        )}&submissaoTreinoId=${encodeURIComponent(submissaoId)}`
      );
    } catch (err: any) {
      console.error("Erro no envio:", err);
      toast.error(err?.message || "Erro de conexão ao enviar submissão.");
    } finally {
      setEnviando(false);
    }
  };

  const tempoBloqueado = isTreino && tempoSegFixado != null;
  const tempoAtualSeg =
    tempoSegFixado != null
      ? tempoSegFixado
      : parseTempoToSeconds(
          tempoTexto
        );

  /*
  * Mesma conversão usada
  * atualmente pelo backend.
  */
  const minutosReaisPreview =
    tempoAtualSeg != null
      ? Math.max(
          1,
          Math.floor(
            tempoAtualSeg / 60
          )
        )
      : null;

  /*
  * A regra atual do backend
  * só aplica penalidade quando
  * ultrapassa:
  *
  * duração programada + 5 minutos
  */
  const penalidadePrevista =
    duracaoProgramadaMinutos !=
      null &&
    minutosReaisPreview != null &&
    minutosReaisPreview >
      duracaoProgramadaMinutos +
        5;

  const pontosPrevistos =
    penalidadePrevista
      ? Math.floor(
          awardPontos / 2
        )
      : awardPontos;

  return (
    <div className="min-h-screen bg-transparent pb-24 px-4 pt-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-green-800 text-center">
          {isDesafio ? "Enviar Submissão do Desafio" : "Enviar Submissão"}
        </h1>

        {isSessaoTreino && (
          <div className="mb-4 bg-green-50 border border-green-200 p-3 rounded">
            <div className="text-sm text-green-900 font-semibold">
              Finalizaram o treino e receberam <span className="font-bold">{awardPontos}</span> pontos:
            </div>
            <div className="text-sm text-green-900 mt-1">
              {awardAtletas.length ? awardAtletas.map(a => a.nome).join(", ") : "Atletas selecionados"}
            </div>
          </div>
        )}

        {isTreino &&
          !isSessaoTreino && (
            <div
              className="
                mb-5
                rounded-xl
                border
                border-green-200
                bg-green-50
                p-4
              "
            >
              <div className="text-sm font-semibold text-green-900 mb-3">
                Resumo do treino
              </div>

              <div className="space-y-1.5 text-sm text-green-950">
                <p>
                  <span className="font-semibold">
                    Atleta:
                  </span>{" "}
                  {atletaNome ||
                    "Atleta"}
                </p>

                <p>
                  <span className="font-semibold">
                    Treino:
                  </span>{" "}
                  {treinoNome ||
                    "Treino"}
                </p>

                <p>
                  <span className="font-semibold">
                    Pontuação base:
                  </span>{" "}
                  <span className="font-bold text-green-700">
                    {awardPontos}{" "}
                    {awardPontos === 1
                      ? "ponto"
                      : "pontos"}
                  </span>
                </p>

                {duracaoProgramadaMinutos !=
                  null && (
                  <p>
                    <span className="font-semibold">
                      Tempo previsto:
                    </span>{" "}
                    {duracaoProgramadaMinutos}{" "}
                    {duracaoProgramadaMinutos ===
                    1
                      ? "minuto"
                      : "minutos"}
                  </p>
                )}

                {tempoAtualSeg != null && (
                  <p>
                    <span className="font-semibold">
                      Tempo realizado:
                    </span>{" "}
                    {secondsToMMSS(
                      tempoAtualSeg
                    )}
                  </p>
                )}

                <p>
                  <span className="font-semibold">
                    Pontuação prevista:
                  </span>{" "}
                  <span
                    className={`font-bold ${
                      penalidadePrevista
                        ? "text-red-600"
                        : "text-green-700"
                    }`}
                  >
                    {pontosPrevistos}{" "}
                    {pontosPrevistos === 1
                      ? "ponto"
                      : "pontos"}
                  </span>
                </p>
              </div>

              {awardPontos > 0 && (
                <>
                  {penalidadePrevista ? (
                    <div
                      className="
                        mt-3
                        rounded-lg
                        bg-red-50
                        border
                        border-red-200
                        px-3
                        py-3
                        text-sm
                        text-red-900
                      "
                    >
                      <p className="font-semibold">
                        Pontuação ajustada pelo tempo
                      </p>

                      <p className="mt-1">
                        O tempo de conclusão ultrapassou
                        o limite permitido para a
                        pontuação integral.
                      </p>

                      <p className="mt-2">
                        Você receberá aproximadamente{" "}
                        <strong>
                          {pontosPrevistos}{" "}
                          {pontosPrevistos === 1
                            ? "ponto"
                            : "pontos"}
                        </strong>
                        , em vez de{" "}
                        <strong>
                          {awardPontos}
                        </strong>
                        .
                      </p>
                    </div>
                  ) : (
                    <div
                      className="
                        mt-3
                        rounded-lg
                        bg-white
                        border
                        border-green-200
                        px-3
                        py-2
                        text-sm
                        text-green-900
                      "
                    >
                      <p>
                        Este treino vale até{" "}
                        <strong>
                          {awardPontos}{" "}
                          {awardPontos === 1
                            ? "ponto"
                            : "pontos"}
                        </strong>
                        .
                      </p>

                      {duracaoProgramadaMinutos != null && (
                        <p className="mt-1 text-xs text-green-800/70">
                          A pontuação integral é mantida
                          até 5 minutos além do tempo
                          programado.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        {isTreino && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Tempo (mm:ss ou segundos)
                </label>
                <input
                  type="text"
                  value={tempoTexto}
                  onChange={(e) =>
                    tempoBloqueado ? undefined : setTempoTexto(e.target.value)
                  }
                  className={`w-full border p-2 rounded ${
                    tempoBloqueado ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                  placeholder="ex: 01:30 ou 90"
                  disabled={tempoBloqueado}
                  readOnly={tempoBloqueado}
                />
                {tempoBloqueado && (
                  <p className="mt-1 text-xs text-gray-500">
                    Tempo preenchido automaticamente pelo cronômetro do treino.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              {treinoMode === "upload" ? (
                <>
                  <label className="block text-sm font-medium mb-1">
                    Enviar Vídeo, PDF, ou Foto (opcional)
                  </label>
                  <input
                    ref={arquivoInputRef}
                    type="file"
                    name="arquivo"
                    data-testid="submissao-file"
                    accept="video/*,image/*,application/pdf,.pdf"
                    onChange={handleArquivoInput}
                  />

                  {preview && arquivo && (
                    <div className="mt-4">
                      {isImageFile(arquivo) ? (
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full h-auto rounded border object-contain"
                        />
                      ) : isVideoFile(arquivo) ? (
                        <video controls className="w-full rounded border">
                          <source src={preview} type={arquivo.type} />
                          Seu navegador não suporta visualização de vídeo.
                        </video>
                      ) : isPdfFile(arquivo) ? (
                        <iframe
                          src={preview}
                          className="w-full h-[420px] rounded border"
                          title="Preview PDF"
                        />
                      ) : (
                        <div className="p-3 border rounded bg-gray-50 text-sm text-gray-700">
                          Arquivo selecionado: <strong>{arquivo.name}</strong>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={removerArquivoSelecionado}
                        className="mt-3 rounded-md border border-red-500 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remover arquivo selecionado
                      </button>
                    </div>
                    
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">
                      Gravação ao vivo de treino (tentativas ilimitadas)
                    </span>
                    {treinoRecError && (
                      <span className="text-xs text-red-600">
                        {treinoRecError}
                      </span>
                    )}
                  </div>

                  <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border mb-3">
                    {!treinoRecordedUrl ? (
                      <video
                        ref={treinoLiveVideoRef}
                        className="w-full h-full object-contain"
                        muted
                        playsInline
                      />
                    ) : (
                      <video
                        className="w-full h-full object-contain"
                        controls
                        src={treinoRecordedUrl}
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {!treinoIsRecording && !treinoRecordedUrl && (
                      <>
                        <button
                          onClick={() => habilitarCameraLive("treino")}
                          className="px-4 py-2 rounded font-semibold border border-gray-300 hover:bg-gray-50"
                        >
                          Habilitar câmera
                        </button>
                        <button
                          onClick={startRecordingTreino}
                          className="px-4 py-2 rounded font-semibold text-white bg-green-700 hover:bg-green-600"
                        >
                          Começar a gravar
                        </button>
                      </>
                    )}

                    {treinoIsRecording && (
                      <button
                        onClick={stopRecordingTreino}
                        className="px-4 py-2 rounded font-semibold text-white bg-red-700 hover:bg-red-600"
                      >
                        Parar & Revisar
                      </button>
                    )}

                    {!treinoIsRecording && treinoRecordedUrl && (
                      <button
                        onClick={descartarTreinoVideo}
                        className="px-4 py-2 rounded font-semibold text-green-800 border border-green-800 hover:bg-green-50"
                      >
                        Refazer
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    • Você pode refazer quantas vezes quiser antes de enviar.{" "}
                    <br />
                    • O vídeo será enviado como parte da submissão do treino.
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {isDesafio && (
          <div className="mt-6">
            <label className="block text-sm font-medium mb-1">
              Enviar vídeo, foto ou PDF (opcional)
            </label>

            <input
              ref={arquivoInputRef}
              type="file"
              name="arquivo"
              data-testid="submissao-file"
              accept="video/*,image/*,application/pdf,.pdf"
              onChange={handleArquivoInput}
              className="block w-full"
            />

            {preview && arquivo && (
              <div className="mt-4">
                {isImageFile(arquivo) ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-auto rounded border object-contain"
                  />
                ) : isVideoFile(arquivo) ? (
                  <video controls className="w-full rounded border">
                    <source src={preview} type={arquivo.type} />
                    Seu navegador não suporta visualização de vídeo.
                  </video>
                ) : isPdfFile(arquivo) ? (
                  <iframe
                    src={preview}
                    className="w-full h-[420px] rounded border"
                    title="Preview PDF"
                  />
                ) : (
                  <div className="p-3 border rounded bg-gray-50 text-sm text-gray-700">
                    Arquivo selecionado: <strong>{arquivo.name}</strong>
                  </div>
                )}
                <button
                  type="button"
                  onClick={removerArquivoSelecionado}
                  className="mt-3 rounded-md border border-red-500 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Remover arquivo selecionado
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              • Envie um vídeo, foto ou PDF como comprovação do desafio.
              <br />
              • Confira o preview antes de enviar a submissão.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={enviando}
          onClick={handleEnviar}
          className={`w-full rounded-md py-3 font-bold text-white mt-4 ${
            enviando
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-700 hover:bg-green-800"
          }`}
        >
          {enviando ? "Enviando..." : "Enviar Submissão"}
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          <House />
        </Link>
        <Link href="/explorar" className="hover:underline">
          <Search />
        </Link>
        <Link href="/post" className="hover:underline">
          <CirclePlus />
        </Link>
        <Link href="/treinos" className="hover:underline">
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:underline">
          <User />
        </Link>
      </nav>
    </div>
  );
}
