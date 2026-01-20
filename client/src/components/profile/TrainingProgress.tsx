import { useMemo, useEffect, useState} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format as formatDateFns, startOfDay, endOfMonth } from "date-fns";
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpRight, Calendar, CheckCircle2, Clock,
  CalendarClock, Medal, TrendingUp, Trophy
} from 'lucide-react';
import { Card, CardContent } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js';
import { Link, useLocation} from 'wouter';
import { API } from '../../config.js';
import Storage from '../../../../server/utils/storage.js';

type Training = {
  id: string;
  titulo: string;
  dataTreino: string | null;
  prazoEnvio?: string | null;
  duracaoMinutos?: number | null;
  exercicios?: Array<any>;
  tipo?: string | null;
  imagemUrl?: string | null;
  status?: string | null;
  temSubmissao?: boolean;
};

type Earned = {
  id: string;
  entity?: string;
  title: string;
  description: string;
  icon?: string;
  tier?: "bronze" | "prata" | "ouro" | "platina";
  group?: string;
};

const HIDE_PATTERNS = [
  /disciplina/i,
  /responsabilidade/i,
  /pontualidade/i,
  /lideran[cç]a/i,
];

function isHiddenTitle(t: string) {
  return HIDE_PATTERNS.some((r) => r.test(t));
}
function tierScore(t?: Earned["tier"]) {
  if (t === "platina") return 4;
  if (t === "ouro") return 3;
  if (t === "prata") return 2;
  if (t === "bronze") return 1;
  return 0;
}
function isDesafioEarned(e: Earned) {
  const t = String(e?.title ?? "");
  const d = String(e?.description ?? "");
  const g = String(e?.group ?? "");

  return /desaf/i.test(g) || /desaf/i.test(t) || /desaf/i.test(d);
}
function extractNum(s: string) {
  const all = [...String(s).matchAll(/\d+/g)];
  if (!all.length) return 0;
  return Math.max(...all.map((m) => parseInt(m[0], 10)));
}
function chooseHardest(list: Earned[], k = 6) {
  const filtered = list.filter((b) => !isHiddenTitle(b.title));
  return filtered
    .sort((a, b) => {
      const tb = tierScore(b.tier) - tierScore(a.tier);
      if (tb !== 0) return tb;
      const nb = extractNum(b.title) || extractNum(b.id);
      const na = extractNum(a.title) || extractNum(a.id);
      return nb - na;
    })
    .slice(0, k);
}

function extractTierFromDescricao(desc?: string | null): Earned["tier"] {
  if (!desc) return undefined;
  const m = desc.match(/Tier:\s*(bronze|prata|ouro|platina)/i);
  const t = (m?.[1] || "").toLowerCase();
  if (t === "bronze" || t === "prata" || t === "ouro" || t === "platina") return t;
  return undefined;
}
function getActivityLink(a: any): string | null {
  if (a?.treinoAgendadoId) {
    return `/treinos/${a.treinoAgendadoId}`;
  }

  if (a?.treinoProgramadoId) {
    return `/treinos/${a.treinoProgramadoId}`;
  }

  if (a?.desafioId) {
    return `/desafios/${a.desafioId}`;
  }

  return null;
}

function extractGrupoFromDescricao(desc?: string | null): string | null {
  if (!desc) return null;
  const m = desc.match(/Grupo:\s*([^\n\r•]+)/i);
  const g = m?.[1]?.trim();
  return g ? g : null;
}

function groupLabelFromTipo(tipo?: string | null): string {
  const t = String(tipo || "").toUpperCase();
  if (t === "TREINO") return "Treinos";
  if (t === "DESAFIO") return "Desafios";
  if (t === "PERFIL") return "Pontuação";
  if (t === "ORGANIZACAO") return "Gestão";
  if (t === "EVENTO") return "Eventos";
  return "Outros";
}

interface TrainingProgressProps {
  userId: string | null;
  tipoUsuarioId?: string | null;
}

const ENABLE_CHALLENGES_TAB = false; 
const toDate = (v?: string | null) => (v ? new Date(v) : null);
    
const dayKey = (d: Date) => formatDateFns(d, "yyyy-MM-dd");

