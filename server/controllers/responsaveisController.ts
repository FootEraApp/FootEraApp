import type {
  Request,
  Response,
} from "express";
import {
  OrigemSolicitacaoResponsavel,
  StatusResponsavelAtleta,
  StatusUsuarioPapel,
  TipoUsuario,
  AuthProvider,
} from "@prisma/client";
import { prisma } from "../prisma.js";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  criarNotificacaoEEnviarPush,
} from "./notificacoesController.js";
import {
  audit,
} from "../services/audit.js";
import bcrypt from "bcryptjs";

type AuthRequest =
  Request & {
    userId?: string;
  };

function getUsuarioId(
  req: AuthRequest,
  res: Response
) {
  const usuarioId =
    String(
      req.userId ?? ""
    ).trim();

  if (!usuarioId) {
    res.status(401).json({
      code:
        "UNAUTHENTICATED",

      message:
        "Usuário não autenticado.",
    });

    return null;
  }

  return usuarioId;
}

async function exigirResponsavel(
  req: AuthRequest,
  res: Response
) {
  const usuarioId =
    getUsuarioId(
      req,
      res
    );

  if (!usuarioId) {
    return null;
  }

  const activeContext =
    await getActiveContext(
      usuarioId
    );

  const contextoValido =
    activeContext?.kind ===
      "PERSONAL" &&
    activeContext.tipoUsuario ===
      TipoUsuario.Responsavel;

  if (!contextoValido) {
    res.status(403).json({
      code:
        "RESPONSAVEL_CONTEXT_REQUIRED",

      message:
        "Selecione seu perfil de Responsável para acessar esta área.",
    });

    return null;
  }

  const papel =
    await prisma.usuarioPapel.findUnique({
      where: {
        usuarioId_papel: {
          usuarioId,

          papel:
            TipoUsuario.Responsavel,
        },
      },

      select: {
        status: true,
      },
    });

  if (
    papel?.status !==
    StatusUsuarioPapel.ATIVO
  ) {
    res.status(403).json({
      code:
        "RESPONSAVEL_ROLE_REQUIRED",

      message:
        "O perfil de Responsável não está ativo nesta conta.",
    });

    return null;
  }

  return usuarioId;
}

async function exigirAtleta(
  req: AuthRequest,
  res: Response
) {
  const usuarioId =
    getUsuarioId(
      req,
      res
    );

  if (!usuarioId) {
    return null;
  }

  const activeContext =
    await getActiveContext(
      usuarioId
    );

  const contextoValido =
    activeContext?.kind ===
      "PERSONAL" &&
    activeContext.tipoUsuario ===
      TipoUsuario.Atleta;

  if (!contextoValido) {
    res
      .status(403)
      .json({
        code:
          "ATLETA_CONTEXT_REQUIRED",

        message:
          "Selecione seu perfil de Atleta para solicitar um responsável.",
      });

    return null;
  }

  const papel =
    await prisma
      .usuarioPapel
      .findUnique({
        where: {
          usuarioId_papel: {
            usuarioId,

            papel:
              TipoUsuario.Atleta,
          },
        },

        select: {
          status:
            true,
        },
      });

  if (
    papel?.status !==
    StatusUsuarioPapel.ATIVO
  ) {
    res
      .status(403)
      .json({
        code:
          "ATLETA_ROLE_REQUIRED",

        message:
          "O perfil de Atleta não está ativo nesta conta.",
      });

    return null;
  }

  return usuarioId;
}

function calcularIdade(
  nascimento:
    Date | string | null | undefined
) {
  if (!nascimento) {
    return null;
  }

  const data =
    new Date(nascimento);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return null;
  }

  const hoje =
    new Date();

  let idade =
    hoje.getFullYear() -
    data.getFullYear();

  const aindaNaoFez =
    hoje.getMonth() <
      data.getMonth() ||
    (
      hoje.getMonth() ===
        data.getMonth() &&
      hoje.getDate() <
        data.getDate()
    );

  if (aindaNaoFez) {
    idade--;
  }

  return Math.max(
    0,
    idade
  );
}


async function notificarDesvinculoResponsavel(
  atletaUsuarioId: string,
  responsavelUsuarioId: string,
  novoPrincipalUsuarioId?: string
) {
  const usuarioQueSaiu = await prisma.usuario.findUnique({
    where: { id: responsavelUsuarioId },
    select: { nome: true, nomeDeUsuario: true },
  }).catch(() => null);
  const nomeResponsavel = usuarioQueSaiu?.nome || usuarioQueSaiu?.nomeDeUsuario || "Um responsável";
  // Notifica o atleta sobre o encerramento do vínculo.
  try {
    await criarNotificacaoEEnviarPush({
      usuarioId: atletaUsuarioId,
      actorId: responsavelUsuarioId,
      tipo: "RESPONSAVEL_VINCULO",
      titulo: "Responsável desvinculado",
      mensagem:
        `${nomeResponsavel} encerrou o vínculo com seu perfil.`,
      link: "/perfil?papel=Atleta",
    });
  } catch (error) {
    console.warn(
      "[Responsaveis] Erro ao notificar atleta sobre desvínculo:",
      error
    );
  }

  // Notifica o novo principal, se houver transferência.
  if (
    novoPrincipalUsuarioId &&
    novoPrincipalUsuarioId !== responsavelUsuarioId
  ) {
    try {
      await criarNotificacaoEEnviarPush({
        usuarioId: novoPrincipalUsuarioId,
        actorId: responsavelUsuarioId,
        tipo: "RESPONSAVEL_VINCULO",
        titulo: "Você é o responsável principal",
        mensagem:
          `${nomeResponsavel} encerrou o vínculo e você foi definido como responsável principal do atleta.`,
        link: "/perfil?papel=Responsavel",
      });
    } catch (error) {
      console.warn(
        "[Responsaveis] Erro ao notificar novo responsável principal:",
        error
      );
    }
  }
}

async function obterVinculoSensivelResponsavel(
  responsavelUsuarioId: string,
  atletaId: string
) {
  return prisma.responsavelAtleta.findUnique({
    where: {
      responsavelUsuarioId_atletaId: {
        responsavelUsuarioId,
        atletaId,
      },
    },

    select: {
      id: true,
      atletaId: true,
      status: true,
      principal: true,

      atleta: {
        select: {
          id: true,
          idade: true,
          usuarioId: true,

          usuario: {
            select: {
              id: true,
              nome: true,
              nomeDeUsuario: true,
              dataNascimento: true,

              deletedAt: true,
              deleteScheduledAt: true,

              authProvider: true,
              localLoginEnabled: true,

              googleSub: true,
              tokenVersion: true,
            },
          },
        },
      },
    },
  });
}

async function validarAcaoSensivelResponsavel(
  responsavelUsuarioId: string,
  atletaId: string,
  res: Response
) {
  const vinculo =
    await obterVinculoSensivelResponsavel(
      responsavelUsuarioId,
      atletaId
    );

  if (
    !vinculo ||
    vinculo.status !==
      StatusResponsavelAtleta.ATIVO
  ) {
    res.status(403).json({
      code:
        "ATLETA_ACCESS_DENIED",

      message:
        "Você não possui acesso a este atleta.",
    });

    return null;
  }

  if (
    vinculo.principal !== true
  ) {
    res.status(403).json({
      code:
        "PRIMARY_GUARDIAN_REQUIRED",

      message:
        "Somente o responsável principal pode realizar esta ação.",
    });

    return null;
  }

  const idade =
    calcularIdade(
      vinculo.atleta
        .usuario
        .dataNascimento
    ) ??
    vinculo.atleta.idade ??
    null;

  if (idade === null) {
    res.status(409).json({
      code:
        "ATLETA_AGE_UNKNOWN",

      message:
        "Não foi possível determinar a idade do atleta.",
    });

    return null;
  }

  if (idade >= 12) {
    res.status(409).json({
      code:
        "GUARDIAN_SECURITY_NOT_REQUIRED",

      message:
        "Este atleta já pode gerenciar estas configurações de segurança.",
    });

    return null;
  }

  return {
    vinculo,
    idade,
  };
}

export async function obterMeuPerfilResponsavel(
  req: AuthRequest,
  res: Response
) {
  try {
    const usuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!usuarioId) {
      return;
    }

    const usuario =
      await prisma.usuario.findUnique({
        where: {
          id:
            usuarioId,
        },

        select: {
          id: true,
          nome: true,
          nomeDeUsuario: true,
          foto: true,
          cidade: true,
          estado: true,
        },
      });

    if (!usuario) {
      return res
        .status(404)
        .json({
          message:
            "Responsável não encontrado.",
        });
    }

    return res.json({
      usuario,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao carregar perfil:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível carregar o perfil do responsável.",
      });
  }
}

export async function listarMeusAtletas(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (
      !responsavelUsuarioId
    ) {
      return;
    }

    const vinculos =
      await prisma.responsavelAtleta.findMany({
        where: {
            responsavelUsuarioId,

            OR: [
                {
                status:
                    StatusResponsavelAtleta.ATIVO,
                },

                {
                status:
                    StatusResponsavelAtleta.PENDENTE,

                OR: [
                    {
                    origemSolicitacao:
                        OrigemSolicitacaoResponsavel.ATLETA,
                    },

                    /*
                    * Compatibilidade com solicitações
                    * criadas antes deste campo existir.
                    */
                    {
                    origemSolicitacao:
                        null,
                    },
                ],
                },
            ],
            },

        include: {
          atleta: {
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  nomeDeUsuario: true,
                  foto: true,
                  dataNascimento: true,

                  deletedAt: true,
                  deleteScheduledAt: true,

                  googleSub: true,
                  localLoginEnabled: true,
                },
              },
            },
          },
        },

        orderBy: [
          {
            principal:
              "desc",
          },

          {
            criadoEm:
              "asc",
          },
        ],
      });

    const items =
      vinculos.map(
        (vinculo) => {
          const idade =
            calcularIdade(
              vinculo.atleta
                .usuario
                .dataNascimento
            ) ??
            vinculo.atleta
              .idade ??
            null;

          return {
            id:
              vinculo.id,

            atletaId:
              vinculo.atletaId,

            status:
              vinculo.status,

            origemSolicitacao:
              vinculo.origemSolicitacao,

            principal:
              vinculo.principal,

            parentesco:
              vinculo.parentesco,

            podeEditarPerfil:
              vinculo
                .podeEditarPerfil,

            podeGerenciarPrivacidade:
              vinculo
                .podeGerenciarPrivacidade,

            podeGerenciarTreinos:
              vinculo
                .podeGerenciarTreinos,

            podeGerenciarConteudo:
                vinculo
                    .podeGerenciarConteudo,

            confirmadoEm:
              vinculo
                .confirmadoEm,

            atleta: {
              id:
                vinculo.atleta.id,

              usuarioId:
                vinculo.atleta
                  .usuarioId,

              nome:
                vinculo.atleta
                  .usuario.nome,

              nomeDeUsuario:
                vinculo.atleta
                  .usuario
                  .nomeDeUsuario,

              foto:
                vinculo.atleta
                  .usuario.foto,

              idade,

              deletedAt:
                vinculo.atleta
                  .usuario
                  .deletedAt,

              deleteScheduledAt:
                vinculo.atleta
                  .usuario
                  .deleteScheduledAt,

              googleLinked:
                Boolean(
                  vinculo.atleta
                    .usuario
                    .googleSub
                ),

              localLoginEnabled:
                Boolean(
                  vinculo.atleta
                    .usuario
                    .localLoginEnabled
                ),
            },
          };
        }
      );

    return res.json({
      items,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao listar atletas:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível carregar os atletas sob sua responsabilidade.",
      });
  }
}

