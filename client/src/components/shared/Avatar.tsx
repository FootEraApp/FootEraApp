import { useMemo, useEffect, useState } from "react";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import { APP } from "@/config.js";

type Props = {
  foto?: string | File | null;
  alt?: string;
  className?: string;
  size?: number;
  pasta?: string;
};

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function isEmptyFoto(value: unknown) {
  const v = String(value ?? "").trim();
  return !v || v === "null" || v === "undefined";
}

export default function Avatar({
  foto,
  alt = "",
  className = "w-10 h-10",
  size = 40,
  pasta = "usuarios",
}: Props) {
  const srcInicial = useMemo<string>(() => {
    if (isEmptyFoto(foto)) return AVATAR_FALLBACK;

    if (typeof File !== "undefined" && foto instanceof File) {
      return URL.createObjectURL(foto);
    }

    return formatarUrlFoto(String(foto), pasta) || AVATAR_FALLBACK;
  }, [foto, pasta]);

  const [src, setSrc] = useState(srcInicial);

  useEffect(() => {
    setSrc(srcInicial);
  }, [srcInicial]);

  useEffect(() => {
    return () => {
      if (typeof File !== "undefined" && foto instanceof File) {
        try {
          URL.revokeObjectURL(srcInicial);
        } catch {}
      }
    };
  }, [foto, srcInicial]);

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={[
        "shrink-0 rounded-full object-cover object-center bg-emerald-900",
        "overflow-hidden aspect-square",
        className,
      ].join(" ")}
      onError={() => {
        if (src !== AVATAR_FALLBACK) {
          setSrc(AVATAR_FALLBACK);
        }
      }}
    />
  );
}