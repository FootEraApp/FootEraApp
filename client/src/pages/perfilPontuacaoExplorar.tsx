import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useRoute } from "wouter";
import { BarChart2, Timer, KeyRound, CheckCircle, Play, ArrowLeft } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

type PontuacaoResp = {
  performance: number;
  disciplina: number;
  responsabilidade: number;
  historico?: Array<{
    tipo: "Desafio" | "Treino" | string;
    titulo: string;
    status?: string;
    data?: string;
    duracao?: string;
    pontuacao?: number;
    pontos?: number; 
  }>;
  videos?: string[];
};

export default function PontuacaoDePerfil() {
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute<{ id: string }>("/perfil/:id/pontuacao");
  const targetId = matched ? params!.id : "";

  const token =
    Storage?.token || (typeof window !== "undefined" ? Storage.token : "");

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [pontuacao, setPontuacao] = useState({ performance: 0, disciplina: 0, responsabilidade: 0 });
  const [historico, setHistorico] = useState<any[]>([]);
  const [videos, setVideos] = useState<string[]>([]);

  const axiosHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` } as any), [token]);

  useEffect(() => {
    if (!token) {
      setLocation("/login");
      return;
    }
    if (!targetId) {
      setErro("ID do perfil não encontrado.");
      return;
    }

    const carregar = async () => {
      setCarregando(true);
      setErro(null);

      try {
        let resp: { data: PontuacaoResp } | null = null;
        try {
          resp = await axios.get(`${API.BASE_URL}/api/perfil/pontuacao/${targetId}`, { headers: axiosHeaders });
        } catch {
          resp = await axios.get(`${API.BASE_URL}/api/perfil/${targetId}/pontuacao`, { headers: axiosHeaders });
        }

        const { performance, disciplina, responsabilidade, historico, videos } = resp!.data;
        setPontuacao({
          performance: performance ?? 0,
          disciplina: disciplina ?? 0,
          responsabilidade: responsabilidade ?? 0,
        });
        setHistorico(historico ?? []);
        setVideos(videos ?? []);
      } catch (e: any) {
        console.error(e);
        setErro("Não foi possível carregar a pontuação do atleta.");
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [targetId, token, axiosHeaders, setLocation]);

  if (!matched) return null;

  return (
    <div className="min-h-screen bg-transparent pb-28">
      <header className="bg-green-900 text-white flex items-center gap-3 py-3 px-4">
        <button className="p-1 -ml-1" onClick={() => history.back()} aria-label="Voltar">
          <ArrowLeft />
        </button>
        <span className="text-lg font-bold">FOOTERA</span>
      </header>

      <h2 className="text-green-900 font-bold text-lg px-4 mt-4 mb-2">Detalhes da Pontuação</h2>

      <section className="bg-green-900 mx-4 p-4 rounded-xl text-white text-center mb-4">
        <h3 className="font-bold mb-2">PONTUAÇÃO FOOTERA</h3>
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

      {carregando && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-white shadow text-sm text-gray-600">
          Carregando dados…
        </div>
      )}
      {erro && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {erro}
        </div>
      )}

      <section className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h3 className="text-green-900 font-bold mb-2">Histórico Completo</h3>
        {historico.map((item, index) => {
            const pts =
             typeof item.pontuacao === "number"
                ? item.pontuacao
                : typeof item.pontos === "number"
                ? item.pontos
                : null;

            const dur =
             item.duracao ??
             (typeof item.duracaoMin === "number" ? `${item.duracaoMin} min` : undefined);

            return (
            <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex items-center gap-2">
                {item.tipo === "Desafio" ? (
                    <CheckCircle className="text-green-600" />
                ) : (
                    <Play className="text-green-600" />
                )}
                <div>
                    <div className="font-semibold">
                    {item.titulo} - {item.tipo} {item.status ?? ""}
                    </div>
                    <div className="text-sm text-gray-600">
                    {item.data ?? ""}
                    {dur ? ` • ${dur}` : ""}
                    {typeof pts === "number" ? ` • +${pts} pts` : ""}
                    </div>
                </div>
                </div>
            </div>
            );
        })}
        </section>

      <section className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h3 className="text-green-900 font-bold mb-2">Galeria de Vídeos</h3>
        {videos.length === 0 && !carregando ? (
          <div className="text-sm text-gray-600">Sem vídeos ainda.</div>
        ) : null}
        <div className="flex gap-2 overflow-x-auto">
          {videos.map((url, idx) =>
            url.includes(".mp4") || url.includes("youtube") ? (
              <video key={idx} src={url} controls className="w-40 h-24 rounded-lg shadow" />
            ) : (
              <img key={idx} src={url} alt={`Vídeo ${idx}`} className="w-40 h-24 rounded-lg shadow object-cover" />
            )
          )}
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