export async function listarResponsaveisDoAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelPrincipalId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelPrincipalId) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    const vinculoPrincipal =
      await prisma.responsavelAtleta.findUnique({
        where: {
          responsavelUsuarioId_atletaId: {
            responsavelUsuarioId:
              responsavelPrincipalId,

            atletaId,
          },
        },

        select: {
          id:
            true,

          status:
            true,

          principal:
            true,
        },
      });

    if (
      !vinculoPrincipal ||
      vinculoPrincipal.status !==
        StatusResponsavelAtleta.ATIVO ||
      vinculoPrincipal.principal !==
        true
    ) {
      return res
        .status(403)
        .json({
          code:
            "PRIMARY_GUARDIAN_REQUIRED",

          message:
            "Somente o responsável principal pode gerenciar permissões.",
        });
    }

    const vinculos =
      await prisma.responsavelAtleta.findMany({
        where: {
          atletaId,

          status:
            StatusResponsavelAtleta.ATIVO,

          principal:
            false,
        },

        orderBy: {
          criadoEm:
            "asc",
        },

        select: {
          id:
            true,

          atletaId:
            true,

          responsavelUsuarioId:
            true,

          parentesco:
            true,

          podeEditarPerfil:
            true,

          podeGerenciarPrivacidade:
            true,

          podeGerenciarTreinos:
            true,

          podeGerenciarConteudo:
            true,

          responsavel: {
            select: {
              id:
                true,

              nome:
                true,

              nomeDeUsuario:
                true,

              foto:
                true,
            },
          },
        },
      });

    return res.json({
      items:
        vinculos,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao listar responsáveis do atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível carregar os responsáveis deste atleta.",
      });
  }
}

export async function atualizarPermissoesResponsavelSecundario(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelPrincipalId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelPrincipalId) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    const vinculoId =
      String(
        req.params.vinculoId ??
        ""
      ).trim();

    if (
      !atletaId ||
      !vinculoId
    ) {
      return res
        .status(400)
        .json({
          message:
            "Dados inválidos.",
        });
    }

    const principal =
      await prisma.responsavelAtleta.findUnique({
        where: {
          responsavelUsuarioId_atletaId: {
            responsavelUsuarioId:
              responsavelPrincipalId,

            atletaId,
          },
        },

        select: {
          id:
            true,

          status:
            true,

          principal:
            true,
        },
      });

    if (
      !principal ||
      principal.status !==
        StatusResponsavelAtleta.ATIVO ||
      principal.principal !==
        true
    ) {
      return res
        .status(403)
        .json({
          code:
            "PRIMARY_GUARDIAN_REQUIRED",

          message:
            "Somente o responsável principal pode alterar permissões.",
        });
    }

    const secundario =
      await prisma.responsavelAtleta.findFirst({
        where: {
          id:
            vinculoId,

          atletaId,

          status:
            StatusResponsavelAtleta.ATIVO,

          principal:
            false,
        },

        select: {
          id:
            true,

          responsavelUsuarioId:
            true,

          podeEditarPerfil:
            true,

          podeGerenciarPrivacidade:
            true,

          podeGerenciarTreinos:
            true,

          podeGerenciarConteudo:
            true,
        },
      });

    if (!secundario) {
      return res
        .status(404)
        .json({
          code:
            "SECONDARY_GUARDIAN_NOT_FOUND",

          message:
            "Responsável secundário não encontrado.",
        });
    }

    const {
      podeEditarPerfil,
      podeGerenciarPrivacidade,
      podeGerenciarTreinos,
      podeGerenciarConteudo,
    } =
      req.body ?? {};

    const data: {
      podeEditarPerfil?:
        boolean;

      podeGerenciarPrivacidade?:
        boolean;

      podeGerenciarTreinos?:
        boolean;

      podeGerenciarConteudo?:
        boolean;
    } = {};

    if (
      typeof podeEditarPerfil ===
      "boolean"
    ) {
      data.podeEditarPerfil =
        podeEditarPerfil;
    }

    if (
      typeof podeGerenciarPrivacidade ===
      "boolean"
    ) {
      data.podeGerenciarPrivacidade =
        podeGerenciarPrivacidade;
    }

    if (
      typeof podeGerenciarTreinos ===
      "boolean"
    ) {
      data.podeGerenciarTreinos =
        podeGerenciarTreinos;
    }

    if (
      typeof podeGerenciarConteudo ===
      "boolean"
    ) {
      data.podeGerenciarConteudo =
        podeGerenciarConteudo;
    }

    if (
      Object.keys(data).length ===
      0
    ) {
      return res
        .status(400)
        .json({
          message:
            "Nenhuma permissão válida foi informada.",
        });
    }

    const atualizado =
      await prisma.responsavelAtleta.update({
        where: {
          id:
            secundario.id,
        },

        data,

        select: {
          id:
            true,

          podeEditarPerfil:
            true,

          podeGerenciarPrivacidade:
            true,

          podeGerenciarTreinos:
            true,

          podeGerenciarConteudo:
            true,
        },
      });

    await audit(
      req,
      {
        acao:
          "PERMISSOES_RESPONSAVEL_SECUNDARIO_ATUALIZADAS",

        entidade:
          "ResponsavelAtleta",

        entidadeId:
          secundario.id,

        descricao:
          "Responsável principal alterou permissões de um responsável secundário.",

        meta: {
          atletaId,

          responsavelSecundarioUsuarioId:
            secundario.responsavelUsuarioId,

          antes: {
            podeEditarPerfil:
              secundario.podeEditarPerfil,

            podeGerenciarPrivacidade:
              secundario.podeGerenciarPrivacidade,

            podeGerenciarTreinos:
              secundario.podeGerenciarTreinos,

            podeGerenciarConteudo:
              secundario.podeGerenciarConteudo,
          },

          depois:
            atualizado,
        },
      }
    );

    return res.json({
      ok:
        true,

      permissoes:
        atualizado,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao atualizar permissões do responsável secundário:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível alterar as permissões.",
      });
  }
}

export async function obterMeuAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (
      !responsavelUsuarioId
    ) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    const vinculo =
      await prisma.responsavelAtleta.findUnique({
        where: {
          responsavelUsuarioId_atletaId:
            {
              responsavelUsuarioId,
              atletaId,
            },
        },

        include: {
          atleta: {
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  nomeDeUsuario:
                    true,
                  foto: true,
                  dataNascimento:
                    true,
                },
              },
            },
          },
        },
      });

    if (
      !vinculo ||
      vinculo.status ===
        StatusResponsavelAtleta.REVOGADO
    ) {
      return res
        .status(404)
        .json({
          code:
            "RESPONSAVEL_ATLETA_NOT_FOUND",

          message:
            "Este atleta não está sob sua responsabilidade.",
        });
    }

    const idade =
      calcularIdade(
        vinculo.atleta
          .usuario
          .dataNascimento
      ) ??
      vinculo.atleta
        .idade ??
      null;

    return res.json({
      id:
        vinculo.id,

      status:
        vinculo.status,

      origemSolicitacao:
        vinculo.origemSolicitacao,

      principal:
        vinculo.principal,

      parentesco:
        vinculo.parentesco,

      podeEditarPerfil:
        vinculo
          .podeEditarPerfil,

      podeGerenciarPrivacidade:
        vinculo
          .podeGerenciarPrivacidade,

      podeGerenciarTreinos:
        vinculo
          .podeGerenciarTreinos,

      podeGerenciarConteudo:
        vinculo
          .podeGerenciarConteudo,

      atleta: {
        id:
          vinculo.atleta.id,

        usuarioId:
          vinculo.atleta
            .usuarioId,

        nome:
          vinculo.atleta
            .usuario.nome,

        nomeDeUsuario:
          vinculo.atleta
            .usuario
            .nomeDeUsuario,

        foto:
          vinculo.atleta
            .usuario.foto,

        idade,
      },
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao carregar atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível carregar este atleta.",
      });
  }
}

