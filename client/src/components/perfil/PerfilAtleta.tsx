// client/src/components/perfil/PerfilAtleta.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

import ProfileHeader from "../profile/ProfileHeader.js";
import ActivityGrid from "../profile/ActivityGrid.js";
import { BadgesList } from "../profile/BadgesList.js";
import ScorePanel from "../profile/ScorePanel.js";
import TrainingProgress from "../profile/TrainingProgress.js";

type TipoAtividade = "Desafio" | "Treino" | "Vídeo";

interface Perfil {
  tipo: string;
  usuario: { id: string; nome: string; email: string; foto?: string | null };
  dadosEspecificos: {
    id?: string;
    nome?: string;
    idade?: number;
    posicao?: string;
    escola?: string | null;
    clube?: string | null;
    foto?: string | null;
    seloQualidade?: boolean;
  };
  atleta?: { id: string };
  tipoUsuarioId?: string;
}

interface Badge {
  id: string;
  nome: string;
  icon: string;
}

interface Activity {
  id: string;
  tipo: TipoAtividade;
  imagemUrl: string;
  nome: string;
}

interface Pontuacao {
  pontuacaoTotal: number;
  pontuacaoPerformance: number;
  pontuacaoDisciplina: number;
  pontuacaoResponsabilidade: number;
}

type Props = {
  /** id do usuário na URL. Se não vier, assume o próprio usuário logado */
  idDaUrl?: string;
};

export default function PerfilAtleta({ idDaUrl }: Props) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [pontuacao, setPontuacao] = useState<Pontuacao | null>(null);
  const [loading, setLoading] = useState(true);

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwnProfile = !idDaUrl || idDaUrl === Storage.usuarioId;
  const basePerfil = isOwnProfile ? "me" : (idDaUrl as string);
  const alvoUsuarioId = isOwnProfile ? (Storage.usuarioId as string) : (idDaUrl as string);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: meOuOutro }, { data: atividades }, { data: badgesData }] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}`, { headers }),
          axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}/atividades`, { headers }),
          axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}/badges`, { headers }),
        ]);

        if (cancelled) return;

        setPerfil(meOuOutro);
        const uid = (meOuOutro?.usuario?.id as string) || alvoUsuarioId || null;
        setUsuarioId(uid);

        setActivities((atividades || []).map((a: any) => ({
          id: a.id,
          tipo: a.tipo as TipoAtividade,
          imagemUrl: a.imagemUrl || "",
          nome: a.nome || a.tipo,
        })));
        setBadges(badgesData || []);

        if (uid) {
          const { data: p } = await axios.get(`${API.BASE_URL}/api/perfil/${uid}/pontuacao`, { headers });
          if (cancelled) return;

          const performance = Number(p?.performance) || 0;
          const disciplina = Number(p?.disciplina) || 0;
          const responsabilidade = Number(p?.responsabilidade) || 0;

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
        console.error("Erro ao carregar dados do perfil do atleta:", err);
        setPerfil(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDaUrl, token]);

  const handleSeguir = async () => {
    if (!perfil?.usuario?.id) return;
    try {
      await fetch(`${API.BASE_URL}/api/seguidores/seguir/${perfil.usuario.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Storage.token}` },
      });
      alert("Você passou a seguir este atleta!");
    } catch {
      alert("Não foi possível seguir agora.");
    }
  };

  const handleTreinarJuntos = () => {
    if (!perfil?.usuario?.id) return;
    window.location.href = `/treinar-juntos/${perfil.usuario.id}`;
  };

  const handleCompartilhar = async () => {
    if (!perfil?.usuario?.id) return;
    const url = `${window.location.origin}/perfil/${perfil.usuario.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link do perfil copiado!");
    } catch {
      alert(url);
    }
  };

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
    <div className="min-h-screen bg-transparent">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <ProfileHeader
          nome={perfil.usuario.nome}
          idade={perfil.dadosEspecificos.idade}
          posicao={perfil.dadosEspecificos.posicao}
          time={
            perfil.tipo === "Atleta"
              ? (perfil.dadosEspecificos.escola ||
                 perfil.dadosEspecificos.clube ||
                 "Independente")
              : undefined
          }
          pontuacao={total}
          isOwnProfile={isOwnProfile}
          foto={perfil.usuario.foto || perfil.dadosEspecificos.foto || undefined}
          perfilId={idDaUrl || perfil.usuario.id}
        />

        {/* Aviso de Independente */}
        {isIndependente && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-4 my-4 text-sm text-yellow-900">
            <div className="font-semibold">Atleta Independente</div>
            Você pode usar todas as funcionalidades do FootEra, mas aparecerá apenas em
            rankings públicos e de engajamento.
          </div>
        )}

        {/* Ações rápidas (seguir, treinar juntos, compartilhar) */}
        {!isOwnProfile && (
          <div className="flex gap-2 my-4">
            <button
              onClick={handleSeguir}
              className="px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800"
            >
              Seguir
            </button>
            <button
              onClick={handleTreinarJuntos}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Treinar juntos
            </button>
            <button
              onClick={handleCompartilhar}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Compartilhar perfil
            </button>
          </div>
        )}

        {/* Progresso de Treinos */}
        <TrainingProgress
          userId={perfil.usuario.id}
          tipoUsuarioId={
            perfil.tipoUsuarioId ??
            perfil.atleta?.id ??
            perfil.dadosEspecificos?.id ??
            null
          }
        />

        {/* Atividades recentes */}
        <ActivityGrid activities={activities} />

        {/* Badges */}
        <BadgesList userId={usuarioId ?? undefined} badges={badges} />

        {/* Painel de Pontuação */}
        {pontuacao && (
          <ScorePanel
            performance={pontuacao.pontuacaoPerformance}
            disciplina={pontuacao.pontuacaoDisciplina}
            responsabilidade={pontuacao.pontuacaoResponsabilidade}
          />
        )}
      </div>
    </div>
  );
}
