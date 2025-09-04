import { useMemo } from "react";
import { API } from "../../config";

type Props = {
  foto?: string | null;  // pode vir null/undefined
  alt: string;
  className?: string;
  size?: number;         // opcional, default 40px
};

/** Placeholder inline (não faz request nenhum) */
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
    if (!foto) return FALLBACK; // sem request
    return foto.startsWith("http") ? foto : `${API.BASE_URL}/uploads/${foto}`;
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
        // desarma o handler para evitar loop e seta placeholder inline
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = FALLBACK;
      }}
    />
  );
}
