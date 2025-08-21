import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import { BarChart2, Timer, KeyRound, CheckCircle, Play } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export default function PontuacaoDetalhada() {
  const [usuarioId] = useState(Storage.usuarioId);
  const [pontuacao, setPontuacao] = useState({ performance: 0, disciplina: 0, responsabilidade: 0 });
  const [historico, setHistorico] = useState<any[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = Storage.token;
    if (!token || !usuarioId) {
      setLocation("/login");
      return;
    }
    
    axios.get(`${API.BASE_URL}/api/perfil/pontuacao/${usuarioId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const { performance, disciplina, responsabilidade, historico, videos } = res.data;
        setPontuacao({ performance, disciplina, responsabilidade });
        setHistorico(historico ?? []);
        setVideos(videos ?? []);
      })
      .catch(err => {
        console.error("Erro ao carregar pontuação:", err);
      });
  }, [usuarioId, setLocation]);

  return (
    <div className="min-h-screen bg-transparent pb-28">
      <header className="bg-green-900 text-white text-center py-3 text-xl font-bold">FOOTERA</header>

      <h2 className="text-green-900 font-bold text-lg px-4 mt-4 mb-2">Detalhes da Pontuação</h2>

      <section className="bg-green-900 mx-4 p-4 rounded-xl text-white text-center mb-4">
        <h3 className="font-bold mb-2">MINHA PONTUAÇÃO FOOTERA</h3>
        <div className="bg-white text-green-900 rounded-lg p-3 space-y-3">
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-2 font-semibold">
              <BarChart2 /> PERFORMANCE
            </div>
            <div>{pontuacao.performance} pts</div>
          </div>
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-2 font-semibold">
              <Timer /> DISCIPLINA
            </div>
            <div>{pontuacao.disciplina} pts</div>
          </div>
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-2 font-semibold">
              <KeyRound /> RESPONSABILIDADE
            </div>
            <div>{pontuacao.responsabilidade} pts</div>
          </div>
        </div>
      </section>

      <section className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h3 className="text-green-900 font-bold mb-2">Histórico Completo</h3>
        {historico.map((item, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              {item.tipo === "Desafio" ? (
                <CheckCircle className="text-green-600" />
              ) : (
                <Play className="text-green-600" />
              )}
              <div>
                <div className="font-semibold">{item.titulo} - {item.tipo} {item.status}</div>
                <div className="text-sm text-gray-600">
                  {item.data}{item.duracao ? ` • ${item.duracao}` : ""} {typeof item.pontuacao==='number' ? `• +${item.pontuacao} pts` : ""}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h3 className="text-green-900 font-bold mb-2">Galeria de Vídeos</h3>
        <div className="flex gap-2 overflow-x-auto">
         {videos.map((url, idx) => (
            url.includes(".mp4") || url.includes("youtube") ? (
              <video key={idx} src={url} controls className="w-40 h-24 rounded-lg shadow" />
            ) : (
              <img key={idx} src={url} alt={`Vídeo ${idx}`} className="w-40 h-24 rounded-lg shadow" />
            )
          ))}
        </div>
      </section>

      <section className="bg-white mx-4 rounded-xl shadow mb-4">
        <button
          onClick={() => alert("Abrir conexões")}
          className="bg-white w-full p-4 text-left rounded-xl mb-2 text-green-900 font-semibold flex justify-between"
        >
          Conexões <span>›</span>
        </button>
        <button
          onClick={() => alert("Abrir info adicionais")}
          className="bg-white w-full p-4 text-left rounded-xl text-green-900 font-semibold flex justify-between"
        >
          Informações Adicionais <span>›</span>
        </button>
      </section>
    </div>
  );
}
