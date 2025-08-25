import { API } from "../../config.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";

interface Activity {
  id: string;
  tipo: "Desafio" | "Treino" | "Vídeo";
  imagemUrl?: string | null;
  nome: string;
}

function resolveImg(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/assets/")) return url;
  return `${API.BASE_URL}${url}`;
}

function guessTreinoImage(nome: string) {
  const n = (nome || "").toLowerCase();
  if (n.includes("controle"))  return "/assets/treinos/controle.jpg";
  if (n.includes("agilidade")) return "/assets/treinos/agilidade.jpg";
  if (n.includes("resist"))    return "/assets/treinos/resistencia.jpg";
  return "/assets/treinos/placeholder.png";
}

export default function ActivityGrid({ activities }: { activities: Activity[] }) {
  return (
    <div className="my-6">
      <h2 className="text-green-900 font-bold text-lg px-4 mt-4 mb-2 hover:underline">
        Atividades Recentes
      </h2>

      <div className="grid grid-cols-3 gap-4">
        {activities.map((activity) => {
          const src =
            activity.imagemUrl?.startsWith("http")
              ? activity.imagemUrl
              : activity.imagemUrl
              ? `${API.BASE_URL}${activity.imagemUrl}`
              : "/assets/treinos/placeholder.png";
          const resolved = formatarUrlFoto(activity.imagemUrl || "");

          return (
            <div key={activity.id} className="rounded-lg overflow-hidden shadow">
              <img src={src} alt={activity.nome || activity.tipo} className="w-full h-24 object-cover" />
              <div className="text-sm text-center font-semibold text-green-900 py-1">
                {activity.nome || activity.tipo}
              </div>
              {"duracao" in activity || "pontos" in activity ? (
                <div className="text-xs text-center text-gray-600 pb-2">
                  {"duracao" in activity && activity.duracao && "pontos" in activity && typeof activity.pontos === "number" ? " • " : ""}
                  {"pontos" in activity && typeof activity.pontos === "number" ? `+${activity.pontos} pts` : ""}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
