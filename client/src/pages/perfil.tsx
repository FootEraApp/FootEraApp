import { useEffect, useState } from "react";
import { Link } from "wouter";
import ProfileHeader from "../components/profile/ProfileHeader";

import ActivityGrid from "../components/profile/ActivityGrid";
import BadgesList from "../components/profile/BadgesList";

import ScorePanel from "../components/profile/ScorePanel";
import TrainingProgress from "../components/profile/TrainingProgress";

export default function ProfilePage() {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);

  const [activities] = useState([
    { id: 1, type: "Treino Técnico", imageUrl: "/attached_assets/treino.jpg" },
    { id: 2, type: "Desafio", imageUrl: "/attached_assets/desafio.jpg" },
    { id: 3, type: "Partida", imageUrl: "/attached_assets/partida.jpg" }
  ]);

  const [badges] = useState([
    { id: 1, name: "Disciplina", icon: "stopwatch" },
    { id: 2, name: "Pontualidade", icon: "bullseye" },
    { id: 3, name: "Liderança", icon: "medal" }
  ]);

  const [scores] = useState({
    performance: 75,
    discipline: 90,
    responsibility: 80
  });

  useEffect(() => {
    const id = localStorage.getItem("usuarioId");
    const nome = localStorage.getItem("nomeUsuario");

    if (id) setUsuarioId(id);
    if (nome) setNomeUsuario(nome);
  }, []);

  if (!usuarioId || !nomeUsuario) {
    return <div className="text-center p-10 text-gray-600">Carregando perfil...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        name={nomeUsuario}
        score={scores.performance + scores.discipline + scores.responsibility}
        isOwnProfile
      />
      <TrainingProgress userId={usuarioId} />
      <ActivityGrid activities={activities} />
      <BadgesList badges={badges} />
      <ScorePanel
        performance={scores.performance}
        discipline={scores.discipline}
        responsibility={scores.responsibility}
      />

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          Feed
        </Link>
        <Link href="/explorar" className="hover:underline">
          Explorar
        </Link>
        <Link href="/post" className="hover:underline">
          Publicar
        </Link>
        <Link href="/treinos" className="hover:underline">
          Treinos
        </Link>
        <Link href="/perfil" className="hover:underline">
          Perfil
        </Link>
      </nav>
    </div>
    
  );
}