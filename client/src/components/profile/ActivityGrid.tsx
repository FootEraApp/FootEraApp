import { APP } from "../../config.js";
import { publicImgUrl } from "@/utils/publicUrl.js";

interface Activity {
  id: string;
  tipo: "Desafio" | "Treino" | "Vídeo";
  imagemUrl?: string | null;
  nome: string;
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
        {activities.map((a) => {
          const candidate =
            (a.imagemUrl && a.imagemUrl.trim()) ? a.imagemUrl : guessTreinoImage(a.nome);

          const src =
            publicImgUrl(candidate) ??
            `${APP.FRONTEND_BASE_URL}/assets/treinos/placeholder.png`;

          return (
            <div key={a.id} className="rounded-lg overflow-hidden shadow">
              <img src={src} alt={a.nome || a.tipo} className="w-full h-24 object-cover" />
              <div className="text-sm text-center font-semibold text-green-900 py-1">
                {a.nome || a.tipo}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
