import { prisma } from "../lib/prisma.js";
import { sincronizarReplayInterno } from "../controllers/aulasAoVivoController.js";

const INTERVALO_MS = 15_000;

let executando = false;
let timer: NodeJS.Timeout | null = null;

async function verificarReplaysPendentes() {
  if (executando) {
    return;
  }

  executando = true;

  try {
    const limite = new Date(
        Date.now() -
            7 * 24 * 60 * 60 * 1000
    );

    const aulas = await prisma.aulaAoVivo.findMany({
      where: {
        status: "FINALIZADA",
        replayDisponivel: false,
        gravacaoAtiva: true,
        ivsRecordingStatus: "PROCESSANDO",
        ivsChannelArn: {
          not: null,
        },
        ivsRecordingConfigurationArn: {
          not: null,
        },
        OR: [
          {
            finalizouEm: {
              gte: limite,
            },
          },
          {
            finalizouEm: null,
            dataFim: {
              gte: limite,
            },
          },
        ],
      },
      orderBy: {
        finalizouEm: "asc",
      },
      take: 20,
      select: {
        id: true,
      },
    });

    for (const aula of aulas) {
      try {
        const resultado =
          await sincronizarReplayInterno(
            aula.id
          );

        if (
          resultado.replayDisponivel
        ) {
          console.log(
            `[REPLAY] Replay disponível: ${aula.id}`
          );
        }
      } catch (error) {
        console.error(
          `[REPLAY] Erro ao sincronizar ${aula.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      "[REPLAY] Erro no scheduler:",
      error
    );
  } finally {
    executando = false;
  }
}

export function startReplayScheduler() {
  if (timer) {
    return;
  }

  console.log(
    "[REPLAY] Scheduler iniciado."
  );

  void verificarReplaysPendentes();

  timer = setInterval(() => {
    void verificarReplaysPendentes();
  }, INTERVALO_MS);
}