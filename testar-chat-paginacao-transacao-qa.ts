
/**
 * FootEra — Teste de paginação Prisma QA.
 *
 * - Usa somente footera_billing_qa.
 * - Cria mensagens sintéticas em uma transação.
 * - Testa paginação de 200 mensagens.
 * - Testa 260 ou 2050 mensagens.
 * - Faz ROLLBACK obrigatório.
 * - Não dispara notificações ou Socket.IO.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "./server/prisma.js";

const ROLLBACK = `CHAT_QA_ROLLBACK_${randomUUID()}`;

const TAMANHO = 200;
const MAX_PAGINAS_UI = 10;

function assegurarAmbiente() {
  const url = new URL(
    process.env.DATABASE_URL ??
      "postgresql://invalid/"
  );

  const ok =
    process.env.NODE_ENV === "test" &&
    url.protocol === "postgresql:" &&
    url.hostname === "127.0.0.1" &&
    url.port === "5433" &&
    url.pathname === "/footera_billing_qa" &&
    process.env.ENABLE_ACCOUNT_PURGE === "false" &&
    process.env.ENABLE_BILLING_SCHEDULER === "false" &&
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false" &&
    process.env.ENABLE_CHAT_AUDIO_WORKER === "false" &&
    !process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim();

  if (!ok) {
    throw new Error("BANCO_OU_AMBIENTE_QA_INCORRETO");
  }
}

function exigir(
  condicao: unknown,
  descricao: string
): asserts condicao {
  if (!condicao) {
    throw new Error(`FALHOU: ${descricao}`);
  }

  console.log(`APROVADO: ${descricao}`);
}

type Registro = {
  id: string;
  criadaEm: Date;
};

async function main() {
  assegurarAmbiente();

  const quantidade = Number(
    process.env.CHAT_PAGINACAO_QA_QUANTIDADE ?? "260"
  );

  if (
    !Number.isInteger(quantidade) ||
    ![260, 2050].includes(quantidade)
  ) {
    throw new Error(
      "CHAT_PAGINACAO_QA_QUANTIDADE_DEVE_SER_260_OU_2050"
    );
  }

  await prisma.$connect();

  const usuarios = await prisma.usuario.findMany({
    where: {
      deletedAt: null,
    },
    take: 2,
    orderBy: {
      id: "asc",
    },
    select: {
      id: true,
    },
  });

  if (usuarios.length < 2) {
    throw new Error(
      "QA_PRECISA_DE_DOIS_USUARIOS_EXISTENTES_NO_BANCO"
    );
  }

  const [remetente, destinatario] =
    usuarios.map((usuario) => usuario.id);

  const grupos = await prisma.grupo.findMany({
    take: 50,
    select: {
      id: true,
      membros: {
        take: 2,
        select: {
          usuarioId: true,
        },
      },
    },
  });

  const grupo = grupos.find(
    (item) => item.membros.length >= 2
  );

  const base = Date.UTC(
    2099,
    0,
    1,
    0,
    0,
    0
  );

  const idPriv = Array.from(
    { length: quantidade },
    () => randomUUID()
  );

  const idGrupo = Array.from(
    { length: quantidade },
    () => randomUUID()
  );

  let transacaoConcluida = false;

  async function testarPaginas(
    titulo: string,
    buscar: (
      cursor?: string
    ) => Promise<Registro[]>,
    ids: string[]
  ) {
    const vistos: string[] = [];
    const idsDoTeste = new Set(ids);

    let cursor: string | undefined;
    let paginas = 0;

    while (paginas < MAX_PAGINAS_UI) {
      const pagina = await buscar(cursor);

      exigir(
        pagina.length <= TAMANHO,
        `${titulo}: limite da página ${paginas + 1}`
      );

      const novos = pagina.filter(
        (mensagem) => idsDoTeste.has(mensagem.id)
      );

      vistos.push(
        ...novos.map((mensagem) => mensagem.id)
      );

      paginas++;

      if (pagina.length < TAMANHO) {
        break;
      }

      const proximoCursor =
        pagina[pagina.length - 1]?.id;

      if (
        !proximoCursor ||
        proximoCursor === cursor
      ) {
        break;
      }

      cursor = proximoCursor;

      if (vistos.length >= ids.length) {
        break;
      }
    }

    const distintos = new Set(vistos);

    exigir(
      distintos.size === vistos.length,
      `${titulo}: nenhuma mensagem duplicada`
    );

    const deveriaEncontrar = Math.min(
      quantidade,
      TAMANHO * MAX_PAGINAS_UI
    );

    exigir(
      vistos.length === deveriaEncontrar,
      `${titulo}: ${vistos.length}/${quantidade} mensagens encontradas em ${paginas} páginas`
    );

    if (quantidade === 2050) {
      exigir(
        !distintos.has(ids[0]),
        `${titulo}: primeira não lida não foi alcançada no limite de 2000`
      );

      console.log(
        `LIMITE_2000_CONFIRMADO: ${titulo}`
      );
    } else {
      exigir(
        distintos.has(ids[0]),
        `${titulo}: primeira mensagem localizada`
      );
    }
  }

  console.log(
    `INICIO QA: ${quantidade} mensagens por conversa`
  );

  console.log(
    grupo
      ? "Grupo QA encontrado para teste."
      : "AVISO: Grupo com dois membros não encontrado."
  );

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.mensagem.createMany({
          data: idPriv.map((id, indice) => ({
            id,
            deId: remetente,
            paraId: destinatario,
            conteudo: `QA_ROLLBACK_${indice}`,
            tipo: "NORMAL" as const,
            lida: false,
            criadaEm: new Date(
              base + indice * 1000
            ),
          })),
        });

        exigir(
          (
            await tx.mensagem.count({
              where: {
                id: {
                  in: idPriv,
                },
              },
            })
          ) === quantidade,
          `DM: ${quantidade} mensagens temporárias`
        );

        await testarPaginas(
          "DM",
          (cursor) =>
            tx.mensagem.findMany({
              where: {
                OR: [
                  {
                    deId: remetente,
                    paraId: destinatario,
                  },
                  {
                    deId: destinatario,
                    paraId: remetente,
                  },
                ],
              },
              orderBy: [
                { criadaEm: "desc" },
                { id: "desc" },
              ],
              take: TAMANHO,
              ...(cursor
                ? {
                    cursor: {
                      id: cursor,
                    },
                    skip: 1,
                  }
                : {}),
              select: {
                id: true,
                criadaEm: true,
              },
            }),
          idPriv
        );

        if (grupo) {
          await tx.mensagemGrupo.createMany({
            data: idGrupo.map((id, indice) => ({
              id,
              grupoId: grupo.id,
              usuarioId:
                grupo.membros[0].usuarioId,
              conteudo: `QA_ROLLBACK_${indice}`,
              tipo: "NORMAL" as const,
              excluida: false,
              criadaEm: new Date(
                base + indice * 1000
              ),
            })),
          });

          exigir(
            (
              await tx.mensagemGrupo.count({
                where: {
                  id: {
                    in: idGrupo,
                  },
                },
              })
            ) === quantidade,
            `GRUPO: ${quantidade} mensagens temporárias`
          );

          await testarPaginas(
            "GRUPO",
            (cursor) =>
              tx.mensagemGrupo.findMany({
                where: {
                  grupoId: grupo.id,
                },
                orderBy: [
                  { criadaEm: "desc" },
                  { id: "desc" },
                ],
                take: TAMANHO,
                ...(cursor
                  ? {
                      cursor: {
                        id: cursor,
                      },
                      skip: 1,
                    }
                  : {}),
                select: {
                  id: true,
                  criadaEm: true,
                },
              }),
            idGrupo
          );
        } else {
          console.log(
            "NAO_TESTADO: grupo sem dois membros QA."
          );
        }

        transacaoConcluida = true;

        // Erro intencional para desfazer a transação.
        throw new Error(ROLLBACK);
      },
      {
        maxWait: 15_000,
        timeout: 120_000,
      }
    );
  } catch (erro) {
    const rollbackEsperado =
      erro instanceof Error &&
      erro.message === ROLLBACK &&
      transacaoConcluida;

    if (!rollbackEsperado) {
      throw erro;
    }
  }

  const [
    restantesPriv,
    restantesGrupo,
  ] = await Promise.all([
    prisma.mensagem.count({
      where: {
        id: {
          in: idPriv,
        },
      },
    }),
    grupo
      ? prisma.mensagemGrupo.count({
          where: {
            id: {
              in: idGrupo,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  exigir(
    restantesPriv === 0 &&
      restantesGrupo === 0,
    "ROLLBACK CONFIRMADO: nenhuma mensagem persistida"
  );

  console.log(
    "CHAT_PAGINACAO_PRISMA_QA_OK"
  );

  if (quantidade === 2050) {
    console.log(
      "LIMITE_2000_CONFIRMADO: frontend precisa preservar mensagens não lidas além do limite."
    );
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });