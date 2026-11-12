
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_ABORTADO: ambiente incorreto");
  }

  const { prisma } = await import("./server/prisma.js");

  let aprovados = 0;
  let falhas = 0;
  let ignorados = 0;

  const aulasQaCriadas: Array<{
    id: string;
    titulo: string;
  }> = [];

  async function testar(
    descricao: string,
    fn: () => Promise<void>
  ) {
    try {
      await fn();
      aprovados++;
      console.log("✔", descricao);
    } catch (erro) {
      falhas++;
      console.error("✖", descricao, erro);
    }
  }

  function ignorar(descricao: string) {
    ignorados++;
    console.log("○ IGNORADO:", descricao);
  }

  async function esperarErro(
    fn: () => Promise<unknown>,
    codigo: string
  ) {
    await assert.rejects(
      fn,
      (erro: unknown) => {
        assert.ok(erro instanceof Error);
        assert.equal(
          (erro as Error & { code?: string }).code,
          codigo
        );
        return true;
      }
    );
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    const {
      assertEventoDisponivelParaCompra,
      assertAulaAoVivoDisponivelParaCompra,
    } = await import(
      "./server/controllers/billingController.js"
    );

    const idInexistente = randomUUID();

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    await testar(
      "Evento inexistente bloqueado",
      async () => {
        await esperarErro(
          () =>
            assertEventoDisponivelParaCompra(
              `EVENTO:${idInexistente}`,
              atleta?.usuarioId ?? randomUUID()
            ),
          "EVENTO_NOT_FOUND"
        );
      }
    );

    await testar(
      "Aula inexistente bloqueada",
      async () => {
        await esperarErro(
          () =>
            assertAulaAoVivoDisponivelParaCompra(
              `AULA_AO_VIVO:${idInexistente}`
            ),
          "AULA_AO_VIVO_NOT_FOUND"
        );
      }
    );
        
    const tituloAulaCancelada =
      `QA_ETAPA6_AULA_CANCELADA_${randomUUID()}`;

    const aulaCancelada =
      await prisma.aulaAoVivo.create({
        data: {
          titulo: tituloAulaCancelada,
          dataInicio: new Date(
            Date.now() - 2 * 60 * 60 * 1000
          ),
          status: "CANCELADA",
          cancelouEm: new Date(),
          acessoPago: true,
          precoAcesso: "19.90",
          replayDisponivel: false,
        },
        select: {
          id: true,
          titulo: true,
        },
      });

    aulasQaCriadas.push({
      id: aulaCancelada.id,
      titulo: aulaCancelada.titulo,
    });

    if (aulaCancelada) {
      await testar(
        "Aula cancelada bloqueada",
        async () => {
          await esperarErro(
            () =>
              assertAulaAoVivoDisponivelParaCompra(
                `AULA_AO_VIVO:${aulaCancelada.id}`
              ),
            "AULA_AO_VIVO_CANCELADA"
          );
        }
      );
    } else {
      ignorar("Aula cancelada paga não encontrada no QA");
    }

    const tituloReplayIndisponivel =
      `QA_ETAPA6_REPLAY_INDISPONIVEL_${randomUUID()}`;

    const replayIndisponivel =
      await prisma.aulaAoVivo.create({
        data: {
          titulo: tituloReplayIndisponivel,
          dataInicio: new Date(
            Date.now() - 2 * 60 * 60 * 1000
          ),
          dataFim: new Date(
            Date.now() - 60 * 60 * 1000
          ),
          finalizouEm: new Date(
            Date.now() - 60 * 60 * 1000
          ),
          status: "FINALIZADA",
          acessoPago: true,
          precoAcesso: "19.90",
          replayDisponivel: false,
          videoGravadoUrl: null,
        },
        select: {
          id: true,
          titulo: true,
        },
      });

    aulasQaCriadas.push({
      id: replayIndisponivel.id,
      titulo: replayIndisponivel.titulo,
    });

    if (replayIndisponivel) {
      await testar(
        "Replay indisponivel bloqueado",
        async () => {
          await esperarErro(
            () =>
              assertAulaAoVivoDisponivelParaCompra(
                `AULA_AO_VIVO:${replayIndisponivel.id}`
              ),
            "REPLAY_NAO_DISPONIVEL"
          );
        }
      );
    } else {
      ignorar("Replay indisponível não encontrado no QA");
    }

    // Um replay antigo, disponível e com vídeo,
    // deve ser recusado após o limite de sete dias.
    const limite = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000
    );

    const replayExpirado =
      await prisma.aulaAoVivo.findFirst({
        where: {
          status: "FINALIZADA",
          acessoPago: true,
          precoAcesso: { gt: 0 },
          replayDisponivel: true,
          videoGravadoUrl: { not: null },
          finalizouEm: { lt: limite },
        },
        select: {
          id: true,
          videoGravadoUrl: true,
        },
      });

    if (
      replayExpirado?.videoGravadoUrl?.trim()
    ) {
      await testar(
        "Replay expirado bloqueado",
        async () => {
          await esperarErro(
            () =>
              assertAulaAoVivoDisponivelParaCompra(
                `AULA_AO_VIVO:${replayExpirado.id}`
              ),
            "REPLAY_EXPIRADO"
          );
        }
      );
    } else {
      ignorar("Replay expirado válido para o cenário não encontrado");
    }

    // Testar um evento encerrado sem modificar dados.
    if (atleta) {
      const eventoPassado =
        await prisma.evento.findFirst({
          where: {
            dataEvento: { lt: new Date() },
            linkInscricao: null,
          },
          select: { id: true },
        });

      if (eventoPassado) {
        await testar(
          "Evento passado bloqueado",
          async () => {
            await esperarErro(
              () =>
                assertEventoDisponivelParaCompra(
                  `EVENTO:${eventoPassado.id}`,
                  atleta.usuarioId
                ),
              "EVENT_UNAVAILABLE"
            );
          }
        );
      } else {
        ignorar("Evento passado sem inscrição externa não encontrado");
      }
    } else {
      ignorar("Nenhum perfil Atleta no banco QA");
    }

    console.log(
      `\nRESULTADO: ${aprovados} aprovados, ${falhas} falhas, ${ignorados} ignorados`
    );

    if (falhas > 0 || ignorados > 0 || aprovados !== 6) {
      process.exitCode = 1;
    }
  } finally {
    try {
      for (const aula of aulasQaCriadas) {
        const atual =
          await prisma.aulaAoVivo.findUnique({
            where: { id: aula.id },
            select: {
              id: true,
              titulo: true,
            },
          });

        if (!atual) {
          continue;
        }

        assert.equal(
          atual.titulo,
          aula.titulo,
          "QA_AULA_IDENTIDADE_DIVERGENTE"
        );

        const [
          acessos,
          convidados,
          mensagens,
          presencas,
        ] = await Promise.all([
          prisma.aulaAoVivoAcesso.count({
            where: { aulaAoVivoId: aula.id },
          }),
          prisma.aulaAoVivoConvidado.count({
            where: { aulaAoVivoId: aula.id },
          }),
          prisma.aulaAoVivoMensagem.count({
            where: { aulaAoVivoId: aula.id },
          }),
          prisma.aulaAoVivoPresenca.count({
            where: { aulaAoVivoId: aula.id },
          }),
        ]);

        assert.equal(
          acessos + convidados + mensagens + presencas,
          0,
          "QA_AULA_POSSUI_RELACIONAMENTOS"
        );

        const removido =
          await prisma.aulaAoVivo.deleteMany({
            where: {
              id: aula.id,
              titulo: aula.titulo,
            },
          });

        assert.equal(
          removido.count,
          1,
          "QA_LIMPEZA_AULA_FALHOU"
        );
      }

      if (aulasQaCriadas.length > 0) {
        console.log(
          "[QA] Aulas sintéticas removidas"
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});