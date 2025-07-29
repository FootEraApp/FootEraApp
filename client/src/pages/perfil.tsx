import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import axios from "axios";

import ProfileHeader from "../components/profile/ProfileHeader";
import ActivityGrid from "../components/profile/ActivityGrid";
import BadgesList from "../components/profile/BadgesList";
import ScorePanel from "../components/profile/ScorePanel";
import TrainingProgress from "../components/profile/TrainingProgress";

interface Perfil {
  tipo: string;
  usuario: {
    nome: string;
    email: string;
    foto?: string;
  };
  dadosEspecificos: {
    nome?: string;
    idade?: number;
    posicao?: string;
    foto?: string;
    escola?: string;
    clube?: string;
    seloQualidade?: boolean;
  };
}

export default function ProfilePage() {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

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
    if (id) {
      setUsuarioId(id);
      axios.get<Perfil>(`http://localhost:3001/api/perfil/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then(res => setPerfil(res.data))
        .catch(err => console.error("Erro ao buscar perfil:", err));
    }
  }, []);

  if (!usuarioId || !perfil) {
    return <div className="text-center p-10 text-gray-600">Carregando perfil...</div>;
  }

  return (
    <div className="min-h-screen bg-yellow-50 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6 ">
        <ProfileHeader
          name={perfil.usuario.nome}
          age={perfil.dadosEspecificos.idade}
          position={perfil.dadosEspecificos.posicao}
          team={perfil.tipo === "Atleta" ? (perfil.dadosEspecificos.escola || perfil.dadosEspecificos.clube || "Atleta Independente") : undefined}
          score={scores.performance + scores.discipline + scores.responsibility}
          isOwnProfile
          foto={perfil.usuario.foto || perfil.dadosEspecificos.foto}
        />

        {perfil.tipo === "Atleta" && !perfil.dadosEspecificos.escola && !perfil.dadosEspecificos.clube && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-4 my-4 text-sm text-yellow-900">
            <strong>Atleta Independente</strong><br />
            Você pode usar todas as funcionalidades do FootEra, mas aparecer apenas em rankings públicos e de engajamento.
          </div>
        )}

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
            <House />
          </Link>
          <Link href="/explorar" className="hover:underline">
            <Search />
          </Link>
          <Link href="/post" className="hover:underline">
            <CirclePlus />
          </Link>
          <Link href="/treinos" className="hover:underline">
            <Volleyball />
          </Link>
          <Link href="/perfil" className="hover:underline">
            <User />
          </Link>
        </nav>
      </div>
    </div>
  );
}
