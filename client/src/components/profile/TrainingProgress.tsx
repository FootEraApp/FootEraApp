import React, { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpRight, Calendar, CheckCircle2, Clock,
  CalendarClock, Medal, TrendingUp, Trophy
} from 'lucide-react';
import { Card, CardContent } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js';
import { Link } from 'wouter';
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
};

interface TrainingProgressProps {
  userId: string | null;
  tipoUsuarioId?: string | null;
}

const toDate = (v?: string | null) => (v ? new Date(v) : null);
const timeKey = (t: Training) =>
  (toDate(t.prazoEnvio)?.getTime() ??
    toDate(t.dataTreino)?.getTime() ??
    Number.MAX_SAFE_INTEGER);

export default function TrainingProgress({ userId, tipoUsuarioId }: TrainingProgressProps) {
  const qc = useQueryClient();
  const token = Storage.token || '';
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const targetUserId = userId ?? (Storage.usuarioId as string) ?? "";
  const targetTipoUsuarioId = tipoUsuarioId ?? (Storage.tipoUsuarioId as string) ?? "";
  
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

  const isDesafio = (a: any) =>
    /desafi/i.test(String(a?.tipo ?? '')) ||
    /desafi/i.test(`${a?.nome ?? ''} ${a?.descricao ?? ''}`);

  const getPts = (a: any): number => {
    const candidates = [
      a.pontos, a.pontuacao, a.pontosGanhos, a.pontosGanho,
      a?.pontuacao?.total, a?.detalhes?.pontos, a?.meta?.pontos,
    ];
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c)) return c;
      if (typeof c === 'string') {
        const n = parseInt(c.replace(/[^\d-]/g, ''), 10);
        if (!Number.isNaN(n)) return n;
      }
    }
    const txt = `${a.nome ?? ''} ${a.descricao ?? ''}`;
    const m = txt.match(/([+-]?\d+)\s*pt/i);
    return m ? parseInt(m[1], 10) : 0;
  };

  const pontosDesafios = useMemo(
    () => (atividades || []).filter(isDesafio).reduce((acc, a) => acc + getPts(a), 0),
    [atividades]
  );

 const { data: treinosAgendados = [], isLoading: isLoadingTreinos,} = useQuery<Training[]>({
  queryKey: ["treinosAgendados", targetTipoUsuarioId],
  enabled: Boolean(token && targetTipoUsuarioId),
  queryFn: async () => {
    const r = await fetch(
      `${API.BASE_URL}/api/treinos/agendados?tipoUsuarioId=${encodeURIComponent(targetTipoUsuarioId)}`,
      { headers }
    );
    if (!r.ok) throw new Error("Erro ao buscar treinos agendados");
    const raw = await r.json();

    return (Array.isArray(raw) ? raw : []).map((t: any): Training => ({
      id: t.id,
      titulo: t.titulo ?? t?.treinoProgramado?.nome ?? "Treino",
      dataTreino: t.dataTreino ?? null,
      prazoEnvio:
        t.prazoEnvio ?? t.dataExpiracao ?? t.dataTreino ?? t?.treinoProgramado?.dataAgendada ?? null,
      duracaoMinutos: t?.treinoProgramado?.duracao ?? t.duracaoMinutos ?? null,
      tipo: t?.treinoProgramado?.tipo ?? t?.categoria ?? null,              // NEW
      imagemUrl: t?.treinoProgramado?.imagemUrl ?? t?.imagemUrl ?? null,    // NEW
    }));
  },
});

  useEffect(() => {
    const onAgendado = () => qc.invalidateQueries({ queryKey: ["treinosAgendados", targetTipoUsuarioId] });
    window.addEventListener("treino:agendado", onAgendado);
    return () => window.removeEventListener("treino:agendado", onAgendado);
  }, [qc, targetTipoUsuarioId]);

  const { data: resumo, isLoading: isLoadingResumo } = useQuery({
    queryKey: ["perfilResumoTreinos", targetUserId],
    enabled: Boolean(token && targetUserId),
    queryFn: async () => {
      const r = await fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(targetUserId)}/treinos`, { headers });
      if (!r.ok) throw new Error("Erro ao buscar resumo de treinos");
      return r.json();
    },
  });

  const  { data: pontuacao, isLoading: isLoadingPontuacao } = useQuery({
    queryKey: ["pontuacaoPerfil", targetUserId],
    enabled: Boolean(token && targetUserId),
    queryFn: async () => {
      
      const r = await fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(targetUserId)}/pontuacao`, { headers });
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

  const totalPontosTopo =
    (pontuacao?.performance ?? 0) +
    (pontuacao?.disciplina ?? 0) +
    (pontuacao?.responsabilidade ?? 0);

  const raw = resumo?.categorias || {};
  const catFisico = (raw as any).Fisico ?? (raw as any)['Físico'] ?? 0;
  const catTecnico = (raw as any).Tecnico ?? (raw as any)['Técnico'] ?? 0;
  const catTatico = (raw as any).Tatico ?? (raw as any)['Tático'] ?? 0;
  const catMental = (raw as any).Mental ?? 0;

  const totalConcluidos = trainingStats.completed || 1;

  const upcomingTrainings = useMemo(() => {
    const now = Date.now();
    return treinosAgendados
      .filter((t) => {
        const ts = toDate(t.prazoEnvio)?.getTime();
        return ts == null || ts >= now;
      })
      .sort((a, b) => timeKey(a) - timeKey(b));
  }, [treinosAgendados]);

  const hasTodayActivities = useMemo(() => {
    if (!upcomingTrainings.length) return false;
    const hoje = new Date();
    return upcomingTrainings.some((t) => {
      const d = toDate(t.dataTreino);
      return d ? isSameDay(hoje, d) : false;
    });
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
          <TabsTrigger value="challenges" className="flex-1">Desafios</TabsTrigger>
        </TabsList>

        {/* Resumo */}
        <TabsContent value="overview">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-green-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-green-600 font-medium">Treinos Completos</span>
                  <div className="flex items-center mt-1">
                    <CheckCircle2 className="text-green-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-green-700">{trainingStats.completed}</span>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-blue-600 font-medium">Horas Treinadas</span>
                  <div className="flex items-center mt-1">
                    <Clock className="text-blue-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-blue-700">{trainingStats.totalHours}h</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-purple-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-purple-600 font-medium">Desafios Completos</span>
                  <div className="flex items-center mt-1">
                    <Trophy className="text-purple-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-purple-700">{resumo?.desafios ?? 0}</span>
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
                    { label: 'Físico', value: catFisico, bar: 'bg-red-500' },
                    { label: 'Técnico', value: catTecnico, bar: 'bg-blue-500' },
                    { label: 'Tático', value: catTatico, bar: 'bg-green-500' },
                    { label: 'Mental', value: catMental, bar: 'bg-purple-500' },
                  ].map(({ label, value, bar }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{label}</span>
                        <span className="font-medium">{value} treinos</span>
                      </div>
                      <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${bar} rounded-full`} style={{ width: `${(value / totalConcluidos) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Próximos */}
        <TabsContent value="upcoming">
          <Card className="bg-white">
            <CardContent className="p-4">
              {upcomingTrainings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingTrainings.slice(0, 6).map((treino) => {
                    const lancado = toDate(treino.dataTreino);
                    const prazo = toDate(treino.prazoEnvio);
                    return (
                      <div key={treino.id} className="border rounded-lg p-3">
                        {treino.imagemUrl && (
                          <img
                            className="w-full h-36 object-cover rounded mb-2"
                            src={
                              treino.imagemUrl.startsWith("http")
                                ? treino.imagemUrl
                                : `${API.BASE_URL}${treino.imagemUrl}`
                            }
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/assets/treinos/placeholder.png"; }}
                            alt={treino.titulo}
                          />
                        )}
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-sm">{treino.titulo}</h4>
                              {treino.tipo && (
                                <Badge variant="outline" className="mt-1 text-[10px]">{treino.tipo}</Badge>
                              )}
                            <div className="text-xs text-gray-600 mt-1 space-y-1">
                              {lancado && (
                                <div>lançado em {format(lancado, "dd/MM/yyyy", { locale: ptBR })}</div>
                              )}
                              {typeof treino.duracaoMinutos === "number" && (
                                <div>Duração: {treino.duracaoMinutos} min</div>
                              )}
                              {prazo && (
                                <div className="flex items-center">
                                  <CalendarClock className="h-3.5 w-3.5 mr-1" />
                                  prazo para envio:
                                  <Badge variant="outline" className="ml-1 text-[10px] bg-green-100 text-green-700 border-green-200">
                                    {format(prazo, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>

                          <Link href={`/submissao?treinoAgendadoId=${treino.id}`}>
                            <Button size="sm" className="h-7 text-xs">Fazer Submissão</Button>
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

        {/* Desafios */}
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
      </Tabs>
    </div>
  );
}
