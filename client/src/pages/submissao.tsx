// client/src/pages/submissao.tsx
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export default function PaginaSubmissao() {
  // comuns
  const [observacao, setObservacao] = useState("");
  const [treinoAgendadoId, setTreinoAgendadoId] = useState<string | null>(null);
  const [desafioId, setDesafioId] = useState<string | null>(null);
  const [atletaId, setAtletaId] = useState<string | null>(null);

  // apenas para treino
  const [tempoTexto, setTempoTexto] = useState("");
  const [reps, setReps] = useState<string>("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // gravação ao vivo (apenas para desafio)
  const [isRecording, setIsRecording] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0); // incrementa ao concluir cada gravação
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

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

    const tipoId = Storage.tipoUsuarioId;
    if (tipoId) setAtletaId(tipoId);

    return () => {
      stopStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ====== UPLOAD (TREINO) ======
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

  // ====== GRAVAÇÃO (DESAFIO) ======
  async function startRecording() {
    setRecError(null);
    try {
      if (!("MediaRecorder" in window)) {
        setRecError("Seu navegador não suporta gravação direta. Tente atualizar o navegador.");
        return;
      }
      if (attemptsUsed >= 2) {
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
        // @ts-expect-error srcObject é suportado em runtime
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }

      const mimeType =
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setRecordedBlob(blob);
          const url = URL.createObjectURL(blob);
          setRecordedUrl(url);
          setIsRecording(false);
          setAttemptsUsed((n) => Math.min(2, n + 1));
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
      // @ts-expect-error limpar srcObject
      liveVideoRef.current.srcObject = null;
    }
  }

  function descartarETentarDeNovo() {
    if (attemptsUsed >= 2) return;
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
  }

  // ====== ENVIAR ======
  const handleEnviar = async () => {
    if (!atletaId || (!treinoAgendadoId && !desafioId)) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const formData = new FormData();
    formData.append("observacao", observacao); // "Comentário" no UI
    formData.append("atletaId", atletaId);

    let url = "";

    if (isTreino) {
      if (!arquivo) {
        alert("Selecione uma imagem ou vídeo do treino.");
        return;
      }
      formData.append("arquivo", arquivo);
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
      // "repeticoes" = número de tentativas usadas (1 ou 2)
      formData.append("repeticoes", String(Math.max(1, Math.min(2, attemptsUsed))));

      url = `${API.BASE_URL}/api/submissoes/desafio`;
    } else {
      alert("Defina se é treino ou desafio.");
      return;
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${Storage.token || ""}`,
        },
      });

      const js = await res.json().catch(() => ({}));

      if (res.ok) {
        const msg = js?.autoAprovado
          ? "Submissão enviada e aprovada automaticamente (sem pontuação por ausência de vínculo)."
          : js?.mensagem || "Submissão enviada com sucesso! Aguarde validação.";
        alert(msg);

        if (isTreino) {
          setArquivo(null);
          if (preview) {
            URL.revokeObjectURL(preview);
            setPreview(null);
          }
          setTempoTexto("");
          setReps("");
        }
        if (isDesafio) {
          if (recordedUrl) URL.revokeObjectURL(recordedUrl);
          setRecordedUrl(null);
          setRecordedBlob(null);
          setIsRecording(false);
          stopStream();
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

  return (
    <div className="min-h-screen bg-yellow-transparent pb-24 px-4 pt-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-green-800 text-center">
          {isDesafio ? "Desafio (Submissão ao Vivo)" : "Enviar Submissão"}
        </h1>

        {/* COMENTÁRIO (comum) */}
        <label className="block text-sm font-medium mb-1 text-gray-700">Comentário</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="w-full border p-3 mb-4 rounded-md shadow-sm"
          rows={4}
          placeholder={isDesafio ? "Comente sua execução do desafio..." : "Comente seu treino..."}
        />

        {/* Campos extras apenas para TREINO */}
        {isTreino && (
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
        )}

        {/* BLOCO DE TREINO (UPLOAD) */}
        {isTreino && (
          <div className="mt-6">
            <label className="block text-sm font-medium mb-1 text-gray-700">Imagem ou Vídeo</label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => handleArquivoChange(e.target.files?.[0] || null)}
              className="mb-4"
            />

            {preview && (
              <div className="mb-4">
                {arquivo?.type.startsWith("image") ? (
                  <img src={preview} alt="Preview" className="w-full h-auto rounded border object-contain" />
                ) : (
                  <video controls className="w-full rounded border">
                    <source src={preview} type={arquivo?.type} />
                    Seu navegador não suporta visualização de vídeo.
                  </video>
                )}
              </div>
            )}
          </div>
        )}

        {/* BLOCO DE DESAFIO (GRAVAÇÃO AO VIVO) */}
        {isDesafio && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">
                Tentativas usadas: <strong>{attemptsUsed}/2</strong>
              </span>
              {recError && <span className="text-xs text-red-600">{recError}</span>}
            </div>

            {/* Player com badge da tentativa */}
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border mb-3">
              {/* Badge visível somente após gravar */}
              {recordedUrl && (
                <span className="pointer-events-none absolute top-2 left-2 z-10 text-xs font-semibold px-2 py-1 rounded-full text-white bg-green-700 shadow">
                  {attemptsUsed <= 1 ? "1ª tentativa" : "2ª tentativa"}
                </span>
              )}

              {/* Ao gravar, mostra o vídeo ao vivo; depois, o gravado para revisão */}
              {!recordedUrl ? (
                <video ref={liveVideoRef} className="w-full h-full object-contain" muted playsInline />
              ) : (
                <video className="w-full h-full object-contain" controls src={recordedUrl} />
              )}
            </div>

            {/* Controles de gravação */}
            <div className="flex flex-wrap gap-3">
              {!isRecording && !recordedUrl && (
                <button
                  onClick={startRecording}
                  disabled={attemptsUsed >= 2}
                  className={`px-4 py-2 rounded font-semibold text-white ${
                    attemptsUsed >= 2 ? "bg-gray-400" : "bg-green-700 hover:bg-green-600"
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

              {!isRecording && recordedUrl && attemptsUsed < 2 && (
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
              • Máximo de <strong>2 tentativas</strong>. Enviaremos em <em>repetições</em> o número de tentativas usadas.
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

      {/* Bottom nav */}
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
