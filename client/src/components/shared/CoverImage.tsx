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

  const isFallback = currentSrc === COVER_FALLBACK;

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={[
        "block object-center",
        isFallback
          ? "object-contain bg-emerald-900 p-4"
          : fit === "contain"
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