export async function ativarMeuAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (
      !responsavelUsuarioId
    ) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    const vinculo =
      await prisma.responsavelAtleta.findUnique({
        where: {
          responsavelUsuarioId_atletaId:
            {
              responsavelUsuarioId,
              atletaId,
            },
        },

        include: {
          atleta: {
            include: {
              usuario: {
                select: {
                  dataNascimento:
                    true,
                },
              },
            },
          },
        },
      });

    if (!vinculo) {
      return res
        .status(404)
        .json({
          code:
            "RESPONSAVEL_ATLETA_NOT_FOUND",

          message:
            "Este atleta não está vinculado ao responsável.",
        });
    }

    if (
    vinculo.status ===
        StatusResponsavelAtleta.PENDENTE &&
    vinculo.origemSolicitacao ===
        OrigemSolicitacaoResponsavel.RESPONSAVEL
    ) {
    return res
        .status(403)
        .json({
        code:
            "CANNOT_APPROVE_OWN_GUARDIAN_REQUEST",

        message:
            "Esta solicitação foi iniciada por você e precisa ser aprovada pelo responsável principal do atleta.",
        });
    }

    if (
      vinculo.status ===
      StatusResponsavelAtleta.REVOGADO
    ) {
      return res
        .status(409)
        .json({
          code:
            "RESPONSAVEL_ATLETA_REVOKED",

          message:
            "Este vínculo foi revogado.",
        });
    }

    const idade =
      calcularIdade(
        vinculo.atleta
          .usuario
          .dataNascimento
      ) ??
      vinculo.atleta
        .idade ??
      null;

    if (
      idade === null
    ) {
      return res
        .status(409)
        .json({
          code:
            "ATLETA_AGE_UNKNOWN",

          message:
            "Não foi possível determinar a idade do atleta.",
        });
    }

    // Vínculos voluntários também são permitidos para atletas com 12 anos ou mais.

    if (
      vinculo.status ===
      StatusResponsavelAtleta.ATIVO
    ) {
      return res.json({
        ok: true,
        status:
          vinculo.status,
      });
    }

    const possuiResponsavelPrincipalAtivo =
        await prisma
            .responsavelAtleta
            .findFirst({
            where: {
                atletaId:
                vinculo.atletaId,

                status:
                StatusResponsavelAtleta.ATIVO,

                principal:
                true,

                id: {
                not:
                    vinculo.id,
                },
            },

            select: {
                id: true,
            },
            });

    const atualizado =
      await prisma.responsavelAtleta.update({
        where: {
          id:
            vinculo.id,
        },

        data: {
          status:
            StatusResponsavelAtleta.ATIVO,

          principal:
            !possuiResponsavelPrincipalAtivo,

          confirmadoEm:
            new Date(),

          revogadoEm:
            null,
        },

        select: {
          id: true,
          atletaId: true,
          status: true,
          confirmadoEm: true,
        },
      });

    try {
        const vinculoComAtleta =
            await prisma
            .responsavelAtleta
            .findUnique({
                where: {
                id:
                    vinculo.id,
                },

                select: {
                atleta: {
                    select: {
                    usuarioId:
                        true,
                    },
                },
                },
            });

        if (
            vinculoComAtleta
            ?.atleta
            ?.usuarioId
        ) {
          const usuarioResponsavel = await prisma.usuario.findUnique({
            where: {
              id: responsavelUsuarioId,
            },
            select: {
              nome: true,
              nomeDeUsuario: true,
            },
          });

          const nomeResponsavel =
            usuarioResponsavel?.nome ||
            usuarioResponsavel?.nomeDeUsuario ||
            "O responsável";
            
            await criarNotificacaoEEnviarPush({
            usuarioId:
                vinculoComAtleta
                .atleta
                .usuarioId,

            actorId:
                responsavelUsuarioId,

            tipo:
                "RESPONSAVEL_SOLICITACAO",

            titulo:
                "Responsável vinculado",

            mensagem:
              `${nomeResponsavel} aceitou sua solicitação e agora está vinculado ao seu perfil como responsável.`,

            link: "/perfil?papel=Atleta&aba=responsaveis",
            });
        }
        } catch (
        notificationError
        ) {
        console.warn(
            "[Responsaveis] Não foi possível notificar o aceite:",
            notificationError
        );
        }

    return res.json({
      ok: true,
      vinculo:
        atualizado,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao ativar atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível ativar o perfil do atleta.",
      });
  }
}

export async function listarPostagensAtletaGerenciado(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (
      !responsavelUsuarioId
    ) {
      return;
    }

    const atletaId =
      String(
        req.params
          .atletaId ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    const vinculo =
      await prisma
        .responsavelAtleta
        .findUnique({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId,
                atletaId,
              },
          },

          select: {
            id: true,

            status: true,

            podeGerenciarConteudo:
              true,

            atleta: {
              select: {
                id: true,

                usuarioId:
                  true,

                usuario: {
                  select: {
                    nome:
                      true,

                    nomeDeUsuario:
                      true,

                    foto:
                      true,
                  },
                },
              },
            },
          },
        });

    if (
      !vinculo ||
      vinculo.status !==
        StatusResponsavelAtleta.ATIVO
    ) {
      return res
        .status(403)
        .json({
          code:
            "ATLETA_ACCESS_DENIED",

          message:
            "Você não possui acesso a este atleta.",
        });
    }

    if (
      !vinculo
        .podeGerenciarConteudo
    ) {
      return res
        .status(403)
        .json({
          code:
            "CONTENT_MANAGEMENT_DISABLED",

          message:
            "Você não possui permissão para gerenciar o conteúdo deste atleta.",
        });
    }

    const postagens =
      await prisma
        .postagem
        .findMany({
          where: {
            usuarioId:
              vinculo.atleta
                .usuarioId,

            /*
             * Não exibimos como conteúdo
             * da criança posts publicados
             * em nome de organização.
             */
            organizacaoId:
              null,
          },

          orderBy: {
            dataCriacao:
              "desc",
          },

          take: 10,

          select: {
            id: true,

            conteudo: true,

            imagemUrl: true,

            videoUrl: true,

            dataCriacao: true,

            visibilidade:
              true,

            repostOfId:
              true,

            compartilhamentos:
              true,

            reposts:
              true,

            _count: {
              select: {
                curtidas:
                  true,

                comentarios:
                  true,
              },
            },
          },
        });

    return res.json({
      atleta: {
        id:
          vinculo.atleta.id,

        usuarioId:
          vinculo.atleta
            .usuarioId,

        nome:
          vinculo.atleta
            .usuario.nome,

        nomeDeUsuario:
          vinculo.atleta
            .usuario
            .nomeDeUsuario,

        foto:
          vinculo.atleta
            .usuario.foto,
      },

      items:
        postagens.map(
          (post) => ({
            id:
              post.id,

            conteudo:
              post.conteudo,

            imagemUrl:
              post.imagemUrl,

            videoUrl:
              post.videoUrl,

            dataCriacao:
              post.dataCriacao,

            visibilidade:
              post.visibilidade,

            repostOfId:
              post.repostOfId,

            compartilhamentos:
              post
                .compartilhamentos,

            reposts:
              post.reposts,

            curtidas:
              post._count
                .curtidas,

            comentarios:
              post._count
                .comentarios,
          })
        ),
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao carregar postagens do atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível carregar as postagens do atleta.",
      });
  }
}

export async function solicitarExclusaoContaAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (
      !responsavelUsuarioId
    ) {
      return;
    }

    const atletaId =
      String(
        req.params
          .atletaId ??
        ""
      ).trim();

    const confirm =
      String(
        req.body
          ?.confirm ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    const vinculo =
      await prisma
        .responsavelAtleta
        .findUnique({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId,
                atletaId,
              },
          },

          include: {
            atleta: {
              include: {
                usuario: {
                  select: {
                    id: true,
                    nome: true,
                    nomeDeUsuario:
                      true,
                    dataNascimento:
                      true,
                    deletedAt:
                      true,
                  },
                },
              },
            },
          },
        });

    if (
      !vinculo ||
      vinculo.status !==
        StatusResponsavelAtleta.ATIVO
    ) {
      return res
        .status(403)
        .json({
          code:
            "ATLETA_ACCESS_DENIED",

          message:
            "Você não possui acesso a este atleta.",
        });
    }

    /*
     * Exclusão da conta é uma ação
     * muito sensível.
     *
     * Apenas o responsável principal.
     */
    if (
      vinculo.principal !==
      true
    ) {
      return res
        .status(403)
        .json({
          code:
            "PRIMARY_GUARDIAN_REQUIRED",

          message:
            "Somente o responsável principal pode solicitar a exclusão desta conta.",
        });
    }

    const idade =
      calcularIdade(
        vinculo.atleta
          .usuario
          .dataNascimento
      ) ??
      vinculo.atleta
        .idade ??
      null;

    if (
      idade === null
    ) {
      return res
        .status(409)
        .json({
          code:
            "ATLETA_AGE_UNKNOWN",

          message:
            "Não foi possível determinar a idade do atleta.",
        });
    }

    if (
      idade >= 12
    ) {
      return res
        .status(409)
        .json({
          code:
            "GUARDIAN_DELETE_NOT_REQUIRED",

          message:
            "Este atleta já pode gerenciar a exclusão da própria conta.",
        });
    }

    /*
     * Para evitar exclusão acidental,
     * o responsável precisa digitar
     * exatamente o nome de usuário
     * da criança.
     */
    const username =
      String(
        vinculo.atleta
          .usuario
          .nomeDeUsuario ??
        ""
      ).trim();

    if (
      !username ||
      confirm !==
        username
    ) {
      return res
        .status(400)
        .json({
          code:
            "INVALID_DELETE_CONFIRMATION",

          message:
            `Digite exatamente "${username}" para confirmar.`,
        });
    }

    if (
      vinculo.atleta
        .usuario
        .deletedAt
    ) {
      return res
        .status(409)
        .json({
          code:
            "ACCOUNT_ALREADY_DELETED",

          message:
            "Esta conta já está na lixeira.",
        });
    }

    const now =
      new Date();

    const in30 =
      new Date(
        now.getTime() +
        30 *
          24 *
          60 *
          60 *
          1000
      );

    await prisma.usuario.update({
      where: {
        id:
          vinculo.atleta
            .usuario.id,
      },

      data: {
        deletedAt:
          now,

        deleteScheduledAt:
          in30,

        tokenVersion: {
          increment:
            1,
        },

        lastLogoutAt:
          now,
      },
    });

    await audit(
      req,
      {
        acao:
          "RESPONSAVEL_EXCLUIU_CONTA_ATLETA",

        entidade:
          "Usuario",

        entidadeId:
          vinculo.atleta
            .usuario.id,

        descricao:
          "Responsável principal moveu a conta do atleta supervisionado para a lixeira.",

        meta: {
          atletaId,
          vinculoId:
            vinculo.id,

          deleteScheduledAt:
            in30.toISOString(),
        },
      }
    );

    return res.json({
      ok: true,

      message:
        "Conta do atleta movida para a lixeira por 30 dias.",

      deleteScheduledAt:
        in30,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao excluir conta do atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível solicitar a exclusão da conta do atleta.",
      });
  }
}

