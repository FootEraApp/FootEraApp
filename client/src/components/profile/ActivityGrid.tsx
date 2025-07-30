import React from "react";

interface Activity {
  id: string;
  tipo: "Desafio" | "Treino" | "Vídeo";
  imagemUrl: string;
}

interface ActivityGridProps {
  activities: Activity[];
}

export function ActivityGrid({ activities }: ActivityGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {activities.map((activity) => (
        <div key={activity.id} className="rounded-lg overflow-hidden shadow">
          <img src={activity.imagemUrl} alt={activity.tipo} className="w-full h-24 object-cover" />
          <div className="text-sm text-center font-semibold text-green-900 py-1">{activity.tipo}</div>
        </div>
      ))}
    </div>
  );
}

export default ActivityGrid;
