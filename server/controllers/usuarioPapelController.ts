import { Response } from "express";
import {
  Prisma,
  StatusUsuarioPapel,
  TipoUsuario,
  CreatorTipo,
  OrigemSolicitacaoResponsavel,
  StatusResponsavelAtleta,
  FuncaoMembroOrganizacao,
} from "@prisma/client";
import {
  garantirOrganizacaoLegada,
  type TipoOrganizacaoLegada,
} from "../services/organizacoes.js";
import {
  ActiveContextError,
  definirActiveContext,
  getActiveContext,
  listarActiveContexts,
} from "../services/activeContext.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import {
  desativarPapelPessoal,
  ExclusaoPapelError,
} from "../services/exclusaoContaService.js";
import {
  getProfileIdForRole,
} from "../services/roles.js";
import {
  calcularIdadePorNascimento,
  categoriaAtletaPorIdade,
} from "../utils/categoriaAtleta.js";
import {
  criarNotificacaoEEnviarPush,
} from "./notificacoesController.js";

function normalizarTexto(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarPapel(valor: unknown): TipoUsuario | null {
  switch (normalizarTexto(valor)) {
    case "atleta":
      return TipoUsuario.Atleta;
    case "professor":
    case "profissional":
      return TipoUsuario.Professor;
    case "clube":
      return TipoUsuario.Clube;
    case "escola":
    case "escolinha":
      return TipoUsuario.Escolinha;
    case "olheiro":
    case "scout":
      return TipoUsuario.Olheiro;
    case "learning":
      return TipoUsuario.Learning;
    case "federacao":
      return TipoUsuario.Federacao;
    case "marca":
      return TipoUsuario.Marca;
    case "creator":
      return TipoUsuario.Creator;
    case "responsavel":
    case "responsável":
      return TipoUsuario.Responsavel;
    default:
      return null;
  }
}

function obterUsuarioId(req: AuthenticatedRequest, res: Response) {
  const usuarioId = String(req.userId ?? "").trim();

  if (!usuarioId) {
    res.status(401).json({
      error: "Usuário não autenticado.",
      code: "UNAUTHENTICATED",
    });
    return null;
  }

  return usuarioId;
}

function papelCanonico(papel: TipoUsuario) {
  return papel === TipoUsuario.Escola ? TipoUsuario.Escolinha : papel;
}

const PAPEIS_RECUPERACAO = new Set<TipoUsuario>([
  TipoUsuario.Atleta,
  TipoUsuario.Responsavel,
  TipoUsuario.Professor,
  TipoUsuario.Olheiro,
  TipoUsuario.Learning,
  TipoUsuario.Creator,
]);

async function buscarRegistroPapel(usuarioId: string, papel: TipoUsuario) {
  if (papel === TipoUsuario.Escolinha || papel === TipoUsuario.Escola) {
    return prisma.usuarioPapel.findFirst({
      where: {
        usuarioId,
        papel: {
          in: [TipoUsuario.Escolinha, TipoUsuario.Escola],
        },
      },
      orderBy: { criadoEm: "asc" },
    });
  }

  return prisma.usuarioPapel.findUnique({
    where: {
      usuarioId_papel: {
        usuarioId,
        papel,
      },
    },
  });
}

async function perfilEspecificoExiste(
  usuarioId: string,
  papel: TipoUsuario,
): Promise<boolean> {
  switch (papel) {
    case TipoUsuario.Atleta:
      return Boolean(
        await prisma.atleta.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Professor:
      return Boolean(
        await prisma.professor.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Clube:
      return Boolean(
        await prisma.clube.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Escolinha:
    case TipoUsuario.Escola:
      return Boolean(
        await prisma.escolinha.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Olheiro:
      return Boolean(
        await prisma.olheiro.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Learning:
      return Boolean(
        await prisma.learningProfile.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Federacao:
      return Boolean(
        await prisma.federacao.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Marca:
      return Boolean(
        await prisma.marca.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Creator:
      return Boolean(
        await getProfileIdForRole(
          usuarioId,
          TipoUsuario.Creator
        )
      );

    case TipoUsuario.Responsavel:
      return Boolean(
        await prisma.usuario.findUnique({
          where: {
            id: usuarioId,
          },
          select: {
            id: true,
          },
        })
      );

    default:
      return false;
  }
}

async function obterPerfilEspecificoId(
  usuarioId: string,
  papel: TipoUsuario,
): Promise<string | null> {
  switch (papel) {
    case TipoUsuario.Atleta:
      return (
        (
          await prisma.atleta.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Professor:
      return (
        (
          await prisma.professor.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Clube:
      return (
        (
          await prisma.clube.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Escolinha:
    case TipoUsuario.Escola:
      return (
        (
          await prisma.escolinha.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Olheiro:
      return (
        (
          await prisma.olheiro.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Learning:
      return (
        (
          await prisma.learningProfile.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Federacao:
      return (
        (
          await prisma.federacao.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Marca:
      return (
        (
          await prisma.marca.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Creator:
      return getProfileIdForRole(
        usuarioId,
        TipoUsuario.Creator
      );

    case TipoUsuario.Responsavel:
      return usuarioId;

    default:
      return null;
  }
}

export async function listarMeusPapeis(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  try {
    const [usuario, papeis] = await prisma.$transaction([
      prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { tipo: true },
      }),
      prisma.usuarioPapel.findMany({
        where: { usuarioId },
        select: {
          id: true,
          papel: true,
          status: true,
          criadoEm: true,
          atualizadoEm: true,
          ativadoEm: true,
          desativadoEm: true,
          perfilCompletoEm: true,
        },
        orderBy: { criadoEm: "asc" },
      }),
    ]);

    if (!usuario) {
      return res.status(404).json({
        error: "Usuário não encontrado.",
        code: "USER_NOT_FOUND",
      });
    }

    const activeContext =
      await getActiveContext(
        usuarioId
      );

    return res.json({
      papelAtivo:
        activeContext
          ?.tipoUsuario ??
        usuario.tipo,

      activeContext,

      papeis,
    });
  } catch (error) {
    console.error("[UsuarioPapel] Erro ao listar papéis:", error);
    return res.status(500).json({
      error: "Não foi possível carregar os perfis da conta.",
    });
  }
}

export async function listarMeusContextos(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId =
    obterUsuarioId(
      req,
      res
    );

  if (!usuarioId) return;

  try {
    const [
      activeContext,
      contexts,
    ] =
      await Promise.all([
        getActiveContext(
          usuarioId
        ),

        listarActiveContexts(
          usuarioId
        ),
      ]);

    return res.json({
      activeContext,
      contexts,
    });
  } catch (error) {
    console.error(
      "[ActiveContext] Erro ao listar contextos:",
      error
    );

    return res.status(500).json({
      error:
        "Não foi possível carregar os contextos.",
    });
  }
}


export async function alterarContextoAtivo(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId =
    obterUsuarioId(
      req,
      res
    );

  if (!usuarioId) return;

  try {
    const contextKey =
      String(
        req.body
          ?.contextKey ??
        ""
      ).trim();

    if (!contextKey) {
      return res.status(400).json({
        error:
          "contextKey obrigatório.",
        code:
          "CONTEXT_REQUIRED",
      });
    }

    const activeContext =
      await definirActiveContext(
        usuarioId,
        contextKey,
      );

    return res.json({
      ok: true,

      activeContext,

      tipoUsuario:
        activeContext
          .tipoUsuario,

      tipoUsuarioId:
        activeContext
          .tipoUsuarioId,
    });
  } catch (error) {
    if (
      error instanceof
      ActiveContextError
    ) {
      return res
        .status(
          error.status
        )
        .json({
          error:
            error.message,

          code:
            error.code,
        });
    }

    console.error(
      "[ActiveContext] Erro ao trocar contexto:",
      error
    );

    return res.status(500).json({
      error:
        "Não foi possível alterar o contexto.",
    });
  }
}

export async function adicionarPapel(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId =
    obterUsuarioId(
      req,
      res,
    );

  if (!usuarioId) return;

  const papelRecebido =
    normalizarPapel(
      req.body?.papel,
    );

  if (!papelRecebido) {
    return res.status(400).json({
      error:
        "Papel inválido.",
      code:
        "INVALID_ROLE",
    });
  }

  const papel =
    papelCanonico(
      papelRecebido,
    );

  try {
    const modoRecuperacao =
      (
        req as AuthenticatedRequest & {
          somenteGestaoConta?: boolean;
        }
      ).somenteGestaoConta === true;

    if (modoRecuperacao) {
      if (!PAPEIS_RECUPERACAO.has(papel)) {
        return res.status(403).json({
          code: "RECOVERY_ROLE_NOT_ALLOWED",
          message:
            "Este papel não está disponível na recuperação. " +
            "Escolha Atleta, Professor, Olheiro, Learning ou Responsável.",
        });
      }

      if (req.body?.reativar === true) {
        return res.status(409).json({
          code: "RECOVERY_REACTIVATION_NOT_ALLOWED",
          message:
            "A recuperação de perfis desativados " +
            "exige uma verificação específica.",
        });
      }

      const contextosValidos =
        await listarActiveContexts(usuarioId);

      if (contextosValidos.length > 0) {
        return res.status(409).json({
          code: "RECOVERY_CONTEXT_ALREADY_AVAILABLE",
          message:
            "Esta conta já possui um contexto utilizável. " +
            "Atualize a sessão e utilize a ativação normal.",
        });
      }

      const existente =
        await buscarRegistroPapel(usuarioId, papel);

      if (
        existente?.status ===
        StatusUsuarioPapel.PENDENTE
      ) {
        let perfilJaExiste: boolean;

        if (papel === TipoUsuario.Creator) {
          const creator = await prisma.creator.findUnique({
            where: { usuarioId },
            select: {
              id: true,
              tipo: true,
              ativo: true,
              organizacaoId: true,
            },
          });

          if (
            creator &&
            (
              creator.tipo !== CreatorTipo.PESSOA_FISICA ||
              creator.ativo !== true ||
              creator.organizacaoId !== null
            )
          ) {
            return res.status(409).json({
              code: "RECOVERY_CREATOR_INVALID",
              message:
                "Existe um Creator associado a esta conta " +
                "que não pode ser reutilizado automaticamente.",
            });
          }

          perfilJaExiste = creator !== null;
        } else {
          perfilJaExiste = await perfilEspecificoExiste(
            usuarioId,
            papel
          );
        }

        return res.json({
          papel: existente,
          jaExistia: true,
          perfilExiste: perfilJaExiste,
          modoRecuperacao: true,
        });
      }

      if (existente) {
        if (
          papel === TipoUsuario.Creator &&
          existente.status === StatusUsuarioPapel.INATIVO
        ) {
          const creatorAtual = await prisma.creator.findUnique({
            where: { usuarioId },
            select: { id: true },
          });

          if (creatorAtual) {
            return res.status(409).json({
              code: "RECOVERY_CREATOR_ALREADY_EXISTS",
              message:
                "Esta conta ainda possui um Creator associado.",
            });
          }

          const transferencias =
            await prisma.transferenciaPropriedade.findMany({
              where: {
                proprietarioAtualId: usuarioId,
                status: "ACEITA",
                concluidoEm: { not: null },
              },
              select: {
                organizacaoId: true,
              },
            });

          let transferenciaInstitucionalConfirmada = false;

          for (const transferencia of transferencias) {
            const creatorInstitucional =
              await prisma.creator.findUnique({
                where: {
                  organizacaoId: transferencia.organizacaoId,
                },
                select: {
                  tipo: true,
                  usuarioId: true,
                },
              });

            if (
              creatorInstitucional?.tipo ===
                CreatorTipo.INSTITUCIONAL &&
              creatorInstitucional.usuarioId === null
            ) {
              transferenciaInstitucionalConfirmada = true;
              break;
            }
          }

          if (!transferenciaInstitucionalConfirmada) {
            return res.status(409).json({
              code: "RECOVERY_CREATOR_TRANSFER_NOT_CONFIRMED",
              message:
                "Não foi possível comprovar a transferência " +
                "do Creator institucional anterior.",
            });
          }

          const agora = new Date();

          const alteracao = await prisma.usuarioPapel.updateMany({
            where: {
              id: existente.id,
              usuarioId,
              papel: TipoUsuario.Creator,
              status: StatusUsuarioPapel.INATIVO,
            },
            data: {
              status: StatusUsuarioPapel.PENDENTE,
              ativadoEm: null,
              desativadoEm: null,
              perfilCompletoEm: null,
            },
          });

          if (alteracao.count !== 1) {
            return res.status(409).json({
              code: "RECOVERY_ROLE_CHANGED",
              message:
                "O estado do papel mudou. Atualize a página.",
            });
          }

          const novoEstado =
            await prisma.usuarioPapel.findUniqueOrThrow({
              where: { id: existente.id },
            });

          return res.json({
            papel: novoEstado,
            jaExistia: true,
            perfilExiste: false,
            modoRecuperacao: true,
            message:
              "Você pode criar um novo Creator pessoal.",
          });
        }

        return res.status(409).json({
          code: "RECOVERY_EXISTING_ROLE",
          message:
            "Este papel já possui um registro nesta conta. " +
            "A recuperação automática desse papel " +
            "não está disponível.",
        });
      }

      const perfilExiste =
        await perfilEspecificoExiste(usuarioId, papel);

      if (papel === TipoUsuario.Creator) {
        const creatorExistente =
          await prisma.creator.findUnique({
            where: { usuarioId },
            select: {
              id: true,
              tipo: true,
              organizacaoId: true,
              ativo: true,
            },
          });

        if (creatorExistente) {
          return res.status(409).json({
            code: "RECOVERY_CREATOR_ALREADY_EXISTS",
            message:
              "Esta conta já possui um Creator associado. " +
              "A recuperação não pode reutilizar nem " +
              "converter esse Creator automaticamente.",
          });
        }
      }

      if (
        papel !== TipoUsuario.Responsavel &&
        perfilExiste
      ) {
        return res.status(409).json({
          code: "RECOVERY_PROFILE_ALREADY_EXISTS",
          message:
            "Já existe um perfil deste tipo associado " +
            "à conta. É necessária uma revisão antes " +
            "de reutilizá-lo.",
        });
      }

      const conta = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          deletedAt: true,
          blockedAt: true,
        },
      });

      if (
        !conta ||
        conta.deletedAt !== null ||
        conta.blockedAt !== null
      ) {
        return res.status(403).json({
          code: "RECOVERY_ACCOUNT_UNAVAILABLE",
          message:
            "Esta conta não está disponível " +
            "para ativação de perfis.",
        });
      }
      const agora = new Date();

      const novoPapel = await prisma.usuarioPapel.create({
        data: {
          usuarioId,
          papel,
          status: StatusUsuarioPapel.PENDENTE,
          ativadoEm: null,
          desativadoEm: null,
          perfilCompletoEm: null,
        },
      });

      return res.status(201).json({
        papel: novoPapel,
        jaExistia: false,
        perfilExiste: false,
        modoRecuperacao: true,
        message:
          "Papel solicitado. Complete os dados " +
          "do novo perfil para ativá-lo.",
      });
    }

    if (papel === TipoUsuario.Creator) {
      const creatorLegado = await prisma.creator.findUnique({
        where: { usuarioId },
        select: {
          id: true,
          tipo: true,
          organizacaoId: true,
        },
      });

      if (
        creatorLegado &&
        (
          creatorLegado.tipo === "INSTITUCIONAL" ||
          creatorLegado.organizacaoId !== null
        )
      ) {
        return res.status(409).json({
          code: "INSTITUTIONAL_CREATOR_ALREADY_LINKED",
          message:
            "Esta conta possui um vínculo histórico com um Creator institucional. " +
            "Esse Creator não pode ser reativado como pessoal. " +
            "Escolha outro papel para continuar utilizando o FootEra.",
        });
      }
    }

    const usuario =
      await prisma.usuario.findUnique({
        where: {
          id:
            usuarioId,
        },

        select: {
          id: true,
          deletedAt: true,
          blockedAt: true,
        },
      });

    if (
      !usuario ||
      usuario.deletedAt !== null ||
      usuario.blockedAt !== null
    ) {
      return res.status(404).json({
        error:
          "Usuário não encontrado.",
        code:
          "USER_NOT_FOUND",
      });
    }

    const [
      existente,
      perfilExiste,
    ] =
      await Promise.all([
        buscarRegistroPapel(
          usuarioId,
          papel,
        ),

        perfilEspecificoExiste(
          usuarioId,
          papel,
        ),
      ]);

    const agora =
      new Date();

    const statusDesejado =
      perfilExiste
        ? StatusUsuarioPapel.ATIVO
        : StatusUsuarioPapel.PENDENTE;

    if (existente) {
      if (existente.status === StatusUsuarioPapel.INATIVO) {
        if (req.body?.reativar !== true) {
          return res.status(409).json({
            code: "ROLE_REACTIVATION_REQUIRED",
            message:
              "Este perfil foi desativado anteriormente. Confirme sua reativação para voltar a utilizá-lo.",
          });
        }
      }

      if (
        papel === TipoUsuario.Creator &&
        existente.status === StatusUsuarioPapel.INATIVO
      ) {
        const resultado = await prisma.$transaction(
          async (tx) => {
            const creator = await tx.creator.findUnique({
              where: { usuarioId },
              select: { id: true },
            });

            const conta = await tx.usuario.findUnique({
              where: { id: usuarioId },
              select: { deletedAt: true },
            });

            if (!conta || conta.deletedAt) {
              throw new Error("ACCOUNT_NOT_AVAILABLE");
            }

            if (!creator) {
              throw new Error("CREATOR_PROFILE_NOT_FOUND");
            }

            const atualizado = await tx.usuarioPapel.updateMany({
              where: {
                id: existente.id,
                usuarioId,
                status: existente.status,
              },
              data: {
                status: StatusUsuarioPapel.ATIVO,
                ativadoEm: existente.ativadoEm ?? agora,
                desativadoEm: null,
                perfilCompletoEm:
                  existente.perfilCompletoEm ?? agora,
              },
            });

            if (atualizado.count !== 1) {
              throw new Error("CREATOR_ROLE_CHANGED");
            }

            await tx.creator.update({
              where: { id: creator.id },
              data: { ativo: true },
            });

            return tx.usuarioPapel.findUniqueOrThrow({
              where: { id: existente.id },
            });
           },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        return res.json({
          papel: resultado,
          jaExistia: true,
          perfilExiste: true,
        });
      }

      const registro =
        await prisma.usuarioPapel.update({
          where: {
            id:
              existente.id,
          },

          data: {
            status:
              statusDesejado,

            ativadoEm:
              statusDesejado ===
              StatusUsuarioPapel.ATIVO
                ? (
                    existente.ativadoEm ??
                    agora
                  )
                : null,

            desativadoEm:
              null,

            perfilCompletoEm:
              statusDesejado ===
              StatusUsuarioPapel.ATIVO
                ? (
                    existente.perfilCompletoEm ??
                    agora
                  )
                : null,
          },
        });

      return res.json({
        papel:
          registro,

        jaExistia:
          true,

        perfilExiste,
      });
    }

    const registro =
      await prisma.usuarioPapel.create({
        data: {
          usuarioId,

          papel,

          status:
            statusDesejado,

          ativadoEm:
            statusDesejado ===
            StatusUsuarioPapel.ATIVO
              ? agora
              : null,

          perfilCompletoEm:
            statusDesejado ===
            StatusUsuarioPapel.ATIVO
              ? agora
              : null,
        },
      });

    return res
      .status(201)
      .json({
        papel:
          registro,

        jaExistia:
          false,

        perfilExiste,
      });
  } catch (error: any) {
    if (
      error?.code ===
      "P2002"
    ) {
      const existente =
        await buscarRegistroPapel(
          usuarioId,
          papel,
        );

      if (existente) {
        if (existente.status === StatusUsuarioPapel.INATIVO) {
          return res.status(409).json({
            code: "ROLE_REACTIVATION_REQUIRED",
            message:
              "O perfil está inativo. Atualize a página e confirme sua reativação.",
          });
        }
        return res.json({
          papel:
            existente,

          jaExistia:
            true,
        });
      }
    }

    console.error(
      "[UsuarioPapel] Erro ao adicionar papel:",
      error,
    );

    return res.status(500).json({
      error:
        "Não foi possível liberar este perfil para configuração.",
    });
  }
}

export async function concluirPapel(req: AuthenticatedRequest, res: Response) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  const papel = normalizarPapel(req.params.papel);

  if (!papel) {
    return res.status(400).json({
      error: "Papel inválido.",
      code: "INVALID_ROLE",
    });
  }

  try {
    const registro = await buscarRegistroPapel(usuarioId, papel);

    if (!registro) {
      return res.status(404).json({
        error: "Este papel ainda não foi adicionado à conta.",
        code: "ROLE_NOT_FOUND",
      });
    }

    if (registro.status === StatusUsuarioPapel.INATIVO) {
      return res.status(409).json({
        error: "Este papel está inativo. Ative-o antes de concluir o perfil.",
        code: "ROLE_INACTIVE",
      });
    }

    const perfilExiste = await perfilEspecificoExiste(usuarioId, papel);

    if (!perfilExiste) {
      return res.status(409).json({
        error: "Salve os dados deste perfil antes de concluir a ativação.",
        code: "ROLE_PROFILE_MISSING",
      });
    }

    const modoRecuperacao =
      (
        req as AuthenticatedRequest & {
          somenteGestaoConta?: boolean;
        }
      ).somenteGestaoConta === true;

    if (modoRecuperacao) {
      const papeisPermitidos = new Set<TipoUsuario>([
        TipoUsuario.Atleta,
        TipoUsuario.Professor,
        TipoUsuario.Olheiro,
        TipoUsuario.Learning,
        TipoUsuario.Responsavel,
        TipoUsuario.Creator,
      ]);

      if (!papeisPermitidos.has(papel)) {
        return res.status(403).json({
          code: "RECOVERY_ROLE_NOT_ALLOWED",
          message: "Este papel não pode ser concluído na recuperação.",
        });
      }

      if (registro.status !== StatusUsuarioPapel.PENDENTE) {
        return res.status(409).json({
          code: "RECOVERY_PENDING_ROLE_REQUIRED",
          message: "O papel precisa estar pendente de conclusão.",
        });
      }

      const contextos = await listarActiveContexts(usuarioId);

      if (contextos.length > 0) {
        return res.status(409).json({
          code: "RECOVERY_CONTEXT_ALREADY_AVAILABLE",
          message: "Esta conta já possui um contexto operacional.",
        });
      }
    }

    if (modoRecuperacao) {
      const agora = new Date();

      const papelAtualizado = await prisma.$transaction(
        async (tx) => {
          if (papel === TipoUsuario.Creator) {
            const creator = await tx.creator.findUnique({
              where: { usuarioId },
              select: {
                id: true,
                tipo: true,
                ativo: true,
                organizacaoId: true,
              },
            });

            if (
              !creator ||
              creator.tipo !== CreatorTipo.PESSOA_FISICA ||
              creator.ativo !== true ||
              creator.organizacaoId !== null
            ) {
              throw new ActiveContextError(
                409,
                "RECOVERY_CREATOR_INVALID",
                "O Creator pessoal não está pronto para ativação."
              );
            }
          }
          if (papel === TipoUsuario.Atleta) {
            const atleta = await tx.atleta.findUnique({
              where: { usuarioId },
              select: {
                id: true,
                usuario: {
                  select: {
                    dataNascimento: true,
                  },
                },
              },
            });

            if (!atleta) {
              throw new ActiveContextError(
                409,
                "RECOVERY_ATHLETE_NOT_FOUND",
                "O perfil Atleta ainda não foi criado."
              );
            }

            const nascimento = atleta.usuario.dataNascimento;

            if (
              !nascimento ||
              Number.isNaN(nascimento.getTime()) ||
              nascimento < new Date("1900-01-01T00:00:00.000Z") ||
              nascimento > new Date()
            ) {
              throw new ActiveContextError(
                409,
                "RECOVERY_INVALID_BIRTH_DATE",
                "A data de nascimento precisa ser validada."
              );
            }

            const idade = calcularIdadePorNascimento(nascimento);

            if (idade < 12) {
              const responsavelPrincipal =
                await tx.responsavelAtleta.findFirst({
                  where: {
                    atletaId: atleta.id,
                    status: "ATIVO",
                    principal: true,
                    confirmadoEm: { not: null },
                    responsavel: {
                      deletedAt: null,
                      blockedAt: null,
                      papeis: {
                        some: {
                          papel: TipoUsuario.Responsavel,
                          status: StatusUsuarioPapel.ATIVO,
                        },
                      },
                    },
                  },
                  select: { id: true },
                });

              if (!responsavelPrincipal) {
                throw new ActiveContextError(
                  409,
                  "RECOVERY_GUARDIAN_REQUIRED",
                  "É necessária a confirmação de um responsável legal."
                );
              }
            }
          }
          const atualizado = await tx.usuarioPapel.updateMany({
            where: {
              id: registro.id,
              usuarioId,
              papel,
              status: StatusUsuarioPapel.PENDENTE,
            },
            data: {
              status: StatusUsuarioPapel.ATIVO,
              ativadoEm: registro.ativadoEm ?? agora,
              desativadoEm: null,
              perfilCompletoEm: registro.perfilCompletoEm ?? agora,
            },
          });

          if (atualizado.count !== 1) {
            throw new ActiveContextError(
              409,
              "RECOVERY_ROLE_CHANGED",
              "O estado deste perfil mudou. Atualize a página."
            );
          }

          const usuarioAtualizado = await tx.usuario.updateMany({
            where: {
              id: usuarioId,
              deletedAt: null,
              blockedAt: null,
            },
            data: {
              tipo: papel,
              contextoOrganizacaoId: null,
            },
          });

          if (usuarioAtualizado.count !== 1) {
            throw new ActiveContextError(
              409,
              "RECOVERY_ACCOUNT_CHANGED",
              "A conta não está disponível para ativação."
            );
          }

          return tx.usuarioPapel.findUniqueOrThrow({
            where: { id: registro.id },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      const activeContext = await getActiveContext(usuarioId);

      if (
        activeContext?.kind !== "PERSONAL" ||
        activeContext.tipoUsuario !== papel ||
        !activeContext.tipoUsuarioId
      ) {
        return res.status(409).json({
          code: "RECOVERY_CONTEXT_REFRESH_REQUIRED",
          message:
            "O papel foi ativado, mas a sessão precisa ser atualizada. " +
            "Faça login novamente antes de continuar.",
        });
      }

      return res.json({
        ok: true,
        papel: papelAtualizado,
        activeContext,
        modoRecuperacao: true,
        message: "Perfil ativado com sucesso.",
      });
    }

    const agora = new Date();

    const papelAtualizado = await prisma.usuarioPapel.update({
      where: { id: registro.id },
      data: {
        status: StatusUsuarioPapel.ATIVO,
        ativadoEm: registro.ativadoEm ?? agora,
        desativadoEm: null,
        perfilCompletoEm: registro.perfilCompletoEm ?? agora,
      },
    });

    return res.json({
      papel: papelAtualizado,
    });
  } catch (error) {
    if (error instanceof ActiveContextError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    console.error("[UsuarioPapel] Erro ao concluir papel:", error);

    return res.status(500).json({
      error: "Não foi possível concluir a ativação deste perfil.",
    });
  }
}

export async function alterarPapelAtivo(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId =
    obterUsuarioId(
      req,
      res
    );

  if (!usuarioId) return;

  const papelRecebido =
    normalizarPapel(
      req.body?.papel
    );

  if (!papelRecebido) {
    return res.status(400).json({
      error:
        "Papel inválido.",
      code:
        "INVALID_ROLE",
    });
  }

  const papel =
    papelCanonico(
      papelRecebido
    );

  try {
        const registro =
          await buscarRegistroPapel(
            usuarioId,
            papel,
          );

        if (!registro) {
          return res.status(404).json({
            error:
              "Este papel não foi adicionado à sua conta.",
            code:
              "ROLE_NOT_FOUND",
          });
        }

        if (
          registro.status !==
          StatusUsuarioPapel.ATIVO
        ) {
          return res.status(409).json({
            error:
              registro.status ===
              StatusUsuarioPapel.PENDENTE
                ? "Conclua a configuração deste perfil antes de usá-lo."
                : "Este perfil está inativo.",

            code:
              registro.status ===
              StatusUsuarioPapel.PENDENTE
                ? "ROLE_PENDING"
                : "ROLE_INACTIVE",
          });
        }

        const perfilExiste =
          await perfilEspecificoExiste(
            usuarioId,
            papel,
          );

        if (!perfilExiste) {
          return res.status(409).json({
            error:
              "Este papel está ativo, mas o perfil correspondente não existe. Configure o perfil novamente.",
            code:
              "ROLE_PROFILE_MISSING",
          });
        }

    const contextoAntes =
      await getActiveContext(
        usuarioId
      );

    const contextKey =
      `personal:${papel}`;

    const jaEstavaEmUso =
      contextoAntes?.key ===
      contextKey;

    const activeContext =
      jaEstavaEmUso &&
      contextoAntes
        ? contextoAntes
        : await definirActiveContext(
            usuarioId,
            contextKey
          );

    return res.json({
      papelAtivo:
        papel,

      tipoUsuario:
        normalizarTexto(
          activeContext
            .tipoUsuario
        ),

      tipoUsuarioId:
        activeContext
          .tipoUsuarioId,

      activeContext,

      jaEstavaEmUso,
    });
  } catch (error) {
    if (
      error instanceof
      ActiveContextError
    ) {
      return res
        .status(
          error.status
        )
        .json({
          error:
            error.message,

          code:
            error.code,
        });
    }

    console.error(
      "[UsuarioPapel] Erro ao alterar papel ativo:",
      error
    );

    return res.status(500).json({
      error:
        "Não foi possível colocar este perfil em uso.",
    });
  }
}

export async function excluirMeuPapel(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = obterUsuarioId(req, res);

  if (!usuarioId) return;

  try {
    const resultado = await desativarPapelPessoal(
      usuarioId,
      String(req.params.papel ?? ""),
    );

    return res.json(resultado);
  } catch (error) {
    if (error instanceof ExclusaoPapelError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    console.error(
      "[excluirMeuPapel] Erro:",
      error,
    );

    return res.status(500).json({
      code: "ROLE_DELETION_FAILED",
      message:
        "Não foi possível excluir este perfil.",
    });
  }
}

export async function salvarPerfilRecuperacao(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  const papel = normalizarPapel(req.params.papel);

  const permitidos = new Set<TipoUsuario>([
    TipoUsuario.Atleta,
    TipoUsuario.Professor,
    TipoUsuario.Olheiro,
    TipoUsuario.Learning,
    TipoUsuario.Creator,
  ]);

  if (!papel || !permitidos.has(papel)) {
    return res.status(403).json({
      code: "RECOVERY_PROFILE_NOT_ALLOWED",
      message:
        "Este perfil ainda não está disponível " +
        "para conclusão pelo fluxo de recuperação.",
    });
  }

  const dados = req.body?.perfil;

  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    return res.status(400).json({
      code: "INVALID_PROFILE_DATA",
      message: "Informe os dados do novo perfil.",
    });
  }

  const texto = (valor: unknown, max = 255) =>
    typeof valor === "string"
      ? valor.trim().slice(0, max)
      : "";

  const listaTextos = (valor: unknown) =>
    Array.isArray(valor)
      ? valor
          .filter((item): item is string =>
            typeof item === "string"
          )
          .map((item) => item.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 30)
      : [];

  try {
    const contextos = await listarActiveContexts(usuarioId);

    if (contextos.length > 0) {
      return res.status(409).json({
        code: "RECOVERY_CONTEXT_ALREADY_AVAILABLE",
        message:
          "A conta já possui um contexto utilizável.",
      });
    }

    const conta = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        deletedAt: true,
        blockedAt: true,
      },
    });

    if (
      !conta ||
      conta.deletedAt !== null ||
      conta.blockedAt !== null
    ) {
      return res.status(403).json({
        code: "RECOVERY_ACCOUNT_UNAVAILABLE",
        message: "A conta não pode recuperar perfis.",
      });
    }

    if (papel === TipoUsuario.Atleta) {
      const nascimento = conta.dataNascimento;

      if (
        !nascimento ||
        Number.isNaN(nascimento.getTime()) ||
        nascimento > new Date() ||
        nascimento < new Date("1900-01-01T00:00:00.000Z")
      ) {
        return res.status(409).json({
          code: "RECOVERY_BIRTH_DATE_REQUIRED",
          message:
            "É necessário ter uma data de nascimento válida " +
            "na conta para criar o perfil Atleta.",
        });
      }
    }

    if (
      papel === TipoUsuario.Professor ||
      papel === TipoUsuario.Olheiro
    ) {
      const nascimento = conta.dataNascimento;

      if (!nascimento) {
        return res.status(409).json({
          code: "RECOVERY_BIRTH_DATE_REQUIRED",
          message:
            "É necessário validar a data de nascimento " +
            "da conta antes de ativar este tipo de perfil.",
        });
      }

      if (
        Number.isNaN(nascimento.getTime()) ||
        nascimento > new Date() ||
        nascimento < new Date("1900-01-01T00:00:00.000Z")
      ) {
        return res.status(409).json({
          code: "RECOVERY_INVALID_BIRTH_DATE",
          message: "Data de nascimento inválida.",
        });
      }

      const idade = calcularIdadePorNascimento(nascimento);

      if (idade < 17) {
        return res.status(403).json({
          code: "RECOVERY_MINIMUM_AGE",
          message:
            "Este tipo de perfil exige mais de 16 anos.",
        });
      }
    }

    const resultado = await prisma.$transaction(
      async (tx) => {
        const registro = await tx.usuarioPapel.findUnique({
          where: {
            usuarioId_papel: {
              usuarioId,
              papel,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (
          !registro ||
          registro.status !== StatusUsuarioPapel.PENDENTE
        ) {
          throw new Error(
            "RECOVERY_PENDING_ROLE_REQUIRED"
          );
        }

        const perfilExistente =
          papel === TipoUsuario.Atleta
            ? await tx.atleta.findUnique({
                where: { usuarioId },
                select: { id: true },
              })
            : papel === TipoUsuario.Professor
              ? await tx.professor.findUnique({
                  where: { usuarioId },
                  select: { id: true },
                })
              : papel === TipoUsuario.Olheiro
                ? await tx.olheiro.findUnique({
                    where: { usuarioId },
                    select: { id: true },
                  })
                : papel === TipoUsuario.Creator
                  ? await tx.creator.findUnique({
                      where: { usuarioId },
                      select: { id: true },
                    })
                  : await tx.learningProfile.findUnique({
                      where: { usuarioId },
                      select: { id: true },
                    });

        if (perfilExistente) {
          throw new Error(
            "RECOVERY_PROFILE_ALREADY_EXISTS"
          );
        }

        if (papel === TipoUsuario.Atleta) {
          const usuarioAtual = await tx.usuario.findUnique({
            where: { id: usuarioId },
            select: {
              email: true,
              dataNascimento: true,
              deletedAt: true,
              blockedAt: true,
            },
          });

          const nascimento = usuarioAtual?.dataNascimento;

          if (
            !usuarioAtual ||
            usuarioAtual.deletedAt !== null ||
            usuarioAtual.blockedAt !== null ||
            !nascimento ||
            Number.isNaN(nascimento.getTime()) ||
            nascimento > new Date() ||
            nascimento < new Date("1900-01-01T00:00:00.000Z")
          ) {
            throw new Error("RECOVERY_BIRTH_DATE_REQUIRED");
          }

          const idade =
            calcularIdadePorNascimento(nascimento);

          const categoria =
            categoriaAtletaPorIdade(idade);

          const atleta = await tx.atleta.create({
            data: {
              usuarioId,
              email: usuarioAtual.email,
              idade,
              categoria: [categoria],
              dataNascimento: nascimento,
              consentimento: false,
              clubeId: null,
              escolinhaId: null,
            },
            select: {
              id: true,
            },
          });

          await tx.pontuacaoAtleta.create({
            data: {
              atletaId: atleta.id,
            },
          });

          if (idade < 12) {
            await tx.usuario.update({
              where: { id: usuarioId },
              data: {
                configuracoesPrivacidade: {
                  perfilVisivel: false,
                  visibilidadePerfil: "PRIVADO",
                  permitirMensagens: false,
                  mostrarEmail: false,
                  mostrarOnline: false,
                },
              },
            });
          }

          return atleta;
        }

        if (papel === TipoUsuario.Professor) {
          const existente = await tx.professor.findUnique({
            where: { usuarioId },
            select: { id: true },
          });

          if (existente) {
            throw new Error(
              "RECOVERY_PROFILE_ALREADY_EXISTS"
            );
          }

          return tx.professor.create({
            data: {
              usuarioId,
              nome:
                texto(dados.nome, 120) ||
                conta.nome ||
                "Professor",
              cref: texto(dados.cref, 60) || null,
              areaFormacao:
                texto(dados.areaFormacao) || null,
              escola: texto(dados.escola) || null,
              qualificacoes:
                listaTextos(dados.qualificacoes),
              certificacoes:
                listaTextos(dados.certificacoes),
              dataNascimento:
                conta.dataNascimento,
            },
            select: { id: true },
          });
        }

        if (papel === TipoUsuario.Olheiro) {
          const existente = await tx.olheiro.findUnique({
            where: { usuarioId },
            select: { id: true },
          });

          if (existente) {
            throw new Error(
              "RECOVERY_PROFILE_ALREADY_EXISTS"
            );
          }

          const anos = Number(dados.anosExperiencia ?? 0);

          if (
            !Number.isInteger(anos) ||
            anos < 0 ||
            anos > 80
          ) {
            throw new Error(
              "RECOVERY_INVALID_EXPERIENCE"
            );
          }

          return tx.olheiro.create({
            data: {
              usuarioId,
              headline:
                texto(dados.headline, 160) || null,
              descricao:
                texto(dados.descricao, 2000) || null,
              areaAtuacao:
                texto(dados.areaAtuacao) || null,
              anosExperiencia: anos,
              dataNascimento: conta.dataNascimento,
            },
            select: { id: true },
          });
        }

        if (papel === TipoUsuario.Creator) {
          const usuarioAtual = await tx.usuario.findUnique({
            where: { id: usuarioId },
            select: {
              id: true,
              nome: true,
              foto: true,
              deletedAt: true,
              blockedAt: true,
            },
          });

          if (
            !usuarioAtual ||
            usuarioAtual.deletedAt !== null ||
            usuarioAtual.blockedAt !== null
          ) {
            throw new ActiveContextError(
              403,
              "RECOVERY_ACCOUNT_UNAVAILABLE",
              "A conta não está disponível para recuperação."
            );
          }

          const creatorExistente = await tx.creator.findUnique({
            where: { usuarioId },
            select: { id: true },
          });

          if (creatorExistente) {
            throw new ActiveContextError(
              409,
              "RECOVERY_CREATOR_ALREADY_EXISTS",
              "Já existe um Creator associado a esta conta."
            );
          }

          const nomePublico =
            texto(dados.nomePublico, 120) ||
            usuarioAtual.nome ||
            "Creator FootEra";

          return tx.creator.create({
            data: {
              usuarioId,
              organizacaoId: null,
              tipo: CreatorTipo.PESSOA_FISICA,
              ativo: true,
              verificado: false,
              instituicaoOficial: false,

              nomePublico,
              headline:
                texto(dados.headline, 160) ||
                "Creator FootEra",
              bio: texto(dados.bio, 2000) || null,
              nicho: texto(dados.nicho, 120) || null,
              avatarUrl: usuarioAtual.foto ?? null,
            },
            select: {
              id: true,
            },
          });
        }

        const existente =
          await tx.learningProfile.findUnique({
            where: { usuarioId },
            select: { id: true },
          });

        if (existente) {
          throw new Error(
            "RECOVERY_PROFILE_ALREADY_EXISTS"
          );
        }

        return tx.learningProfile.create({
          data: {
            usuarioId,
          },
          select: {
            id: true,
          },
        });
      }
    );

    return res.status(201).json({
      ok: true,
      perfilId: resultado.id,
      papel,
      status: "PENDENTE",
      requerResponsavel:
        papel === TipoUsuario.Atleta &&
        conta.dataNascimento !== null &&
        calcularIdadePorNascimento(conta.dataNascimento) < 12,
      message:
        "Dados do novo perfil salvos. " +
        "A ativação será concluída na próxima etapa.",
    });
  } catch (error: any) {
    if (error instanceof ActiveContextError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }
    if (error?.message === "RECOVERY_BIRTH_DATE_REQUIRED") {
      return res.status(409).json({
        code: "RECOVERY_BIRTH_DATE_REQUIRED",
        message:
          "Não foi possível validar a data de nascimento da conta.",
      });
    }

    if (error?.message === "RECOVERY_GUARDIAN_REQUIRED") {
      return res.status(409).json({
        code: "RECOVERY_GUARDIAN_REQUIRED",
        message:
          "É necessário concluir o fluxo de responsável legal " +
          "antes de ativar este perfil Atleta.",
      });
    }

    if (
      error?.message ===
      "RECOVERY_PENDING_ROLE_REQUIRED"
    ) {
      return res.status(409).json({
        code: error.message,
        message:
          "Solicite um novo papel antes de salvar os dados.",
      });
    }

    if (
      error?.message ===
      "RECOVERY_PROFILE_ALREADY_EXISTS"
    ) {
      return res.status(409).json({
        code: error.message,
        message:
          "Este perfil já existe. Não será sobrescrito " +
          "pelo fluxo de recuperação.",
      });
    }

    if (
      error?.message ===
      "RECOVERY_INVALID_EXPERIENCE"
    ) {
      return res.status(400).json({
        code: error.message,
        message: "Tempo de experiência inválido.",
      });
    }

    console.error(
      "[salvarPerfilRecuperacao]",
      error
    );

    return res.status(500).json({
      code: "RECOVERY_SAVE_FAILED",
      message:
        "Não foi possível salvar o novo perfil.",
    });
  }
}

export async function consultarRecuperacaoAtleta(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  try {
    const conta = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        dataNascimento: true,
        deletedAt: true,
        blockedAt: true,
      },
    });

    if (
      !conta ||
      conta.deletedAt !== null ||
      conta.blockedAt !== null
    ) {
      return res.status(403).json({
        code: "RECOVERY_ACCOUNT_UNAVAILABLE",
      });
    }

    const registro = await prisma.usuarioPapel.findUnique({
      where: {
        usuarioId_papel: {
          usuarioId,
          papel: TipoUsuario.Atleta,
        },
      },
      select: {
        status: true,
      },
    });

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: {
        id: true,
      },
    });

    const nascimento = conta.dataNascimento;

    const nascimentoValido =
      nascimento !== null &&
      !Number.isNaN(nascimento.getTime()) &&
      nascimento <= new Date() &&
      nascimento >=
        new Date("1900-01-01T00:00:00.000Z");

    const requerResponsavel =
      nascimentoValido && nascimento !== null
        ? calcularIdadePorNascimento(nascimento) < 12
        : false;

    const solicitacaoPendente = atleta
      ? await prisma.responsavelAtleta.findFirst({
          where: {
            atletaId: atleta.id,
            status: "PENDENTE",
            origemSolicitacao: "ATLETA",
            responsavel: {
              deletedAt: null,
              blockedAt: null,
              papeis: {
                some: {
                  papel: TipoUsuario.Responsavel,
                  status: StatusUsuarioPapel.ATIVO,
                },
              },
            },
          },
          select: {
            id: true,
            status: true,
            criadoEm: true,
          },
          orderBy: {
            criadoEm: "desc",
          },
        })
      : null;

    const responsavelConfirmado =
      requerResponsavel &&
      atleta
        ? Boolean(
            await prisma.responsavelAtleta.findFirst({
              where: {
                atletaId: atleta.id,
                status: "ATIVO",
                principal: true,
                confirmadoEm: { not: null },
                responsavel: {
                  deletedAt: null,
                  blockedAt: null,
                  papeis: {
                    some: {
                      papel: TipoUsuario.Responsavel,
                      status: StatusUsuarioPapel.ATIVO,
                    },
                  },
                },
              },
              select: { id: true },
            })
          )
        : false;

    return res.json({
      ok: true,

      papelStatus: registro?.status ?? null,
      perfilExiste: Boolean(atleta),
      nascimentoValido,
      requerResponsavel,

      solicitacaoPendente: Boolean(solicitacaoPendente),
      solicitacaoStatus:
        solicitacaoPendente?.status ?? null,

      responsavelConfirmado,

      podeSolicitarResponsavel:
        registro?.status === StatusUsuarioPapel.PENDENTE &&
        Boolean(atleta) &&
        nascimentoValido &&
        requerResponsavel &&
        !responsavelConfirmado &&
        !solicitacaoPendente,

      podeConcluir:
        registro?.status === StatusUsuarioPapel.PENDENTE &&
        Boolean(atleta) &&
        nascimentoValido &&
        (!requerResponsavel || responsavelConfirmado),
    });
  } catch (error) {
    console.error(
      "[consultarRecuperacaoAtleta]",
      error
    );

    return res.status(500).json({
      code: "RECOVERY_STATUS_FAILED",
      message:
        "Não foi possível consultar o cadastro Atleta.",
    });
  }
}

export async function solicitarResponsavelRecuperacaoAtleta(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  const responsavelUsuarioId = String(
    req.body?.responsavelUsuarioId ?? ""
  ).trim();

  if (!responsavelUsuarioId || responsavelUsuarioId === usuarioId) {
    return res.status(400).json({
      code: "INVALID_GUARDIAN",
      message: "Informe outro usuário como responsável.",
    });
  }

  try {
    const contextos = await listarActiveContexts(usuarioId);

    if (contextos.length > 0) {
      return res.status(409).json({
        code: "RECOVERY_CONTEXT_ALREADY_AVAILABLE",
        message: "Esta conta já possui um contexto ativo.",
      });
    }

    const conta = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        dataNascimento: true,
        deletedAt: true,
        blockedAt: true,
      },
    });

    const nascimento = conta?.dataNascimento;

    if (
      !conta ||
      conta.deletedAt !== null ||
      conta.blockedAt !== null ||
      !nascimento ||
      Number.isNaN(nascimento.getTime()) ||
      nascimento > new Date() ||
      nascimento < new Date("1900-01-01T00:00:00.000Z")
    ) {
      return res.status(409).json({
        code: "RECOVERY_INVALID_BIRTH_DATE",
        message: "Data de nascimento inválida.",
      });
    }

    const idade = calcularIdadePorNascimento(nascimento);

    if (idade >= 12) {
      return res.status(409).json({
        code: "RECOVERY_GUARDIAN_NOT_REQUIRED",
        message:
          "Este fluxo é destinado a atletas menores de 12 anos.",
      });
    }

    const papelAtleta = await prisma.usuarioPapel.findUnique({
      where: {
        usuarioId_papel: {
          usuarioId,
          papel: TipoUsuario.Atleta,
        },
      },
      select: { status: true },
    });

    if (papelAtleta?.status !== StatusUsuarioPapel.PENDENTE) {
      return res.status(409).json({
        code: "RECOVERY_PENDING_ROLE_REQUIRED",
        message: "O perfil Atleta precisa estar pendente.",
      });
    }

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true },
    });

    if (!atleta) {
      return res.status(409).json({
        code: "RECOVERY_ATHLETE_NOT_FOUND",
        message: "Prepare o perfil Atleta antes de continuar.",
      });
    }

    const responsavel = await prisma.usuario.findFirst({
      where: {
        id: responsavelUsuarioId,
        deletedAt: null,
        blockedAt: null,
        papeis: {
          some: {
            papel: TipoUsuario.Responsavel,
            status: StatusUsuarioPapel.ATIVO,
          },
        },
      },
      select: { id: true },
    });

    if (!responsavel) {
      return res.status(404).json({
        code: "RECOVERY_GUARDIAN_NOT_FOUND",
        message:
          "Não foi encontrado um perfil Responsável ativo com esse ID.",
      });
    }

    const principalAtivo = await prisma.responsavelAtleta.findFirst({
      where: {
        atletaId: atleta.id,
        status: StatusResponsavelAtleta.ATIVO,
        principal: true,
        confirmadoEm: { not: null },
      },
      select: { id: true },
    });

    if (principalAtivo) {
      return res.status(409).json({
        code: "RECOVERY_GUARDIAN_ALREADY_CONFIRMED",
        message:
          "Este atleta já possui responsável principal confirmado.",
      });
    }

    const existente = await prisma.responsavelAtleta.findUnique({
      where: {
        responsavelUsuarioId_atletaId: {
          responsavelUsuarioId,
          atletaId: atleta.id,
        },
      },
    });

    if (existente?.status === StatusResponsavelAtleta.ATIVO) {
      return res.status(409).json({
        code: "RECOVERY_GUARDIAN_ALREADY_LINKED",
        message: "Este responsável já possui vínculo com o atleta.",
      });
    }

    if (existente?.status === StatusResponsavelAtleta.PENDENTE) {
      if (
        existente.origemSolicitacao !==
        OrigemSolicitacaoResponsavel.ATLETA
      ) {
        return res.status(409).json({
          code: "RECOVERY_REQUEST_ORIGIN_CONFLICT",
          message:
            "Já existe uma solicitação de outra origem. " +
            "Ela precisa ser resolvida antes de continuar.",
        });
      }

      return res.json({
        ok: true,
        solicitacaoPendente: true,
        vinculoId: existente.id,
        message: "Esta solicitação já está aguardando resposta.",
      });
    }

    const vinculo = await prisma.responsavelAtleta.upsert({
      where: {
        responsavelUsuarioId_atletaId: {
          responsavelUsuarioId,
          atletaId: atleta.id,
        },
      },
      create: {
        responsavelUsuarioId,
        atletaId: atleta.id,
        status: StatusResponsavelAtleta.PENDENTE,
        origemSolicitacao: OrigemSolicitacaoResponsavel.ATLETA,
        principal: false,
        confirmadoEm: null,
        parentesco: "Responsável legal",
        permitirPerfilPublico: false,
        permitirMensagensDiretas: false,
        permitirMostrarEmail: false,
      },
      update: {
        status: StatusResponsavelAtleta.PENDENTE,
        origemSolicitacao: OrigemSolicitacaoResponsavel.ATLETA,
        principal: false,
        confirmadoEm: null,
        revogadoEm: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    const usuarioAtleta = await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        nome: true,
        nomeDeUsuario: true,
      },
    });

    const nomeAtleta =
      usuarioAtleta?.nome ||
      usuarioAtleta?.nomeDeUsuario ||
      "Um atleta";

    try {
      await criarNotificacaoEEnviarPush({
        usuarioId: responsavelUsuarioId,
        actorId: usuarioId,
        tipo: "RESPONSAVEL_SOLICITACAO",
        titulo: "Solicitação para ser responsável",
        mensagem:
          `${nomeAtleta} solicitou que você seja seu responsável legal. ` +
          "Acesse seus atletas para aceitar ou recusar.",
        link: "/perfil?papel=Responsavel",
      });
    } catch (notificationError) {
      console.warn(
        "[Recuperação Atleta] Não foi possível enviar notificação:",
        notificationError
      );
    }

    return res.status(201).json({
      ok: true,
      vinculoId: vinculo.id,
      status: vinculo.status,
      solicitacaoPendente: true,
      message:
        "Solicitação registrada. O responsável deverá entrar " +
        "na própria conta para aceitar ou recusar.",
    });
  } catch (error) {
    console.error(
      "[solicitarResponsavelRecuperacaoAtleta]",
      error
    );

    return res.status(500).json({
      code: "RECOVERY_GUARDIAN_REQUEST_FAILED",
      message:
        "Não foi possível solicitar a confirmação do responsável.",
    });
  }
}

async function processarCriacaoOrganizacao(
  req: AuthenticatedRequest,
  res: Response,
  exigirSemContexto: boolean
) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  const tipos = {
    Clube: {
      papel: TipoUsuario.Clube,
      legado: "CLUBE",
    },
    Escolinha: {
      papel: TipoUsuario.Escolinha,
      legado: "ESCOLINHA",
    },
    Marca: {
      papel: TipoUsuario.Marca,
      legado: "MARCA",
    },
    Federacao: {
      papel: TipoUsuario.Federacao,
      legado: "FEDERACAO",
    },
  } as const;

  const tipoRecebido = String(req.body?.tipo ?? "");

  if (!(tipoRecebido in tipos)) {
    return res.status(400).json({
      code: "INVALID_ORGANIZATION_TYPE",
      message: "Tipo de organização inválido.",
    });
  }

  const tipo = tipoRecebido as keyof typeof tipos;
  const { papel, legado } = tipos[tipo];

  const dados = req.body?.perfil ?? {};

  const nome = String(dados.nome ?? "").trim();
  const email = String(dados.email ?? "")
    .trim()
    .toLowerCase();

  const opcional = (valor: unknown, max = 255) => {
    const resultado =
      typeof valor === "string"
        ? valor.trim().slice(0, max)
        : "";

    return resultado || null;
  };

  if (nome.length < 3 || nome.length > 120) {
    return res.status(400).json({
      code: "ORGANIZATION_NAME_REQUIRED",
      message:
        "Informe um nome entre 3 e 120 caracteres.",
    });
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return res.status(400).json({
      code: "INVALID_ORGANIZATION_EMAIL",
      message: "Informe um e-mail válido.",
    });
  }

  try {
    const resultado = await prisma.$transaction(
      async (tx) => {
        const conta = await tx.usuario.findUnique({
          where: { id: usuarioId },
          select: {
            id: true,
            deletedAt: true,
            blockedAt: true,
          },
        });

        if (
          !conta ||
          conta.deletedAt ||
          conta.blockedAt
        ) {
          throw new ActiveContextError(
            403,
            "ACCOUNT_UNAVAILABLE",
            "Conta indisponível."
          );
        }

        const papelAtivo =
          await tx.usuarioPapel.findFirst({
            where: {
              usuarioId,
              status: StatusUsuarioPapel.ATIVO,
            },
            select: { id: true },
          });

        const membroAtivo =
          await tx.membroOrganizacao.findFirst({
            where: {
              usuarioId,
              ativo: true,
              organizacao: { ativo: true },
            },
            select: { id: true },
          });

        if (
          exigirSemContexto &&
          (papelAtivo || membroAtivo)
        ) {
          throw new ActiveContextError(
            409,
            "RECOVERY_CONTEXT_ALREADY_AVAILABLE",
            "Esta conta já possui um contexto ativo."
          );
        }

        if (
          !exigirSemContexto &&
          !papelAtivo &&
          !membroAtivo
        ) {
          throw new ActiveContextError(
            409,
            "ACTIVE_CONTEXT_REQUIRED",
            "Utilize a recuperação de perfil para contas sem contexto ativo."
          );
        }

        const papelAnterior =
          await tx.usuarioPapel.findUnique({
            where: {
              usuarioId_papel: {
                usuarioId,
                papel,
              },
            },
          });

        if (
          papelAnterior?.status ===
          StatusUsuarioPapel.ATIVO
        ) {
          throw new ActiveContextError(
            409,
            "ORGANIZATION_ROLE_ALREADY_ACTIVE",
            "Esta conta já possui este papel organizacional ativo. " +
              "Utilize a organização existente ou solicite uma revisão."
          );
        }

        if (
          papelAnterior?.status ===
          StatusUsuarioPapel.PENDENTE
        ) {
          throw new ActiveContextError(
            409,
            "ORGANIZATION_ROLE_PENDING_REVIEW",
            "Esta conta já possui uma solicitação pendente " +
              "para este tipo de organização. " +
              "Regularize a solicitação antes de criar outra."
          );
        }
        if (
          papelAnterior?.status ===
          StatusUsuarioPapel.INATIVO
        ) {
          const transferencias =
            await tx.transferenciaPropriedade.findMany({
              where: {
                proprietarioAtualId: usuarioId,
                status: "ACEITA",
                concluidoEm: { not: null },
              },
              select: {
                organizacaoId: true,
              },
            });

          const organizacoes =
            await tx.organizacao.findMany({
              where: {
                id: {
                  in: transferencias.map(
                    (item) => item.organizacaoId
                  ),
                },
              },
              select: {
                tipo: true,
              },
            });

          const tipoEsperado =
            legado === "ESCOLINHA"
              ? "ESCOLA"
              : legado;

          if (
            !organizacoes.some(
              (org) => org.tipo === tipoEsperado
            )
          ) {
            throw new ActiveContextError(
              409,
              "ORGANIZATION_RECOVERY_REVIEW_REQUIRED",
              "Não foi possível validar o histórico " +
              "da organização anterior."
            );
          }
        }

        const legadoExistente =
          tipo === "Clube"
            ? await tx.clube.findUnique({
                where: { usuarioId },
                select: { id: true },
              })
            : tipo === "Escolinha"
              ? await tx.escolinha.findUnique({
                  where: { usuarioId },
                  select: { id: true },
                })
              : tipo === "Marca"
                ? await tx.marca.findUnique({
                    where: { usuarioId },
                    select: { id: true },
                  })
                : await tx.federacao.findUnique({
                    where: { usuarioId },
                    select: { id: true },
                  });

        if (legadoExistente) {
          throw new ActiveContextError(
            409,
            "ORGANIZATION_PROFILE_ALREADY_EXISTS",
            "Esta conta já possui um perfil físico deste tipo."
          );
        }

        const campos = {
          usuarioId,
          nome,
          cnpj: opcional(dados.cnpj, 18),
          email: email || null,
          telefone1: opcional(dados.telefone1, 30),
          siteOficial: opcional(dados.siteOficial, 255),
          cidade: opcional(dados.cidade, 120),
          estado: opcional(dados.estado, 60),
        };

        const perfil =
          tipo === "Clube"
            ? await tx.clube.create({
                data: campos,
                select: { id: true },
              })
            : tipo === "Escolinha"
              ? await tx.escolinha.create({
                  data: campos,
                  select: { id: true },
                })
              : tipo === "Marca"
                ? await tx.marca.create({
                    data: campos,
                    select: { id: true },
                  })
                : await tx.federacao.create({
                    data: campos,
                    select: { id: true },
                  });

        const organizacao =
          await garantirOrganizacaoLegada({
            tipo: legado as TipoOrganizacaoLegada,
            ownerId: perfil.id,
            proprietarioUsuarioId: usuarioId,
            tx,
          });

        if (
          tipo === "Marca" ||
          tipo === "Federacao"
        ) {
          await tx.creator.create({
            data: {
              usuarioId: null,
              organizacaoId: organizacao.id,
              tipo: CreatorTipo.INSTITUCIONAL,
              ativo: true,
              instituicaoOficial: true,
              verificado: false,
              nomePublico: nome,
              headline: "Canal oficial FootEra",
            },
          });
        }

        const agora = new Date();

        if (papelAnterior) {
          const atualizado =
            await tx.usuarioPapel.updateMany({
              where: {
                id: papelAnterior.id,
                usuarioId,
                status: papelAnterior.status,
              },
              data: {
                status: StatusUsuarioPapel.ATIVO,
                ativadoEm: agora,
                desativadoEm: null,
                perfilCompletoEm: agora,
              },
            });

          if (atualizado.count !== 1) {
            throw new ActiveContextError(
              409,
              "ROLE_CHANGED",
              "O papel mudou durante a recuperação."
            );
          }
        } else {
          await tx.usuarioPapel.create({
            data: {
              usuarioId,
              papel,
              status: StatusUsuarioPapel.ATIVO,
              ativadoEm: agora,
              perfilCompletoEm: agora,
            },
          });
        }

        await tx.usuario.update({
          where: { id: usuarioId },
          data: {
            tipo: papel,
            contextoOrganizacaoId: organizacao.id,
          },
        });

        return {
          organizacaoId: organizacao.id,
          perfilId: perfil.id,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    const activeContext = await definirActiveContext(
      usuarioId,
      `organization:${resultado.organizacaoId}`
    );

    if (
      activeContext.kind !== "ORGANIZATION" ||
      activeContext.organizationId !== resultado.organizacaoId
    ) {
      throw new ActiveContextError(
        409,
        "ORGANIZATION_CONTEXT_NOT_SELECTED",
        "A organização foi criada, mas não foi possível " +
          "selecionar o novo contexto."
      );
    }

    return res.status(201).json({
      ok: true,
      organizacaoId: resultado.organizacaoId,
      perfilId: resultado.perfilId,
      activeContext,
      message: "Nova organização criada e ativada com sucesso.",
    });
  } catch (error: any) {
    if (error instanceof ActiveContextError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    if (error?.code === "P2002") {
      return res.status(409).json({
        code: "ORGANIZATION_DUPLICATE",
        message:
          "Já existe um cadastro com algum dos dados informados.",
      });
    }

    if (error?.code === "P2034") {
      return res.status(409).json({
        code: "ORGANIZATION_CONCURRENT_CHANGE",
        message:
          "Outra operação alterou os dados. Tente novamente.",
      });
    }

    console.error(
      "[criarOrganizacaoRecuperacao]",
      error
    );

    return res.status(500).json({
      code: "ORGANIZATION_RECOVERY_FAILED",
      message:
        "Não foi possível criar a organização.",
    });
  }
}

export async function criarOrganizacaoRecuperacao(
  req: AuthenticatedRequest,
  res: Response
) {
  return processarCriacaoOrganizacao(
    req,
    res,
    true
  );
}

export async function criarOrganizacaoContaAtiva(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.authUser?.activeContext) {
    return res.status(403).json({
      code: "ACTIVE_CONTEXT_REQUIRED",
      message:
        "Selecione um perfil ativo antes de criar uma organização.",
    });
  }

  return processarCriacaoOrganizacao(
    req,
    res,
    false
  );
}