export async function solicitarVinculoResponsavel(
  req: AuthRequest,
  res: Response
) {
  try {
    const atletaUsuarioId =
      await exigirAtleta(
        req,
        res
      );

    if (!atletaUsuarioId) {
      return;
    }

    const responsavelUsuarioId =
      String(
        req.body
          ?.responsavelUsuarioId ??
        ""
      ).trim();

    if (!responsavelUsuarioId) {
      return res
        .status(400)
        .json({
          code:
            "RESPONSAVEL_REQUIRED",

          message:
            "Responsável inválido.",
        });
    }

    if (
      responsavelUsuarioId ===
      atletaUsuarioId
    ) {
      return res
        .status(400)
        .json({
          code:
            "SELF_RESPONSAVEL_NOT_ALLOWED",

          message:
            "Você não pode solicitar a si mesmo como responsável.",
        });
    }

    /*
     * Confirma que o destino realmente
     * possui papel Responsavel ativo.
     */
    const responsavel =
      await prisma.usuario.findFirst({
        where: {
          id:
            responsavelUsuarioId,

          deletedAt:
            null,

          papeis: {
            some: {
              papel:
                TipoUsuario.Responsavel,

              status:
                StatusUsuarioPapel.ATIVO,
            },
          },
        },

        select: {
          id: true,
          nome: true,
          nomeDeUsuario:
            true,
        },
      });

    if (!responsavel) {
      return res
        .status(404)
        .json({
          code:
            "RESPONSAVEL_NOT_FOUND",

          message:
            "Este usuário não possui um perfil de Responsável ativo.",
        });
    }

    const atleta =
      await prisma.atleta.findFirst({
        where: {
          usuarioId:
            atletaUsuarioId,
        },

        select: {
          id: true,

          usuario: {
            select: {
              nome: true,

              nomeDeUsuario:
                true,

              dataNascimento:
                true,
            },
          },

          idade: true,
        },
      });

    if (!atleta) {
      return res
        .status(404)
        .json({
          code:
            "ATLETA_NOT_FOUND",

          message:
            "Perfil de atleta não encontrado.",
        });
    }

    const idade =
      calcularIdade(
        atleta.usuario
          .dataNascimento
      ) ??
      atleta.idade ??
      null;

    /*
     * Este fluxo foi criado para
     * supervisão de menor de 12.
     */
    if (
      idade === null
    ) {
      return res
        .status(409)
        .json({
          code:
            "ATLETA_AGE_UNKNOWN",

          message:
            "Não foi possível determinar sua idade.",
        });
    }


    const existente =
      await prisma
        .responsavelAtleta
        .findUnique({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId,

                atletaId:
                  atleta.id,
              },
          },
        });

    /*
     * Já existe vínculo ativo.
     */
    if (
      existente?.status ===
      StatusResponsavelAtleta.ATIVO
    ) {
      return res
        .status(409)
        .json({
          code:
            "RESPONSAVEL_ALREADY_LINKED",

          message:
            "Este responsável já está vinculado ao seu perfil.",
        });
    }

    /*
     * Já existe solicitação aguardando.
     */
    if (
      existente?.status ===
      StatusResponsavelAtleta.PENDENTE
    ) {
      return res
        .status(409)
        .json({
          code:
            "RESPONSAVEL_REQUEST_PENDING",

          message:
            "Você já enviou uma solicitação para este responsável.",
        });
    }

    /*
     * Um vínculo REVOGADO pode receber
     * uma nova solicitação.
     */
    const vinculo =
      await prisma
        .responsavelAtleta
        .upsert({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId,

                atletaId:
                  atleta.id,
              },
          },

          update: {
            status:
              StatusResponsavelAtleta.PENDENTE,

            origemSolicitacao:
              OrigemSolicitacaoResponsavel.ATLETA,

            principal:
              false,

            confirmadoEm:
              null,

            revogadoEm:
              null,
          },

          create: {
            responsavelUsuarioId,

            atletaId:
              atleta.id,

            status:
              StatusResponsavelAtleta.PENDENTE,

            origemSolicitacao:
              OrigemSolicitacaoResponsavel.ATLETA,

            principal:
              false,

            podeEditarPerfil:
              true,

            podeGerenciarPrivacidade:
              true,

            podeGerenciarTreinos:
              true,

            podeGerenciarConteudo:
              true,

            permitirPerfilPublico:
              false,

            permitirMensagensDiretas:
              false,

            permitirMostrarEmail:
              false,
          },

          select: {
            id: true,
            atletaId: true,
            status: true,
            criadoEm: true,
          },
        });

    const nomeAtleta =
      atleta.usuario.nome ||
      atleta.usuario
        .nomeDeUsuario ||
      "Um atleta";

    /*
     * A solicitação já foi criada.
     * Falha de notificação não deve
     * desfazer o vínculo pendente.
     */
    try {
      await criarNotificacaoEEnviarPush({
        usuarioId:
          responsavelUsuarioId,

        actorId:
          atletaUsuarioId,

        tipo:
          "RESPONSAVEL_SOLICITACAO",

        titulo:
          "Solicitação de responsável",

        mensagem:
          `${nomeAtleta} quer vincular você como responsável.`,

        link: "/perfil?papel=Responsavel",
      });
    } catch (
      notificationError
    ) {
      console.warn(
        "[Responsaveis] Não foi possível enviar a notificação da solicitação:",
        notificationError
      );
    }

    return res
      .status(201)
      .json({
        ok: true,

        message:
          "Solicitação enviada ao responsável.",

        vinculo,
      });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao solicitar responsável:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível enviar a solicitação ao responsável.",
      });
  }
}

export async function recusarVinculoAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelUsuarioId) {
      return;
    }

    const atletaId =
      String(
        req.params
          .atletaId ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    const vinculo =
      await prisma
        .responsavelAtleta
        .findUnique({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId,

                atletaId,
              },
          },

          select: {
            id: true,
            status: true,

            origemSolicitacao:
                true,

            atleta: {
                select: {
                usuarioId:
                    true,
                },
            },
            },
        });

    if (!vinculo) {
      return res
        .status(404)
        .json({
          code:
            "RESPONSAVEL_REQUEST_NOT_FOUND",

          message:
            "Solicitação não encontrada.",
        });
    }

    if (
    vinculo.status ===
        StatusResponsavelAtleta.PENDENTE &&
    vinculo.origemSolicitacao ===
        OrigemSolicitacaoResponsavel.RESPONSAVEL
    ) {
    return res
        .status(403)
        .json({
        code:
            "CANNOT_REJECT_OWN_GUARDIAN_REQUEST",

        message:
            "Esta solicitação foi iniciada por você e deve ser analisada pelo responsável principal do atleta.",
        });
    }

    if (
      vinculo.status !==
      StatusResponsavelAtleta.PENDENTE
    ) {
      return res
        .status(409)
        .json({
          code:
            "RESPONSAVEL_REQUEST_NOT_PENDING",

          message:
            "Esta solicitação não está mais pendente.",
        });
    }

    const atualizado =
      await prisma
        .responsavelAtleta
        .update({
          where: {
            id:
              vinculo.id,
          },

          data: {
            status:
              StatusResponsavelAtleta.REVOGADO,

            confirmadoEm:
              null,

            revogadoEm:
              new Date(),

            principal:
              false,
          },

          select: {
            id: true,
            atletaId: true,
            status: true,
            revogadoEm: true,
          },
        });

    try {
      const usuarioResponsavel = await prisma.usuario.findUnique({
        where: {
          id: responsavelUsuarioId,
        },
        select: {
          nome: true,
          nomeDeUsuario: true,
        },
      });

      const nomeResponsavel =
        usuarioResponsavel?.nome?.trim() ||
        usuarioResponsavel?.nomeDeUsuario?.trim() ||
        "O responsável";

      await criarNotificacaoEEnviarPush({
        usuarioId: vinculo.atleta.usuarioId,
        actorId: responsavelUsuarioId,
        tipo: "RESPONSAVEL_SOLICITACAO",
        titulo: "Solicitação de responsável recusada",
        mensagem:
          `${nomeResponsavel} recusou sua solicitação de vínculo como responsável.`,
        link: "/perfil?papel=Atleta&aba=responsaveis",
      });
    } catch (notificationError) {
      console.warn(
        "[Responsaveis] Não foi possível notificar a recusa:",
        notificationError
      );
    }

    return res.json({
      ok: true,

      message:
        "Solicitação recusada.",

      vinculo:
        atualizado,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao recusar solicitação:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível recusar a solicitação.",
      });
  }
}

