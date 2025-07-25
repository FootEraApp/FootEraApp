import { Play } from "lucide-react";

interface Activity {
  id: number;
  type: string;
  imageUrl: string;
}

interface ActivityGridProps {
  activities: Activity[];
}

export default function ActivityGrid({ activities }: ActivityGridProps) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold footera-text-green mb-3">Atividade Recente</h2>
      <div className="grid grid-cols-3 gap-3">
        {activities.map(activity => (
          <div key={activity.id} className="footera-bg-cream border border-gray-200 rounded-lg overflow-hidden shadow">
            <img 
              src={activity.imageUrl} 
              className="w-full h-20 object-cover" 
              alt={activity.type} 
            />
            <div className="p-2 text-center">
              <p className="text-xs font-medium footera-text-green">{activity.type}</p>
              <div className="mt-1">
                <Play className="mx-auto h-3 w-3 footera-text-green" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}