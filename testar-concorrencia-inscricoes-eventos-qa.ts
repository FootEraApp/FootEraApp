
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Response } from "express";

type ResultadoHttp = {
  status: number;
  body: any;
};

async function main() {
  let url: URL;

  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("QA_DATABASE_URL_INVALIDA");
  }

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
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import("./server/prisma.js");

  const { participarEvento } = await import(
    "./server/controllers/eventosController.js"
  );

  const prefixo = `QA_INSCRICOES_${randomUUID()}`;
  const eventoGratuitoId = randomUUID();
  const eventoPagoId = randomUUID();

  const eventosCriados: string[] = [];
    const vistos = new Set<string>();
    let aprovados = 0;
    let falhou = false;

  async function verificar(
    descricao: string,
    executar: () => Promise<void>
  ) {
    await executar();
    aprovados++;
    console.log("✔", descricao);
  }

  async function chamarParticipar(
    eventoId: string,
    atleta?: {
      id: string;
      usuarioId: string;
    },
    contextoValido = true
  ): Promise<ResultadoHttp> {
    let status = 200;
    let body: any = null;

    const req: any = {
      params: { id: eventoId },
      userId: atleta?.usuarioId ?? "",
      user: atleta
        ? {
            id: atleta.usuarioId,
            activeContext: contextoValido
              ? {
                  kind: "PERSONAL",
                  tipoUsuario: "Atleta",
                  profileId: atleta.id,
                }
              : {
                  kind: "PERSONAL",
                  tipoUsuario: "Professor",
                },
          }
        : {},
    };

    const res = {
      status(codigo: number) {
        status = codigo;
        return this;
      },
      json(valor: unknown) {
        body = valor;
        return this;
      },
    } as unknown as Response;

    await participarEvento(req, res);

    return { status, body };
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    const atletasBase = await prisma.atleta.findMany({
      select: {
        id: true,
        usuarioId: true,
      },
      take: 100,
    });

    const atletas = atletasBase.filter((atleta) => {
      if (vistos.has(atleta.usuarioId)) return false;
      vistos.add(atleta.usuarioId);
      return true;
    });

    assert.ok(
      atletas.length >= 2,
      "QA_PRECISA_DE_DOIS_ATLETAS_COM_USUARIOS_DIFERENTES"
    );

    const [primeiro, segundo] = atletas;

    const dadosBase = {
      descricao: "Fixture temporaria de concorrencia",
      status: "ABERTO" as const,
      dataEvento: new Date(Date.now() + 10 * 86400000),
      inscricaoInicio: new Date(Date.now() - 86400000),
      inscricaoFim: new Date(Date.now() + 9 * 86400000),
      vagas: 1,
      requisitos: [] as string[],
      linkInscricao: null,
    };

    await prisma.evento.create({
      data: {
        ...dadosBase,
        id: eventoGratuitoId,
        titulo: `${prefixo}_GRATUITO`,
        valorInscricao: "0.00",
      },
    });

    eventosCriados.push(eventoGratuitoId);

    await prisma.evento.create({
      data: {
        ...dadosBase,
        id: eventoPagoId,
        titulo: `${prefixo}_PAGO`,
        valorInscricao: "25.00",
      },
    });

    eventosCriados.push(eventoPagoId);

    await verificar(
      "Participacao sem autenticacao e recusada",
      async () => {
        const resultado = await chamarParticipar(
          eventoGratuitoId
        );

        assert.equal(resultado.status, 401);
        assert.equal(resultado.body.code, "AUTH_REQUIRED");
      }
    );

    await verificar(
      "Contexto diferente de Atleta e recusado",
      async () => {
        const resultado = await chamarParticipar(
          eventoGratuitoId,
          primeiro,
          false
        );

        assert.equal(resultado.status, 403);
        assert.equal(
          resultado.body.code,
          "ATLETA_CONTEXT_REQUIRED"
        );
      }
    );

    await verificar(
      "Evento pago nao concede inscricao gratuita",
      async () => {
        const resultado = await chamarParticipar(
          eventoPagoId,
          primeiro
        );

        assert.equal(resultado.status, 402);
        assert.equal(
          resultado.body.code,
          "PAYMENT_REQUIRED"
        );

        assert.equal(
          await prisma.inscricaoEvento.count({
            where: { eventoId: eventoPagoId },
          }),
          0
        );
      }
    );

    let vencedor = primeiro;
    let perdedor = segundo;

    await verificar(
      "Dez requisicoes disputando uma vaga",
      async () => {
        const resultados = await Promise.all(
          Array.from({ length: 10 }, (_, indice) =>
            chamarParticipar(
              eventoGratuitoId,
              indice % 2 === 0 ? primeiro : segundo
            )
          )
        );

        const confirmadas = await prisma.inscricaoEvento.findMany({
          where: {
            eventoId: eventoGratuitoId,
            status: { not: "CANCELADA" },
          },
        });

        assert.equal(confirmadas.length, 1);

        assert.equal(
          resultados.filter((r) => r.status === 201).length,
          1
        );

        assert.ok(
          resultados.every((r) =>
            [200, 201, 409].includes(r.status)
          )
        );

        vencedor =
          confirmadas[0].usuarioId === primeiro.usuarioId
            ? primeiro
            : segundo;

        perdedor =
          vencedor.usuarioId === primeiro.usuarioId
            ? segundo
            : primeiro;
      }
    );

    await verificar(
      "Usuario vencedor nao ocupa segunda vaga",
      async () => {
        const resultado = await chamarParticipar(
          eventoGratuitoId,
          vencedor
        );

        assert.equal(resultado.status, 200);
        assert.equal(resultado.body.inscrito, true);

        assert.equal(
          await prisma.inscricaoEvento.count({
            where: {
              eventoId: eventoGratuitoId,
              status: { not: "CANCELADA" },
            },
          }),
          1
        );
      }
    );

    await verificar(
      "Outro atleta nao ultrapassa capacidade",
      async () => {
        const resultado = await chamarParticipar(
          eventoGratuitoId,
          perdedor
        );

        assert.equal(resultado.status, 409);
        assert.equal(resultado.body.code, "EVENT_FULL");
      }
    );

    await verificar(
      "Inscricao cancelada nao volta com evento lotado",
      async () => {
        await prisma.inscricaoEvento.upsert({
          where: {
            eventoId_usuarioId: {
              eventoId: eventoGratuitoId,
              usuarioId: perdedor.usuarioId,
            },
          },
          create: {
            eventoId: eventoGratuitoId,
            usuarioId: perdedor.usuarioId,
            status: "CANCELADA",
          },
          update: { status: "CANCELADA" },
        });

        const resultado = await chamarParticipar(
          eventoGratuitoId,
          perdedor
        );

        assert.equal(resultado.status, 409);
        assert.equal(resultado.body.code, "EVENT_FULL");

        const inscricao =
          await prisma.inscricaoEvento.findUniqueOrThrow({
            where: {
              eventoId_usuarioId: {
                eventoId: eventoGratuitoId,
                usuarioId: perdedor.usuarioId,
              },
            },
          });

        assert.equal(inscricao.status, "CANCELADA");
      }
    );

  } catch (erro) {
    falhou = true;
    throw erro;
  } finally {
    try {
      if (!falhou) {
        for (const eventoId of eventosCriados) {
          const evento = await prisma.evento.findUnique({
            where: { id: eventoId },
          });

          if (!evento || !evento.titulo.startsWith(prefixo)) {
            throw new Error("QA_LIMPEZA_EVENTO_INVALIDO");
          }

          const pagamentos = await prisma.pagamento.count({
            where: { plano: `EVENTO:${eventoId}` },
          });

          if (pagamentos !== 0) {
            throw new Error(
              "QA_LIMPEZA_BLOQUEADA_EXISTE_PAGAMENTO"
            );
          }

          const inscricoes = await prisma.inscricaoEvento.findMany({
            where: { eventoId },
            select: { usuarioId: true },
          });

          if (
            inscricoes.some(
              (item) => !vistos.has(item.usuarioId)
            )
          ) {
            throw new Error(
              "QA_LIMPEZA_INSCRICAO_INESPERADA"
            );
          }

          await prisma.$transaction(async (tx) => {
            await tx.inscricaoEvento.deleteMany({
              where: { eventoId },
            });

            await tx.evento.delete({
              where: { id: eventoId },
            });
          });
        }

        console.log("[QA] Fixtures removidas.");
      } else {
        console.warn(
          "[QA] Falha detectada. Fixtures preservadas:",
          eventosCriados
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`\nRESULTADO: ${aprovados}/7`);
  console.log(
    "[QA] Nenhuma cobranca, estorno ou chamada externa."
  );
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});