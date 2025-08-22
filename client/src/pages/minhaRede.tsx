import { useEffect, useMemo, useState } from "react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

type Usuario = { id: string; nome: string; foto?: string | null };
type Seguidor = Usuario & { isSeguindo?: boolean };

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
      if (seg) setSeguindo(prev => [...prev, seg]);
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
      <h1 className="text-center text-xl font-bold bg-green-900 text-white rounded p-3 mb-3">
        Minha rede
      </h1>

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
                <img
                  src={
                    u.foto?.startsWith("http")
                      ? (u.foto as string)
                      : `${API.BASE_URL}${u.foto ?? ""}`
                  }
                  className="w-10 h-10 rounded-full object-cover"
                />
                <span className="font-medium">{u.nome || "Usuário"}</span>
              </div>
              <button
                className="bg-red-600 text-white rounded px-3 py-1 text-sm"
                onClick={() => unfollow(u.id)}
              >
                Deixar de seguir
              </button>
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
                  <img
                    src={
                      u.foto?.startsWith("http")
                        ? (u.foto as string)
                        : `${API.BASE_URL}${u.foto ?? ""}`
                    }
                    className="w-10 h-10 rounded-full object-cover"
                  />
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
    </div>
  );
}
