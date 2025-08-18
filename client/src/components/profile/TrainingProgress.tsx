import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpRight, Calendar, CheckCircle2, Clock, Layers,
  Dumbbell, CalendarClock, Zap, Target, Medal, TrendingUp, Trophy
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
};

interface TrainingProgressProps {
  userId: string | null;
}

interface ResumoTreinos {
  completos: number;
  horas: number;
  desafios: number;
  pontos: number;
  categorias: Record<string, number>;
}

interface PontuacaoPerfil {
  performance: number;
  disciplina: number;
  responsabilidade: number;
}

const toDate = (v?: string | null) => (v ? new Date(v) : null);
const timeKey = (t: Training) =>
  (toDate(t.prazoEnvio)?.getTime() ??
   toDate(t.dataTreino)?.getTime() ??
   Number.MAX_SAFE_INTEGER);

export default function TrainingProgress({ userId }: TrainingProgressProps) {
  const token = Storage.token || '';
  const usuarioId = (Storage.usuarioId as string) || userId || '';
  const atletaId  = (Storage.tipoUsuarioId as string) || '';

  const { data: treinosAgendados = [], isLoading: isLoadingTrainings } = useQuery<Training[]>({
    queryKey: ['treinosAgendados', atletaId],
    enabled: Boolean(token && atletaId),
    queryFn: async () => {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/agendados?tipoUsuarioId=${encodeURIComponent(atletaId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Erro ao buscar treinos agendados');
      return res.json();
    },
  });

  const { data: resumo, isLoading: isLoadingResumo } = useQuery<ResumoTreinos>({
    queryKey: ['perfilResumoTreinos', usuarioId],
    enabled: Boolean(token && usuarioId),
    queryFn: async () => {
      const res = await fetch(
        `${API.BASE_URL}/api/perfil/${encodeURIComponent(usuarioId)}/treinos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Erro ao buscar resumo de treinos');
      return res.json();
    },
  });

  const { data: pontuacao, isLoading: isLoadingPontuacao } = useQuery<PontuacaoPerfil>({
    queryKey: ['pontuacaoPerfil', usuarioId],
    enabled: Boolean(token && usuarioId),
    queryFn: async () => {
      const res = await fetch(
        `${API.BASE_URL}/api/perfil/pontuacao/${encodeURIComponent(usuarioId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Erro ao buscar pontuação do perfil');
      return res.json();
    },
  });

  const trainingStats = useMemo(() => ({
    completed: resumo?.completos ?? 0,
    totalHours: Number(resumo?.horas ?? 0).toFixed(1),
  }), [resumo]);

  const totalPontosTopo =
    (pontuacao?.performance ?? 0) +
    (pontuacao?.disciplina ?? 0) +
    (pontuacao?.responsabilidade ?? 0);

  const raw = resumo?.categorias || {};
  const catFisico  = (raw as any).Fisico   ?? (raw as any)['Físico']  ?? 0;
  const catTecnico = (raw as any).Tecnico  ?? (raw as any)['Técnico'] ?? 0;
  const catTatico  = (raw as any).Tatico   ?? (raw as any)['Tático']  ?? 0;
  const catMental  = (raw as any).Mental   ?? 0;

  const totalConcluidos = trainingStats.completed || 1;

  const scheduledTrainings = useMemo(
    () => treinosAgendados.slice().sort((a, b) => timeKey(a) - timeKey(b)),
    [treinosAgendados]
  );

  const hasTodayActivities = useMemo(() => {
    if (!scheduledTrainings.length) return false;
    const hoje = new Date();
    return scheduledTrainings.some((t) => {
      const d = toDate(t.dataTreino);
      return d ? isSameDay(hoje, d) : false;
    });
  }, [scheduledTrainings]);

  const isLoading = isLoadingTrainings || isLoadingResumo || isLoadingPontuacao;

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

        <TabsContent value="upcoming">
          <Card className="bg-white">
            <CardContent className="p-4">
              {scheduledTrainings.length > 0 ? (
                <div className="space-y-3">
                  {scheduledTrainings.slice(0, 6).map((treino) => {
                    const lancado = toDate(treino.dataTreino);
                    const prazo   = toDate(treino.prazoEnvio);
                    return (
                      <div key={treino.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-sm">{treino.titulo}</h4>

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

        <TabsContent value="challenges">
          <Card className="bg-white">
            <CardContent className="p-2">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-purple-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-purple-600 font-medium">Completos</span>
                  <div className="flex items-center mt-1">
                    <Trophy className="text-purple-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-purple-700">{resumo?.desafios ?? 0}</span>
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-amber-600 font-medium">Pontos</span>
                  <div className="flex items-center mt-1">
                    <Medal className="text-amber-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-amber-700">{totalPontosTopo}</span>
                  </div>
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