export async function solicitarVinculoAtletaComoResponsavel(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelUsuarioId) {
      return;
    }

    const atletaUsuarioId =
      String(
        req.body
          ?.atletaUsuarioId ??
        ""
      ).trim();

    if (!atletaUsuarioId) {
      return res
        .status(400)
        .json({
          code:
            "ATLETA_REQUIRED",

          message:
            "Atleta inválido.",
        });
    }

    if (
      atletaUsuarioId ===
      responsavelUsuarioId
    ) {
      return res
        .status(400)
        .json({
          code:
            "SELF_LINK_NOT_ALLOWED",

          message:
            "Você não pode solicitar vínculo com a própria conta.",
        });
    }

    const atleta =
      await prisma.atleta.findFirst({
        where: {
          usuarioId:
            atletaUsuarioId,

          usuario: {
            deletedAt:
              null,

            papeis: {
              some: {
                papel:
                  TipoUsuario.Atleta,

                status:
                  StatusUsuarioPapel.ATIVO,
              },
            },
          },
        },

        select: {
          id: true,
          idade: true,
          usuarioId: true,

          usuario: {
            select: {
              nome: true,
              nomeDeUsuario:
                true,
              dataNascimento:
                true,
            },
          },
        },
      });

    if (!atleta) {
      return res
        .status(404)
        .json({
          code:
            "ATLETA_NOT_FOUND",

          message:
            "Atleta não encontrado.",
        });
    }

    const idade =
      calcularIdade(
        atleta.usuario
          .dataNascimento
      ) ??
      atleta.idade ??
      null;

    if (idade === null) {
      return res
        .status(409)
        .json({
          code:
            "ATLETA_AGE_UNKNOWN",

          message:
            "Não foi possível determinar a idade do atleta.",
        });
    }


    const existente =
      await prisma
        .responsavelAtleta
        .findUnique({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId,

                atletaId:
                  atleta.id,
              },
          },
        });

    if (
      existente?.status ===
      StatusResponsavelAtleta.ATIVO
    ) {
      return res
        .status(409)
        .json({
          code:
            "RESPONSAVEL_ALREADY_LINKED",

          message:
            "Você já está vinculado a este atleta.",
        });
    }

    if (
      existente?.status ===
      StatusResponsavelAtleta.PENDENTE
    ) {
      return res
        .status(409)
        .json({
          code:
            "RESPONSAVEL_REQUEST_PENDING",

          message:
            "Já existe uma solicitação de vínculo pendente com este atleta.",
        });
    }

    /*
     * Só permitimos que um adulto solicite
     * vínculo quando a criança já possui
     * responsável principal ativo.
     */
    const responsavelPrincipal =
      await prisma
        .responsavelAtleta
        .findFirst({
          where: {
            atletaId:
              atleta.id,

            status:
              StatusResponsavelAtleta.ATIVO,

            principal:
              true,
          },

          select: {
            id: true,

            responsavelUsuarioId:
              true,
          },
        });

    // Para menores de 12 anos, uma solicitação iniciada por adulto
    // só pode ser encaminhada se existir principal ativo.
    if (!responsavelPrincipal && idade < 12) {
      return res.status(409).json({
        code: "PRIMARY_GUARDIAN_REQUIRED",
        message: "Para menores de 12 anos, o vínculo inicial deve seguir o fluxo protegido de cadastro.",
      });
    }

    if (
      responsavelPrincipal?.responsavelUsuarioId ===
      responsavelUsuarioId
    ) {
      return res
        .status(409)
        .json({
          code:
            "ALREADY_PRIMARY_GUARDIAN",

          message:
            "Você já é o responsável principal deste atleta.",
        });
    }

    const vinculo =
      await prisma
        .responsavelAtleta
        .upsert({
          where: {
            responsavelUsuarioId_atletaId:
              {
                responsavelUsuarioId,

                atletaId:
                  atleta.id,
              },
          },

          update: {
            status:
              StatusResponsavelAtleta.PENDENTE,

            origemSolicitacao:
              OrigemSolicitacaoResponsavel.RESPONSAVEL,

            principal:
              false,

            confirmadoEm:
              null,

            revogadoEm:
              null,
            podeEditarPerfil: false,
            podeGerenciarPrivacidade: false,
            podeGerenciarTreinos: false,
            podeGerenciarConteudo: false,
          },

          create: {
            responsavelUsuarioId,

            atletaId:
              atleta.id,

            status:
              StatusResponsavelAtleta.PENDENTE,

            origemSolicitacao:
              OrigemSolicitacaoResponsavel.RESPONSAVEL,

            principal:
              false,

            podeEditarPerfil:
              false,

            podeGerenciarPrivacidade:
              false,

            podeGerenciarTreinos:
              false,

            podeGerenciarConteudo:
              false,

            permitirPerfilPublico:
              false,

            permitirMensagensDiretas:
              false,

            permitirMostrarEmail:
              false,
          },

          select: {
            id: true,
            atletaId: true,
            status: true,
            origemSolicitacao:
              true,
            criadoEm: true,
          },
        });

    const solicitante =
      await prisma.usuario.findUnique({
        where: {
          id:
            responsavelUsuarioId,
        },

        select: {
          nome: true,
          nomeDeUsuario:
            true,
        },
      });

    const nomeSolicitante =
      solicitante?.nome ||
      solicitante
        ?.nomeDeUsuario ||
      "Um responsável";

    const nomeAtleta =
      atleta.usuario.nome ||
      atleta.usuario
        .nomeDeUsuario ||
      "o atleta";

    if (responsavelPrincipal) try {
      await criarNotificacaoEEnviarPush({
        usuarioId:
          responsavelPrincipal.responsavelUsuarioId,

        actorId:
          responsavelUsuarioId,

        tipo:
          "RESPONSAVEL_SOLICITACAO",

        titulo:
          "Novo responsável solicitando vínculo",

        mensagem:
          `${nomeSolicitante} quer se vincular como responsável de ${nomeAtleta}.`,

        link: "/perfil?papel=Responsavel",
      });
    } catch (
      notificationError
    ) {
      console.warn(
        "[Responsaveis] Não foi possível notificar o responsável principal:",
        notificationError
      );
    }

    // O atleta é sempre informado. Se tiver >=12 anos, também pode decidir.
    try {
      await criarNotificacaoEEnviarPush({
        usuarioId: atletaUsuarioId,
        actorId: responsavelUsuarioId,
        tipo: "RESPONSAVEL_SOLICITACAO",
        titulo: "Pedido de novo responsável",
        mensagem: `${nomeSolicitante} solicitou ser seu responsável.${idade >= 12 ? " Você pode aceitar ou recusar na aba Responsáveis." : " Aguarde a decisão do responsável principal."}`,
        link: "/perfil?papel=Atleta&aba=responsaveis",
      });
    } catch (error) {
      console.warn("[Responsaveis] Falha ao notificar atleta:", error);
    }

    return res
      .status(201)
      .json({
        ok: true,

        message:
          responsavelPrincipal
            ? "Solicitação enviada ao responsável principal e informada ao atleta."
            : "Solicitação enviada ao atleta para decisão.",

        vinculo,
      });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao solicitar vínculo com atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível enviar a solicitação de vínculo.",
      });
  }
}

export async function listarSolicitacoesNovosResponsaveis(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelPrincipalId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelPrincipalId) {
      return;
    }

    const atletasPrincipais =
      await prisma
        .responsavelAtleta
        .findMany({
          where: {
            responsavelUsuarioId:
              responsavelPrincipalId,

            status:
              StatusResponsavelAtleta.ATIVO,

            principal:
              true,
          },

          select: {
            atletaId:
              true,
          },
        });

    const atletaIds =
      atletasPrincipais.map(
        (item) =>
          item.atletaId
      );

    if (
      atletaIds.length ===
      0
    ) {
      return res.json({
        items: [],
      });
    }

    const solicitacoes =
      await prisma
        .responsavelAtleta
        .findMany({
          where: {
            atletaId: {
              in:
                atletaIds,
            },

            status:
              StatusResponsavelAtleta.PENDENTE,

            origemSolicitacao:
              OrigemSolicitacaoResponsavel.RESPONSAVEL,

            responsavelUsuarioId: {
              not:
                responsavelPrincipalId,
            },
          },

          include: {
            responsavel: {
              select: {
                id: true,
                nome: true,
                nomeDeUsuario:
                  true,
                foto: true,
              },
            },

            atleta: {
              include: {
                usuario: {
                  select: {
                    id: true,
                    nome: true,
                    nomeDeUsuario:
                      true,
                    foto: true,
                  },
                },
              },
            },
          },

          orderBy: {
            criadoEm:
              "desc",
          },
        });

    return res.json({
      items:
        solicitacoes.map(
          (solicitacao) => ({
            id:
              solicitacao.id,

            atletaId:
              solicitacao.atletaId,

            criadoEm:
              solicitacao.criadoEm,

            responsavelSolicitante: {
              id:
                solicitacao
                  .responsavel.id,

              nome:
                solicitacao
                  .responsavel.nome,

              nomeDeUsuario:
                solicitacao
                  .responsavel
                  .nomeDeUsuario,

              foto:
                solicitacao
                  .responsavel.foto,
            },

            atleta: {
              id:
                solicitacao
                  .atleta.id,

              usuarioId:
                solicitacao
                  .atleta.usuarioId,

              nome:
                solicitacao
                  .atleta.usuario.nome,

              nomeDeUsuario:
                solicitacao
                  .atleta.usuario
                  .nomeDeUsuario,

              foto:
                solicitacao
                  .atleta.usuario.foto,
            },
          })
        ),
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao listar solicitações de novos responsáveis:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível carregar as solicitações.",
      });
  }
}

/** Decide pedidos iniciados por responsável.
 * Atleta com >=12 ou principal ativo pode responder. Somente a primeira decisão vale.
 */
async function decidirNovoResponsavel(
  req: AuthRequest,
  res: Response,
  decisao: "aceitar" | "recusar",
  ator: "ATLETA" | "PRINCIPAL"
) {
  try {
    const usuarioId = ator === "ATLETA"
      ? await exigirAtleta(req, res)
      : await exigirResponsavel(req, res);
    if (!usuarioId) return;

    const vinculoId = String(req.params.vinculoId ?? "").trim();
    if (!vinculoId) return res.status(400).json({ message: "Solicitação inválida." });

    // A transação serializa as decisões por atleta e evita que duas
    // solicitações diferentes se tornem principais simultaneamente.
    const resultado = await prisma.$transaction(async (tx) => {
      const original = await tx.responsavelAtleta.findUnique({
        where: { id: vinculoId },
        include: {
          atleta: {
            include: { usuario: {
              select: { id: true, nome: true, nomeDeUsuario: true, dataNascimento: true }
            } }
          },
          responsavel: { select: { id: true, nome: true, nomeDeUsuario: true } },
        },
      });
      if (!original) return { erro: 404, message: "Solicitação não encontrada." } as const;
      // Mantém decisões de um mesmo atleta em ordem no PostgreSQL.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${original.atletaId}))::text`;
      const solicitacao = await tx.responsavelAtleta.findUnique({ where: { id: vinculoId } });
      if (solicitacao?.status !== StatusResponsavelAtleta.PENDENTE ||
          solicitacao.origemSolicitacao !== OrigemSolicitacaoResponsavel.RESPONSAVEL) {
        return { erro: 409, message: "Esta solicitação já foi respondida ou não está pendente." } as const;
      }

      const principal = await tx.responsavelAtleta.findFirst({
        where: {
          atletaId: original.atletaId,
          status: StatusResponsavelAtleta.ATIVO,
          principal: true,
        },
        select: { responsavelUsuarioId: true },
      });
      const idade = calcularIdade(original.atleta.usuario.dataNascimento) ?? original.atleta.idade;
      if (ator === "ATLETA") {
        if (original.atleta.usuarioId !== usuarioId)
          return { erro: 403, message: "Esta solicitação não pertence ao seu perfil." } as const;
        if (idade === null || idade < 12)
          return { erro: 403, message: "Somente atletas com 12 anos ou mais podem decidir este pedido." } as const;
      } else if (principal?.responsavelUsuarioId !== usuarioId) {
        return { erro: 403, message: "Somente o responsável principal ativo pode decidir este pedido." } as const;
      }

      const aceitar = decisao === "aceitar";
      const updated = await tx.responsavelAtleta.updateMany({
        where: {
          id: vinculoId,
          status: StatusResponsavelAtleta.PENDENTE,
          origemSolicitacao: OrigemSolicitacaoResponsavel.RESPONSAVEL,
        },
        data: {
          status: aceitar ? StatusResponsavelAtleta.ATIVO : StatusResponsavelAtleta.REVOGADO,
          principal: aceitar && !principal,
          confirmadoEm: aceitar ? new Date() : null,
          revogadoEm: aceitar ? null : new Date(),
          // Primeiro vínculo de atleta >=12 não concede controle
          // irrestrito de perfil ou conteúdo automaticamente.
        },
      });
      if (updated.count !== 1)
        return { erro: 409, message: "Esta solicitação já foi respondida." } as const;
      return {
        sucesso: true as const,
        atletaUsuarioId: original.atleta.usuarioId,
        nomeAtleta: original.atleta.usuario.nome || original.atleta.usuario.nomeDeUsuario || "Atleta",
        responsavelUsuarioId: original.responsavelUsuarioId,
        nomeSolicitante: original.responsavel.nome || original.responsavel.nomeDeUsuario || "Responsável",
        principalUsuarioId: principal?.responsavelUsuarioId || null,
        virouPrincipal: aceitar && !principal,
      };
    });
    
    if ("erro" in resultado && typeof resultado.erro === "number") {
      return res.status(resultado.erro).json({
        message: resultado.message,
      });
    }

    const nomeDecisor = await prisma.usuario.findUnique({
      where: { id: usuarioId }, select: { nome: true, nomeDeUsuario: true }
    });
    const decisor = nomeDecisor?.nome || nomeDecisor?.nomeDeUsuario ||
      (ator === "ATLETA" ? "O atleta" : "O responsável principal");
    const acao = decisao === "aceitar" ? "aprovou" : "recusou";
    const destinatarios = [
      {
        id: resultado.responsavelUsuarioId,
        link: "/perfil?papel=Responsavel",
        mensagem: `${decisor} ${acao} seu pedido para ser responsável por ${resultado.nomeAtleta}.`,
      },
      {
        id: resultado.atletaUsuarioId,
        link: "/perfil?papel=Atleta&aba=responsaveis",
        mensagem: `${decisor} ${acao} o pedido de ${resultado.nomeSolicitante} para ser seu responsável.`,
      },
      ...(resultado.principalUsuarioId ? [{
        id: resultado.principalUsuarioId,
        link: "/perfil?papel=Responsavel",
        mensagem: `${decisor} ${acao} o pedido de ${resultado.nomeSolicitante} para ser responsável por ${resultado.nomeAtleta}.`,
      }] : []),
    ];
    // Não criar notificação para o ator sobre sua própria decisão.
    await Promise.allSettled(destinatarios.filter(d => d.id !== usuarioId).map(d =>
      criarNotificacaoEEnviarPush({
        usuarioId: d.id,
        actorId: usuarioId,
        tipo: "RESPONSAVEL_SOLICITACAO",
        titulo: decisao === "aceitar" ? "Vínculo aprovado" : "Vínculo recusado",
        mensagem: d.mensagem,
        link: d.link,
      })
    ));
    return res.json({ ok: true, decisao, virouPrincipal: resultado.virouPrincipal });
  } catch (error) {
    console.error("[Responsaveis] Erro ao decidir pedido:", error);
    return res.status(500).json({ message: "Não foi possível responder à solicitação." });
  }
}

