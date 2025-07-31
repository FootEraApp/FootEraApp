import React, { useEffect, useState } from "react";
import axios from "axios";

interface Badge {
  id: string;
  name: string;
  icon: string;
}

const badgeIconMap: { [key: string]: string } = {
  stopwatch: "⏱️",
  bullseye: "🎯",
  medal: "🏅",
};

export const BadgesList = ({ userId }: { userId: string }) => {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`http://localhost:3001/api/perfil/${userId}/badges`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBadges(res.data);
      } catch (err) {
        console.error("Erro ao buscar badges:", err);
      }
    };
    fetchBadges();
  }, [userId]);

  return (
    <div className="my-6">
      <h3 className="text-green-900 font-bold text-lg px-4 mt-4 mb-2 hover:underline">Conquistas</h3>
      <div className="flex gap-4 overflow-x-auto">
        {badges.map((badge) => (
          <div key={badge.id} className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-900 rounded-full flex items-center justify-center text-2xl">
              <span>{badgeIconMap[badge.icon] || "🏆"}</span>
            </div>
            <span className="text-sm mt-1">{badge.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
