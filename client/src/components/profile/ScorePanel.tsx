import { BarChart3, Timer, Sprout, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface ScorePanelProps {
  performance: number;
  discipline: number;
  responsibility: number;
}

export default function ScorePanel({
  performance,
  discipline,
  responsibility
}: ScorePanelProps) {
  const [_, navigate] = useLocation();
  
  const handleClick = () => {
    navigate("/profile/score");
  };
  
  return (
    <section className="mb-6 cursor-pointer" onClick={handleClick}>
      <h2 className="text-lg font-bold footera-text-green mb-3">Detalhes da Pontuação</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Performance Score */}
        <div className="p-3 border-b border-gray-100 flex items-center">
          <div className="w-8 h-8 footera-bg-green rounded flex items-center justify-center mr-3">
            <BarChart3 className="footera-text-cream h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold footera-text-green">PERFORMANCE</h3>
          </div>
          <div className="footera-text-green font-bold">{performance} pts</div>
        </div>
        
        {/* Discipline Score */}
        <div className="p-3 border-b border-gray-100 flex items-center">
          <div className="w-8 h-8 footera-bg-green rounded flex items-center justify-center mr-3">
            <Timer className="footera-text-cream h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold footera-text-green">DISCIPLINA</h3>
          </div>
          <div className="footera-text-green font-bold">{discipline} pts</div>
        </div>
        
        {/* Responsibility Score */}
        <div className="p-3 flex items-center">
          <div className="w-8 h-8 footera-bg-green rounded flex items-center justify-center mr-3">
            <Sprout className="footera-text-cream h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold footera-text-green">RESPONSABILIDADE</h3>
          </div>
          <div className="footera-text-green font-bold">{responsibility} pts</div>
        </div>
      </div>
      
      {/* Group Section */}
      <div className="footera-bg-cream border border-gray-200 rounded-lg p-4 flex justify-between items-center mt-6">
        <h2 className="font-bold footera-text-green">Meu Grupo</h2>
        <ChevronRight className="footera-text-green h-5 w-5" />
      </div>
    </section>
  );
}