export async function aceitarNovoResponsavel(req: AuthRequest, res: Response) {
  return decidirNovoResponsavel(req, res, "aceitar", "PRINCIPAL");
}
export async function recusarNovoResponsavel(req: AuthRequest, res: Response) {
  return decidirNovoResponsavel(req, res, "recusar", "PRINCIPAL");
}
export async function aceitarNovoResponsavelComoAtleta(req: AuthRequest, res: Response) {
  return decidirNovoResponsavel(req, res, "aceitar", "ATLETA");
}
export async function recusarNovoResponsavelComoAtleta(req: AuthRequest, res: Response) {
  return decidirNovoResponsavel(req, res, "recusar", "ATLETA");
}

export async function redefinirSenhaAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelUsuarioId) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    const senhaNova =
      String(
        req.body?.senhaNova ??
        ""
      );

    const confirm =
      String(
        req.body?.confirm ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    if (
      senhaNova.length < 8
    ) {
      return res
        .status(400)
        .json({
          message:
            "A nova senha deve ter pelo menos 8 caracteres.",
        });
    }

    const resultado =
      await validarAcaoSensivelResponsavel(
        responsavelUsuarioId,
        atletaId,
        res
      );

    if (!resultado) {
      return;
    }

    const {
      vinculo,
    } = resultado;

    if (
      vinculo.atleta.usuario
        .deletedAt
    ) {
      return res
        .status(409)
        .json({
          code:
            "ACCOUNT_DELETED",

          message:
            "A conta está na lixeira. Restaure-a antes de alterar a senha.",
        });
    }

    const username =
      String(
        vinculo.atleta
          .usuario
          .nomeDeUsuario ??
        ""
      ).trim();

    if (
      !username ||
      confirm !== username
    ) {
      return res
        .status(400)
        .json({
          code:
            "INVALID_SECURITY_CONFIRMATION",

          message:
            `Digite exatamente "${username}" para confirmar.`,
        });
    }

    const senhaHash =
      await bcrypt.hash(
        senhaNova,
        10
      );

    const providerAtual =
      vinculo.atleta
        .usuario
        .authProvider;

    const novoProvider =
      providerAtual ===
      AuthProvider.GOOGLE
        ? AuthProvider.LOCAL_GOOGLE
        : providerAtual;

    const agora =
      new Date();

    await prisma.usuario.update({
      where: {
        id:
          vinculo.atleta
            .usuarioId,
      },

      data: {
        senhaHash,

        localLoginEnabled:
          true,

        authProvider:
          novoProvider,

        tokenVersion: {
          increment:
            1,
        },

        lastLogoutAt:
          agora,

        lastSeenAt:
          agora,
      },
    });

    await prisma.passwordReset.deleteMany({
      where: {
        usuarioId:
          vinculo.atleta
            .usuarioId,

        usedAt:
          null,
      },
    });

    await audit(
      req,
      {
        acao:
          "RESPONSAVEL_REDEFINIU_SENHA_ATLETA",

        entidade:
          "Usuario",

        entidadeId:
          vinculo.atleta
            .usuarioId,

        descricao:
          "Responsável principal redefiniu a senha de um atleta supervisionado.",

        meta: {
          atletaId,
          vinculoId:
            vinculo.id,
        },
      }
    );

    return res.json({
      ok: true,

      message:
        "Senha redefinida com sucesso. Todas as sessões do atleta foram encerradas.",
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao redefinir senha:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível redefinir a senha do atleta.",
      });
  }
}

export async function encerrarSessoesAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelUsuarioId) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    const resultado =
      await validarAcaoSensivelResponsavel(
        responsavelUsuarioId,
        atletaId,
        res
      );

    if (!resultado) {
      return;
    }

    const {
      vinculo,
    } = resultado;

    if (
      vinculo.atleta.usuario
        .deletedAt
    ) {
      return res
        .status(409)
        .json({
          code:
            "ACCOUNT_DELETED",

          message:
            "Esta conta já está na lixeira.",
        });
    }

    const agora =
      new Date();

    await prisma.usuario.update({
      where: {
        id:
          vinculo.atleta
            .usuarioId,
      },

      data: {
        tokenVersion: {
          increment:
            1,
        },

        lastLogoutAt:
          agora,

        lastSeenAt:
          agora,
      },
    });

    await audit(
      req,
      {
        acao:
          "RESPONSAVEL_ENCERROU_SESSOES_ATLETA",

        entidade:
          "Usuario",

        entidadeId:
          vinculo.atleta
            .usuarioId,

        descricao:
          "Responsável principal encerrou todas as sessões do atleta supervisionado.",

        meta: {
          atletaId,
          vinculoId:
            vinculo.id,
        },
      }
    );

    return res.json({
      ok: true,

      message:
        "Todas as sessões do atleta foram encerradas.",
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao encerrar sessões:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível encerrar as sessões do atleta.",
      });
  }
}

export async function desvincularGoogleAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelUsuarioId) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    const confirm =
      String(
        req.body?.confirm ??
        ""
      ).trim();

    const resultado =
      await validarAcaoSensivelResponsavel(
        responsavelUsuarioId,
        atletaId,
        res
      );

    if (!resultado) {
      return;
    }

    const {
      vinculo,
    } = resultado;

    const usuario =
      vinculo.atleta.usuario;

    if (usuario.deletedAt) {
      return res
        .status(409)
        .json({
          code:
            "ACCOUNT_DELETED",

          message:
            "A conta está na lixeira.",
        });
    }

    if (!usuario.googleSub) {
      return res
        .status(400)
        .json({
          code:
            "GOOGLE_NOT_LINKED",

          message:
            "A conta deste atleta não está vinculada ao Google.",
        });
    }

    /*
     * Não deixa o responsável remover
     * o único método de autenticação.
     */
    if (
      !usuario.localLoginEnabled
    ) {
      return res
        .status(409)
        .json({
          code:
            "LAST_AUTH_METHOD",

          message:
            "Defina primeiro uma senha FootEra para o atleta antes de remover o Google.",
        });
    }

    const username =
      String(
        usuario.nomeDeUsuario ??
        ""
      ).trim();

    if (
      !username ||
      confirm !== username
    ) {
      return res
        .status(400)
        .json({
          code:
            "INVALID_SECURITY_CONFIRMATION",

          message:
            `Digite exatamente "${username}" para confirmar.`,
        });
    }

    const agora =
      new Date();

    await prisma.usuario.update({
      where: {
        id:
          vinculo.atleta
            .usuarioId,
      },

      data: {
        googleSub:
          null,

        googleEmail:
          null,

        googlePicture:
          null,

        googleLinkedAt:
          null,

        authProvider:
          AuthProvider.LOCAL,

        tokenVersion: {
          increment:
            1,
        },

        lastLogoutAt:
          agora,

        lastSeenAt:
          agora,
      },
    });

    await audit(
      req,
      {
        acao:
          "RESPONSAVEL_DESVINCULOU_GOOGLE_ATLETA",

        entidade:
          "Usuario",

        entidadeId:
          vinculo.atleta
            .usuarioId,

        descricao:
          "Responsável principal desvinculou o Google da conta do atleta supervisionado.",

        meta: {
          atletaId,
          vinculoId:
            vinculo.id,
        },
      }
    );

    return res.json({
      ok: true,

      message:
        "Conta Google desvinculada. As sessões do atleta foram encerradas.",
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao desvincular Google:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível desvincular a conta Google.",
      });
  }
}

export async function restaurarContaAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelUsuarioId) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    const confirm =
      String(
        req.body?.confirm ??
        ""
      ).trim();

    const resultado =
      await validarAcaoSensivelResponsavel(
        responsavelUsuarioId,
        atletaId,
        res
      );

    if (!resultado) {
      return;
    }

    const {
      vinculo,
    } = resultado;

    const usuario =
      vinculo.atleta.usuario;

    if (!usuario.deletedAt) {
      return res
        .status(409)
        .json({
          code:
            "ACCOUNT_NOT_DELETED",

          message:
            "Esta conta não está na lixeira.",
        });
    }

    const agora =
      new Date();

    const limite =
      usuario.deleteScheduledAt
        ? new Date(
            usuario.deleteScheduledAt
          )
        : new Date(
            new Date(
              usuario.deletedAt
            ).getTime() +
              30 *
                24 *
                60 *
                60 *
                1000
          );

    if (
      limite.getTime() <=
      agora.getTime()
    ) {
      return res
        .status(410)
        .json({
          code:
            "RESTORE_EXPIRED",

          message:
            "O prazo de recuperação desta conta expirou.",
        });
    }

    const username =
      String(
        usuario.nomeDeUsuario ??
        ""
      ).trim();

    if (
      !username ||
      confirm !== username
    ) {
      return res
        .status(400)
        .json({
          code:
            "INVALID_SECURITY_CONFIRMATION",

          message:
            `Digite exatamente "${username}" para confirmar.`,
        });
    }

    await prisma.usuario.update({
      where: {
        id:
          vinculo.atleta
            .usuarioId,
      },

      data: {
        deletedAt:
          null,

        deleteScheduledAt:
          null,

        tokenVersion: {
          increment:
            1,
        },

        lastLogoutAt:
          null,
      },
    });

    await audit(
      req,
      {
        acao:
          "RESPONSAVEL_RESTAUROU_CONTA_ATLETA",

        entidade:
          "Usuario",

        entidadeId:
          vinculo.atleta
            .usuarioId,

        descricao:
          "Responsável principal restaurou a conta do atleta supervisionado.",

        meta: {
          atletaId,
          vinculoId:
            vinculo.id,
        },
      }
    );

    return res.json({
      ok: true,

      message:
        "Conta do atleta restaurada com sucesso.",
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao restaurar conta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível restaurar a conta do atleta.",
      });
  }
}

export async function listarMeusResponsaveisComoAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const atletaUsuarioId =
      await exigirAtleta(
        req,
        res
      );

    if (!atletaUsuarioId) {
      return;
    }

    const atleta =
      await prisma.atleta.findFirst({
        where: {
          usuarioId:
            atletaUsuarioId,
        },

        select: {
          id: true,
          idade: true,

          usuario: {
            select: {
              dataNascimento:
                true,
            },
          },

          responsaveis: {
            where: {
              status: {
                in: [
                  StatusResponsavelAtleta.ATIVO,
                  StatusResponsavelAtleta.PENDENTE,
                ],
              },
            },

            orderBy: [
              {
                principal:
                  "desc",
              },
              {
                criadoEm:
                  "asc",
              },
            ],

            select: {
              id: true,
              status: true,
              principal: true,
              parentesco: true,
              podeEditarPerfil: true,
              podeGerenciarPrivacidade: true,
              podeGerenciarTreinos: true,
              podeGerenciarConteudo: true,

              origemSolicitacao:
                true,

              criadoEm:
                true,

              responsavel: {
                select: {
                  id: true,
                  nome: true,
                  nomeDeUsuario:
                    true,
                  foto: true,
                },
              },
            },
          },
        },
      });

    if (!atleta) {
      return res
        .status(404)
        .json({
          message:
            "Perfil de atleta não encontrado.",
        });
    }

    const idade =
      calcularIdade(
        atleta.usuario
          .dataNascimento
      ) ??
      atleta.idade ??
      null;

    return res.json({
      idade,

      supervisionado:
        idade !== null &&
        idade < 12,

      podeDesvincularResponsaveis:
        idade !== null &&
        idade >= 12,
      podeResponderSolicitacoes:
        idade !== null &&
        idade >= 12,

      items:
        atleta.responsaveis,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao listar responsáveis do atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível carregar seus responsáveis.",
      });
  }
}

export async function desvincularResponsavelComoAtleta(
  req: AuthRequest,
  res: Response
) {
  try {
    const atletaUsuarioId =
      await exigirAtleta(
        req,
        res
      );

    if (!atletaUsuarioId) {
      return;
    }

    const vinculoId =
      String(
        req.params
          .vinculoId ??
        ""
      ).trim();

    if (!vinculoId) {
      return res
        .status(400)
        .json({
          message:
            "Vínculo inválido.",
        });
    }

    const atleta =
      await prisma.atleta.findFirst({
        where: {
          usuarioId:
            atletaUsuarioId,
        },

        select: {
          id: true,
          idade: true,

          usuario: {
            select: {
              dataNascimento:
                true,
            },
          },
        },
      });

    if (!atleta) {
      return res
        .status(404)
        .json({
          message:
            "Perfil de atleta não encontrado.",
        });
    }

    const idade =
      calcularIdade(
        atleta.usuario
          .dataNascimento
      ) ??
      atleta.idade ??
      null;

    if (idade === null) {
      return res
        .status(409)
        .json({
          code:
            "ATLETA_AGE_UNKNOWN",

          message:
            "Não foi possível determinar sua idade.",
        });
    }

    const vinculo =
      await prisma.responsavelAtleta.findFirst({
        where: {
          id:
            vinculoId,

          atletaId:
            atleta.id,
        },

        select: {
          id: true,
          status: true,
          principal: true,
          responsavelUsuarioId:
            true,
        },
      });

    if (!vinculo) {
      return res
        .status(404)
        .json({
          code:
            "RESPONSAVEL_LINK_NOT_FOUND",

          message:
            "Vínculo de responsável não encontrado.",
        });
    }
    
    if (
      vinculo.status === StatusResponsavelAtleta.REVOGADO
    ) {
      return res.status(409).json({
        code: "RESPONSAVEL_LINK_ALREADY_REVOKED",
        message:
          "Este vínculo de responsável já foi encerrado.",
      });
    }

    if (
      idade < 12 &&
      vinculo.status ===
        StatusResponsavelAtleta.ATIVO
    ) {
      return res
        .status(403)
        .json({
          code:
            "GUARDIAN_UNLINK_FORBIDDEN_FOR_MINOR",

          message:
            "Enquanto sua conta for supervisionada, um responsável ativo não pode ser removido por você.",
        });
    }

    /*
     * Aos 12 anos ou mais,
     * o atleta passa a ter autonomia
     * e pode remover qualquer vínculo,
     * inclusive o principal.
     */
    const agora =
      new Date();

    const atualizado =
      await prisma.responsavelAtleta.update({
        where: {
          id:
            vinculo.id,
        },

        data: {
          status:
            StatusResponsavelAtleta.REVOGADO,

          principal:
            false,

          revogadoEm:
            agora,
        },

        select: {
          id: true,
          status: true,
          principal: true,
          revogadoEm: true,
        },
      });

    await audit(
      req,
      {
        acao:
          "ATLETA_DESVINCULOU_RESPONSAVEL",

        entidade:
          "ResponsavelAtleta",

        entidadeId:
          vinculo.id,

        descricao:
          "Atleta removeu um vínculo de responsável.",

        meta: {
          atletaId:
            atleta.id,

          responsavelUsuarioId:
            vinculo
              .responsavelUsuarioId,

          eraPrincipal:
            vinculo.principal,

          idade,
        },
      }
    );

    try {
      const usuarioAtleta = await prisma.usuario.findUnique({
        where: {
          id: atletaUsuarioId,
        },
        select: {
          nome: true,
          nomeDeUsuario: true,
        },
      });

      const nomeAtleta =
        usuarioAtleta?.nome ||
        usuarioAtleta?.nomeDeUsuario ||
        "O atleta";
      await criarNotificacaoEEnviarPush({
        usuarioId:
          vinculo
            .responsavelUsuarioId,

        actorId:
          atletaUsuarioId,

        tipo:
          "RESPONSAVEL_VINCULO",

        titulo:
          "Vínculo encerrado",

        mensagem:
          `${nomeAtleta} encerrou o vínculo de responsabilidade com sua conta.`,

        link: "/perfil?papel=Responsavel",
      });
    } catch (
      notificationError
    ) {
      console.warn(
        "[Responsaveis] Não foi possível notificar o desvínculo:",
        notificationError
      );
    }

    return res.json({
      ok: true,

      message:
        "Responsável desvinculado com sucesso.",

      vinculo:
        atualizado,
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao desvincular responsável:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível desvincular o responsável.",
      });
  }
}

