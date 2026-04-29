import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API, APP } from "../../config.js";
import { publicImgUrl } from "@/utils/publicUrl.js";

interface Activity {
  id: string;
  tipo: string;
  imagemUrl?: string | null;
  nome?: string;
  titulo?: string;
  createdAt?: string;
}

type VideoItem = {
  id: string;
  videoUrl: string;
  titulo: string;
  thumb?: string | null;
  createdAt?: string;
  curtidas?: number;
};

type ActivityCard = Activity & {
  video?: VideoItem | null;
};

function guessTreinoImage(nome: string) {
  const n = (nome || "").toLowerCase();
  if (n.includes("livre")) return "/assets/treinos/treino-livre.jpg";
  if (n.includes("agendado")) return "/assets/treinos/treino-agendado.jpg";
  if (n.includes("desafio")) return "/assets/treinos/desafio.jpg";
  if (n.includes("controle")) return "/assets/treinos/controle.jpg";
  if (n.includes("agilidade")) return "/assets/treinos/agilidade.jpg";
  if (n.includes("resist")) return "/assets/treinos/resistencia.jpg";
  return "/assets/treinos/placeholder.png";
}

function isYouTube(url: string) {
  try {
    const u = new URL(url);
    return ["youtube.com", "www.youtube.com", "youtu.be"].includes(u.hostname);
  } catch {
    return false;
  }
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return id;
      const parts = u.pathname.split("/");
      const idx = parts.findIndex((p) => p === "embed" || p === "shorts");
      return idx >= 0 ? parts[idx + 1] || null : null;
    }
    return null;
  } catch {
    return null;
  }
}

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function resolveImg(src?: string | null) {
  const s = String(src || "").trim();
  if (!s) return AVATAR_FALLBACK;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/")) return `${API.BASE_URL}/${s}`;
  if (s.startsWith("/assets/")) return `${APP.FRONTEND_BASE_URL}${s}`;
  if (s.startsWith("/")) return `${APP.FRONTEND_BASE_URL}${s}`;

  return `${API.BASE_URL}/${s.replace(/^\/+/, "")}`;
}

export default function ActivityGrid({
  activities,
  perfilUsuarioId,
}: {
  activities: Activity[];
  perfilUsuarioId?: string | null;
}) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [sel, setSel] = useState<VideoItem | null>(null);

  const token = Storage.token;
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!perfilUsuarioId || !headers) return;
      try {
        const { data } = await axios.get<VideoItem[]>(
          `${API.BASE_URL}/api/perfil/${perfilUsuarioId}/desafios-videos`,
          { headers }
        );
        if (!alive) return;
        setVideos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn("Falha ao buscar vídeos de desafios:", e);
        setVideos([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [perfilUsuarioId, headers]);

  const cards: ActivityCard[] = useMemo(() => {
    const base: ActivityCard[] = (activities || []).map((a: any) => ({
      ...a,
      nome: a.nome ?? a.titulo ?? "Atividade",
      video: null,
    }));

    const videoCards: ActivityCard[] = (videos || []).map((v) => ({
      id: `video-${v.id}`,
      tipo: "Vídeo",
      imagemUrl: v.thumb || v.videoUrl,
      nome: v.titulo,
      video: v,
    }));

    return [...base, ...videoCards];
  }, [activities, videos]);

  return (
    <div className="my-6">
      <h2 className="text-green-900 font-bold text-lg px-4 mt-2 mb-2 hover:underline">
        Atividades Recentes
      </h2>

      {cards.length === 0 ? (
        <div className="text-sm text-green-800 px-4 pb-2">
          Nenhuma atividade recente ainda.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 px-0">
          {cards.map((card) => {
            const isVideo = !!card.video;

            let thumbCandidate: string;
            if (isVideo) {
              thumbCandidate =
                card.video?.thumb && card.video.thumb.trim()
                  ? card.video.thumb
                  : "/assets/treinos/placeholder.png";
            } else if (card.imagemUrl && card.imagemUrl.trim()) {
              thumbCandidate = card.imagemUrl;
            } else {
              thumbCandidate = guessTreinoImage(card.nome ?? "");
            }

            const thumb = publicImgUrl(thumbCandidate) || AVATAR_FALLBACK;
            return (
              <button
                key={card.id}
                className="rounded-lg overflow-hidden shadow relative group bg-black"
                onClick={() => {
                  if (isVideo && card.video) setSel(card.video);
                }}
                type="button"
              >
              <img
                src={thumb}
                alt={card.nome}
                className="w-full h-24 object-cover opacity-80 group-hover:opacity-60 transition"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK;
                }}
              />

                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[11px] text-white px-2 py-1 flex justify-between items-center">
                  <span className="truncate max-w-[70%]">{card.nome}</span>
                  <span className="ml-1 font-semibold">
                    {card.tipo === "Vídeo"
                      ? "Vídeo"
                      : card.tipo || "Atividade"}
                  </span>
                </div>

                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <svg viewBox="0 0 24 24" className="w-6 h-6">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSel(null)}
        >
          <div
            className="bg-black rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-black/60 text-white">
              <div className="font-semibold truncate pr-2">{sel.titulo}</div>
              <button
                className="px-2 py-1 rounded hover:bg-white/10"
                onClick={() => setSel(null)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="bg-black">
              {isYouTube(sel.videoUrl) ? (
                <iframe
                  className="w-full aspect-video"
                  src={`https://www.youtube.com/embed/${
                    getYouTubeId(sel.videoUrl) || ""
                  }?autoplay=1&rel=0`}
                  title={sel.titulo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video
                  className="w-full h-auto"
                  controls
                  autoPlay
                  src={sel.videoUrl}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}