import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export default function PaginaSubmissao() {
  // ====== Persistência: tentativas (DESAFIO) ======
  const ATTEMPT_LIMIT = 2;
  const STORAGE_KEY_PREFIX = "footera:desafioAttempts";

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

  const attemptKey = (desafioId: string, atletaId: string) =>
    `${STORAGE_KEY_PREFIX}:${desafioId}:${atletaId}`;

  const loadAttempts = (desafioId: string, atletaId: string): number => {
    const raw = dualStorage.getItem(attemptKey(desafioId, atletaId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.min(ATTEMPT_LIMIT, Math.max(0, n)) : 0;
  };

  const saveAttempts = (desafioId: string, atletaId: string, n: number) => {
    dualStorage.setItem(attemptKey(desafioId, atletaId), String(Math.min(ATTEMPT_LIMIT, Math.max(0, n))));
  };

  // ====== Persistência: VÍDEO de DESAFIO (IndexedDB) ======
  const IDB_NAME = "footera-media";
  const IDB_STORE = "desafio-videos";
  const IDB_VERSION = 1;

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

  const videoKey = (desafioId: string, atletaId: string) => `desafioVideo:${desafioId}:${atletaId}`;

  async function saveRecordedVideo(desafioId: string, atletaId: string, blob: Blob) {
    try {
      await idbPut(videoKey(desafioId, atletaId), { blob, type: blob.type || "video/webm", createdAt: Date.now() });
    } catch (e) {
      console.warn("Falha ao salvar vídeo no IDB", e);
    }
  }

  async function loadRecordedVideo(desafioId: string, atletaId: string): Promise<Blob | null> {
    try {
      const saved = await idbGet(videoKey(desafioId, atletaId));
      return saved?.blob ?? null;
    } catch (e) {
      console.warn("Falha ao ler vídeo do IDB", e);
      return null;
    }
  }

  async function clearRecordedVideo(desafioId: string, atletaId: string) {
    try {
      await idbDel(videoKey(desafioId, atletaId));
    } catch {}
  }

  // ====== Estados comuns ======
  const [observacao, setObservacao] = useState("");
  const [treinoAgendadoId, setTreinoAgendadoId] = useState<string | null>(null);
  const [desafioId, setDesafioId] = useState<string | null>(null);
  const [atletaId, setAtletaId] = useState<string | null>(null);
  const [tempoTexto, setTempoTexto] = useState("");
  const [reps, setReps] = useState<string>("");

  // UPLOAD de treino
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Gravação ao vivo (DESAFIO)
  const [isRecording, setIsRecording] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  // ====== NOVO: Gravação ao vivo (TREINO, sem limite) ======
  const [treinoMode, setTreinoMode] = useState<"upload" | "live">("upload");
  const [treinoIsRecording, setTreinoIsRecording] = useState(false);
  const [treinoRecordedBlob, setTreinoRecordedBlob] = useState<Blob | null>(null);
  const [treinoRecordedUrl, setTreinoRecordedUrl] = useState<string | null>(null);
  const [treinoRecError, setTreinoRecError] = useState<string | null>(null);
  const treinoMediaStreamRef = useRef<MediaStream | null>(null);
  const treinoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const treinoChunksRef = useRef<BlobPart[]>([]);
  const treinoLiveVideoRef = useRef<HTMLVideoElement | null>(null);

  const [location] = useLocation();

  const isDesafio = Boolean(desafioId);
  const isTreino = Boolean(treinoAgendadoId);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const treinoId = params.get("treinoAgendadoId");
    const desafioParam = params.get("desafioId");

    if (treinoId) setTreinoAgendadoId(treinoId);
    if (desafioParam) setDesafioId(desafioParam);

    const tipoId = (Storage as any)?.tipoUsuarioId ?? (Storage as any)?.tipoUserId ?? null;
    if (tipoId) setAtletaId(String(tipoId));

    return () => {
      stopStream();
      stopTreinoStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (treinoRecordedUrl) URL.revokeObjectURL(treinoRecordedUrl);
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Carrega tentativas salvas (DESAFIO)
  useEffect(() => {
    if (desafioId && atletaId) {
      const n = loadAttempts(desafioId, atletaId);
      if (n !== attemptsUsed) setAttemptsUsed(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desafioId, atletaId]);

  // Persiste tentativas (DESAFIO)
  useEffect(() => {
    if (isDesafio && desafioId && atletaId) {
      saveAttempts(desafioId, atletaId, attemptsUsed);
    }
  }, [attemptsUsed, isDesafio, desafioId, atletaId]);

  // Carregar VÍDEO salvo (DESAFIO)
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
    return () => { cancelled = true; };
  }, [desafioId, atletaId]);

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

  // ====== DESAFIO: gravação ======
  async function startRecording() {
    setRecError(null);
    try {
      if (!("MediaRecorder" in window)) {
        setRecError("Seu navegador não suporta gravação direta. Tente atualizar o navegador.");
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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: true,
      });
      mediaStreamRef.current = stream;

      if (liveVideoRef.current) {
        (liveVideoRef.current as any).srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }

      const mimeType =
        (MediaRecorder as any).isTypeSupported?.("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : (MediaRecorder as any).isTypeSupported?.("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
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
      setRecError("Não foi possível acessar a câmera/microfone.");
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

  // ====== TREINO: gravação (sem limite) ======
  async function startRecordingTreino() {
    setTreinoRecError(null);
    try {
      if (!("MediaRecorder" in window)) {
        setTreinoRecError("Seu navegador não suporta gravação direta. Tente atualizar o navegador.");
        return;
      }

      treinoChunksRef.current = [];
      setTreinoRecordedBlob(null);
      if (treinoRecordedUrl) {
        URL.revokeObjectURL(treinoRecordedUrl);
        setTreinoRecordedUrl(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: true,
      });
      treinoMediaStreamRef.current = stream;

      if (treinoLiveVideoRef.current) {
        (treinoLiveVideoRef.current as any).srcObject = stream;
        await treinoLiveVideoRef.current.play().catch(() => {});
      }

      const mimeType =
        (MediaRecorder as any).isTypeSupported?.("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : (MediaRecorder as any).isTypeSupported?.("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      treinoMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) treinoChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(treinoChunksRef.current, { type: mimeType });
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
      setTreinoRecError("Não foi possível acessar a câmera/microfone.");
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

  // ====== Envio ======
  const handleEnviar = async () => {
    if (!atletaId || (!treinoAgendadoId && !desafioId)) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const formData = new FormData();
    formData.append("observacao", observacao);
    formData.append("atletaId", atletaId);

    let url = "";

    if (isTreino) {
      // Aceitar upload OU gravação ao vivo (sem limite)
      if (treinoMode === "live") {
        if (!treinoRecordedBlob) {
          alert("Grave um vídeo do treino antes de enviar.");
          return;
        }
        formData.append("arquivo", treinoRecordedBlob, `treino-${treinoAgendadoId ?? "livre"}-${Date.now()}.webm`);
      } else {
        if (!arquivo) {
          alert("Selecione uma imagem ou vídeo do treino.");
          return;
        }
        formData.append("arquivo", arquivo);
      }

      formData.append("treinoAgendadoId", treinoAgendadoId!);

      const tempoSeg = parseTempoToSeconds(tempoTexto);
      if (tempoSeg != null) formData.append("tempoSeg", String(tempoSeg));
      if (reps) formData.append("repeticoes", String(Number(reps)));

      url = `${API.BASE_URL}/api/submissoes/treino`;
    } else if (isDesafio) {
      if (!recordedBlob) {
        alert("Grave sua execução do desafio antes de enviar.");
        return;
      }
      const filename = `desafio-${desafioId}-tentativa${Math.max(1, attemptsUsed)}.webm`;
      formData.append("arquivo", recordedBlob, filename);
      formData.append("desafioId", desafioId!);
      formData.append("repeticoes", String(Math.max(1, Math.min(ATTEMPT_LIMIT, attemptsUsed))));
      url = `${API.BASE_URL}/api/submissoes/desafio`;
    } else {
      alert("Defina se é treino ou desafio.");
      return;
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${Storage.token || ""}` },
      });

      const js = await res.json().catch(() => ({}));

      if (res.ok) {
        const msg = js?.autoAprovado
          ? "Submissão enviada e aprovada automaticamente (sem pontuação por ausência de vínculo)."
          : js?.mensagem || "Submissão enviada com sucesso! Aguarde validação.";
        alert(msg);

        if (isTreino) {
          // reset upload
          setArquivo(null);
          if (preview) {
            URL.revokeObjectURL(preview);
            setPreview(null);
          }
          // reset live
          if (treinoRecordedUrl) URL.revokeObjectURL(treinoRecordedUrl);
          setTreinoRecordedUrl(null);
          setTreinoRecordedBlob(null);
          setTreinoIsRecording(false);
          stopTreinoStream();

          setTempoTexto("");
          setReps("");
        }
        if (isDesafio) {
          if (recordedUrl) URL.revokeObjectURL(recordedUrl);
          setRecordedUrl(null);
          setRecordedBlob(null);
          setIsRecording(false);
          stopStream();
          if (desafioId && atletaId) {
            await clearRecordedVideo(desafioId, atletaId);
          }
          // setAttemptsUsed(ATTEMPT_LIMIT); // se quiser travar após enviar
        }

        setObservacao("");
      } else {
        console.error("Erro:", js);
        alert(js?.erro || "Erro ao enviar submissão.");
      }
    } catch (err) {
      console.error("Erro no envio:", err);
      alert("Erro de conexão ao enviar submissão.");
    }
  };

  // ====== UI ======
  return (
    <div className="min-h-screen bg-yellow-transparent pb-24 px-4 pt-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-green-800 text-center">
          {isDesafio ? "Desafio (Submissão ao Vivo)" : "Enviar Submissão"}
        </h1>

        <label className="block text-sm font-medium mb-1 text-gray-700">Comentário</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="w-full border p-3 mb-4 rounded-md shadow-sm"
          rows={4}
          placeholder={isDesafio ? "Comente sua execução do desafio..." : "Comente seu treino..."}
        />

        {isTreino && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Tempo (mm:ss ou segundos)</label>
                <input
                  type="text"
                  value={tempoTexto}
                  onChange={(e) => setTempoTexto(e.target.value)}
                  className="w-full border p-2 rounded"
                  placeholder="ex: 01:30 ou 90"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Repetições</label>
                <input
                  type="number"
                  min={0}
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  className="w-full border p-2 rounded"
                  placeholder="ex: 25"
                />
              </div>
            </div>

            {/* Toggle Upload x Ao vivo */}
            <div className="mt-6">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setTreinoMode("upload")}
                  className={`px-3 py-2 rounded border ${treinoMode === "upload" ? "bg-green-100 border-green-600 text-green-800" : "bg-white border-gray-300"}`}
                >
                  Upload
                </button>
                <button
                  onClick={() => setTreinoMode("live")}
                  className={`px-3 py-2 rounded border ${treinoMode === "live" ? "bg-green-100 border-green-600 text-green-800" : "bg-white border-gray-300"}`}
                >
                  Gravar ao vivo (sem limite)
                </button>
              </div>

              {treinoMode === "upload" ? (
                <>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Imagem ou Vídeo</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleArquivoChange(e.target.files?.[0] || null)}
                    className="mb-4"
                  />

                  {preview && (
                    <div className="mb-4">
                      {arquivo?.type?.startsWith("image") ? (
                        <img src={preview} alt="Preview" className="w-full h-auto rounded border object-contain" />
                      ) : (
                        <video controls className="w-full rounded border">
                          <source src={preview} type={arquivo?.type} />
                          Seu navegador não suporta visualização de vídeo.
                        </video>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">Gravação ao vivo de treino (tentativas ilimitadas)</span>
                    {treinoRecError && <span className="text-xs text-red-600">{treinoRecError}</span>}
                  </div>

                  <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border mb-3">
                    {!treinoRecordedUrl ? (
                      <video ref={treinoLiveVideoRef} className="w-full h-full object-contain" muted playsInline />
                    ) : (
                      <video className="w-full h-full object-contain" controls src={treinoRecordedUrl} />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {!treinoIsRecording && !treinoRecordedUrl && (
                      <button
                        onClick={startRecordingTreino}
                        className="px-4 py-2 rounded font-semibold text-white bg-green-700 hover:bg-green-600"
                      >
                        Começar a gravar
                      </button>
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
                    • Você pode refazer quantas vezes quiser antes de enviar. <br />
                    • O vídeo será enviado como parte da submissão do treino.
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {isDesafio && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">
                Tentativas usadas: <strong>{attemptsUsed}/{ATTEMPT_LIMIT}</strong>
              </span>
              {recError && <span className="text-xs text-red-600">{recError}</span>}
            </div>

            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border mb-3">
              {recordedUrl && (
                <span className="pointer-events-none absolute top-2 left-2 z-10 text-xs font-semibold px-2 py-1 rounded-full text-white bg-green-700 shadow">
                  {attemptsUsed <= 1 ? "1ª tentativa" : "2ª tentativa"}
                </span>
              )}

              {!recordedUrl ? (
                <video ref={liveVideoRef} className="w-full h-full object-contain" muted playsInline />
              ) : (
                <video className="w-full h-full object-contain" controls src={recordedUrl} />
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {!isRecording && !recordedUrl && (
                <button
                  onClick={startRecording}
                  disabled={attemptsUsed >= ATTEMPT_LIMIT}
                  className={`px-4 py-2 rounded font-semibold text-white ${
                    attemptsUsed >= ATTEMPT_LIMIT ? "bg-gray-400" : "bg-green-700 hover:bg-green-600"
                  }`}
                >
                  Começar a gravar
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 rounded font-semibold text-white bg-red-700 hover:bg-red-600"
                >
                  Parar & Revisar
                </button>
              )}

              {!isRecording && recordedUrl && attemptsUsed < ATTEMPT_LIMIT && (
                <button
                  onClick={descartarETentarDeNovo}
                  className="px-4 py-2 rounded font-semibold text-green-800 border border-green-800 hover:bg-green-50"
                >
                  Refazer (2ª tentativa)
                </button>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              • O desafio é gravado ao vivo pelo app. Sem upload de arquivos. <br />
              • Máximo de <strong>{ATTEMPT_LIMIT} tentativas</strong>. Enviaremos em <em>repetições</em> o número de tentativas usadas.
            </p>
          </div>
        )}

        <button
          onClick={handleEnviar}
          className="w-full mt-6 bg-green-800 hover:bg-green-700 text-white py-2 rounded font-semibold"
          disabled={isDesafio && !recordedBlob}
        >
          Enviar Submissão
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
