import React, { useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { format, isAfter, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowUpRight, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Rotate3D, 
  Timer, 
  Dumbbell, 
  CalendarClock,
  Zap,
  Target,
  Medal,
  TrendingUp,
  Trophy
} from 'lucide-react';
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription 
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Link } from 'wouter';

type Training = {
  id: string;
  status: 'completed' | 'scheduled' | string;
  scheduledFor: string;
  training: {
    title: string;
    duration: number;
    category: 'Físico' | 'Técnico' | 'Tático' | 'Mental' | string;
  };
};

type Challenge = {
  id: string;
  status: 'completed' | 'pending' | string;
  pointsEarned?: number;
  submittedAt?: string;
  challenge: {
    id: string;
    title: string;
    category: string;
    ageGroup: string;
    pointsValue: number;
    expiresAt: string;
  };
};

const categoryIcons: Record<string, React.ReactNode> = {
  'Físico': <Dumbbell className="h-4 w-4" />,
  'Técnico': <Target className="h-4 w-4" />,
  'Tático': <Layers className="h-4 w-4" />,
  'Mental': <Zap className="h-4 w-4" />
};

interface TrainingProgressProps {
  userId: string;
}

export default function TrainingProgress({ userId }: TrainingProgressProps) {
  const {
  data: userTrainings = [],
  isLoading: isLoadingTrainings
} = useQuery<Training[], Error>(
  {
    queryKey: ['userTrainings', userId],
    queryFn: async () => {
      const res = await fetch(`/api/user/${userId}/trainings`);
      if (!res.ok) throw new Error("Erro ao buscar treinos");
      return res.json();
    },
    enabled: !!userId,
    onError: (err: Error) => {
      console.error("Erro ao buscar treinos:", err);
    }
  } as UseQueryOptions<Training[], Error>
);

  const {
  data: userChallenges = [],
  isLoading: isLoadingChallenges
} = useQuery<Challenge[], Error>(
  {
    queryKey: ['userChallenges', userId],
    queryFn: async () => {
      const res = await fetch(`/api/user/${userId}/challenges`);
      if (!res.ok) throw new Error("Erro ao buscar desafios");
      return res.json();
    },
    enabled: !!userId,
    onError: (err: Error) => {
      console.error("Erro ao buscar desafios:", err);
    }
  } as UseQueryOptions<Challenge[], Error>
);

  const completedTrainings = useMemo(() => {
    if (!userTrainings || !Array.isArray(userTrainings)) return [];
    return userTrainings.filter((t: any) => t.status === 'completed');
  }, [userTrainings]);

  const scheduledTrainings = useMemo(() => {
    if (!userTrainings || !Array.isArray(userTrainings)) return [];
    return userTrainings.filter((t: any) => t.status === 'scheduled')
      .sort((a: any, b: any) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }, [userTrainings]);
  const completedChallenges = useMemo(() => {
    if (!userChallenges || !Array.isArray(userChallenges)) return [];
    return userChallenges.filter((c: any) => c.status === 'completed');
  }, [userChallenges]);

  const pendingChallenges = useMemo(() => {
    if (!userChallenges || !Array.isArray(userChallenges)) return [];
    return userChallenges.filter((c: any) => c.status === 'pending')
      .sort((a: any, b: any) => {
        const aDate = new Date(a.challenge.expiresAt);
        const bDate = new Date(b.challenge.expiresAt);
        return aDate.getTime() - bDate.getTime();
      });
  }, [userChallenges]);

  const trainingStats = useMemo(() => {
    if (!userTrainings) return { completed: 0, scheduled: 0, totalHours: 0 };
    
    const completed = completedTrainings.length;
    const scheduled = scheduledTrainings.length;
    const totalHours = completedTrainings.reduce((acc: number, t: any) => 
      acc + (t.training.duration / 60), 0).toFixed(1);
    
    return { completed, scheduled, totalHours };
  }, [userTrainings, completedTrainings, scheduledTrainings]);

  const challengeStats = useMemo(() => {
    if (!userChallenges) return { completed: 0, pending: 0, totalPoints: 0 };
    
    const completed = completedChallenges.length;
    const pending = pendingChallenges.length;
    const totalPoints = completedChallenges.reduce((acc: number, c: any) => 
      acc + (c.pointsEarned || 0), 0);
    
    return { completed, pending, totalPoints };
  }, [userChallenges, completedChallenges, pendingChallenges]);

 const hasTodayActivities = useMemo(() => {
    if (!scheduledTrainings.length) return false;
    const today = new Date();
    return scheduledTrainings.some((t: any) => {
      const scheduleDate = new Date(t.scheduledFor);
      return isSameDay(today, scheduleDate);
    });
  }, [scheduledTrainings]);

  const formatDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM", { locale: ptBR });
  };

  if (isLoadingTrainings || isLoadingChallenges) {
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

        {/* Aba de Resumo */}
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
                    <span className="text-xl font-bold text-purple-700">{challengeStats.completed}</span>
                  </div>
                </div>
                
                <div className="bg-amber-50 rounded-lg p-3 flex flex-col items-center justify-center">
                  <span className="text-xs text-amber-600 font-medium">Pontos Conquistados</span>
                  <div className="flex items-center mt-1">
                    <Medal className="text-amber-600 h-4 w-4 mr-1" />
                    <span className="text-xl font-bold text-amber-700">{challengeStats.totalPoints}</span>
                  </div>
                </div>
              </div>

              {hasTodayActivities && (
                <div className="bg-footera-cream-light border border-footera-cream rounded-lg p-4 mb-3">
                  <h4 className="text-sm font-semibold flex items-center mb-2 footera-text-green">
                    <Calendar className="h-4 w-4 mr-1" /> Atividades para Hoje
                  </h4>
                  
                  <div className="space-y-2">
                    {scheduledTrainings
                      .filter((t: any) => isSameDay(new Date(), new Date(t.scheduledFor)))
                      .map((training: any) => (
                        <div key={training.id} className="flex justify-between items-center bg-white p-2 rounded-md">
                          <div className="flex items-center">
                            <div className="bg-footera-green-light p-1.5 rounded-md mr-2">
                              {categoryIcons[training.training.category] || <Rotate3D className="h-4 w-4 text-footera-green" />}
                            </div>
                            <div>
                              <p className="text-xs font-medium">{training.training.title}</p>
                              <p className="text-[10px] text-gray-500 flex items-center">
                                <Timer className="h-3 w-3 inline mr-1" /> 
                                {training.training.duration} min
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            Iniciar
                          </Button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              <div className="mt-3">
                <h4 className="text-sm font-semibold mb-2">Desempenho por Categoria</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Dumbbell className="h-3 w-3 mr-1 text-red-500" /> Físico
                      </span>
                      <span className="font-medium">
                        {completedTrainings.filter((t: any) => t.training.category === 'Físico').length} treinos
                      </span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full" 
                        style={{ 
                          width: `${
                            completedTrainings.length 
                              ? (completedTrainings.filter((t: any) => 
                                  t.training.category === 'Físico').length / completedTrainings.length) * 100 
                              : 0
                          }%` 
                        }} 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Target className="h-3 w-3 mr-1 text-blue-500" /> Técnico
                      </span>
                      <span className="font-medium">
                        {completedTrainings.filter((t: any) => t.training.category === 'Técnico').length} treinos
                      </span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ 
                          width: `${
                            completedTrainings.length 
                              ? (completedTrainings.filter((t: any) => 
                                  t.training.category === 'Técnico').length / completedTrainings.length) * 100 
                              : 0
                          }%` 
                        }} 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Layers className="h-3 w-3 mr-1 text-green-500" /> Tático
                      </span>
                      <span className="font-medium">
                        {completedTrainings.filter((t: any) => t.training.category === 'Tático').length} treinos
                      </span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ 
                          width: `${
                            completedTrainings.length 
                              ? (completedTrainings.filter((t: any) => 
                                  t.training.category === 'Tático').length / completedTrainings.length) * 100 
                              : 0
                          }%` 
                        }} 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center">
                        <Zap className="h-3 w-3 mr-1 text-purple-500" /> Mental
                      </span>
                      <span className="font-medium">
                        {completedTrainings.filter((t: any) => t.training.category === 'Mental').length} treinos
                      </span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full" 
                        style={{ 
                          width: `${
                            completedTrainings.length 
                              ? (completedTrainings.filter((t: any) => 
                                  t.training.category === 'Mental').length / completedTrainings.length) * 100 
                              : 0
                          }%` 
                        }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Próximos Treinos */}
        <TabsContent value="upcoming">
          <Card className="bg-white">
            <CardContent className="p-4">
              {scheduledTrainings.length > 0 ? (
                <div className="space-y-3">
                  {scheduledTrainings.slice(0, 4).map((training: any) => (
                    <div key={training.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-sm">{training.training.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {training.training.category} • {training.training.duration} min
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            isSameDay(new Date(), new Date(training.scheduledFor)) 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {isSameDay(new Date(), new Date(training.scheduledFor)) 
                            ? 'Hoje' 
                            : formatDate(training.scheduledFor)}
                        </Badge>
                      </div>
                      
                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex items-center text-xs text-gray-600">
                          <CalendarClock className="h-3.5 w-3.5 mr-1" />
                          {format(new Date(training.scheduledFor), 'HH:mm', { locale: ptBR })}
                        </div>
                        
                        <Button 
                          size="sm" 
                          className={`h-7 text-xs ${
                            isSameDay(new Date(), new Date(training.scheduledFor)) 
                              ? 'bg-footera-green hover:bg-footera-green-dark' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {isSameDay(new Date(), new Date(training.scheduledFor)) 
                            ? 'Iniciar Treino' 
                            : 'Ver Detalhes'}
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {scheduledTrainings.length > 4 && (
                    <div className="text-center mt-2">
                      <Link href="/trainings">
                        <Button variant="link" className="text-sm footera-text-green">
                          Ver mais {scheduledTrainings.length - 4} treinos agendados
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <h4 className="text-gray-500 font-medium">Nenhum treino agendado</h4>
                  <p className="text-gray-400 text-sm mt-1">
                    Agende novos treinos para acompanhar seu progresso
                  </p>
                  <Link href="/trainings">
                    <Button 
                      className="mt-4 bg-footera-green hover:bg-footera-green-dark"
                    >
                      Explorar Treinos
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Desafios */}
        <TabsContent value="challenges">
          <Card className="bg-white">
            <CardContent className="p-4">
              {pendingChallenges.length > 0 && (
                <>
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <Target className="h-4 w-4 mr-1 text-amber-500" />
                    Desafios Ativos
                  </h4>
                  
                  <div className="space-y-3 mb-4">
                    {pendingChallenges.slice(0, 2).map((challenge: any) => (
                      <div key={challenge.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-sm">{challenge.challenge.title}</h4>
                            <p className="text-xs text-gray-600 mt-1 flex items-center">
                              <Trophy className="h-3 w-3 mr-1 text-amber-500" />
                              {challenge.challenge.pointsValue} pontos
                            </p>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-amber-100 text-amber-800 border-amber-200"
                          >
                            Expira: {formatDate(challenge.challenge.expiresAt)}
                          </Badge>
                        </div>
                        
                        <Separator className="my-2 bg-amber-200" />
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-amber-700">
                            {challenge.challenge.category} • {challenge.challenge.ageGroup}
                          </span>
                          <Link href={`/challenges/${challenge.challenge.id}`}>
                            <Button 
                              size="sm" 
                              className="h-7 text-xs bg-amber-500 hover:bg-amber-600"
                            >
                              Realizar
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                    
                    {pendingChallenges.length > 2 && (
                      <div className="text-center">
                        <Link href="/challenges">
                          <Button variant="link" className="text-sm text-amber-600">
                            Ver mais {pendingChallenges.length - 2} desafios
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {completedChallenges.length > 0 ? (
                <>
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                    Desafios Completados
                  </h4>
                  
                  <div className="space-y-2">
                    {completedChallenges.slice(0, 3).map((challenge: any) => (
                      <div key={challenge.id} className="border rounded-lg p-2 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="bg-green-100 p-1.5 rounded-md mr-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">{challenge.challenge.title}</p>
                            <p className="text-[10px] text-gray-500">
                              {formatDate(challenge.submittedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center text-amber-600 font-medium text-xs">
                          <Trophy className="h-3.5 w-3.5 mr-1" />
                          {challenge.pointsEarned || 0} pts
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <h4 className="text-gray-500 font-medium">Nenhum desafio completado</h4>
                  <p className="text-gray-400 text-sm mt-1">
                    Complete desafios para ganhar pontos e subir no ranking
                  </p>
                  <Link href="/challenges">
                    <Button 
                      className="mt-4 bg-footera-green hover:bg-footera-green-dark"
                    >
                      Ver Desafios
                    </Button>
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