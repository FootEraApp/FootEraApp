import { useMemo, useState, useEffect } from "react";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";

type Props = {
  src?: string | File | null;
  alt?: string;
  className?: string;
  pasta?: string;
  fit?: "cover" | "contain";
};

const COVER_FALLBACK = "/assets/usuarios/footera-logo-fundo-verde.png";
const FALLBACK_BG_PADRAO = "#003c24";

function isEmptySrc(value: unknown) {
  const v = String(value ?? "").trim();
  return !v || v === "null" || v === "undefined";
}

export default function CoverImage({
  src,
  alt = "",
  className = "w-full h-full",
  pasta = "metodologias",
  fit = "cover",
}: Props) {
  const srcInicial = useMemo(() => {
    if (isEmptySrc(src)) return COVER_FALLBACK;

    if (typeof File !== "undefined" && src instanceof File) {
      return URL.createObjectURL(src);
    }

    const value = String(src).trim();

    if (
      value.startsWith("blob:") ||
      value.startsWith("data:") ||
      value.startsWith("http://") ||
      value.startsWith("https://")
    ) {
      return value;
    }

    return formatarUrlFoto(value, pasta) || COVER_FALLBACK;
  }, [src, pasta]);

  const [currentSrc, setCurrentSrc] = useState(srcInicial);
  const [fallbackBg, setFallbackBg] = useState(FALLBACK_BG_PADRAO);

  useEffect(() => {
    setCurrentSrc(srcInicial);
  }, [srcInicial]);

  useEffect(() => {
    return () => {
      if (typeof File !== "undefined" && src instanceof File) {
        try {
          URL.revokeObjectURL(srcInicial);
        } catch {}
      }
    };
  }, [src, srcInicial]);

  const isFallback =
    currentSrc === COVER_FALLBACK ||
    currentSrc.includes("/assets/usuarios/footera-logo-fundo-verde.png");

  useEffect(() => {
    if (!isFallback) {
      setFallbackBg(FALLBACK_BG_PADRAO);
      return;
    }

    let cancelado = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSrc;

    img.onload = () => {
      if (cancelado) return;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const sampleW = Math.max(1, Math.floor(img.naturalWidth * 0.12));
        const sampleH = Math.max(1, Math.floor(img.naturalHeight * 0.12));

        ctx.drawImage(img, 0, 0, sampleW, sampleH, 0, 0, 1, 1);

        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        setFallbackBg(`rgb(${r}, ${g}, ${b})`);
      } catch {
        setFallbackBg(FALLBACK_BG_PADRAO);
      }
    };

    img.onerror = () => {
      if (!cancelado) setFallbackBg(FALLBACK_BG_PADRAO);
    };

    return () => {
      cancelado = true;
    };
  }, [currentSrc, isFallback]);

  if (isFallback) {
    return (
      <div
        className={[
          "relative block overflow-hidden",
          className,
        ].join(" ")}
        style={{ backgroundColor: fallbackBg }}
        role="img"
        aria-label={alt}
      >
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="relative z-10 block h-full w-full object-contain scale-[1.03]"
          onError={() => {
            if (currentSrc !== COVER_FALLBACK) {
              setCurrentSrc(COVER_FALLBACK);
            }
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={[
        "block object-center",
        fit === "contain"
          ? "object-contain bg-slate-100"
          : "object-cover bg-slate-100",
        className,
      ].join(" ")}
      onError={() => {
        if (currentSrc !== COVER_FALLBACK) {
          setCurrentSrc(COVER_FALLBACK);
        }
      }}
    />
  );
}