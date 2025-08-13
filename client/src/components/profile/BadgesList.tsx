import React, { useEffect, useState } from "react";
import axios from "axios";

type Badge = {
  id: string;
  nome: string;
  icon: string;
}

const badgeIconMap: { [key: string]: string } = {
  stopwatch: "⏱️",
  bullseye: "🎯",
  medal: "🏅",
};

export function BadgesList({
  userId,
  badges,
}: { userId?: string | null; badges?: Badge[] }) {
  const [data, setData] = useState<Badge[]>(badges ?? []);

  useEffect(() => {
    if (badges) return;
    if (!userId) return;
    
  }, [badges, userId]);

  const list = badges ?? data;
  return (
    <div className="grid gap-2">
      {list.map(b => (
        <div key={b.id} className="flex items-center gap-2">
          <span>{b.icon}</span>
          <span className="font-medium">{b.nome}</span>
        </div>
      ))}
    </div>
  );
}

