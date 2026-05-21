import { useEffect, useMemo, useState } from "react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import { ArrowLeft } from "lucide-react";
import { Link } from 'wouter';
import BottomNav from "@/components/layout/BottomNav.js";

type Usuario = { id: string; nome: string; foto?: string | null; isPendente?: boolean };
type Seguidor = Usuario & { isSeguindo?: boolean };

const FALLBACK_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";

function temFotoValida(foto?: string | null) {
  const v = String(foto ?? "").trim();
  return !!v && v !== "null" && v !== "undefined" && v !== "0";
}

function fotoSrcUsuario(foto?: string | null) {
  return temFotoValida(foto) ? formatarUrlFoto(foto as any, "usuarios") : FALLBACK_AVATAR;
}

function aplicarFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = "1";
  img.src = FALLBACK_AVATAR;
}

export default function MinhaRede() {
  const [aba, setAba] = useState<"seguindo" | "seguidores">("seguindo");
  const [seguindo, setSeguindo] = useState<Usuario[]>([]);
  const [seguidores, setSeguidores] = useState<Seguidor[]>([]);
  const token = Storage.token || "";

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/seguidores/minha-rede`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          console.error("Falha ao carregar /minha-rede:", r.status);
          setSeguindo([]);
          setSeguidores([]);
          return;
        }
        const data = await r.json();
        setSeguindo(data.seguindo ?? []);
        setSeguidores(data.seguidores ?? []);
      } catch (e) {
        console.error(e);
        setSeguindo([]);
        setSeguidores([]);
      }
    })();
  }, [token]);

  async function followBack(userId: string) {
    const r = await fetch(`${API.BASE_URL}/api/seguidores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        seguidoUsuarioId: userId,
        seguidorUsuarioId: Storage.usuarioId,
      }),
    });
    if (r.ok) {
      setSeguidores(prev =>
        prev.map(s => (s.id === userId ? { ...s, isSeguindo: true } : s))
      );

      const seg = seguidores.find(s => s.id === userId);
      if (seg) {
        setSeguindo(prev => [
          ...prev.filter(u => u.id !== userId),
          { ...seg, isPendente: true },
        ]);
      }
    }
  }

  async function unfollow(userId: string) {
    const r = await fetch(`${API.BASE_URL}/api/seguidores/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ seguidoUsuarioId: userId }),
    });
    if (r.ok) {
      setSeguindo(prev => prev.filter(u => u.id !== userId));
      setSeguidores(prev =>
        prev.map(s => (s.id === userId ? { ...s, isSeguindo: false } : s))
      );
    }
  }

  const seguindoSet = useMemo(() => new Set(seguindo.map(u => u.id)), [seguindo]);

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="bg-green-900 text-white rounded mb-3 px-3 py-3 flex items-center relative">
        <Link
          href="/perfil"
          aria-label="Voltar para perfil"
          className="inline-flex h-10 w-10 items-center justify-center
            rounded-full bg-white/10 text-white
            hover:bg-white/20 focus:outline-none
            focus:ring-2 focus:ring-white/30 z-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold pointer-events-none">
          Minha rede
        </h1>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          className={`flex-1 p-2 rounded ${
            aba === "seguindo" ? "bg-green-100" : "bg-gray-100"
          }`}
          onClick={() => setAba("seguindo")}
        >
          Seguindo ({seguindo.length})
        </button>
        <button
          className={`flex-1 p-2 rounded ${
            aba === "seguidores" ? "bg-green-100" : "bg-gray-100"
          }`}
          onClick={() => setAba("seguidores")}
        >
          Seguidores ({seguidores.length})
        </button>
      </div>

      {aba === "seguindo" && (
        <div className="space-y-3">
          {seguindo.map(u => (
            <div
              key={u.id}
              className="bg-white rounded-lg p-3 flex items-center justify-between shadow"
            >
              <div className="flex items-center gap-3">
                <Link href={`/perfil/${u.id}`} onClick={(e) => e.stopPropagation()}>
                  <img
                    src={fotoSrcUsuario(u.foto)}
                    onError={aplicarFallback}
                    className="w-10 h-10 rounded-full object-cover cursor-pointer"
                    alt={u.nome || "Usuário"}
                    title="Ver perfil"
                  />
                </Link>

                <span className="font-medium">{u.nome || "Usuário"}</span>
              </div>
              {u.isPendente ? (
                <span className="bg-gray-200 text-gray-700 rounded px-3 py-1 text-sm">
                  Solicitação enviada
                </span>
              ) : (
                <button
                  className="bg-red-600 text-white rounded px-3 py-1 text-sm"
                  onClick={() => unfollow(u.id)}
                >
                  Deixar de seguir
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {aba === "seguidores" && (
        <div className="space-y-3">
          {seguidores.map(u => {
            const jaSigo = u.isSeguindo ?? seguindoSet.has(u.id);
            return (
              <div
                key={u.id}
                className="bg-white rounded-lg p-3 flex items-center justify-between shadow"
              >
                <div className="flex items-center gap-3">
                  <Link href={`/perfil/${u.id}`} onClick={(e) => e.stopPropagation()}>
                    <img
                      src={fotoSrcUsuario(u.foto)}
                      onError={aplicarFallback}
                      className="w-10 h-10 rounded-full object-cover cursor-pointer"
                      alt={u.nome || "Usuário"}
                      title="Ver perfil"
                    />
                  </Link>
                  <span className="font-medium">{u.nome || "Usuário"}</span>
                </div>

                {jaSigo ? (
                  <span className="bg-gray-200 text-gray-700 rounded px-3 py-1 text-sm cursor-default">
                    Seguindo
                  </span>
                ) : (
                  <button
                    className="bg-green-700 text-white rounded px-3 py-1 text-sm"
                    onClick={() => followBack(u.id)}
                  >
                    Seguir de volta
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <BottomNav />
    </div>
  );
}
