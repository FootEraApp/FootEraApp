import { useContext, useEffect, useRef, useState } from "react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import {
  UserContext,
} from "../context/UserContext.js";

export function useTreinoTimer(treinoAgendadoId: string) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const authContext =
    useContext(
      UserContext
    );

  const atletaAtivo =
    authContext
      ?.activeContext
      ?.kind ===
      "PERSONAL" &&
    String(
      authContext
        ?.activeTipoUsuario ??
      ""
    )
      .trim()
      .toLowerCase() ===
      "atleta" &&
    Boolean(
      authContext
        ?.activeTipoUsuarioId
    );

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

  const iniciar =
    async () => {
      if (!atletaAtivo) {
        throw new Error(
          "Use seu perfil de Atleta para iniciar este treino."
        );
      }
      const token =
        Storage.token;

      const r =
        await fetch(
          `${API.BASE_URL}/api/treinos/${encodeURIComponent(
            treinoAgendadoId
          )}/start`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!r.ok) {
        const data =
          await r
            .json()
            .catch(
              () => null
            );

        throw new Error(
          data?.message ??
          data?.error ??
          "Falha ao iniciar treino"
        );
      }

      const data =
        await r
          .json()
          .catch(
            () => ({})
          );

      const nowISO =
        data?.startedAt ??
        new Date()
          .toISOString();

      setStartedAt(
        nowISO
      );

      localStorage.setItem(
        `treino:${treinoAgendadoId}:startedAt`,
        nowISO
      );

      return data;
    };

  const finalizar =
    async (
      payload: {
        observacao?: string;
        midiaUrl?: string;
        midiaTipo?: string;
      }
    ) => {
      if (!atletaAtivo) {
        throw new Error(
          "Use seu perfil de Atleta para finalizar este treino."
        );
      }

      const token =
        Storage.token;

      const r =
        await fetch(
          `${API.BASE_URL}/api/treinos/${encodeURIComponent(
            treinoAgendadoId
          )}/finish`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await r
          .json()
          .catch(
            () => null
          );

      if (!r.ok) {
        throw new Error(
          data?.message ??
          data?.error ??
          "Falha ao finalizar treino"
        );
      }

      localStorage.removeItem(
        `treino:${treinoAgendadoId}:startedAt`
      );

      setStartedAt(
        null
      );

      setElapsed(
        0
      );

      return data;
    };

  return { startedAt, elapsed, iniciar, finalizar };
}