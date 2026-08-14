import { useEffect, useState } from "react";
import { Link } from "wouter";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API, APP } from "../../config.js";
import BottomNav from "@/components/layout/BottomNav.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

type Atleta = {
  id: string;     
  usuarioId: string;
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string | null;
  pontuacao?: number | null;
  categoria?: string | null;
};

function resolveUploadUrl(raw?: string | null) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/assets/") || raw.startsWith("/attached_assets/")) {
    return raw.startsWith("/assets/")
      ? `${APP.FRONTEND_BASE_URL}${raw}`
      : `${API.BASE_URL}${raw}`;
  }
  if (raw.startsWith("/uploads/")) return `${API.BASE_URL}${raw}`;
  return `${API.BASE_URL}/uploads/${raw.replace(/^\/+/, "")}`;
}
function initials(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function AvatarCircle({ src, nome, size = 40 }: { src?: string; nome: string; size?: number }) {
  const [imgSrc, setImgSrc] = useState(src || AVATAR_FALLBACK);
  const style = { width: size, height: size };

  useEffect(() => {
    setImgSrc(src || AVATAR_FALLBACK);
  }, [src]);

  return (
    <div
      className="relative rounded-full overflow-hidden bg-green-100 border"
      style={style}
    >
      <img
        src={imgSrc}
        alt={nome}
        className="w-full h-full object-cover"
        onError={() => {
          if (imgSrc !== AVATAR_FALLBACK) {
            setImgSrc(AVATAR_FALLBACK);
          }
        }}
      />
    </div>
  );
}

export default function PainelOlheiro() {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const tipoId = Storage.tipoUsuarioId;

  const [obs, setObs] = useState<Atleta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !tipoId) return;

    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API.BASE_URL}/api/olheiros/${tipoId}/observados`, { headers });

        const arr: Atleta[] = (
          Array.isArray(r.data)
            ? r.data
            : []
        ).map((x: any) => {
          /*
          * atletaId:
          * usado em desempenho/indicação.
          */
          const atletaId =
            x.atletaId ||
            x.atleta?.id ||
            x.id;

          /*
          * usuarioId:
          * usado para abrir /perfil/:id.
          *
          * Na resposta atual do backend,
          * quando existe atletaId, x.id
          * corresponde ao usuário.
          */
          const usuarioId =
            x.usuarioId ||
            x.usuario?.id ||
            x.atleta?.usuarioId ||
            (x.atletaId ? x.id : "");

          const nome =
            x.nome ||
            x.atleta?.nome ||
            x.usuario?.nome ||
            "";

          const fotoRaw =
            x.foto ??
            x.atleta?.foto ??
            x.usuario?.foto ??
            null;

          return {
            id: String(atletaId),
            usuarioId: String(usuarioId),

            nome: String(nome),

            foto:
              resolveUploadUrl(
                fotoRaw
              ),

            posicao:
              x.posicao ??
              x.atleta?.posicao ??
              null,

            idade:
              x.idade ??
              x.atleta?.idade ??
              null,

            altura:
              x.altura ??
              x.atleta?.altura ??
              null,

            peso:
              x.peso ??
              x.atleta?.peso ??
              null,

            observadoEm:
              x.observadoEm ??
              null,

            categoria:
              x.categoria ??
              null,

            pontuacao:
              typeof x.pontuacao ===
              "number"
                ? x.pontuacao
                : null,
          };
        });

        setObs(arr.filter((a) => a.id && a.nome));
      } catch (e) {
        console.error("Falha ao carregar observados:", e);
        setObs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [tipoId, token]);

  const total = obs.length;

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20">
      <div className="mb-3 flex items-end justify-between">
        <h1 className="text-xl font-bold text-green-900">Painel do Olheiro</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">
          {total} observado{total === 1 ? "" : "s"}
        </span>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white border animate-pulse" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border bg-white/90 p-6 text-center text-green-900/70">
          Você ainda não observa atletas.
        </div>
      ) : (
        <ul className="grid gap-3">
          {obs.map((a) => {
            const bullets = [
              a.posicao || null,
              typeof a.idade === "number" ? `${a.idade} anos` : null,
              a.categoria || null,
            ].filter(Boolean);

            return (
              <li
                key={a.id}
                className="rounded-xl border bg-white/90 p-3 shadow-sm hover:shadow transition flex items-start gap-3"
              >
                {a.usuarioId ? (
                  <Link
                    href={`/perfil/${encodeURIComponent(
                      a.usuarioId
                    )}`}
                    aria-label={`Ver perfil de ${a.nome}`}
                    title={`Ver perfil de ${a.nome}`}
                    className="
                      shrink-0
                      rounded-full
                      transition
                      hover:opacity-80
                      focus:outline-none
                      focus:ring-2
                      focus:ring-green-500
                      focus:ring-offset-2
                    "
                  >
                    <AvatarCircle
                      src={a.foto || undefined}
                      nome={a.nome}
                      size={44}
                    />
                  </Link>
                ) : (
                  <AvatarCircle
                    src={a.foto || undefined}
                    nome={a.nome}
                    size={44}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-green-900 truncate">{a.nome}</div>
                    {typeof a.pontuacao === "number" && (
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {a.pontuacao} pts
                      </span>
                    )}
                  </div>

                  {bullets.length > 0 && (
                    <div className="text-xs text-green-900/70">{bullets.join(" • ")}</div>
                  )}

                  {a.observadoEm && (
                    <div className="mt-1 text-[11px] text-green-900/60">
                      Observando desde {new Date(a.observadoEm).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Link
                    href={`/olheiros/desempenho?atletaId=${a.id}`}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border text-green-800 border-green-200 hover:bg-green-50 text-sm"
                  >
                    Desempenho
                  </Link>
                  <Link
                    href={`/olheiros/indicar?atletaId=${a.id}`}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 text-sm"
                  >
                    Indicar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      
      <BottomNav active="olheiros" />

    </div>
  );
}