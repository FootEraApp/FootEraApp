import { useEffect, useRef, useState } from "react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

export function useTreinoTimer(treinoAgendadoId: string) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`treino:${treinoAgendadoId}:startedAt`);
    if (saved) setStartedAt(saved);
  }, [treinoAgendadoId]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    };
    tick();
    intervalRef.current = window.setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const iniciar = async () => {
    const token = Storage.token;
    const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error("Falha ao iniciar treino");
    const nowISO = new Date().toISOString();
    setStartedAt(nowISO);
    localStorage.setItem(`treino:${treinoAgendadoId}:startedAt`, nowISO);
  };

  const finalizar = async (payload: { observacao?: string; midiaUrl?: string; midiaTipo?: string }) => {
    const token = Storage.token;
    const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error("Falha ao finalizar treino");
    localStorage.removeItem(`treino:${treinoAgendadoId}:startedAt`);
    setStartedAt(null);
    setElapsed(0);
    return r.json();
  };

  return { startedAt, elapsed, iniciar, finalizar };
}