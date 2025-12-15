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
  idDaUrl?: string;
};

function pickProfessorNome(anyData: any): string | null {
  if (!anyData) return null;
  const o = Array.isArray(anyData) ? anyData[0] : anyData;

  if (o?.professor?.nome) return o.professor.nome;
  if (o?.treinador?.nome) return o.treinador.nome;
  if (o?.dadosEspecificos?.professor) return o.dadosEspecificos.professor;
  if (o?.dadosEspecificos?.professorNome) return o.dadosEspecificos.professorNome;

  if (o?.tipo === "Professor" && o?.nome) return o.nome;
  if (o?.usuario?.tipo === "Professor" && o?.usuario?.nome) return o.usuario.nome;

  return null;
}

function VinculosCard({
  professor,
  escola,
  clube,
}: { professor?: string | null; escola?: string | null; clube?: string | null }) {
  const items = [
    { icon: "👨‍🏫", label: "Professor", value: professor },
    { icon: "🏫",   label: "Escola",    value: escola },
    { icon: "🏟️",   label: "Clube",     value: clube },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4 my-4">
      <div className="text-green-900 font-semibold mb-3">Vínculos</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it, idx) => (
          <VinculoItem key={idx} icon={it.icon} label={it.label} value={it.value!} />
        ))}
      </div>
    </div>
  );
}

function VinculoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-green-50 border rounded-lg">
      <span className="text-xl">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-green-800">{label}</div>
        <div className="font-medium truncate" title={value}>{value}</div>
      </div>
    </div>
  );
}

export default function PerfilAtleta({ idDaUrl }: Props) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [pontuacao, setPontuacao] = useState<Pontuacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [professor, setProfessor] = useState<{ id?: string; nome: string } | null>(null);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [clubeNome, setClubeNome] = useState<string | null>(null);
  const [scoreDelta, setScoreDelta] = useState(0);

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwnProfile = !idDaUrl || idDaUrl === Storage.usuarioId;
  const basePerfil = isOwnProfile ? "me" : (idDaUrl as string);
  const alvoUsuarioId = isOwnProfile ? (Storage.usuarioId as string) : (idDaUrl as string);

  useEffect(() => {
  if (!token) return;

  let alive = true;
  (async () => {
    setLoading(true);
    try {
      const [{ data: meOuOutro }, { data: atividades }, { data: badgesData }] = await Promise.all([
        axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}`, { headers }),
        axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}/atividades`, { headers }),
        axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}/badges`, { headers }),
      ]);
      if (!alive) return;

      setPerfil(meOuOutro);
      const uid = (meOuOutro?.usuario?.id as string) || alvoUsuarioId || null;
      setUsuarioId(uid);

      let escola = meOuOutro?.dadosEspecificos?.escola ?? null;
      let clube  = meOuOutro?.dadosEspecificos?.clube  ?? null;
      let prof   = meOuOutro?.dadosEspecificos?.professor ?? null;

      if (meOuOutro?.tipo === "Atleta") {
        const idParaConsulta =
          meOuOutro?.dadosEspecificos?.atletaId ??
          meOuOutro?.atleta?.id ??
          meOuOutro?.usuario?.id ??
          alvoUsuarioId;

        try {
          const { data: vinc } = await axios.get(
            `${API.BASE_URL}/api/atletas/${idParaConsulta}/vinculos-basic`,
            { headers }
          );
          if (!alive) return;

          escola = vinc?.escolinha?.nome ?? escola;
          clube  = vinc?.clube?.nome     ?? clube;
          prof   = vinc?.professor?.nome ?? prof;
        } catch (e) {
       }
      }

      setEscolaNome(escola);
      setClubeNome(clube);
      setProfessor(prof ? { nome: prof } : null);

      setActivities((atividades || []).map((a: any) => ({
        id: a.id,
        tipo: a.tipo as TipoAtividade,
        imagemUrl: a.imagemUrl || "",
        nome: a.nome || a.tipo,
      })));
      setBadges(badgesData || []);

      if (uid) {
        const { data: p } = await axios.get(`${API.BASE_URL}/api/perfil/${uid}/pontuacao`, { headers });
        if (!alive) return;
        const performance = Number(p?.performance) || 0;
        const disciplina = Number(p?.disciplina) || 0;
        const responsabilidade = Number(p?.responsabilidade) || 0;

        setPontuacao({
          pontuacaoTotal: performance + disciplina + responsabilidade,
          pontuacaoPerformance: performance,
          pontuacaoDisciplina: disciplina,
          pontuacaoResponsabilidade: responsabilidade,
        });

        const totalAtual = performance + disciplina + responsabilidade;
        const viewerId = String(Storage?.usuarioId ?? "");
        const key = `lastSeenScore:${viewerId}:${uid}`;
        const last = Number(localStorage.getItem(key) ?? 0);
        const d = Math.max(0, totalAtual - last);
        setScoreDelta(d);
        setTimeout(() => { try { localStorage.setItem(key, String(totalAtual)); } catch {} }, 2000);
      } else {
        setPontuacao(null);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do perfil do atleta:", err);
      setPerfil(null);
    } finally {
      if (alive) setLoading(false);
    }
  })();

  return () => { alive = false; };
}, [idDaUrl, token]);

  if (loading) {
    return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  }
  if (!perfil) {
    return <div className="text-center p-10 text-red-600">Erro ao carregar perfil.</div>;
  }
  
  const temVinculo = Boolean(professor?.nome || escolaNome || clubeNome);
  const isIndependente = perfil.tipo === "Atleta" && !temVinculo;

  const total = pontuacao?.pontuacaoTotal || 0;

  const timeLabel =
    professor?.nome ||
    escolaNome ||
    clubeNome ||
    (isIndependente ? "Atleta Independente" : undefined);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-3xl mx-auto px-4 py-6">
<ProfileHeader
  nome={perfil.usuario.nome}
  idade={perfil.dadosEspecificos.idade}
  posicao={perfil.dadosEspecificos.posicao}
  pontuacao={total}
  scoreDelta={scoreDelta}
  isOwnProfile={isOwnProfile}
  foto={perfil.usuario.foto || perfil.dadosEspecificos.foto || undefined}

  perfilId={perfil.usuario.id}          
  perfilTipoProp="atleta"
  perfilTipoIdProp={perfil.dadosEspecificos.id} 
/>

        <VinculosCard
          professor={professor?.nome || null}
          escola={escolaNome}
          clube={clubeNome}
        />

        {isIndependente && (
          <div className="bg-yellow-100 border border-yellow-300 rounded p-4 my-4 text-sm text-yellow-900">
            <div className="font-semibold">Atleta Independente</div>
            Você pode usar todas as funcionalidades do FootEra, mas aparecerá apenas em
            rankings públicos e de engajamento.
          </div>
        )}

        <TrainingProgress
          userId={perfil.usuario.id}
          tipoUsuarioId={
            perfil.tipoUsuarioId ?? perfil.dadosEspecificos?.id ?? perfil.atleta?.id ?? null
          }
        />

        <ActivityGrid activities={activities} perfilUsuarioId={usuarioId ?? perfil.usuario.id} />
        <BadgesList userId={usuarioId ?? undefined} badges={badges} />

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