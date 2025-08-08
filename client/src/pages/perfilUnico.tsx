import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import Storage from "../../../server/utils/storage";
import { API } from "../config";

import ProfileHeader from "../components/profile/ProfileHeader";
import ActivityGrid from "../components/profile/ActivityGrid";
import { BadgesList } from "../components/profile/BadgesList";
import ScorePanel from "../components/profile/ScorePanel";
import TrainingProgress from "../components/profile/TrainingProgress";

interface Badge {
  id: string;
  titulo: string;
  imagemUrl: string;
}

interface Activity {
  id: string;
  tipo: "Desafio" | "Treino" | "Vídeo";
  imagemUrl: string;
  nome: string;
}

export default function PerfilUnico() {
  const { id } = useParams<{ id: string }>();
  const [usuario, setUsuario] = useState<any>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
    
  const [scores] = useState({
    performance: 75,
    discipline: 90,
    responsibility: 80
  });

  const seguirUsuario = async () => {
  const token = Storage.token;
  try {
    const response = await fetch(`${API.BASE_URL}/api/seguidores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ seguidoUsuarioId: id }), 
    });

    if (!response.ok) throw new Error("Erro ao seguir usuário");

    alert("Agora você está seguindo este usuário!");
  } catch (error) {
    console.error(error);
  }
};

const solicitarTreino = async () => {
  const token = Storage.token;

  try {
    const response = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ destinatarioId: id }),
    });

    if (!response.ok) throw new Error("Erro ao solicitar treino");

    alert("Solicitação enviada!");
  } catch (error) {
    console.error(error);
  }
};

  useEffect(() => {

  if (!id || id === "editar" || id === "configuracoes") {
    console.warn("⚠️ id inválido detectado (nulo,'editar' ou 'configuracoes'), abortando fetch.");
    return;
  }

  setUsuarioId(id);

  const loggedInId = Storage.usuarioId || "";
  const token = Storage.token;

  if (id === loggedInId) {
    setIsOwnProfile(true);
  }

  fetch(`${API.BASE_URL}/api/perfil/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error("Não autorizado");
      return res.json();
    })
    .then(data => {
      console.log("✅ Dados recebidos:", data);
      setUsuario(data);
    })
    .catch((err) => {
      console.error("❌ Erro ao buscar perfil:", err);
    });
  }, [id]);

  if (!usuario ) return <div className="text-center p-10 text-gray-600"></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        name={
          usuario.dadosEspecificos?.nome && usuario.dadosEspecificos?.sobrenome
            ? `${usuario.dadosEspecificos.nome} ${usuario.dadosEspecificos.sobrenome}`
            : usuario.dadosEspecificos?.nome || usuario.usuario.nome || "Usuário"
        }
        score={scores.performance + scores.discipline + scores.responsibility}
        isOwnProfile={isOwnProfile}
        foto={usuario.usuario.foto}
      />

      {!isOwnProfile && (
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={seguirUsuario}
            className="px-4 py-2 bg-green-600 text-white rounded-full"
          >
            Seguir
          </button>
          <button
            onClick={solicitarTreino}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-full"
          >
            Treinar Juntos
          </button>
        </div>
      )}

      <TrainingProgress userId={id} />
      <ActivityGrid activities={activities} />
      {usuarioId && <BadgesList userId={usuarioId} />}
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
  );
}