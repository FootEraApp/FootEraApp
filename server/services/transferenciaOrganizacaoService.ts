
import {
  FuncaoMembroOrganizacao,
  Prisma,
  StatusUsuarioPapel,
  TipoUsuario,
  CreatorTipo,
} from "@prisma/client";
import { prisma } from "../prisma.js";

export class ErroTransferencia extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function executarComRetryTransacao<T>(
  operacao: () => Promise<T>,
): Promise<T> {
  const maxTentativas = 3;

  for (
    let tentativa = 1;
    tentativa <= maxTentativas;
    tentativa++
  ) {
    try {
      return await operacao();
    } catch (error) {
      const conflitoTransacao =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";

      if (!conflitoTransacao || tentativa === maxTentativas) {
        throw error;
      }

      const atrasoMs =
        100 * tentativa + Math.floor(Math.random() * 100);

      console.warn(
        `[TRANSFERENCIA] P2034 na tentativa ${tentativa}/${maxTentativas}. ` +
        `Repetindo a transação em ${atrasoMs}ms.`,
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, atrasoMs);
      });
    }
  }

  throw new Error("Falha inesperada ao executar a transação.");
}

export async function responderTransferenciaPropriedade(params: {
  transferenciaId: string;
  destinatarioId: string;
  aceitar: boolean;
  ip?: string;
  userAgent?: string;
}) {
  return executarComRetryTransacao(() =>
    prisma.$transaction(
    async (tx) => {
      const pedido = await tx.transferenciaPropriedade.findUnique({
        where: { id: params.transferenciaId },
      });

      if (!pedido) {
        throw new ErroTransferencia(
          404,
          "TRANSFER_NOT_FOUND",
          "Solicitação não encontrada.",
        );
      }

      if (pedido.destinatarioId !== params.destinatarioId) {
        throw new ErroTransferencia(
          403,
          "NOT_TRANSFER_RECIPIENT",
          "Esta solicitação não pertence à sua conta.",
        );
      }

      if (pedido.status !== "PENDENTE") {
        throw new ErroTransferencia(
          409,
          "TRANSFER_ALREADY_ANSWERED",
          "Esta solicitação já foi respondida.",
        );
      }

      const agora = new Date();

      if (pedido.expiraEm <= agora) {
        throw new ErroTransferencia(
          409,
          "TRANSFER_EXPIRED",
          "Esta solicitação expirou.",
        );
      }

      if (!params.aceitar) {
        const alteracao = await tx.transferenciaPropriedade.updateMany({
          where: {
            id: pedido.id,
            status: "PENDENTE",
          },
          data: {
            status: "RECUSADA",
            respondidoEm: agora,
          },
        });

        if (alteracao.count !== 1) {
          throw new ErroTransferencia(
            409,
            "TRANSFER_CHANGED",
            "A solicitação foi alterada.",
          );
        }

        return {
          status: "RECUSADA" as const,
          organizacaoId: pedido.organizacaoId,
          proprietarioAnteriorId: pedido.proprietarioAtualId,
          destinatarioId: pedido.destinatarioId,
        };
      }

      const organizacao = await tx.organizacao.findUnique({
        where: { id: pedido.organizacaoId },
        select: {
          id: true,
          tipo: true,
          nome: true,
          ativo: true,
          clube: { select: { id: true, usuarioId: true } },
          escolinha: { select: { id: true, usuarioId: true } },
          marca: { select: { id: true, usuarioId: true } },
          federacao: { select: { id: true, usuarioId: true } },
          membros: {
            where: {
              ativo: true,
              funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
            },
            select: {
              id: true,
              usuarioId: true,
            },
          },
        },
      });

      if (!organizacao?.ativo) {
        throw new ErroTransferencia(
          409,
          "ORGANIZATION_UNAVAILABLE",
          "Organização indisponível.",
        );
      }

      if (
        organizacao.membros.length !== 1 ||
        organizacao.membros[0].usuarioId !==
          pedido.proprietarioAtualId
      ) {
        throw new ErroTransferencia(
          409,
          "OWNERSHIP_CHANGED",
          "A propriedade da organização foi alterada.",
        );
      }

      const [anterior, destinatario] = await Promise.all([
        tx.usuario.findUnique({
          where: { id: pedido.proprietarioAtualId },
          select: {
            id: true,
            deletedAt: true,
            blockedAt: true,
            contextoOrganizacaoId: true,
          },
        }),
        tx.usuario.findUnique({
          where: { id: pedido.destinatarioId },
          select: {
            id: true,
            deletedAt: true,
            blockedAt: true,
          },
        }),
      ]);

      if (
        !anterior ||
        anterior.deletedAt ||
        anterior.blockedAt ||
        !destinatario ||
        destinatario.deletedAt ||
        destinatario.blockedAt
      ) {
        throw new ErroTransferencia(
          409,
          "ACCOUNT_UNAVAILABLE",
          "Uma das contas está indisponível.",
        );
      }

      if (anterior.id === destinatario.id) {
        throw new ErroTransferencia(
            409,
            "SAME_OWNER",
            "O proprietário e o destinatário não podem ser a mesma pessoa.",
        );
        }

      const legado =
        organizacao.tipo === "CLUBE"
          ? organizacao.clube
          : organizacao.tipo === "ESCOLA"
            ? organizacao.escolinha
            : organizacao.tipo === "MARCA"
              ? organizacao.marca
              : organizacao.federacao;

      if (!legado || legado.usuarioId !== anterior.id) {
        throw new ErroTransferencia(
          409,
          "LEGACY_OWNER_MISMATCH",
          "A titularidade legada precisa ser regularizada antes da transferência.",
        );
      }

      const jaPossuiMesmoTipo =
        organizacao.tipo === "CLUBE"
          ? await tx.clube.findFirst({
              where: {
                usuarioId: destinatario.id,
                id: { not: legado.id },
              },
              select: { id: true },
            })
          : organizacao.tipo === "ESCOLA"
            ? await tx.escolinha.findFirst({
                where: {
                  usuarioId: destinatario.id,
                  id: { not: legado.id },
                },
                select: { id: true },
              })
            : organizacao.tipo === "MARCA"
              ? await tx.marca.findFirst({
                  where: {
                    usuarioId: destinatario.id,
                    id: { not: legado.id },
                  },
                  select: { id: true },
                })
              : await tx.federacao.findFirst({
                  where: {
                    usuarioId: destinatario.id,
                    id: { not: legado.id },
                  },
                  select: { id: true },
                });

      if (jaPossuiMesmoTipo) {
        throw new ErroTransferencia(
          409,
          "RECIPIENT_ALREADY_OWNS_TYPE",
          "O destinatário já é titular de outra organização desse tipo.",
        );
      }

      const membroDestino =
        await tx.membroOrganizacao.findUnique({
          where: {
            organizacaoId_usuarioId: {
              organizacaoId: organizacao.id,
              usuarioId: destinatario.id,
            },
          },
          select: { id: true, ativo: true },
        });

      if (membroDestino) {
        await tx.membroOrganizacao.update({
          where: { id: membroDestino.id },
          data: {
            ativo: true,
            funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
          },
        });
      } else {
        await tx.membroOrganizacao.create({
          data: {
            organizacaoId: organizacao.id,
            usuarioId: destinatario.id,
            ativo: true,
            funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
          },
        });
      }

      const antigoAtualizado =
        await tx.membroOrganizacao.updateMany({
          where: {
            organizacaoId: organizacao.id,
            usuarioId: anterior.id,
            ativo: true,
            funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
          },
          data: {
            ativo: false,
            funcao: FuncaoMembroOrganizacao.MEMBRO,
            permissoes: Prisma.DbNull,
          },
        });

      if (antigoAtualizado.count !== 1) {
        throw new ErroTransferencia(
          409,
          "OWNER_MEMBERSHIP_CHANGED",
          "O vínculo do proprietário anterior mudou.",
        );
      }

      const dadosTitular = {
        usuarioId: destinatario.id,
      };

      const legadoAtualizado =
        organizacao.tipo === "CLUBE"
          ? await tx.clube.updateMany({
              where: {
                id: legado.id,
                usuarioId: anterior.id,
              },
              data: dadosTitular,
            })
          : organizacao.tipo === "ESCOLA"
            ? await tx.escolinha.updateMany({
                where: {
                  id: legado.id,
                  usuarioId: anterior.id,
                },
                data: dadosTitular,
              })
            : organizacao.tipo === "MARCA"
              ? await tx.marca.updateMany({
                  where: {
                    id: legado.id,
                    usuarioId: anterior.id,
                  },
                  data: dadosTitular,
                })
              : await tx.federacao.updateMany({
                  where: {
                    id: legado.id,
                    usuarioId: anterior.id,
                  },
                  data: dadosTitular,
                });

      if (legadoAtualizado.count !== 1) {
        throw new ErroTransferencia(
          409,
          "LEGACY_OWNERSHIP_CHANGED",
          "A titularidade legada foi alterada.",
        );
      }

      const creatorInstitucional = await tx.creator.findUnique({
        where: {
          organizacaoId: organizacao.id,
        },
        select: {
          id: true,
          usuarioId: true,
          tipo: true,
        },
      });

      if (creatorInstitucional) {
        if (creatorInstitucional.tipo !== CreatorTipo.INSTITUCIONAL) {
          throw new ErroTransferencia(
            409,
            "CREATOR_INSTITUTIONAL_INCONSISTENT",
            "O Creator da organização possui um tipo incompatível."
          );
        }

        if (
          creatorInstitucional.usuarioId !== null &&
          creatorInstitucional.usuarioId !== anterior.id
        ) {
          throw new ErroTransferencia(
            409,
            "CREATOR_OWNER_MISMATCH",
            "O Creator institucional possui uma associação pessoal inesperada."
          );
        }

        if (creatorInstitucional.usuarioId === anterior.id) {
          const desvinculado = await tx.creator.updateMany({
            where: {
              id: creatorInstitucional.id,
              usuarioId: anterior.id,
              organizacaoId: organizacao.id,
              tipo: CreatorTipo.INSTITUCIONAL,
            },
            data: {
              usuarioId: null,
            },
          });

          if (desvinculado.count !== 1) {
            throw new ErroTransferencia(
              409,
              "CREATOR_ASSOCIATION_CHANGED",
              "A associação do Creator institucional mudou durante a transferência."
            );
          }
        }
      }

      const papelOrganizacao =
        organizacao.tipo === "CLUBE"
          ? TipoUsuario.Clube
          : organizacao.tipo === "ESCOLA"
            ? TipoUsuario.Escolinha
            : organizacao.tipo === "MARCA"
              ? TipoUsuario.Marca
              : TipoUsuario.Federacao;

      const outrosVinculos = await tx.membroOrganizacao.count({
        where: {
          usuarioId: anterior.id,
          ativo: true,
          organizacaoId: {
            not: organizacao.id,
          },
          organizacao: {
            ativo: true,
            tipo: organizacao.tipo,
          },
        },
      });

      if (outrosVinculos === 0) {
        await tx.usuarioPapel.updateMany({
          where: {
            usuarioId: anterior.id,
            papel: papelOrganizacao,
            status: StatusUsuarioPapel.ATIVO,
          },
          data: {
            status: StatusUsuarioPapel.INATIVO,
            desativadoEm: agora,
          },
        });
      }

      if (
        creatorInstitucional?.usuarioId === anterior.id
      ) {
        await tx.usuarioPapel.updateMany({
          where: {
            usuarioId: anterior.id,
            papel: TipoUsuario.Creator,
            status: StatusUsuarioPapel.ATIVO,
          },
          data: {
            status: StatusUsuarioPapel.INATIVO,
            desativadoEm: agora,
          },
        });
      }

      await tx.usuario.updateMany({
        where: {
            id: anterior.id,
            contextoOrganizacaoId: organizacao.id,
      },
       data: {
            contextoOrganizacaoId: null,
       },
      });

      await tx.usuario.updateMany({
        where: {
          id: { in: [anterior.id, destinatario.id] },
        },
        data: {
          tokenVersion: { increment: 1 },
        },
      });

      const pedidoAtualizado =
        await tx.transferenciaPropriedade.updateMany({
          where: {
            id: pedido.id,
            status: "PENDENTE",
          },
          data: {
            status: "ACEITA",
            respondidoEm: agora,
            concluidoEm: agora,
          },
        });

      if (pedidoAtualizado.count !== 1) {
        throw new ErroTransferencia(
          409,
          "TRANSFER_CHANGED",
          "O estado da transferência mudou.",
        );
      }

      await tx.logAuditoria.create({
        data: {
          usuarioId: destinatario.id,
          acao: "PROPRIEDADE_ORGANIZACAO_TRANSFERIDA",
          entidade: "Organizacao",
          entidadeId: organizacao.id,
          descricao:
            "Transferência de propriedade aceita pelo destinatário.",
          ip: params.ip ?? null,
          userAgent: params.userAgent ?? null,
          meta: {
            transferenciaId: pedido.id,
            organizacaoId: organizacao.id,
            proprietarioAnteriorId: anterior.id,
            novoProprietarioId: destinatario.id,
            tipo: organizacao.tipo,
          },
        },
      });

      return {
        status: "ACEITA" as const,
        organizacaoId: organizacao.id,
        proprietarioAnteriorId: anterior.id,
        destinatarioId: destinatario.id,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 20000,
    },
  ),
);
}