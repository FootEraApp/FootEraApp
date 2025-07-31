import React, { useEffect, useState } from "react";
import axios from "axios";

interface TrainingProgressProps {
  userId: string;
}

export default function TrainingProgress({ userId }: TrainingProgressProps) {
  const [aba, setAba] = useState("resumo");
  const [treinosCompletos, setTreinosCompletos] = useState(0);
  const [horasTreinadas, setHorasTreinadas] = useState(0);
  const [desafiosCompletos, setDesafiosCompletos] = useState(0);
  const [pontosConquistados, setPontosConquistados] = useState(0);
  const [desempenhoPorCategoria, setDesempenhoPorCategoria] = useState({
    Fisico: 0,
    Tecnico: 0,
    Tatico: 0,
    Mental: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };

    axios
      .get(`http://localhost:3001/api/perfil/${userId}/treinos`, { headers })
      .then((res) => {
        const { completos, horas, desafios, pontos, categorias } = res.data;
        setTreinosCompletos(completos || 0);
        setHorasTreinadas(horas || 0);
        setDesafiosCompletos(desafios || 0);
        setPontosConquistados(pontos || 0);
        setDesempenhoPorCategoria({
          Fisico: categorias?.Fisico || 0,
          Tecnico: categorias?.Tecnico || 0,
          Tatico: categorias?.Tatico || 0,
          Mental: categorias?.Mental || 0,
        });
      })
      .catch((err) => console.error("Erro ao buscar progresso de treino:", err));
  }, [userId]);

  return (
    <div className="bg-transparent p-4 rounded-xl shadow my-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Progresso de Treinamento</h2>
        <a href="/treinos" className="text-sm text-green-900 underline">
          Ver todos
        </a>
      </div>

      <div className="flex mb-4 border rounded overflow-hidden text-sm">
        {['resumo', 'proximos', 'desafios'].map((tab) => (
          <button
            key={tab}
            className={`flex-1 p-2 ${aba === tab ? 'bg-white font-semibold' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setAba(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {aba === "resumo" && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Card color="green" label="Treinos Completos" value={treinosCompletos} icon="✔️" />
            <Card color="blue" label="Horas Treinadas" value={`${horasTreinadas.toFixed(1)}h`} icon="🕒" />
            <Card color="purple" label="Desafios Completos" value={desafiosCompletos} icon="🏆" />
            <Card color="orange" label="Pontos Conquistados" value={pontosConquistados} icon="🌟" />
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-bold text-green-900 mb-2">Desempenho por Categoria</h4>
            <div className="grid gap-3">
              <div className="flex items-center rounded-md px-3 py-2 shadow-sm">
                <span className="mr-2 text-lg">🧠</span>
                <div>
                  <p className="text-xs text-gray-700 font-medium">Mental</p>
                  <p className="text-sm text-gray-900">{desempenhoPorCategoria?.Mental || 0} treinos</p>
                </div>
              </div>
              <div className="flex items-center rounded-md px-3 py-2 shadow-sm">
                <span className="mr-2 text-lg">🏀</span>
                <div>
                  <p className="text-xs text-gray-700 font-medium">Técnico</p>
                  <p className="text-sm text-gray-900">{desempenhoPorCategoria?.Tecnico || 0} treinos</p>
                </div>
              </div>
              <div className="flex items-centerrounded-md px-3 py-2 shadow-sm">
                <span className="mr-2 text-lg">🏆</span>
                <div>
                  <p className="text-xs text-gray-700 font-medium">Tático</p>
                  <p className="text-sm text-gray-900">{desempenhoPorCategoria?.Tatico || 0} treinos</p>
                </div>
              </div>
              <div className="flex items-center rounded-md px-3 py-2 shadow-sm">
                <span className="mr-2 text-lg">💪</span>
                <div>
                  <p className="text-xs text-gray-700 font-medium">Físico</p>
                  <p className="text-sm text-gray-900">{desempenhoPorCategoria?.Fisico || 0} treinos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {aba === "proximos" && (
        <div className="text-center text-gray-600 p-6">
          <div className="text-4xl mb-2">🗓️</div>
          <p className="font-semibold">Nenhum treino agendado</p>
          <p className="text-sm">Agende novos treinos para acompanhar seu progresso</p>
          <a href="/treinos" className="text-green-700 text-sm underline block mt-2">Explorar Treinos</a>
        </div>
      )}

      {aba === "desafios" && (
        <div className="text-center text-gray-600 p-6">
          <div className="text-4xl mb-2">🏅</div>
          <p className="font-semibold">Nenhum desafio completado</p>
          <p className="text-sm">Complete desafios para ganhar pontos e subir no ranking</p>
          <a href="/explorar" className="text-green-700 text-sm underline block mt-2">Ver Desafios</a>
        </div>
      )}
    </div>
  );
}

const Card = ({ color, label, value, icon }: { color: string; label: string; value: any; icon: string }) => (
  <div className={`p-3 rounded shadow text-center bg-${color}-50`}>
    <div className={`text-${color}-700 text-2xl`}>{icon}</div>
    <div className="text-xl font-bold">{value}</div>
    <div className="text-sm text-gray-700">{label}</div>
  </div>
);
