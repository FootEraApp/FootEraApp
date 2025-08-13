import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import axios from "axios";
import Storage from "../../../server/utils/storage";
import { API } from "../config";

import ProfileHeader from "../components/profile/ProfileHeader";
import ActivityGrid from "../components/profile/ActivityGrid";
import { BadgesList } from "../components/profile/BadgesList";
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
    escola?: string;
    clube?: string;
    foto?: string;
    seloQualidade?: boolean;
  };
}

interface Badge {
  id: string;
  nome: string;
  icon: string;
}

interface Activity {
  id: string;
  tipo: "Desafio" | "Treino" | "Vídeo";
  imagemUrl: string;
  nome: string;
}

interface Pontuacao {
  pontuacaoTotal: number;
  pontuacaoPerformance: number;
  pontuacaoDisciplina: number;
  pontuacaoResponsabilidade: number;
}

export default function ProfilePage() {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [pontuacao, setPontuacao] = useState<Pontuacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Storage.token;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API.BASE_URL}/api/perfil/me`, { headers }),
      axios.get(`${API.BASE_URL}/api/perfil/me/atividades`, { headers }),
      axios.get(`${API.BASE_URL}/api/perfil/me/badges`, { headers }),
      axios.get(`${API.BASE_URL}/api/perfil/me/pontuacao`, { headers }),
    ])
      .then(([perfilRes, atividadesRes, badgesRes, pontuacaoRes]) => {
        setPerfil(perfilRes.data);
        setUsuarioId(perfilRes.data?.usuario?.id ?? null);
        setBadges(badgesRes.data || []);
        setActivities(atividadesRes.data.map((a: any) => ({
          id: a.id,
          tipo: a.tipo,
          imagemUrl: a.imagemUrl || "",
          nome: a.nome || a.tipo
        })));
        
        const {
          performance = 0,
          disciplina = 0,
          responsabilidade = 0
        } = pontuacaoRes.data || {};
        setPontuacao({
          pontuacaoTotal: performance + disciplina + responsabilidade,
          pontuacaoPerformance: performance,
          pontuacaoDisciplina: disciplina,
          pontuacaoResponsabilidade: responsabilidade,
        });
      })
      .catch((err) => {
        console.error("Erro ao carregar dados do perfil:", err);
        setPerfil(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  }

  if (!perfil) {
    return <div className="text-center p-10 text-red-600">Erro ao carregar perfil.</div>;
  }

  const isIndependente =
    perfil.tipo === "Atleta" &&
    !perfil.dadosEspecificos.escola &&
    !perfil.dadosEspecificos.clube;

  const total = pontuacao?.pontuacaoTotal || 0;

  return (
    <div className="min-h-screen bg-transparent pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <ProfileHeader
          name={perfil.usuario.nome}
          age={perfil.dadosEspecificos.idade}
          position={perfil.dadosEspecificos.posicao}
          team={
            perfil.tipo === "Atleta"
              ? perfil.dadosEspecificos.escola ||
                perfil.dadosEspecificos.clube ||
                "Independente"
              : undefined
          }
          score={total}
          isOwnProfile
          foto={perfil.usuario.foto || perfil.dadosEspecificos.foto}
        />

        {isIndependente && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-4 my-4 text-sm text-yellow-900">
            <strong>Atleta Independente</strong><br />
            Você pode usar todas as funcionalidades do FootEra, mas aparecerá apenas em rankings públicos e de engajamento.
          </div>
        )}

        <TrainingProgress userId={usuarioId} />
        <ActivityGrid activities={activities} />
        <BadgesList userId={usuarioId} badges={badges} />
        {pontuacao && (
          <ScorePanel
            performance={pontuacao.pontuacaoPerformance}
            discipline={pontuacao.pontuacaoDisciplina}
            responsibility={pontuacao.pontuacaoResponsabilidade}
          />
        )}

        <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
          <Link href="/feed"><House /></Link>
          <Link href="/explorar"><Search /></Link>
          <Link href="/post"><CirclePlus /></Link>
          <Link href="/treinos"><Volleyball /></Link>
          <Link href="/perfil"><User /></Link>
        </nav>
      </div>
    </div>
  );
}
