interface Activity {
  id: string;
  tipo: "Desafio" | "Treino" | "Vídeo";
  imagemUrl: string;
  nome: string;
}

export default function ActivityGrid({ activities }: { activities: Activity[] }) {
  return (
    <div className="my-6">
      <h2 className="text-green-900 font-bold text-lg px-4 mt-4 mb-2 hover:underline">Atividades Recentes</h2>
      <div className="grid grid-cols-3 gap-4">
        {activities.map((activity) => (
          <div key={activity.id} className="rounded-lg overflow-hidden shadow">
            <img
              src={activity.imagemUrl.startsWith("/") ? `http://localhost:3001${activity.imagemUrl}` : activity.imagemUrl}
              alt={activity.tipo}
              className="w-full h-24 object-cover"
            />
            <div className="text-sm text-center font-semibold text-green-900 py-1">
              {activity.nome || activity.tipo}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