export async function desvincularMeuAtletaComoResponsavel(
  req: AuthRequest,
  res: Response
) {
  try {
    const responsavelUsuarioId =
      await exigirResponsavel(
        req,
        res
      );

    if (!responsavelUsuarioId) {
      return;
    }

    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    const novoPrincipalVinculoId =
      String(
        req.body
          ?.novoPrincipalVinculoId ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "Atleta inválido.",
        });
    }

    const vinculoAtual =
      await prisma.responsavelAtleta.findUnique({
        where: {
          responsavelUsuarioId_atletaId: {
            responsavelUsuarioId,
            atletaId,
          },
        },

        select: {
          id:
            true,

          status:
            true,

          principal:
            true,

          responsavelUsuarioId:
            true,
        },
      });

    if (
      !vinculoAtual ||
      vinculoAtual.status !==
        StatusResponsavelAtleta.ATIVO
    ) {
      return res
        .status(404)
        .json({
          code:
            "RESPONSAVEL_LINK_NOT_FOUND",

          message:
            "Você não possui vínculo ativo com este atleta.",
        });
    }
        
    const atletaVinculado =
      await prisma.atleta.findUnique({
        where: {
          id: atletaId,
        },
        select: {
          usuarioId: true,
        },
      });

    if (!atletaVinculado) {
      return res.status(404).json({
        code: "ATLETA_NOT_FOUND",
        message: "Atleta não encontrado.",
      });
    }

    const atletaUsuarioId =
      atletaVinculado.usuarioId;

    const outrosResponsaveis =
      await prisma.responsavelAtleta.findMany({
        where: {
          atletaId,

          status:
            StatusResponsavelAtleta.ATIVO,

          id: {
            not:
              vinculoAtual.id,
          },
        },

        orderBy: {
          criadoEm:
            "asc",
        },

        select: {
          id:
            true,

          responsavelUsuarioId:
            true,

          parentesco:
            true,

          responsavel: {
            select: {
              id:
                true,

              nome:
                true,

              nomeDeUsuario:
                true,

              foto:
                true,
            },
          },
        },
      });

    /*
     * Secundário:
     * pode sair diretamente.
     */
    if (
      vinculoAtual.principal !==
      true
    ) {
      const atualizado =
        await prisma.responsavelAtleta.update({
          where: {
            id:
              vinculoAtual.id,
          },

          data: {
            status:
              StatusResponsavelAtleta.REVOGADO,

            principal:
              false,

            revogadoEm:
              new Date(),
          },
        });

      await audit(
        req,
        {
          acao:
            "RESPONSAVEL_DESVINCULOU_ATLETA",

          entidade:
            "ResponsavelAtleta",

          entidadeId:
            vinculoAtual.id,

          descricao:
            "Responsável secundário encerrou o próprio vínculo com o atleta.",

          meta: {
            atletaId,

            eraPrincipal:
              false,
          },
        }
      );
      
      await notificarDesvinculoResponsavel(
        atletaUsuarioId,
        responsavelUsuarioId
      );

      return res.json({
        ok:
          true,

        message:
          "Vínculo removido com sucesso.",

        vinculo:
          atualizado,
      });
    }

    /*
     * Principal sem outros responsáveis:
     * pode sair e o atleta fica sem principal.
     */
    if (
      outrosResponsaveis.length ===
      0
    ) {
      const atualizado =
        await prisma.responsavelAtleta.update({
          where: {
            id:
              vinculoAtual.id,
          },

          data: {
            status:
              StatusResponsavelAtleta.REVOGADO,

            principal:
              false,

            revogadoEm:
              new Date(),
          },
        });

      await audit(
        req,
        {
          acao:
            "RESPONSAVEL_PRINCIPAL_DESVINCULOU_ATLETA",

          entidade:
            "ResponsavelAtleta",

          entidadeId:
            vinculoAtual.id,

          descricao:
            "Responsável principal encerrou o vínculo e não havia outro responsável ativo.",

          meta: {
            atletaId,

            novoPrincipalVinculoId:
              null,
          },
        }
      );

      await notificarDesvinculoResponsavel(
        atletaUsuarioId,
        responsavelUsuarioId
      );

      return res.json({
        ok:
          true,

        message:
          "Vínculo removido com sucesso.",

        semResponsavel:
          true,
      });
    }

    /*
     * Principal com apenas um sucessor:
     * promoção automática.
     */
    if (
      outrosResponsaveis.length ===
      1
    ) {
      const novoPrincipal =
        outrosResponsaveis[0];

      await prisma.$transaction([
        prisma.responsavelAtleta.update({
          where: {
            id:
              vinculoAtual.id,
          },

          data: {
            status:
              StatusResponsavelAtleta.REVOGADO,

            principal:
              false,

            revogadoEm:
              new Date(),
          },
        }),

        prisma.responsavelAtleta.update({
          where: {
            id:
              novoPrincipal.id,
          },

          data: {
            principal:
              true,
          },
        }),
      ]);

      await audit(
        req,
        {
          acao:
            "RESPONSAVEL_PRINCIPAL_TRANSFERIDO",

          entidade:
            "ResponsavelAtleta",

          entidadeId:
            vinculoAtual.id,

          descricao:
            "Responsável principal saiu e o único responsável restante foi promovido.",

          meta: {
            atletaId,

            novoPrincipalVinculoId:
              novoPrincipal.id,

            novoPrincipalUsuarioId:
              novoPrincipal
                .responsavelUsuarioId,
          },
        }
      );
      
      await notificarDesvinculoResponsavel(
        atletaUsuarioId,
        responsavelUsuarioId,
        novoPrincipal.responsavelUsuarioId
      );

      return res.json({
        ok:
          true,

        message:
          "Vínculo removido e novo responsável principal definido.",

        novoPrincipal: {
          vinculoId:
            novoPrincipal.id,

          usuarioId:
            novoPrincipal
              .responsavelUsuarioId,
        },
      });
    }

    /*
     * Principal com vários possíveis sucessores:
     * precisa escolher.
     */
    if (
      !novoPrincipalVinculoId
    ) {
      return res
        .status(409)
        .json({
          code:
            "NEW_PRIMARY_GUARDIAN_REQUIRED",

          message:
            "Escolha qual responsável será o novo principal antes de se desvincular.",

          opcoes:
            outrosResponsaveis,
        });
    }

    const novoPrincipal =
      outrosResponsaveis.find(
        (item) =>
          item.id ===
          novoPrincipalVinculoId
      );

    if (!novoPrincipal) {
      return res
        .status(400)
        .json({
          code:
            "INVALID_NEW_PRIMARY_GUARDIAN",

          message:
            "O responsável escolhido não pode ser definido como principal.",
        });
    }

    await prisma.$transaction([
      prisma.responsavelAtleta.update({
        where: {
          id:
            vinculoAtual.id,
        },

        data: {
          status:
            StatusResponsavelAtleta.REVOGADO,

          principal:
            false,

          revogadoEm:
            new Date(),
        },
      }),

      prisma.responsavelAtleta.update({
        where: {
          id:
            novoPrincipal.id,
        },

        data: {
          principal:
            true,
        },
      }),
    ]);

    await audit(
      req,
      {
        acao:
          "RESPONSAVEL_PRINCIPAL_TRANSFERIDO",

        entidade:
          "ResponsavelAtleta",

        entidadeId:
          vinculoAtual.id,

        descricao:
          "Responsável principal escolheu um sucessor e encerrou o próprio vínculo.",

        meta: {
          atletaId,

          novoPrincipalVinculoId:
            novoPrincipal.id,

          novoPrincipalUsuarioId:
            novoPrincipal
              .responsavelUsuarioId,
        },
      }
    );
    
    await notificarDesvinculoResponsavel(
      atletaUsuarioId,
      responsavelUsuarioId,
      novoPrincipal.responsavelUsuarioId
    );

    return res.json({
      ok:
        true,

      message:
        "Vínculo removido e novo responsável principal definido.",

      novoPrincipal: {
        vinculoId:
          novoPrincipal.id,

        usuarioId:
          novoPrincipal
            .responsavelUsuarioId,
      },
    });
  } catch (error) {
    console.error(
      "[Responsaveis] Erro ao desvincular atleta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível remover o vínculo.",
      });
  }
}

// Validação de ID para a prévia do formulário "Solicitar responsável".
export async function consultarResponsavelPorId(req: AuthRequest, res: Response) {
  try {
    const usuarioId = getUsuarioId(req, res);
    if (!usuarioId) return;
    const id = String(req.params.usuarioId ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }
    const usuario = await prisma.usuario.findFirst({
      where: {
        id, deletedAt: null,
        papeis: { some: { papel: TipoUsuario.Responsavel, status: StatusUsuarioPapel.ATIVO } },
      },
      select: { id: true, nome: true, nomeDeUsuario: true, foto: true },
    });
    if (!usuario) return res.status(404).json({ message: "Responsável não encontrado." });
    return res.json({ usuario });
  } catch (error) {
    console.error("[Responsaveis] consulta:", error);
    return res.status(500).json({ message: "Não foi possível consultar o responsável." });
  }
}

const RELACOES_RESPONSAVEL = ["Mãe", "Pai", "Responsável legal", "Avó", "Avô", "Outro"] as const;
export async function atualizarParentescoComoAtleta(req: AuthRequest, res: Response) {
  try {
    const usuarioId = await exigirAtleta(req, res);
    if (!usuarioId) return;
    const vinculoId = String(req.params.vinculoId ?? "").trim();
    const valor = req.body?.parentesco;
    if (valor !== null && !RELACOES_RESPONSAVEL.includes(valor)) {
      return res.status(400).json({ message: "Relação com o atleta inválida." });
    }
    const vinculo = await prisma.responsavelAtleta.findFirst({
      where: { id: vinculoId, status: StatusResponsavelAtleta.ATIVO, atleta: { usuarioId } },
      select: { id: true },
    });
    if (!vinculo) return res.status(404).json({ message: "Vínculo ativo não encontrado." });
    const atualizado = await prisma.responsavelAtleta.update({
      where: { id: vinculo.id }, data: { parentesco: valor }, select: { id: true, parentesco: true },
    });
    return res.json({ ok: true, vinculo: atualizado });
  } catch (error) {
    console.error("[Responsaveis] parentesco:", error);
    return res.status(500).json({ message: "Não foi possível alterar a relação com o atleta." });
  }
}

/** Responsável principal encerra vínculo de um responsável secundário. */
export async function desvincularResponsavelSecundarioComoPrincipal(
  req: AuthRequest,
  res: Response
) {
  try {
    const principalUsuarioId = await exigirResponsavel(req, res);
    if (!principalUsuarioId) return;
    const atletaId = String(req.params.atletaId ?? "").trim();
    const vinculoId = String(req.params.vinculoId ?? "").trim();
    if (!atletaId || !vinculoId) {
      return res.status(400).json({ message: "Dados do vínculo inválidos." });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${atletaId}))::text`;
      const principal = await tx.responsavelAtleta.findFirst({
        where: {
          atletaId,
          responsavelUsuarioId: principalUsuarioId,
          status: StatusResponsavelAtleta.ATIVO,
          principal: true,
        },
        select: { id: true },
      });
      if (!principal) return { erro: 403, message: "Somente o responsável principal ativo pode desvincular um secundário." } as const;

      const secundario = await tx.responsavelAtleta.findFirst({
        where: {
          id: vinculoId,
          atletaId,
          status: StatusResponsavelAtleta.ATIVO,
          principal: false,
        },
        select: {
          id: true,
          responsavelUsuarioId: true,
          responsavel: { select: { nome: true, nomeDeUsuario: true } },
          atleta: { select: { usuarioId: true, usuario: { select: { nome: true, nomeDeUsuario: true } } } },
        },
      });
      if (!secundario) return { erro: 404, message: "Responsável secundário ativo não encontrado." } as const;
      const alteracao = await tx.responsavelAtleta.updateMany({
        where: { id: secundario.id, status: StatusResponsavelAtleta.ATIVO, principal: false },
        data: { status: StatusResponsavelAtleta.REVOGADO, principal: false, revogadoEm: new Date() },
      });
      if (alteracao.count !== 1) return { erro: 409, message: "Este vínculo já foi alterado." } as const;
      return {
        ok: true as const,
        atletaUsuarioId: secundario.atleta.usuarioId,
        nomeAtleta: secundario.atleta.usuario.nome || secundario.atleta.usuario.nomeDeUsuario || "O atleta",
        secundarioUsuarioId: secundario.responsavelUsuarioId,
        nomeSecundario: secundario.responsavel.nome || secundario.responsavel.nomeDeUsuario || "O responsável",
      };
    });
    if ("erro" in resultado && typeof resultado.erro === "number") {
      return res.status(resultado.erro).json({ message: resultado.message });
    }
    if (!("ok" in resultado)) return res.status(409).json({ message: "Não foi possível encerrar o vínculo." });

    const principal = await prisma.usuario.findUnique({
      where: { id: principalUsuarioId }, select: { nome: true, nomeDeUsuario: true },
    }).catch(() => null);
    const nomePrincipal = principal?.nome || principal?.nomeDeUsuario || "O responsável principal";
    await Promise.allSettled([
      criarNotificacaoEEnviarPush({
        usuarioId: resultado.atletaUsuarioId,
        actorId: principalUsuarioId,
        tipo: "RESPONSAVEL_VINCULO",
        titulo: "Responsável desvinculado",
        mensagem: `${nomePrincipal} encerrou o vínculo de ${resultado.nomeSecundario} como seu responsável.`,
        link: "/perfil?papel=Atleta&aba=responsaveis",
      }),
      criarNotificacaoEEnviarPush({
        usuarioId: resultado.secundarioUsuarioId,
        actorId: principalUsuarioId,
        tipo: "RESPONSAVEL_VINCULO",
        titulo: "Vínculo encerrado",
        mensagem: `${nomePrincipal} encerrou seu vínculo de responsável com ${resultado.nomeAtleta}.`,
        link: "/perfil?papel=Responsavel",
      }),
    ]);
    return res.json({ ok: true, message: "Responsável secundário desvinculado." });
  } catch (error) {
    console.error("[Responsaveis] Falha ao desvincular secundário:", error);
    return res.status(500).json({ message: "Não foi possível desvincular o responsável secundário." });
  }
}