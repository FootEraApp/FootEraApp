import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import axios from "axios";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

import ProfileHeader from "../components/profile/ProfileHeader.js";
import ActivityGrid from "../components/profile/ActivityGrid.js";
import { BadgesList } from "../components/profile/BadgesList.js";
import ScorePanel from "../components/profile/ScorePanel.js";
import TrainingProgress from "../components/profile/TrainingProgress.js";

interface Perfil {
  tipo: string;
  usuario: { id: string; nome: string; email: string; foto?: string };
  dadosEspecificos: {
    id?: string; 
    nome?: string; idade?: number; posicao?: string;
    escola?: string; clube?: string; foto?: string; seloQualidade?: boolean;
  };
  atleta?: { id: string };
  tipoUsuarioId?: string;     
}

interface Badge { id: string; nome: string; icon: string; }
interface Activity { id: string; tipo: "Desafio" | "Treino" | "Vídeo"; imagemUrl: string; nome: string; }
interface Pontuacao { pontuacaoTotal: number; pontuacaoPerformance: number; pontuacaoDisciplina: number; pontuacaoResponsabilidade: number; }

export default function ProfilePage() {
  const { id: idDaUrl } = useParams<{ id?: string }>();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [pontuacao, setPontuacao] = useState<Pontuacao | null>(null);
  const [loading, setLoading] = useState(true);

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwnProfile = !idDaUrl || idDaUrl === Storage.usuarioId;
  const basePerfil = isOwnProfile ? "me" : idDaUrl!;
  const alvoUsuarioId = isOwnProfile ? (Storage.usuarioId as string) : (idDaUrl as string);

  useEffect(() => {
    if (!token) return;

    (async () => {
      setLoading(true);
      try {
        const [{ data: meOuOutro }, { data: atividades }, { data: badgesData }] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}`, { headers }),
          axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}/atividades`, { headers }),
          axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}/badges`, { headers }),
        ]);

        setPerfil(meOuOutro);
        const uid = (meOuOutro?.usuario?.id as string) || alvoUsuarioId || null;
        setUsuarioId(uid);

        setActivities((atividades || []).map((a: any) => ({
          id: a.id, tipo: a.tipo, imagemUrl: a.imagemUrl || "", nome: a.nome || a.tipo,
        })));
        setBadges(badgesData || []);

        if (uid) {
          const { data: p } = await axios.get(
            `${API.BASE_URL}/api/perfil/${uid}/pontuacao`,
            { headers }
          );
          const performance = p?.performance ?? 0;
          const disciplina = p?.disciplina ?? 0;
          const responsabilidade = p?.responsabilidade ?? 0;

          setPontuacao({
            pontuacaoTotal: performance + disciplina + responsabilidade,
            pontuacaoPerformance: performance,
            pontuacaoDisciplina: disciplina,
            pontuacaoResponsabilidade: responsabilidade,
          });
        } else {
          setPontuacao(null);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do perfil:", err);
        setPerfil(null);
      } finally {
        setLoading(false);
      }
    })();

  }, [idDaUrl, token]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!perfil)   return <div className="text-center p-10 text-red-600">Erro ao carregar perfil.</div>;

  const isIndependente =
    perfil.tipo === "Atleta" &&
    !perfil.dadosEspecificos.escola &&
    !perfil.dadosEspecificos.clube;

  const total = pontuacao?.pontuacaoTotal || 0;

  const handleSeguir = async () => {
  try {
    await fetch(`${API.BASE_URL}/api/seguidores/seguir/${perfil!.usuario.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Storage.token}` },
    });
    alert("Você passou a seguir este atleta!");
  } catch {
    alert("Não foi possível seguir agora.");
  }
};

const handleTreinarJuntos = () => {
  window.location.href = `/treinar-juntos/${perfil!.usuario.id}`;
};

const handleCompartilhar = async () => {
  const url = `${window.location.origin}/perfil/${perfil!.usuario.id}`;
  try {
    await navigator.clipboard.writeText(url);
    alert("Link do perfil copiado!");
  } catch {
    alert(url);
  }
};

  return (
    <div className="min-h-screen bg-transparent pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <ProfileHeader
          nome={perfil.usuario.nome}
          idade={perfil.dadosEspecificos.idade}
          posicao={perfil.dadosEspecificos.posicao}
          time={perfil.tipo === "Atleta" ? (perfil.dadosEspecificos.escola || perfil.dadosEspecificos.clube || "Independente") : undefined}
          pontuacao={total}
          isOwnProfile={isOwnProfile}
          foto={perfil.usuario.foto || perfil.dadosEspecificos.foto}
          perfilId={idDaUrl || perfil.usuario.id}
        />

        {isIndependente && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-4 my-4 text-sm text-yellow-900">
            <strong>Atleta Independente</strong><br />
            Você pode usar todas as funcionalidades do FootEra, mas aparecerá apenas em rankings públicos e de engajamento.
          </div>
        )}

        <TrainingProgress
          userId={perfil.usuario.id}
          tipoUsuarioId={
            perfil.tipoUsuarioId ??
            perfil.atleta?.id ??
            perfil.dadosEspecificos?.id ??
            null
          }
        />
        <ActivityGrid activities={activities} />
        <BadgesList userId={usuarioId ?? undefined} badges={badges} />

        {pontuacao && (
          <ScorePanel
            performance={pontuacao.pontuacaoPerformance}
            disciplina={pontuacao.pontuacaoDisciplina}
            responsabilidade={pontuacao.pontuacaoResponsabilidade}
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
