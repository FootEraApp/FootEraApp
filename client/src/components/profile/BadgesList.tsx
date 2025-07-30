import axios from "axios";
import { useState, useEffect } from "react";

interface Badge {
  id: string;
  titulo: string;
  imagemUrl: string;
}

interface BadgesListProps {
  userId: string;
}

export function BadgesList({ userId }: BadgesListProps) {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    axios.get(`http://localhost:3001/api/perfil/${userId}/badges`).then(res => {
      setBadges(res.data);
    });
  }, [userId]);

  return (
    <div className="flex gap-2 overflow-x-auto mt-4">
      {badges.map((badge) => (
        <div key={badge.id} className="flex flex-col items-center">
          <img src={badge.imagemUrl} alt={badge.titulo} className="w-16 h-16 rounded-full" />
          <span className="text-xs mt-1">{badge.titulo}</span>
        </div>
      ))}
    </div>
  );
}