function safeDateFromWire(v?: string | null): Date | null {
  if (!v) return null;
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      return new Date(y, mo, d);
    }
  }

  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return null;

  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : Array.isArray(v?.badges) ? v.badges : Array.isArray(v?.conquistas) ? v.conquistas : [];
}

function getActivityImage(a: any): string | null {
  const raw =
    a?.imagemUrl ??
    a?.imagem ??
    a?.midiaUrl ??
    a?.foto ??
    a?.treino?.imagemUrl ??
    a?.desafio?.imagemUrl ??
    a?.treinoProgramado?.imagemUrl ??
    null;

  if (!raw) return null;
  const s = String(raw);
  if (s.startsWith("http")) return s;
  if (s.startsWith("/")) return s;
  return `${API.BASE_URL}/${s.replace(/^\/+/, "")}`;
}

function pickNumber(...vals: any[]): number {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const m = v.match(/-?\d+(?:\.\d+)?/);
      if (m) {
        const n = Number(m[0]);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return 0;
}

function computeFromHistorico(wire?: any) {
  const hist: any[] = Array.isArray(wire?.historico) ? wire.historico : [];

  const isTreino = (t: any) =>
    /treino/i.test(String(t?.tipo ?? t?.categoria ?? ""));
  const isDesafio = (t: any) =>
    /desaf/i.test(String(t?.tipo ?? t?.categoria ?? ""));

  const isConcluido = (t: any) => /conclu|aprov|finaliz|valid|ok|encerr/i
    .test(String(t?.status ?? t?.situacao ?? ""));

  const treinosConcluidos  = hist.filter((t) => isTreino(t)  && isConcluido(t));
  const desafiosConcluidos = hist.filter((t) => isDesafio(t) && isConcluido(t));

  const eventosPontuaveis = [...treinosConcluidos, ...desafiosConcluidos];
  const performance = eventosPontuaveis.reduce((acc, it) => {
    const p = pickNumber(
      it?.pontos,
      it?.pontuacao,
      it?.pontosPerformance,
      it?.pontosDesafio,
      it?.score,
      it?.totalPontos,
      it?.valor
    );
    return acc + p;
  }, 0);

  const disciplina = treinosConcluidos.length * 2;
  const responsabilidade = desafiosConcluidos.length * 2;

  return {
    performance,
    disciplina,
    responsabilidade,
    total: performance + disciplina + responsabilidade,
  };
}

export default function TrainingProgress({ userId, tipoUsuarioId }: TrainingProgressProps) {
  const qc = useQueryClient();
  const token = Storage.token || '';
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const targetUserId = userId ?? (Storage.usuarioId as string) ?? "";
  const debugLoggedIds = useState(() => new Set<string>())[0];

  const [, setLocation] = useLocation();
  const [resumoModal, setResumoModal] = useState<{
    treinoAgendadoId: string;
    treino: Training;
  } | null>(null);

  const fecharResumo = () => setResumoModal(null);

  function abrirTreinoAtividade(a: any) {
    const treinoAgendadoId = String(
      a?.treinoAgendadoId ?? a?.treinoAgendado?.id ?? ""
    ).trim();

    if (treinoAgendadoId) {
      const encontrado = (treinosAgendados || []).find(
        (t) => String(t?.id) === String(treinoAgendadoId)
      );

      if (encontrado) {
        setResumoModal({ treinoAgendadoId, treino: encontrado });
        return;
      }

      setLocation(`/submissao?treinoAgendadoId=${encodeURIComponent(treinoAgendadoId)}`);
      return;
    }
    setLocation("/trainings");
  }

  const { data: perfil } = useQuery<any>({
    queryKey: ["perfil-basico", targetUserId],
    enabled: Boolean(token && targetUserId && !tipoUsuarioId),
    queryFn: async () => {
      const r = await fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(targetUserId)}`, { headers });
      if (!r.ok) throw new Error("Erro ao buscar perfil");
      return r.json();
    },
  });

  const resolvedTipoUsuarioId =
    tipoUsuarioId ||
    perfil?.atleta?.id ||
    perfil?.professor?.id ||
    perfil?.clube?.id ||
    perfil?.escolinha?.id ||
    null;

  const normalizeTipoTreino = (v?: string | null) => {
    if (!v) return null;
    const s = String(v).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (s.includes("fis")) return "Físico";
    if (s.includes("tec")) return "Técnico";
    if (s.includes("tat")) return "Tático";
    if (s.includes("men")) return "Mental";
    return v;
  };

  const { data: atividades = [] } = useQuery<any[]>({
    queryKey: ["perfilAtividades", targetUserId],
    enabled: Boolean(token && targetUserId),
    queryFn: async () => {
      const url = `${API.BASE_URL}/api/perfil/${encodeURIComponent(targetUserId)}/atividades`;
      const r = await fetch(url, { headers });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: conquistasEarned = [] } = useQuery<Earned[]>({
    queryKey: ["conquistas-earned", targetUserId],
    enabled: Boolean(token && targetUserId),
    queryFn: async () => {
      const ownerId = targetUserId;
      const url = `${API.BASE_URL.replace(/\/+$/, "")}/api/conquistas/${encodeURIComponent(ownerId)}?sync=1`;
      const r = await fetch(url, { headers });
      if (!r.ok) return [];

      const data = await r.json();

      const earnedRaw = Array.isArray(data?.earned) ? data.earned : [];
      const onlyDone = earnedRaw.filter((e: any) => Boolean(e?.concluida));

      const mapped: Earned[] = onlyDone
        .map((e: any) => {
          const c = e?.conquista || {};
          const desc = c?.descricao ?? null;

          const group = extractGrupoFromDescricao(desc) || groupLabelFromTipo(c?.tipo);
          const tier =
            extractTierFromDescricao(desc) ||
            (typeof c?.tier === "string" ? c.tier : undefined);

          return {
            id: String(c?.id ?? e?.conquistaId ?? e?.id ?? ""),
            title: String(c?.titulo ?? ""),
            description: String(c?.descricao ?? ""),
            icon: c?.icon ?? undefined,
            tier,
            group,
          };
        })
        .filter((x: Earned) => Boolean(x.id) && Boolean(x.title));
      return mapped.filter((e) => !isDesafioEarned(e));
    },
  });

  const conquistasDestaque = useMemo(() => {
    return chooseHardest(conquistasEarned, 4);
  }, [conquistasEarned]);

  const atletaId = resolvedTipoUsuarioId || (Storage.tipoUsuarioId as string) || "";
  const base = `${API.BASE_URL}/api/treinos/agendados`;
  const url = `${base}?atletaId=${encodeURIComponent(atletaId)}&apenasFuturos=1&apenasComSubmissao=0`;

  const { data: treinosAgendados = [], isLoading: isLoadingTreinos } = useQuery<Training[]>({
    queryKey: ["treinosAgendados", atletaId],
    enabled: Boolean(token && atletaId),
    queryFn: async () => {
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error((await r.text()) || "Erro ao buscar treinos agendados");
      const raw = await r.json();

      return (Array.isArray(raw) ? raw : []).map((t: any) => {
       
      const submissaoTreinosCount =
        typeof t?.submissaoTreinos === "number"
          ? t.submissaoTreinos
          : typeof t?.submissaoTreinos === "string"
            ? Number(t.submissaoTreinos)
            : null;

      const temSubmissao =
        Boolean(t?.submissao?.feito === true) ||
        Boolean(
          typeof t?.submissaoTreinos === "number" && t.submissaoTreinos > 0
        );
        Boolean(t?.submissaoTreinoId || t?.submissaoId) ||
        Boolean(t?.submissaoTreino?.id || t?.submissao?.id) ||
        (Array.isArray(t?.submissoesTreino) && t.submissoesTreino.some((s: any) => s?.id)) ||
        (Array.isArray(t?.submissoes) && t.submissoes.some((s: any) => s?.id));

        const dataTreinoWire =
          t?.dataTreino ??
          t?.dataHora ??                
          t?.data ??                    
          t?.dataAgendada ??            
          t?.treinoProgramado?.dataAgendada ??
          t?.treinoProgramado?.dataTreino ??
          null;

        const prazoWire =
          t?.prazoEnvio ??
          t?.dataExpiracao ??
          t?.prazo ??
          t?.dataLimite ??
          null;

        return {
          id: t.id,
          titulo: t.titulo ?? t?.treinoProgramado?.nome ?? "Treino",
          dataTreino: dataTreinoWire,
          prazoEnvio: prazoWire ?? dataTreinoWire,
          duracaoMinutos: t?.treinoProgramado?.duracao ?? t.duracaoMinutos ?? null,
          tipo: normalizeTipoTreino(
            t?.treinoProgramado?.tipoTreino ??
              t?.tipo ??
              (Array.isArray(t?.categoria) ? t.categoria[0] : t?.categoria) ??
              null
          ),
          imagemUrl: t?.treinoProgramado?.imagemUrl ?? t?.imagemUrl ?? null,
          status: t?.status ?? null,
          temSubmissao,
        };
      });
    },
  });

  const { data: resumo, isLoading: isLoadingResumo } = useQuery({
    queryKey: ["perfilResumoTreinos", targetUserId],
    enabled: Boolean(token && targetUserId),
    queryFn: async () => {
      const r = await fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(targetUserId)}/treinos`, { headers });
      if (!r.ok) throw new Error("Erro ao buscar resumo de treinos");
      return r.json();
    },
  });

  const { data: pontuacao, isLoading: isLoadingPontuacao } = useQuery({
    queryKey: ["pontuacaoPerfil", targetUserId],
    enabled: Boolean(token && targetUserId),
    queryFn: async () => {
      const url = `${API.BASE_URL}/api/perfil/${encodeURIComponent(targetUserId)}/pontuacao`;
      const r = await fetch(url, { headers });
      if (r.status === 404) return { performance: 0, disciplina: 0, responsabilidade: 0 };
      if (!r.ok) throw new Error("Erro ao buscar pontuação do perfil");
      return r.json();
    },
  });

  const trainingStats = useMemo(
    () => ({
      completed: resumo?.completos ?? 0,
      totalHours: Number(resumo?.horas ?? 0).toFixed(1),
    }),
    [resumo]
  );

  const calcTop = useMemo(() => {
    const performance = Number((pontuacao as any)?.performance) || 0;
    const disciplina = Number((pontuacao as any)?.disciplina) || 0;
    const responsabilidade = Number((pontuacao as any)?.responsabilidade) || 0;

    return {
      performance,
      disciplina,
      responsabilidade,
      total: performance + disciplina + responsabilidade,
    };
  }, [pontuacao]);

  const totalPontosTopo = calcTop.performance + calcTop.disciplina + calcTop.responsabilidade;

  const raw = resumo?.categorias || {};
  const catFisico = (raw as any).Fisico ?? (raw as any)['Físico'] ?? 0;
  const catTecnico = (raw as any).Tecnico ?? (raw as any)['Técnico'] ?? 0;
  const catTatico = (raw as any).Tatico ?? (raw as any)['Tático'] ?? 0;
  const catMental = (raw as any).Mental ?? 0;
  const totalConcluidos = trainingStats.completed || 1;

  const upcomingTrainings = useMemo(() => {
    const today = startOfDay(new Date());
    const todayKey = dayKey(today);

    return treinosAgendados
      .filter((t) => {
        if (t.temSubmissao) return false;
        if (t.status === "CONCLUIDO") return false;

        const d = safeDateFromWire(t.dataTreino);
        if (!d) return false;
        if (dayKey(d) < todayKey) return false;

        return true;
      })
      .sort((a, b) => {
        const da = safeDateFromWire(a.dataTreino);
        const db = safeDateFromWire(b.dataTreino);
        return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
      });
  }, [treinosAgendados]);

  const pendentesCount = useMemo(() => upcomingTrainings.length, [upcomingTrainings]);

  useEffect(() => {
    for (const t of upcomingTrainings) {
      const id = String(t?.id ?? "");
      if (!id) continue;

      if (debugLoggedIds.has(id)) continue;
      debugLoggedIds.add(id);

      const d = safeDateFromWire(t.dataTreino);
    }
  }, [upcomingTrainings, debugLoggedIds]);

  useEffect(() => {
    const keyId = atletaId || targetUserId;

    const refetchTreinos = () =>
      qc.invalidateQueries({ queryKey: ["treinosAgendados", keyId] });

    const refetchResumo = () => {
      qc.invalidateQueries({ queryKey: ["perfilResumoTreinos", targetUserId] });
      qc.invalidateQueries({ queryKey: ["pontuacaoPerfil", targetUserId] });
      qc.invalidateQueries({ queryKey: ["perfilAtividades", targetUserId] });
    };

    window.addEventListener("treino:agendado", refetchTreinos);
    window.addEventListener("treino:submetido", refetchTreinos);
    window.addEventListener("perfil:refresh", refetchResumo);

    return () => {
      window.removeEventListener("treino:agendado", refetchTreinos);
      window.removeEventListener("treino:submetido", refetchTreinos);
      window.removeEventListener("perfil:refresh", refetchResumo);
    };
  }, [qc, atletaId, targetUserId]);

  useEffect(() => {
    const tipoAtual = upcomingTrainings?.[0]?.tipo;
    if (tipoAtual) {
      localStorage.setItem("ultimoTipoTreino", tipoAtual);
      window.dispatchEvent(new CustomEvent("perfil:ultimoTipoTreino", { detail: tipoAtual }));
    }
  }, [upcomingTrainings]);

  const isLoading = isLoadingTreinos || isLoadingResumo || isLoadingPontuacao;

  if (isLoading) {
    return (
      <Card className="w-full mb-6">
        <CardContent className="p-6 text-center">
          <div className="animate-pulse flex flex-col items-center justify-center">
            <div className="h-8 w-40 bg-gray-200 rounded-md mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 rounded-md mb-2"></div>
            <div className="h-4 w-20 bg-gray-200 rounded-md"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold footera-text-green flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          Progresso de Treinamento
        </h3>
        <Link href="/trainings">
          <Button variant="link" className="p-0 h-auto text-sm footera-text-green">
            Ver todos <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="overview" className="flex-1">Resumo</TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1">Próximos</TabsTrigger>
          {ENABLE_CHALLENGES_TAB && (
          <TabsTrigger value="challenges" className="flex-1">
            Desafios
          </TabsTrigger>
        )}
        </TabsList>

        <TabsContent value="overview">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-purple-50 rounded-lg p-3 mt-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-purple-600 font-medium">Treinos Pendentes</span>
                  <div className="flex items-center mt-1">
                    <CalendarClock className="text-purple-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-purple-700">{pendentesCount}</span>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 flex mt-3 flex-col items-center justify-center">
                  <span className="text-xs text-green-600 font-medium">Treinos Completos</span>
                  <div className="flex items-center mt-1">
                    <CheckCircle2 className="text-green-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-green-700">{trainingStats.completed}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-blue-600 font-medium">Horas Treinadas</span>
                  <div className="flex items-center mt-1">
                    <Clock className="text-blue-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-blue-700">{trainingStats.totalHours}h</span>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-amber-600 font-medium">Pontos Conquistados</span>
                  <div className="flex items-center mt-1">
                    <Medal className="text-amber-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-amber-700">{totalPontosTopo}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <h4 className="text-sm font-semibold mb-2">Desempenho por Categoria</h4>
                <div className="space-y-3">
                  {[
                    { label: "Físico", value: catFisico, bar: "bg-red-500" },
                    { label: "Técnico", value: catTecnico, bar: "bg-blue-500" },
                    { label: "Tático", value: catTatico, bar: "bg-green-500" },
                    { label: "Mental", value: catMental, bar: "bg-purple-500" },
                  ].map(({ label, value, bar }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{label}</span>
                        <span className="font-medium">{value} treinos</span>
                      </div>
                      <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${bar} rounded-full`}
                          style={{ width: `${(value / totalConcluidos) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold">Conquistas</h4>
                  <Link href="/perfil/conquistas">
                    <Button variant="link" className="p-0 h-auto text-sm footera-text-green">
                      Ver todas →
                    </Button>
                  </Link>
                </div>

                {conquistasDestaque.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {conquistasDestaque.map((c: any) => (
                      <div
                        key={String(c?.id)}
                        className="border rounded-xl p-3 bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl">
                            {c?.icon ?? "🏅"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {c?.title ?? "Conquista"}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {c?.description ?? ""}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="mt-3 text-xs footera-text-green flex items-center gap-2"
                          onClick={() => {
                            navigator?.share?.({
                              title: c?.title ?? "Conquista",
                              text: c?.description ?? "Conquista desbloqueada!",
                            }).catch(() => {});
                          }}
                        >
                          <span className="text-base">🔗</span> Compartilhar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 border rounded-xl p-4 bg-white">
                    Nenhuma conquista ainda. Complete treinos/desafios para desbloquear!
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <Link href="/perfil/pontuacao">
                    <h4 className="text-base font-semibold cursor-pointer hover:underline underline-offset-4">
                      Pontuação Detalhada
                    </h4>
                  </Link>
                </div>

                <div className="space-y-3">
                  <Link href="/perfil/pontuacao" className="block">
                    <div className="border rounded-xl p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-700" />
                        </div>
                        <div className="font-semibold text-sm">PERFORMANCE</div>
                      </div>
                      <div className="font-semibold text-sm">{calcTop.performance} pts</div>
                    </div>
                  </Link>

                  <Link href="/perfil/pontuacao" className="block">
                    <div className="border rounded-xl p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-blue-700" />
                        </div>
                        <div className="font-semibold text-sm">DISCIPLINA</div>
                      </div>
                      <div className="font-semibold text-sm">{calcTop.disciplina} pts</div>
                    </div>
                  </Link>

                  <Link href="/perfil/pontuacao" className="block">
                    <div className="border rounded-xl p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-orange-700" />
                        </div>
                        <div className="font-semibold text-sm">RESPONSABILIDADE</div>
                      </div>
                      <div className="font-semibold text-sm">{calcTop.responsabilidade} pts</div>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold">Atividades Recentes</h4>
                  
                </div>

                {Array.isArray(atividades) && atividades.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {atividades.slice(0, 6).map((a: any, idx: number) => {
                      const img = getActivityImage(a) ?? "/assets/treinos/placeholder.png";
                      const label =
                        a?.tipo ?? a?.categoria ?? a?.kind ?? (a?.desafioId ? "Desafio" : "Treino");
                      const titulo =
                        a?.titulo ?? a?.nome ?? a?.treino?.nome ?? a?.desafio?.nome ?? "Atividade";

                      const isTreino = /treino/i.test(String(label));

                      return (
                        <button
                          key={String(a?.id ?? idx)}
                          type="button"
                          className="rounded-xl overflow-hidden border bg-white hover:shadow transition text-left"
                          onClick={() => {
                            if (isTreino) {
                              abrirTreinoAtividade(a);
                            } else {
                              setLocation("/trainings");
                            }
                          }}
                        >
                          <div className="relative">
                            <img
                              src={img}
                              alt={titulo}
                              className="w-full h-20 object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  "/assets/treinos/placeholder.png";
                              }}
                            />
                            <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 text-white px-2 py-1 rounded-full">
                              {String(label)}
                            </div>
                          </div>
                          <div className="p-2">
                            <div className="text-[11px] font-semibold leading-tight line-clamp-2">
                              {titulo}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 border rounded-xl p-4 bg-white">
                    Nenhuma atividade recente ainda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card className="bg-white">
            <CardContent className="p-4">
              {upcomingTrainings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingTrainings.slice(0, 6).map((treino) => {
                    const agendadoPara = toDate(treino.dataTreino);
                    const prazo = toDate(treino.prazoEnvio);
                    return (
                      <div key={treino.id} className="border rounded-lg p-3">
                        <img
                          className="w-full h-36 object-cover rounded mb-2"
                          src={
                            treino.imagemUrl
                              ? (treino.imagemUrl.startsWith("http")
                                  ? treino.imagemUrl
                                  : `${API.BASE_URL}${treino.imagemUrl}`)
                              : "/assets/treinos/placeholder.png"
                          }
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/treinos/placeholder.png"; }}
                          alt={treino.titulo}
                        />
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-sm">{treino.titulo}</h4>
                              {treino.tipo && (
                                <Badge variant="outline" className="mt-1 text-[10px]">{treino.tipo}</Badge>
                              )}
                            <div className="text-xs text-gray-600 mt-1 space-y-1">
                              {agendadoPara && (
                                <div className="flex items-center">
                                  <Calendar className="h-3.5 w-3.5 mr-1" />
                                  Agendado para:
                                  <Badge variant="outline" className="ml-1 text-[10px]">
                                    {formatDateFns(agendadoPara, "dd/MM/yyyy", { locale: ptBR })}
                                  </Badge>
                                </div>
                              )}
                              {typeof treino.duracaoMinutos === "number" && (
                                <div className="flex items-center">
                                  <CalendarClock className="h-3.5 w-3.5 mr-1" />
                                  <span>Duração:</span>
                                  <Badge variant="outline" className="ml-1 text-[10px]">
                                    {treino.duracaoMinutos} min
                                  </Badge>
                                </div>
                              )}
                           
                            </div>
                          </div>

                          <Link className="-ml-1" href={`/treinos`}>
                            <Button size="sm" className="h-5 text-xs">Realizar Treino</Button>
                          </Link>                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <h4 className="text-gray-500 font-medium">Nenhum treino agendado</h4>
                  <p className="text-gray-400 text-sm mt-1">
                    Agende treinos com seu professor ou clube para visualizar aqui.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {ENABLE_CHALLENGES_TAB && (
          <TabsContent value="challenges">
            <Card className="bg-white">
              <CardContent className="p-2">
                <div className="bg-purple-50 rounded-lg p-3 flex flex-col items-center justify-center">
                    <span className="text-xs text-purple-600 font-medium">Completos</span>
                    <div className="flex items-center mt-1">
                      <Trophy className="text-purple-600 h-4 w-4 mr-1" />
                      <span className="text-xl font-bold text-purple-700">{resumo?.desafios ?? 0}</span>
                    </div>
                </div>

                {(resumo?.desafios ?? 0) > 0 ? (
                  <div className="text-center py-6 text-green-800 text-sm">
                    Você já concluiu {resumo?.desafios} desafio(s). Confira o ranking e novos desafios.
                    <div className="mt-3">
                      <Link href="/challenges">
                        <Button className="bg-footera-green hover:bg-footera-green-dark">Abrir Desafios</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <h4 className="text-gray-500 font-medium">Nenhum desafio completado</h4>
                    <p className="text-gray-400 text-sm mt-1">Complete desafios para ganhar pontos e subir no ranking</p>
                    <Link href="/challenges">
                      <Button className="mt-4 bg-footera-green hover:bg-footera-green-dark">Ver Desafios</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      {resumoModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
          onClick={fecharResumo}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Resumo do Treino</div>
              <button
                type="button"
                className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                onClick={fecharResumo}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm font-semibold">
                {resumoModal.treino?.titulo ?? "Treino"}
              </div>

              {resumoModal.treino?.tipo && (
                <div className="text-xs text-gray-600">
                  Tipo: <span className="font-medium">{resumoModal.treino.tipo}</span>
                </div>
              )}

              {resumoModal.treino?.duracaoMinutos != null && (
                <div className="text-xs text-gray-600">
                  Duração:{" "}
                  <span className="font-medium">{resumoModal.treino.duracaoMinutos} min</span>
                </div>
              )}

              {resumoModal.treino?.dataTreino && (
                <div className="text-xs text-gray-600">
                  Data:{" "}
                  <span className="font-medium">
                    {formatDateFns(new Date(resumoModal.treino.dataTreino), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    fecharResumo();
                    setLocation(
                      `/submissao?treinoAgendadoId=${encodeURIComponent(resumoModal.treinoAgendadoId)}`
                    );
                  }}
                >
                  Ir para submissão
                </Button>

                <Button
                  onClick={() => {
                    fecharResumo();
                    setLocation("/trainings");
                  }}
                >
                  Ver treinos
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
