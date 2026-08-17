import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowUp, ArrowDown } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";

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
          Number(data?.delta) || 0;

        setDelta(valor);

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

  if (delta === 0) {
    return null;
  }

  const subiu = delta > 0;
  const valorAbsoluto = Math.abs(delta);

  return (
    <div
      title={
        subiu
          ? `+${valorAbsoluto} pontos desde sua última visita`
          : `-${valorAbsoluto} pontos desde sua última visita`
      }
      className={`
        flex
        items-center
        gap-1
        text-xs
        rounded
        px-2
        py-0.5
        ${
          subiu
            ? "text-green-200 bg-green-900/30 border border-green-200/30"
            : "text-red-200 bg-red-900/30 border border-red-200/30"
        }
      `}
    >
      {subiu ? (
        <ArrowUp size={16} />
      ) : (
        <ArrowDown size={16} />
      )}

      <span>
        {subiu ? "+" : "-"}
        {valorAbsoluto}
      </span>
    </div>
  );
}