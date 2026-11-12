import {
  calcularIdadePorNascimento,
  categoriaAtletaPorIdade,
} from "../utils/categoriaAtleta.js";
import { prisma } from "../prisma.js";

export class CorrecaoNascimentoError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "CorrecaoNascimentoError";
  }
}

function hojeEmBrasilia(): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const parte = (tipo: string) =>
    partes.find((item) => item.type === tipo)?.value ?? "";

  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function analisarDataCivil(valor: unknown): Date {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    throw new CorrecaoNascimentoError(
      "INVALID_BIRTH_DATE",
      "Informe uma data válida no formato AAAA-MM-DD."
    );
  }

  const data = new Date(`${valor}T00:00:00.000Z`);

  if (
    !Number.isFinite(data.getTime()) ||
    data.toISOString().slice(0, 10) !== valor ||
    valor < "1900-01-01" ||
    valor > hojeEmBrasilia()
  ) {
    throw new CorrecaoNascimentoError(
      "INVALID_BIRTH_DATE",
      "A data de nascimento informada é inválida."
    );
  }

  return data;
}

export async function solicitarCorrecaoNascimento(args: {
  usuarioId: string;
  dataSolicitada: unknown;
  motivo: unknown;
}) {
  const usuarioId = args.usuarioId.trim();

  if (!usuarioId) {
    throw new CorrecaoNascimentoError(
      "UNAUTHORIZED",
      "Não autenticado.",
      401
    );
  }

  const dataSolicitada = analisarDataCivil(
    args.dataSolicitada
  );

  const motivo =
    typeof args.motivo === "string"
      ? args.motivo.trim()
      : "";

  if (motivo.length < 20 || motivo.length > 1000) {
    throw new CorrecaoNascimentoError(
      "INVALID_BIRTH_DATE_REASON",
      "Descreva o motivo da correção entre 20 e 1000 caracteres."
    );
  }

  // Bloqueia o registro do usuário dentro da transação.
  // Isso serializa solicitações simultâneas da mesma conta.
  return prisma.$transaction(
    async (tx) => {
      const linhas = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Usuario"
        WHERE "id" = ${usuarioId}
        FOR UPDATE
      `;

      if (linhas.length !== 1) {
        throw new CorrecaoNascimentoError(
          "USER_NOT_FOUND",
          "Usuário não encontrado.",
          404
        );
      }

      const usuario = await tx.usuario.findUnique({
        where: {
          id: usuarioId,
        },
        select: {
          dataNascimento: true,
        },
      });

      const nascimentoAtual =
        usuario?.dataNascimento
          ?.toISOString()
          .slice(0, 10) ?? null;

      const nascimentoSolicitado =
        dataSolicitada.toISOString().slice(0, 10);

      if (
        nascimentoAtual === nascimentoSolicitado
      ) {
        throw new CorrecaoNascimentoError(
          "BIRTH_DATE_UNCHANGED",
          "A data informada já está cadastrada.",
          409
        );
      }

      const pendente =
        await tx.solicitacaoCorrecaoNascimento.findFirst({
          where: {
            usuarioId,
            status: {
              in: [
                "PENDENTE_VERIFICACAO",
                "EM_ANALISE",
              ],
            },
          },
          select: {
            id: true,
          },
        });

      if (pendente) {
        throw new CorrecaoNascimentoError(
          "BIRTH_DATE_REQUEST_PENDING",
          "Você já possui uma solicitação de correção em andamento.",
          409
        );
      }

      return tx.solicitacaoCorrecaoNascimento.create({
        data: {
          usuarioId,
          dataSolicitada,
          motivo,
          status: "PENDENTE_VERIFICACAO",
        },
        select: {
          id: true,
          dataSolicitada: true,
          status: true,
          criadoEm: true,
        },
      });
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

export async function consultarMinhasCorrecoesNascimento(
  usuarioId: string
) {
  if (!usuarioId.trim()) {
    throw new CorrecaoNascimentoError(
      "UNAUTHORIZED",
      "Não autenticado.",
      401
    );
  }

  return prisma.solicitacaoCorrecaoNascimento.findMany({
    where: {
      usuarioId,
    },
    select: {
      id: true,
      dataSolicitada: true,
      motivo: true,
      status: true,
      criadoEm: true,
      revisadoEm: true,
      documento: {
        select: {
          id: true,
          mimeType: true,
          criadoEm: true,
        },
      },
    },
    orderBy: {
      criadoEm: "desc",
    },
    take: 20,
  });
}

type DecisaoNascimento = "APROVAR" | "REJEITAR";

export async function listarCorrecoesNascimentoAdmin(
  status?: string,
  pagina = 1
) {
  const permitidos = [
    "PENDENTE_VERIFICACAO",
    "EM_ANALISE",
    "APROVADA",
    "REJEITADA",
  ] as const;

  if (status && !permitidos.includes(status as any)) {
    throw new CorrecaoNascimentoError(
      "INVALID_STATUS",
      "Status de solicitação inválido."
    );
  }

  const page = Number.isInteger(pagina)
    ? Math.max(1, Math.min(pagina, 10000))
    : 1;

  return prisma.solicitacaoCorrecaoNascimento.findMany({
    where: status
      ? { status: status as typeof permitidos[number] }
      : {
          status: {
            in: ["PENDENTE_VERIFICACAO", "EM_ANALISE"],
          },
        },
    select: {
      id: true,
      usuarioId: true,
      dataSolicitada: true,
      motivo: true,
      status: true,
      verificacaoRef: true,
      verificadoEm: true,
      revisadoPorId: true,
      revisadoEm: true,
      criadoEm: true,
      documento: {
        select: {
          id: true,
          mimeType: true,
          tamanhoBytes: true,
          criadoEm: true,
        },
      },
      usuario: {
        select: {
          nome: true,
          nomeDeUsuario: true,
          email: true,
          dataNascimento: true,
        },
      },
    },
    orderBy: { criadoEm: "asc" },
    skip: (page - 1) * 20,
    take: 20,
  });
}

export async function decidirCorrecaoNascimento(args: {
  solicitacaoId: string;
  administradorId: string;
  decisao: DecisaoNascimento;
  motivoDecisao: string;
  verificacaoRef?: string;
  confirmacaoDocumental?: boolean;
  ip?: string;
  userAgent?: string;
}) {
  const solicitacaoId = args.solicitacaoId.trim();
  const administradorId = args.administradorId.trim();
  const motivoDecisao = args.motivoDecisao.trim();
  const verificacaoRef = args.verificacaoRef?.trim() ?? "";

  if (!solicitacaoId || !administradorId) {
    throw new CorrecaoNascimentoError(
      "INVALID_REQUEST",
      "Solicitação ou administrador ausente."
    );
  }

  if (
    args.decisao !== "APROVAR" &&
    args.decisao !== "REJEITAR"
  ) {
    throw new CorrecaoNascimentoError(
      "INVALID_DECISION",
      "Decisão inválida."
    );
  }

  if (
    motivoDecisao.length < 10 ||
    motivoDecisao.length > 1000
  ) {
    throw new CorrecaoNascimentoError(
      "INVALID_DECISION_REASON",
      "Informe uma justificativa entre 10 e 1000 caracteres."
    );
  }

  if (args.decisao === "APROVAR") {
    if (
      args.confirmacaoDocumental !== true ||
      verificacaoRef.length < 8 ||
      verificacaoRef.length > 200
    ) {
      throw new CorrecaoNascimentoError(
        "DOCUMENT_VERIFICATION_REQUIRED",
        "A aprovação exige confirmação da verificação documental e referência válida.",
        422
      );
    }
  }

  return prisma.$transaction(
    async (tx) => {
      // Garante que o operador ainda possui privilégio
      // administrativo, mesmo se o serviço for chamado
      // fora de uma rota HTTP protegida.
      const administrador = await tx.administrador.findUnique({
        where: { usuarioId: administradorId },
        select: { id: true },
      });

      if (!administrador) {
        throw new CorrecaoNascimentoError(
          "ADMIN_REQUIRED",
          "Administrador não autorizado.",
          403
        );
      }

      // Localiza o dono para bloquear primeiro Usuario,
      // mantendo a mesma ordem de bloqueio da criação
      // de solicitações.
      const referencia =
        await tx.solicitacaoCorrecaoNascimento.findUnique({
          where: { id: solicitacaoId },
          select: { usuarioId: true },
        });

      if (!referencia) {
        throw new CorrecaoNascimentoError(
          "REQUEST_NOT_FOUND",
          "Solicitação não encontrada.",
          404
        );
      }

      if (referencia.usuarioId === administradorId) {
        throw new CorrecaoNascimentoError(
          "SELF_APPROVAL_DENIED",
          "Não é permitido analisar a própria solicitação.",
          403
        );
      }

      await tx.$queryRaw`
        SELECT "id" FROM "Usuario"
        WHERE "id" = ${referencia.usuarioId}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id" FROM "SolicitacaoCorrecaoNascimento"
        WHERE "id" = ${solicitacaoId}
        FOR UPDATE
      `;

      const solicitacao =
        await tx.solicitacaoCorrecaoNascimento.findUniqueOrThrow({
          where: { id: solicitacaoId },
        });

      if (
        solicitacao.status !== "PENDENTE_VERIFICACAO" &&
        solicitacao.status !== "EM_ANALISE"
      ) {
        throw new CorrecaoNascimentoError(
          "REQUEST_ALREADY_DECIDED",
          "Esta solicitação já possui decisão.",
          409
        );
      }

      const usuario = await tx.usuario.findUniqueOrThrow({
        where: { id: solicitacao.usuarioId },
        select: {
          id: true,
          dataNascimento: true,
          aniversarioElegivelApartirDe: true,
          deletedAt: true,
          blockedAt: true,
        },
      });

      if (usuario.deletedAt || usuario.blockedAt) {
        throw new CorrecaoNascimentoError(
          "ACCOUNT_NOT_ACTIVE",
          "Não é permitido revisar o nascimento de uma conta bloqueada ou excluída.",
          409
        );
      }

      const agora = new Date();
      const nascimentoAnterior =
        usuario.dataNascimento?.toISOString().slice(0, 10) ?? null;
      const nascimentoSolicitado =
        solicitacao.dataSolicitada.toISOString().slice(0, 10);

      if (args.decisao === "APROVAR") {
        // Revalida a data no momento da decisão.
        const nascimento = analisarDataCivil(
          nascimentoSolicitado
        );

        if (nascimentoAnterior === nascimentoSolicitado) {
          throw new CorrecaoNascimentoError(
            "BIRTH_DATE_UNCHANGED",
            "A conta já possui a data solicitada.",
            409
          );
        }

        const documento =
          await tx.documentoCorrecaoNascimento.findUnique({
            where: {
              solicitacaoId,
            },

            select: {
              id: true,
              criadoEm: true,
              statusSeguranca: true,
              analisadoEm: true,
              scannerRef: true,
            },
          });

        if (!documento) {
          throw new CorrecaoNascimentoError(
            "BIRTH_DOCUMENT_REQUIRED",
            "A aprovação exige um documento comprobatório.",
            422
          );
        }

        if (
          documento.statusSeguranca !== "SEGURO" ||
          !documento.analisadoEm ||
          String(documento.scannerRef ?? "").trim().length === 0
        ) {
          throw new CorrecaoNascimentoError(
            "BIRTH_DOCUMENT_SECURITY_NOT_CLEARED",
            "O documento ainda não foi liberado pela análise de segurança.",
            422
          );
        }

        const acesso =
          await tx.logAuditoria.findFirst({
            where: {
              usuarioId: administradorId,

              acao: "DOCUMENTO_NASCIMENTO_ACESSADO",

              entidade:
                "SolicitacaoCorrecaoNascimento",

              entidadeId: solicitacaoId,

              createdAt: {
                gte: documento.criadoEm,
              },

              // O acesso precisa pertencer ao
              // documento exato da solicitação.
              meta: {
                path: ["documentoId"],
                equals: documento.id,
              },
            },

            select: {
              id: true,
            },
          });

        if (!acesso) {
          throw new CorrecaoNascimentoError(
            "BIRTH_DOCUMENT_NOT_REVIEWED",
            "Baixe e confira o documento antes de aprovar.",
            422
          );
        }
        const idade = calcularIdadePorNascimento(nascimento);
        const categoria = categoriaAtletaPorIdade(idade);

        // Proteção para correções de nascimento de atletas
        // que passam a ter menos de 12 anos.
        if (idade < 12) {
          const atleta = await tx.atleta.findUnique({
            where: {
              usuarioId: usuario.id,
            },
            select: {
              id: true,
            },
          });

          if (atleta) {
            const responsavelPrincipal =
              await tx.responsavelAtleta.findFirst({
                where: {
                  atletaId: atleta.id,

                  status: "ATIVO",
                  principal: true,

                  confirmadoEm: {
                    not: null,
                  },

                  revogadoEm: null,

                  responsavel: {
                    is: {
                      deletedAt: null,
                      blockedAt: null,

                      papeis: {
                        some: {
                          papel: "Responsavel",
                          status: "ATIVO",
                        },
                      },
                    },
                  },
                },

                select: {
                  id: true,
                  responsavelUsuarioId: true,
                },
              });

            if (!responsavelPrincipal) {
              throw new CorrecaoNascimentoError(
                "PRIMARY_GUARDIAN_REQUIRED_FOR_BIRTH_DATE",
                "A correção indica que o atleta possui menos de 12 anos. " +
                  "É necessário regularizar um responsável principal " +
                  "ativo e confirmado antes de aprovar.",
                409
              );
            }
          }
        }
        // Não diminuir uma carência já existente.
        const novaCarencia = new Date(
          agora.getTime() + 30 * 24 * 60 * 60 * 1000
        );

        const elegivelApartirDe =
          usuario.aniversarioElegivelApartirDe &&
          usuario.aniversarioElegivelApartirDe > novaCarencia
            ? usuario.aniversarioElegivelApartirDe
            : novaCarencia;

        await tx.usuario.update({
          where: {
            id: usuario.id,
          },

          data: {
            dataNascimento: nascimento,
            aniversarioElegivelApartirDe: elegivelApartirDe,

            // Se a correção indicar um atleta com menos
            // de 12 anos, invalida as sessões existentes.
            // O usuário precisará autenticar-se novamente.
            ...(idade < 12
              ? {
                  tokenVersion: {
                    increment: 1,
                  },
                }
              : {}),
          },
        });

        await tx.atleta.updateMany({
          where: { usuarioId: usuario.id },
          data: {
            dataNascimento: nascimento,
            idade,
            categoria: { set: [categoria] },
          },
        });

        await tx.professor.updateMany({
          where: { usuarioId: usuario.id },
          data: { dataNascimento: nascimento },
        });

        await tx.olheiro.updateMany({
          where: { usuarioId: usuario.id },
          data: { dataNascimento: nascimento },
        });
      }

      const novoStatus =
        args.decisao === "APROVAR"
          ? "APROVADA"
          : "REJEITADA";

      await tx.solicitacaoCorrecaoNascimento.update({
        where: { id: solicitacaoId },
        data: {
          status: novoStatus,
          revisadoPorId: administradorId,
          revisadoEm: agora,
          ...(args.decisao === "APROVAR"
            ? {
                verificacaoRef,
                verificadoEm: agora,
              }
            : {}),
        },
      });

      // Auditoria obrigatória na mesma transação.
      // Se falhar, toda a decisão é revertida.
      await tx.logAuditoria.create({
        data: {
          usuarioId: administradorId,
          acao:
            args.decisao === "APROVAR"
              ? "CORRECAO_NASCIMENTO_APROVADA"
              : "CORRECAO_NASCIMENTO_REJEITADA",
          entidade: "SolicitacaoCorrecaoNascimento",
          entidadeId: solicitacaoId,
          descricao: motivoDecisao,
          ip: args.ip ?? null,
          userAgent: args.userAgent ?? null,
          meta: {
            usuarioAfetadoId: usuario.id,
            nascimentoAnterior,
            nascimentoSolicitado,
            verificacaoRef:
              args.decisao === "APROVAR"
                ? verificacaoRef
                : null,
            decisao: novoStatus,
          },
        },
      });

      return {
        ok: true,
        solicitacaoId,
        usuarioId: usuario.id,
        status: novoStatus,
        revisadoEm: agora,
      };
    },
    {
      maxWait: 10000,
      timeout: 20000,
    }
  );
}
