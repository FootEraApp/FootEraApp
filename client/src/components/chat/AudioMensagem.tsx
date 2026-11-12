
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { API } from "../../config.js";

type Props = {
  id: string;
  grupoId?: string;
  token: string;
  duracaoMs?: number | null;
};

function formatarTempo(segundos: number) {
  const valor = Math.max(0, Math.floor(segundos || 0));

  return `${Math.floor(valor / 60)}:${String(
    valor % 60
  ).padStart(2, "0")}`;
}

export default function AudioMensagem({
  id,
  grupoId,
  token,
  duracaoMs,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const carregamentoRef = useRef(false);

  const [src, setSrc] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [duracao, setDuracao] = useState(
    Math.max(0, (duracaoMs ?? 0) / 1000)
  );
  const [velocidade, setVelocidade] =
    useState<1 | 1.5 | 2>(1);
  const [erro, setErro] = useState("");

  const duracaoInicial = Math.max(
    0,
    (duracaoMs ?? 0) / 1000
  );

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      audioRef.current?.pause();

      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setDuracao(duracaoInicial);
  }, [duracaoInicial]);

  const reproduzir = async () => {
    setErro("");

    if (tocando) {
      audioRef.current?.pause();
      return;
    }

    if (carregamentoRef.current) return;

    try {
      if (!src) {
        carregamentoRef.current = true;
        setCarregando(true);

        const controller = new AbortController();
        controllerRef.current = controller;

        const caminho = grupoId
          ? `/api/mensagem/grupos/${encodeURIComponent(grupoId)}/audio/${encodeURIComponent(id)}`
          : `/api/mensagem/audio/${encodeURIComponent(id)}`;

        const resposta = await fetch(
          `${API.BASE_URL}${caminho}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        if (!resposta.ok) {
          throw new Error(
            `Falha ao carregar áudio (${resposta.status}).`
          );
        }

        const blob = await resposta.blob();

        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setSrc(url);

        const elemento = audioRef.current;

        if (elemento) {
          elemento.src = url;
          elemento.playbackRate = velocidade;
          await elemento.play();
        }
      } else {
        const elemento = audioRef.current;

        if (elemento) {
          elemento.playbackRate = velocidade;
          await elemento.play();
        }
      }
    } catch (e) {
      if (
        !(e instanceof DOMException && e.name === "AbortError")
      ) {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível reproduzir o áudio."
        );
      }
    } finally {
      carregamentoRef.current = false;
      setCarregando(false);
    }
  };

  const mudarVelocidade = () => {
    const nova: 1 | 1.5 | 2 =
      velocidade === 1
        ? 1.5
        : velocidade === 1.5
          ? 2
          : 1;

    setVelocidade(nova);

    if (audioRef.current) {
      audioRef.current.playbackRate = nova;
    }
  };

  return (
    <div className="w-[270px] max-w-full rounded-2xl bg-slate-100 px-3 py-3 text-slate-900">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onTimeUpdate={(event) => {
          setAtual(event.currentTarget.currentTime);
        }}
        onLoadedMetadata={(event) => {
          const valor = event.currentTarget.duration;

          if (Number.isFinite(valor) && valor > 0) {
            setDuracao(valor);
          }
        }}
        onEnded={() => {
          setTocando(false);
          setAtual(0);

          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void reproduzir()}
          disabled={carregando}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-800 text-white disabled:opacity-50"
          aria-label={
            carregando
              ? "Carregando áudio"
              : tocando
                ? "Pausar áudio"
                : "Reproduzir áudio"
          }
        >
          {tocando ? (
            <Pause size={19} />
          ) : (
            <Play size={19} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(duracao, 0.1)}
            step={0.1}
            value={Math.min(atual, Math.max(duracao, 0.1))}
            disabled={!src}
            onChange={(e) => {
              const valor = Number(e.target.value);

              if (audioRef.current) {
                audioRef.current.currentTime = valor;
                setAtual(valor);
              }
            }}
            className="w-full accent-green-800"
            aria-label="Posição do áudio"
          />

          <div className="flex justify-between text-xs tabular-nums">
            <span>{formatarTempo(atual)}</span>
            <span>{formatarTempo(duracao)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={mudarVelocidade}
          className="shrink-0 rounded-full border border-slate-300 px-2 py-1 text-xs font-medium"
          aria-label="Alterar velocidade"
        >
          {velocidade}x
        </button>
      </div>

      {carregando && (
        <span className="mt-1 block text-xs">
          Carregando áudio...
        </span>
      )}

      {erro && (
        <span
          role="alert"
          className="mt-1 block text-xs text-red-600"
        >
          {erro}
        </span>
      )}
    </div>
  );
}