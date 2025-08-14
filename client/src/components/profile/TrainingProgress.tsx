import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpRight, Calendar, CheckCircle2, Clock, Layers, Rotate3D, Timer,
  Dumbbell, CalendarClock, Zap, Target, Medal, TrendingUp, Trophy
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Link } from 'wouter';
import { API } from '../../config';
import Storage from '../../../../server/utils/storage';

type Training = {
  id: string;
  titulo: string;
  dataTreino: string;
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

const categoryIcons: Record<string, React.ReactNode> = {
  'Físico': <Dumbbell className="h-4 w-4" />,
  'Técnico': <Target className="h-4 w-4" />,
  'Tático': <Layers className="h-4 w-4" />,
  'Mental': <Zap className="h-4 w-4" />
};

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
    () => [...treinosAgendados].sort(
      (a, b) => new Date(a.dataTreino).getTime() - new Date(b.dataTreino).getTime()
    ),
    [treinosAgendados]
  );

  const hasTodayActivities = useMemo(() => {
    if (!scheduledTrainings.length) return false;
    const hoje = new Date();
    return scheduledTrainings.some((t) => isSameDay(hoje, new Date(t.dataTreino)));
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
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Dumbbell className="h-3 w-3 mr-1 text-red-500" /> Físico
                      </span>
                      <span className="font-medium">{catFisico} treinos</span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${(catFisico / totalConcluidos) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Target className="h-3 w-3 mr-1 text-blue-500" /> Técnico
                      </span>
                      <span className="font-medium">{catTecnico} treinos</span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(catTecnico / totalConcluidos) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Layers className="h-3 w-3 mr-1 text-green-500" /> Tático
                      </span>
                      <span className="font-medium">{catTatico} treinos</span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(catTatico / totalConcluidos) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Zap className="h-3 w-3 mr-1 text-purple-500" /> Mental
                      </span>
                      <span className="font-medium">{catMental} treinos</span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(catMental / totalConcluidos) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card className="bg-white">
            <CardContent className="p-4">
              {treinosAgendados.length > 0 ? (
                <div className="space-y-3">
                  {treinosAgendados.slice(0, 4).map((treino) => (
                    <div key={treino.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-sm">{treino.titulo}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {treino.exercicios?.length || 0} exercícios
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                          {format(new Date(treino.dataTreino), "dd 'de' MMM", { locale: ptBR })}
                        </Badge>
                      </div>

                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex items-center text-xs text-gray-600">
                          <CalendarClock className="h-3.5 w-3.5 mr-1" />
                          {format(new Date(treino.dataTreino), 'HH:mm', { locale: ptBR })}
                        </div>

                        <Link href={`/submissao?treinoAgendadoId=${treino.id}`}>
                          <Button size="sm" className="h-7 text-xs">Fazer Submissão</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <h4 className="text-gray-500 font-medium">Nenhum treino agendado</h4>
                  <p className="text-gray-400 text-sm mt-1">Agende treinos com seu professor ou clube para visualizar aqui.</p>
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

              <div className="text-center py-6">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <h4 className="text-gray-500 font-medium">Nenhum desafio completado</h4>
                <p className="text-gray-400 text-sm mt-1">Complete desafios para ganhar pontos e subir no ranking</p>
                <Link href="/challenges">
                  <Button className="mt-4 bg-footera-green hover:bg-footera-green-dark">Ver Desafios</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
