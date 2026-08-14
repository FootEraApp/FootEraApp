import {
  useEffect,
  useState,
} from "react";

import axios from "axios";

import {
  ArrowUp,
} from "lucide-react";

import Storage from "../../../../server/utils/storage.js";

import {
  API,
} from "../../config.js";

type Props = {
  usuarioId: string;
};

type DeltaResponse = {
  delta?: number;
  totalAtual?: number;

  primeiraVisualizacao?: boolean;

  proprioPerfil?: boolean;

  registrarVisualizacao?: boolean;
};

export default function ScoreDeltaBadge({
  usuarioId,
}: Props) {
  const [delta, setDelta] =
    useState(0);

  const token =
    Storage.token;

  useEffect(() => {
    if (
      !usuarioId ||
      !token
    ) {
      setDelta(0);
      return;
    }

    let alive = true;

    let timer:
      | ReturnType<
          typeof setTimeout
        >
      | null = null;

    const headers = {
      Authorization:
        `Bearer ${token}`,
    };

    (async () => {
      try {
        /*
         * Apenas CONSULTA
         * a última pontuação vista.
         *
         * Esse GET não altera
         * o snapshot.
         */
        const {
          data,
        } =
          await axios.get<DeltaResponse>(
            `${API.BASE_URL}/api/perfil/${encodeURIComponent(
              usuarioId
            )}/pontuacao-delta`,
            {
              headers,
            }
          );

        if (!alive) {
          return;
        }

        const valor =
          Math.max(
            0,
            Number(
              data?.delta
            ) || 0
          );

        setDelta(valor);

        /*
         * Esperamos um pouco antes
         * de considerar que a pessoa
         * realmente viu a pontuação.
         */
        if (
          data
            ?.registrarVisualizacao ===
          true
        ) {
          timer =
            setTimeout(
              async () => {
                try {
                  await axios.post(
                    `${API.BASE_URL}/api/perfil/${encodeURIComponent(
                      usuarioId
                    )}/pontuacao-delta/confirmar`,
                    {},
                    {
                      headers,
                    }
                  );
                } catch (
                  error
                ) {
                  console.error(
                    "[ScoreDeltaBadge] Falha ao registrar visualização:",
                    error
                  );
                }
              },
              2000
            );
        }
      } catch (
        error
      ) {
        if (!alive) {
          return;
        }

        console.error(
          "[ScoreDeltaBadge] Falha ao carregar delta:",
          error
        );

        setDelta(0);
      }
    })();

    return () => {
      alive = false;

      if (timer) {
        clearTimeout(
          timer
        );
      }
    };
  }, [
    usuarioId,
    token,
  ]);

  if (delta <= 0) {
    return null;
  }

  return (
    <div
      title={`+${delta} pontos desde sua última visita`}
      className="
        flex
        items-center
        gap-1
        text-green-200
        text-xs
        bg-green-900/30
        border
        border-green-200/30
        rounded
        px-2
        py-0.5
      "
    >
      <ArrowUp
        size={16}
      />

      <span>
        +{delta}
      </span>
    </div>
  );
}