// client/src/components/chat/GravadorAudio.tsx
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

type Props = {
  disabled?: boolean;
  onGravado: (blob: Blob, duracaoMs: number) => Promise<void>;
};

const LIMITE_MS = 120_000;

function tipoSuportado(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const tipo of ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return null;
}

export default function GravadorAudio({ disabled, onGravado }: Props) {
  const [gravando, setGravando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inicioRef = useRef(0);
  const cancelarRef = useRef(false);
  const mountedRef = useRef(true);
  const onGravadoRef = useRef(onGravado);
  onGravadoRef.current = onGravado;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelarRef.current = true;
      if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!gravando) return;
    const timer = window.setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicioRef.current) / 1000));
      if (Date.now() - inicioRef.current >= LIMITE_MS) {
        if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [gravando]);

  const iniciar = async () => {
    if (disabled || enviando || gravando) return;
    const mimeType = tipoSuportado();
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      setErro("Gravação indisponível neste navegador.");
      return;
    }
    try {
      setErro("");
      cancelarRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const media = new MediaRecorder(stream, { mimeType });
      mediaRef.current = media;
      const pedacos: BlobPart[] = [];
      media.ondataavailable = (e) => { if (e.data.size > 0) pedacos.push(e.data); };
      media.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (mountedRef.current) setGravando(false);
        if (cancelarRef.current || !mountedRef.current) return;
        const duracaoMs = Math.min(LIMITE_MS, Date.now() - inicioRef.current);
        const blob = new Blob(pedacos, { type: media.mimeType });
        if (duracaoMs < 700 || blob.size === 0) { setErro("Áudio muito curto."); return; }
        if (blob.size > 8 * 1024 * 1024) {
          setErro("O áudio ultrapassou o limite de 8 MB.");
          return;
        }
        setEnviando(true);
        void onGravadoRef.current(blob, duracaoMs)
          .catch((e) => {
            if (mountedRef.current) {
              setErro(
                e instanceof Error
                  ? e.message
                  : "Falha no envio."
              );
            }
          })
          .finally(() => { if (mountedRef.current) setEnviando(false); });
      };
      inicioRef.current = Date.now();
      setSegundos(0);
      media.start(250);
      setGravando(true);
    } catch {
      setErro("Permissão de microfone negada ou indisponível.");
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  };

  const parar = (cancelar: boolean) => {
    cancelarRef.current = cancelar;
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {!gravando ? (
        <button type="button" disabled={disabled || enviando} onClick={() => void iniciar()} className="rounded-full border border-green-700 p-2 disabled:opacity-40" title="Gravar mensagem de voz" aria-label="Gravar mensagem de voz"><Mic size={20}/></button>
      ) : (
        <>
          <span className="text-xs text-red-600" aria-live="polite">● {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}</span>
          <button type="button" onClick={() => parar(true)} className="rounded-full p-2 text-red-600" title="Cancelar áudio" aria-label="Cancelar áudio"><Trash2 size={20}/></button>
          <button type="button" onClick={() => parar(false)} className="rounded-full bg-green-900 p-2 text-white" title="Finalizar e enviar áudio" aria-label="Finalizar e enviar áudio"><Square size={18}/></button>
        </>
      )}
      {enviando && <span className="text-xs">Enviando...</span>}
      {erro && <span role="alert" className="max-w-40 text-xs text-red-600">{erro}</span>}
    </div>
  );
}
