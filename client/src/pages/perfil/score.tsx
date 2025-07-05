import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import MobileLayout from "@/components/layout/MobileLayout";
import { Check, Play, ChevronRight, BarChart3, Timer, Sprout } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProfileScore() {
  const [_, navigate] = useLocation();
  const { user, score } = useAuth();

  const { data: userTrainings, isLoading: isLoadingTrainings } = useQuery({
    queryKey: [`/api/user/${user?.id}/trainings`],
    enabled: !!user?.id,
    staleTime: 60000
  });

  const { data: userChallenges, isLoading: isLoadingChallenges } = useQuery({
    queryKey: [`/api/user/${user?.id}/challenges`],
    enabled: !!user?.id,
    staleTime: 60000
  });

  const handleBack = () => {
    navigate("/profile");
  };

  // Function to format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d 'de' MMMM", { locale: ptBR });
  };

  // Sample history data
  const historyItems = [
    {
      id: 1,
      type: "Desafio concluído",
      date: "2023-04-24",
      duration: 40,
      icon: <Check className="text-white text-xs" />,
      iconBg: "footera-bg-success"
    },
    {
      id: 2,
      type: "Treino programado",
      date: "2023-04-24",
      duration: 40,
      icon: <Play className="text-white text-xs" />,
      iconBg: "footera-bg-green"
    },
    {
      id: 3,
      type: "Desafio concluído",
      date: "2023-04-24",
      duration: 40,
      icon: <Check className="text-white text-xs" />,
      iconBg: "footera-bg-success"
    }
  ];

  // Sample videos
  const videos = [
    {
      id: 1,
      thumbnail: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=150&h=120"
    },
    {
      id: 2,
      thumbnail: "https://images.unsplash.com/photo-1587329310686-91414b8e3cb7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=150&h=120"
    },
    {
      id: 3,
      thumbnail: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=150&h=120"
    }
  ];

  return (
    <MobileLayout hideNavigation showBackButton onBack={handleBack}>
      <div className="p-4">
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-bold footera-text-green">Detalhes da Pontuação</h2>
        </div>
        
        <div className="footera-bg-green text-center p-6 rounded-lg mb-6">
          <h2 className="footera-text-cream text-xl mb-2">MINHA PONTUAÇÃO FOOTERA</h2>
          <div className="text-5xl font-bold footera-text-cream mb-6">
            {score?.total}<span className="text-lg">pts</span>
          </div>
          
          {/* Performance Score */}
          <div className="footera-bg-cream rounded-lg p-3 mb-3 flex items-center">
            <div className="w-10 h-10 footera-bg-green border-2 border-footera-cream rounded flex items-center justify-center mr-3">
              <BarChart3 className="footera-text-cream h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold footera-text-green">PERFORMANCE</h3>
            </div>
            <div className="footera-text-green font-bold">{score?.performance} pts</div>
          </div>
          
          {/* Discipline Score */}
          <div className="footera-bg-cream rounded-lg p-3 mb-3 flex items-center">
            <div className="w-10 h-10 footera-bg-green border-2 border-footera-cream rounded flex items-center justify-center mr-3">
              <Timer className="footera-text-cream h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold footera-text-green">DISCIPLINA</h3>
            </div>
            <div className="footera-text-green font-bold">{score?.discipline} pts</div>
          </div>
          
          {/* Responsibility Score */}
          <div className="footera-bg-cream rounded-lg p-3 flex items-center">
            <div className="w-10 h-10 footera-bg-green border-2 border-footera-cream rounded flex items-center justify-center mr-3">
              <Sprout className="footera-text-cream h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold footera-text-green">RESPONSABILIDADE</h3>
            </div>
            <div className="footera-text-green font-bold">{score?.responsibility} pts</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 mb-4">
          <h3 className="font-semibold footera-text-green mb-3">Histórico Completo</h3>
          
          {/* Activity History */}
          {historyItems.map((item, index) => (
            <div 
              key={item.id} 
              className={`mb-3 pb-3 ${index < historyItems.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="flex items-center">
                <div className={`w-6 h-6 ${item.iconBg} rounded-full flex items-center justify-center mr-3`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium footera-text-green">{item.type}</h4>
                  <p className="text-xs text-gray-500">
                    {formatDate(item.date)} • ± {item.duration} min
                  </p>
                </div>
                {index === 0 && (
                  <div className="text-sm footera-text-green cursor-pointer">Ver Tudo &gt;</div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-white rounded-lg p-4 mb-4">
          <h3 className="font-semibold footera-text-green mb-3">Galeria de Vídeos</h3>
          
          <div className="grid grid-cols-3 gap-2">
            {videos.map(video => (
              <div key={video.id} className="video-thumbnail rounded overflow-hidden">
                <img 
                  src={video.thumbnail} 
                  className="w-full h-20 object-cover" 
                  alt="Vídeo de treino" 
                />
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 mb-12">
          <div className="flex justify-between items-center mb-2 cursor-pointer">
            <h3 className="font-semibold footera-text-green">Conexões</h3>
            <ChevronRight className="footera-text-green h-5 w-5" />
          </div>
          
          <div className="flex justify-between items-center mt-3 cursor-pointer">
            <h3 className="font-semibold footera-text-green">Informações Adicionais</h3>
            <ChevronRight className="footera-text-green h-5 w-5" />
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
