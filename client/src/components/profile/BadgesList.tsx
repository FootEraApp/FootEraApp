import { 
  Timer, 
  Target, 
  Medal, 
  Footprints, 
  Users 
} from "lucide-react";

interface Badge {
  id: number;
  name: string;
  icon: string;
}

interface BadgesListProps {
  badges: Badge[];
}

export default function BadgesList({ badges = [] }: BadgesListProps) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "stopwatch":
        return <Timer className="text-footera-cream text-lg" />;
      case "bullseye":
        return <Target className="text-footera-cream text-lg" />;
      case "medal":
        return <Medal className="text-footera-cream text-lg" />;
      case "shoe-prints":
        return <Footprints className="text-footera-cream text-lg" />;
      case "users":
        return <Users className="text-footera-cream text-lg" />;
      default:
        return <Medal className="text-footera-cream text-lg" />;
    }
  };
  
  const displayBadges = badges.length > 0 ? badges : [
    { id: 1, name: "Badge 1", icon: "medal" },
    { id: 2, name: "Badge 2", icon: "stopwatch" },
    { id: 3, name: "Badge 3", icon: "bullseye" },
    { id: 4, name: "Badge 4", icon: "shoe-prints" },
    { id: 5, name: "Badge 5", icon: "users" }
  ];
  
  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold footera-text-green mb-3">Badges Conquistados</h2>
      <div className="flex justify-between mb-4">
        {displayBadges.map(badge => (
          <div 
            key={badge.id} 
            className="w-12 h-12 footera-bg-green rounded-full flex items-center justify-center"
            title={badge.name}
          >
            {getIcon(badge.icon)}
          </div>
        ))}
      </div>
    </section>
  );
}