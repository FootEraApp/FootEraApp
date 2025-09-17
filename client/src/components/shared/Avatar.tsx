import { useMemo } from "react";
import { API } from "../../config.js";

type Props = {
  foto?: string | File | null;
  alt: string;
  className?: string;
  size?: number;
};

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
      <rect width='100%' height='100%' fill='#e5f3eb'/>
      <circle cx='40' cy='30' r='16' fill='#97c7a6'/>
      <rect x='14' y='50' width='52' height='22' rx='11' fill='#97c7a6'/>
    </svg>`
  );

export default function Avatar({ foto, alt, className = "w-10 h-10", size = 40 }: Props) {
  const src = useMemo<string>(() => {
    if (!foto) return FALLBACK;

    if (typeof File !== "undefined" && foto instanceof File) {
      return URL.createObjectURL(foto);
    }

    const s = String(foto);

    if (/^(https?:|data:|blob:)/i.test(s)) return s;

    if (s.startsWith("/uploads/") || s.startsWith("/assets/")) {
      return `${API.BASE_URL}${s}`;
    }
    if (s.startsWith("assets/")) {
      return `${API.BASE_URL}/${s}`;
    }

    if (s.startsWith("/usuarios/")) {
      return `${API.BASE_URL}/uploads${s}`;
    }

    const clean = s.replace(/^\/+/, "");
    return `${API.BASE_URL}/uploads/usuarios/${clean}`;
  }, [foto]);

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${className} rounded-full object-cover`}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = FALLBACK;
      }}
    />
  );
}