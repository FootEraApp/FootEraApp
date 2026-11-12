import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import CardAtletaShield from "./CardAtletaShield.js";
import "./CardAtletaInterativo.css";

type Props = {
  usuarioId: string;
  atleta: {
    atletaId: string;
    nome: string;
    foto?: string | null;
    posicao?: string | null;
    idade: number | null;
  };
  ovr: number;
  perf: number;
  disc: number;
  resp: number;
  capturaRef: RefObject<HTMLDivElement | null>;
  bloqueado?: boolean;
};

export default function CardAtletaInterativo({
  usuarioId, atleta, ovr, perf, disc, resp, capturaRef, bloqueado = false,
}: Props) {
  const [mostrarQR, setMostrarQR] = useState(false);

const [esvaecendo, setEsvaecendo] = useState(false);
const transicaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (transicaoRef.current) clearTimeout(transicaoRef.current);
  };
}, []);

function alternarCarta() {
  if (esvaecendo || bloqueado) return;

  const reduzirMovimento = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (reduzirMovimento) {
    setMostrarQR((atual) => !atual);
    return;
  }

  setEsvaecendo(true);

  transicaoRef.current = setTimeout(() => {
    setMostrarQR((atual) => !atual);
    setEsvaecendo(false);
    transicaoRef.current = null;
  }, 220);
}

  const [largura, setLargura] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);
  const gestoRef = useRef({ x: 0, y: 0, arrastou: false });
  const perfilUrl = `https://footera.app.br/perfil/${encodeURIComponent(usuarioId)}?papel=Atleta`;
  const idValido = Boolean(usuarioId && usuarioId !== "undefined" && usuarioId !== "null");

  useEffect(() => {
    setMostrarQR(false);
  }, [usuarioId]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const atualizar = () => {
      const width = Math.floor(node.getBoundingClientRect().width);
      if (width > 0) setLargura(width);
    };
    atualizar();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", atualizar);
      return () => window.removeEventListener("resize", atualizar);
    }
    const observer = new ResizeObserver(atualizar);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="footera-social-card">
      <button
        type="button"
        className="footera-social-card__button"
        disabled={bloqueado || !idValido}
        aria-pressed={mostrarQR}
        aria-label={mostrarQR ? "Voltar à foto do atleta" : "Mostrar QR code dentro da carta"}
        onPointerDownCapture={(event) => {
          gestoRef.current = { x: event.clientX, y: event.clientY, arrastou: false };
        }}
        onPointerMoveCapture={(event) => {
          const gesto = gestoRef.current;
          if (Math.hypot(event.clientX - gesto.x, event.clientY - gesto.y) > 8) {
            gesto.arrastou = true;
          }
        }}
        onPointerCancel={() => { gestoRef.current.arrastou = true; }}
onClick={(event) => {
  if (event.detail !== 0 && gestoRef.current.arrastou) return;
  alternarCarta();
}}
      >
        <div
          style={{
            opacity: esvaecendo ? 0 : 1,
            transition: "opacity 220ms ease-in-out",
          }}
        >
          <div ref={capturaRef} style={{ width: largura }}>
            <CardAtletaShield
              atleta={atleta}
              ovr={ovr}
              perf={perf}
              disc={disc}
              resp={resp}
              size={{ w: largura, h: Math.round(largura * 1.4) }}
              
              qrValue={mostrarQR ? perfilUrl : undefined}
            />
          </div>
        </div>
      </button>
      <p className="footera-social-card__hint" aria-live="polite">
        {mostrarQR ? "Aponte a câmera para o QR · Toque para voltar à foto" : "Toque na carta para mostrar seu QR code"}
      </p>
    </div>
  );
}
