
import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";

async function main() {
  // Validar segurança antes dos imports do backend.
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_ABORTADO: ambiente inseguro");
  }

  const { prisma } = await import("./server/prisma.js");

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`SELECT current_database() AS nome`;

  assert.equal(banco[0]?.nome, "footera_billing_qa");

  const {
    configurarConsultorMercadoPagoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const {
    mercadoPagoWebhook,
  } = await import(
    "./server/controllers/billingController.js"
  );

  let passou = 0;
  let falhou = 0;

  type Caso = {
    tipo: "EVENTO" | "AULA_AO_VIVO";
    recursoId: string;
    usuarioId: string;
    valor: string;
  };

  async function testar(
    nome: string,
    fn: () => Promise<void>
  ) {
    try {
      await fn();
      passou++;
      console.log("✔", nome);
    } catch (erro) {
      falhou++;
      console.error("✖", nome, erro);
    }
  }

  async function webhook(mpId: string) {
    let status = 0;
    let corpo: any = null;
        
    const req = {
      query: {
        type: "payment",
        "data.id": mpId,
      },
      body: {
        type: "payment",
        data: {
          id: mpId,
        },
      },
    };

    const res = {
      status(codigo: number) {
        status = codigo;
        return this;
      },
      json(valor: unknown) {
        corpo = valor;
        return this;
      },
    };

    await mercadoPagoWebhook(req as any, res as any);
    return { status, corpo };
  }

  // Encontrar comprador que ainda não possui acesso.
  async function encontrarComprador(
    tipo: Caso["tipo"],
    recursoId: string
  ): Promise<string | null> {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true },
      take: 200,
    });

    for (const usuario of usuarios) {
      const acesso = tipo === "EVENTO"
        ? await prisma.inscricaoEvento.findUnique({
            where: {
              eventoId_usuarioId: {
                eventoId: recursoId,
                usuarioId: usuario.id,
              },
            },
          })
        : await prisma.aulaAoVivoAcesso.findUnique({
            where: {
              aulaAoVivoId_usuarioId: {
                aulaAoVivoId: recursoId,
                usuarioId: usuario.id,
              },
            },
          });

      if (acesso) continue;

      // Não reutilizar um comprador que já tenha
      // outro pagamento aprovado para este produto.
      const pagamentoExistente =
        await prisma.pagamento.findFirst({
          where: {
            usuarioId: usuario.id,
            plano: `${tipo}:${recursoId}`,
            status: "APROVADO",
          },
          select: { id: true },
        });

      if (!pagamentoExistente) return usuario.id;
    }

    return null;
  }

  async function executarCaso(caso: Caso) {
    const pagamentoId = randomUUID();
    const mpId = (
      BigInt(Date.now()) * 100000n +
      BigInt(randomInt(100000))
    ).toString();

    const plano = `${caso.tipo}:${caso.recursoId}`;
    let pagamentoCriado = false;
    let concluido = false;

    console.log(`\n[QA] Produto: ${plano}`);
    console.log(`[QA] Comprador: ${caso.usuarioId}`);

    try {
      await prisma.pagamento.create({
        data: {
          id: pagamentoId,
          usuarioId: caso.usuarioId,
          plano,
          periodicidade: "Mensal",
          metodo: "PIX",
          status: "PENDENTE",
          valor: caso.valor,
          moeda: "BRL",
          provider: "MERCADOPAGO",
          providerRef: `PREF-QA-${pagamentoId}`,
          contextoKind: "PERSONAL",
          contextoTipo: "Atleta",
          contextoPerfilId: null,
        },
      });

      pagamentoCriado = true;

      configurarConsultorMercadoPagoQa(async (id) => {
        assert.equal(id, mpId);

        return {
          id: mpId,
          status: "approved",
          status_detail: "accredited",
          external_reference: pagamentoId,
          metadata: { pagamentoId },
          transaction_amount: Number(caso.valor),
          currency_id: "BRL",
        };
      });

      const falhasIniciais = falhou;

      await testar(
        `${caso.tipo}: pagamento aprovado`,
        async () => {
          const resposta = await webhook(mpId);
          assert.equal(
            resposta.status,
            200,
            JSON.stringify(resposta.corpo)
          );

          const pagamento =
            await prisma.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            });

          assert.equal(pagamento.status, "APROVADO");
          assert.equal(pagamento.providerRef, mpId);
          assert.ok(pagamento.pagoEm);
        }
      );

      await testar(
        `${caso.tipo}: acesso concedido`,
        async () => {
          if (caso.tipo === "EVENTO") {
            const inscricao =
              await prisma.inscricaoEvento.findUnique({
                where: {
                  eventoId_usuarioId: {
                    eventoId: caso.recursoId,
                    usuarioId: caso.usuarioId,
                  },
                },
              });

            assert.ok(inscricao);
            assert.equal(inscricao.status, "CONFIRMADA");
          } else {
            const acesso =
              await prisma.aulaAoVivoAcesso.findUnique({
                where: {
                  aulaAoVivoId_usuarioId: {
                    aulaAoVivoId: caso.recursoId,
                    usuarioId: caso.usuarioId,
                  },
                },
              });

            assert.ok(acesso);
            assert.equal(acesso.status, "ATIVO");
            assert.equal(acesso.origem, "PAGAMENTO");
            assert.equal(acesso.expiraEm, null);
            assert.equal(
              acesso.valorPago?.toNumber(),
              Number(caso.valor)
            );
          }
        }
      );

      await testar(
        `${caso.tipo}: beneficio correto`,
        async () => {
          const beneficios =
            await prisma.pagamentoBeneficio.findMany({
              where: { pagamentoId },
            });

          assert.equal(beneficios.length, 1);
          assert.equal(beneficios[0].tipo, caso.tipo);
          assert.equal(
            beneficios[0].recursoId,
            caso.recursoId
          );
          assert.equal(beneficios[0].itemKey, plano);
          assert.equal(beneficios[0].revogadoEm, null);
        }
      );

      await testar(
        `${caso.tipo}: webhook idempotente`,
        async () => {
          const resposta = await webhook(mpId);

          assert.equal(resposta.status, 200);
          assert.equal(resposta.corpo?.idempotent, true);

          const beneficios =
            await prisma.pagamentoBeneficio.count({
              where: { pagamentoId },
            });

          const acessos = caso.tipo === "EVENTO"
            ? await prisma.inscricaoEvento.count({
                where: {
                  eventoId: caso.recursoId,
                  usuarioId: caso.usuarioId,
                },
              })
            : await prisma.aulaAoVivoAcesso.count({
                where: {
                  aulaAoVivoId: caso.recursoId,
                  usuarioId: caso.usuarioId,
                },
              });

          assert.equal(beneficios, 1);
          assert.equal(acessos, 1);
        }
      );

      concluido = falhou === falhasIniciais;
    } finally {
      configurarConsultorMercadoPagoQa(null);

      if (pagamentoCriado && concluido) {
        await prisma.$transaction(async (tx) => {
          const beneficios =
            await tx.pagamentoBeneficio.findMany({
              where: { pagamentoId },
            });

          if (
            beneficios.length !== 1 ||
            beneficios[0].usuarioId !== caso.usuarioId ||
            beneficios[0].recursoId !== caso.recursoId ||
            beneficios[0].tipo !== caso.tipo
          ) {
            throw new Error(
              "QA_CLEANUP_ABORTADO: beneficio inesperado"
            );
          }

          if (caso.tipo === "EVENTO") {
            const inscricao =
              await tx.inscricaoEvento.findUniqueOrThrow({
                where: {
                  eventoId_usuarioId: {
                    eventoId: caso.recursoId,
                    usuarioId: caso.usuarioId,
                  },
                },
              });

            assert.equal(inscricao.status, "CONFIRMADA");

            await tx.inscricaoEvento.delete({
              where: { id: inscricao.id },
            });
          } else {
            const acesso =
              await tx.aulaAoVivoAcesso.findUniqueOrThrow({
                where: {
                  aulaAoVivoId_usuarioId: {
                    aulaAoVivoId: caso.recursoId,
                    usuarioId: caso.usuarioId,
                  },
                },
              });

            assert.equal(acesso.origem, "PAGAMENTO");

            await tx.aulaAoVivoAcesso.delete({
              where: { id: acesso.id },
            });
          }

          await tx.pagamentoBeneficio.deleteMany({
            where: { pagamentoId },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });
        });

        console.log(
          `[QA] ${caso.tipo}: registros de teste removidos.`
        );
      } else if (pagamentoCriado) {
        console.warn(
          `[QA] ${caso.tipo}: registros preservados para auditoria`,
          { pagamentoId }
        );
      }
    }
  }

  
  const prefixo = `QA_EVENTO_AULA_${randomUUID()}`;
  const eventoId = randomUUID();
  const aulaId = randomUUID();

  let eventoCriado = false;
  let aulaCriada = false;
  let casosConcluidos = false;

  try {
    // Utilizar apenas a identidade de um usuário
    // existente no banco QA, sem alterar seu cadastro.
    const usuario = await prisma.usuario.findFirst({
      select: { id: true },
    });

    assert.ok(usuario, "QA_SEM_USUARIO");

    const agora = Date.now();

    // Criar um evento pago exclusivo deste teste.
    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `${prefixo}_EVENTO`,
        descricao: "Fixture temporaria QA",
        status: "ABERTO",
        dataEvento: new Date(
          agora + 10 * 86400000
        ),
        inscricaoInicio: new Date(
          agora - 86400000
        ),
        inscricaoFim: new Date(
          agora + 9 * 86400000
        ),
        vagas: 10,
        valorInscricao: "25.00",
        requisitos: [],
        linkInscricao: null,
      },
    });

    eventoCriado = true;

    // Criar uma aula paga exclusiva deste teste.
    // Não cria transmissão, sala IVS nem vídeo.
    await prisma.aulaAoVivo.create({
      data: {
        id: aulaId,
        titulo: `${prefixo}_AULA`,
        descricao: "Fixture temporaria QA",
        status: "AGENDADA",
        dataInicio: new Date(
          agora + 10 * 86400000
        ),
        dataFim: new Date(
          agora + 10 * 86400000 + 3600000
        ),
        inscricaoInicio: new Date(
          agora - 86400000
        ),
        inscricaoFim: new Date(
          agora + 9 * 86400000
        ),
        acessoPago: true,
        precoAcesso: "25.00",
        replayDisponivel: false,
      },
    });

    aulaCriada = true;

    const casoEvento: Caso = {
      tipo: "EVENTO",
      recursoId: eventoId,
      usuarioId: usuario.id,
      valor: "25.00",
    };

    const casoAula: Caso = {
      tipo: "AULA_AO_VIVO",
      recursoId: aulaId,
      usuarioId: usuario.id,
      valor: "25.00",
    };

    // Reutilizar os testes reais existentes.
    // A função executarCaso já cria seu pagamento,
    // instala o simulador e testa a concessão
    // e a idempotência do webhook.
    await executarCaso(casoEvento);
    await executarCaso(casoAula);

    assert.equal(
      falhou,
      0,
      "QA_FALHAS_NO_PROCESSAMENTO"
    );

    casosConcluidos = true;

    console.log(
      `\nRESULTADO: ${passou}/${passou + falhou}`
    );
  } finally {
    try {
      if (
        casosConcluidos &&
        eventoCriado &&
        aulaCriada
      ) {
        await prisma.$transaction(async (tx) => {
          const evento =
            await tx.evento.findUniqueOrThrow({
              where: { id: eventoId },
            });

          const aula =
            await tx.aulaAoVivo.findUniqueOrThrow({
              where: { id: aulaId },
            });

          if (
            evento.titulo !== `${prefixo}_EVENTO` ||
            aula.titulo !== `${prefixo}_AULA`
          ) {
            throw new Error(
              "QA_LIMPEZA_IDENTIDADE_INCONSISTENTE"
            );
          }

          // Nenhum acesso, pagamento ou benefício
          // deve restar após executarCaso().
          const [
            inscricoes,
            acessos,
            pagamentosEvento,
            pagamentosAula,
            beneficiosEvento,
            beneficiosAula,
          ] = await Promise.all([
            tx.inscricaoEvento.count({
              where: { eventoId },
            }),
            tx.aulaAoVivoAcesso.count({
              where: { aulaAoVivoId: aulaId },
            }),
            tx.pagamento.count({
              where: {
                plano: `EVENTO:${eventoId}`,
              },
            }),
            tx.pagamento.count({
              where: {
                plano: `AULA_AO_VIVO:${aulaId}`,
              },
            }),
            tx.pagamentoBeneficio.count({
              where: {
                tipo: "EVENTO",
                recursoId: eventoId,
              },
            }),
            tx.pagamentoBeneficio.count({
              where: {
                tipo: "AULA_AO_VIVO",
                recursoId: aulaId,
              },
            }),
          ]);

          if (
            inscricoes !== 0 ||
            acessos !== 0 ||
            pagamentosEvento !== 0 ||
            pagamentosAula !== 0 ||
            beneficiosEvento !== 0 ||
            beneficiosAula !== 0
          ) {
            throw new Error(
              "QA_LIMPEZA_BLOQUEADA_REGISTROS_RESTANTES"
            );
          }

          await tx.aulaAoVivo.delete({
            where: { id: aulaId },
          });

          await tx.evento.delete({
            where: { id: eventoId },
          });
        });

        console.log(
          "[QA] Evento e aula temporarios removidos."
        );
      } else {
        console.warn(
          "[QA] Fixtures preservadas para auditoria:",
          {
            eventoId: eventoCriado ? eventoId : null,
            aulaId: aulaCriada ? aulaId : null,
          }
        );
      }
    } finally {
      configurarConsultorMercadoPagoQa(null);
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});