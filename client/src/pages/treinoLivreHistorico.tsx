import { useEffect, useState } from "react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Link } from "wouter";

type TL = {
  id: string;
  data: string;
  descricao: string;
  duracaoMin: number;
  tipoAtividade?: string | null;
  categoria?: string | null;
  urlEvidencia?: string | null;
};

function isVideo(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".ogg");
}

function openMediaFullscreen(url: string) {
  if (typeof window === "undefined") return;

  const nova = window.open("", "_blank");
  if (!nova) return;

  const video = isVideo(url);

  nova.document.write(`
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Treino Livre</title>
        <style>
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img, video {
            max-width: 100%;
            max-height: 100%;
          }
        </style>
      </head>
      <body>
        ${
          video
            ? `<video src="${url}" controls autoplay></video>`
            : `<img src="${url}" alt="Treino livre" />`
        }
      </body>
    </html>
  `);
  nova.document.close();
}

export default function TreinosLivresHistorico() {
  const [itens, setItens] = useState<TL[]>([]);

  useEffect(() => {
    (async () => {
      const token = (Storage as any).token ?? localStorage.getItem("token");
      const atletaId =
        (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");
      if (!token || !atletaId) return;

      const r = await fetch(
        `${API.BASE_URL}/api/treinos-livres?atletaId=${encodeURIComponent(
          atletaId
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (r.ok) setItens(await r.json());
    })();
  }, []);

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Tem certeza que deseja apagar este treino livre? Essa ação não pode ser desfeita."
      )
    ) {
      return;
    }

    const token = (Storage as any).token ?? localStorage.getItem("token");
    if (!token) {
      alert("Sessão expirada.");
      return;
    }

    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos-livres/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!r.ok && r.status !== 204) {
        const txt = await r.text();
        console.error("Erro ao deletar treino livre:", r.status, txt);
        alert("Não foi possível apagar o treino.");
        return;
      }

      setItens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao apagar treino.");
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <Link
        href="/treinos"
        aria-label="Voltar para treinos"
        title="Voltar para explorar"
        className="inline-flex h-10 w-10 items-center justify-center
          rounded-full border border-green-800 bg-white text-green-900
          shadow-sm hover:bg-green-50 focus:outline-none
          focus:ring-2 focus:ring-green-700/30 mt-2 ml-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <h2 className="text-lg font-bold mb-4 mt-2">Treinos Livres</h2>

      {itens.length === 0 ? (
        <p className="text-gray-600">Nenhum treino livre registrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((t) => {
            const mediaUrl = t.urlEvidencia
              ? `${API.BASE_URL}${t.urlEvidencia}`
              : null;

            return (
              <li
                key={t.id}
                className="p-3 rounded border bg-white flex gap-3 items-center"
              >
                {mediaUrl && (
                  <button
                    type="button"
                    className="flex-shrink-0 cursor-pointer border-0 p-0 bg-transparent"
                    onClick={() => openMediaFullscreen(mediaUrl)}
                  >
                    {isVideo(mediaUrl) ? (
                      <video
                        src={mediaUrl}
                        className="w-24 h-24 rounded object-cover"
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt={t.descricao}
                        className="w-24 h-24 rounded object-cover"
                      />
                    )}
                  </button>
                )}

                <div className="flex-1">
                  <div className="font-semibold">{t.descricao}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(t.data).toLocaleString("pt-BR")} • {t.duracaoMin}{" "}
                    min
                    {t.tipoAtividade ? ` • ${t.tipoAtividade}` : ""}
                    {t.categoria ? ` • ${t.categoria}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="ml-2 text-red-600 hover:text-red-800"
                  aria-label="Apagar treino livre"
                  title="Apagar treino livre"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
