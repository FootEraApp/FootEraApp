import {
  Request,
  Response,
} from "express";

import {
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  recomputePontuacaoAtleta,
} from "../services/recomputePontuacao.js";

import {
  getActiveContext,
} from "../services/activeContext.js";

type AtletaAtivo = {
  usuarioId: string;
  atletaId: string;
};

async function resolverAtletaAtivo(
  req: Request,
  atletaIdSolicitado?: string
): Promise<AtletaAtivo | null> {
  const usuarioId =
    String(
      (req as any).userId ??
      (req as any).usuarioId ??
      (req as any).user?.id ??
      ""
    ).trim();

  if (!usuarioId) {
    return null;
  }

  const contexto =
    await getActiveContext(
      usuarioId
    );
  
  if (
    contexto?.kind === "PERSONAL" &&
    contexto.tipoUsuario === TipoUsuario.Responsavel &&
    atletaIdSolicitado
  ) {
    const vinculo = await prisma.responsavelAtleta.findFirst({
      where: {
        atletaId: atletaIdSolicitado,
        responsavelUsuarioId: usuarioId,
        status: "ATIVO",
        OR: [
          { principal: true },
          { podeGerenciarTreinos: true },
        ],
      },
      select: {
        atletaId: true,
      },
    });

    if (!vinculo) {
      return null;
    }

    return {
      usuarioId,
      atletaId: vinculo.atletaId,
    };
  }

  /*
   * Treino livre é uma ação
   * pessoal do Atleta.
   *
   * Não usamos:
   * req.user.tipo
   * req.user.tipoUsuarioId
   * atletaId enviado pelo cliente
   */
  if (
    !contexto ||
    contexto.kind !==
      "PERSONAL" ||
    contexto.tipoUsuario !==
      TipoUsuario.Atleta ||
    !contexto.tipoUsuarioId
  ) {
    return null;
  }

  return {
    usuarioId,

    atletaId:
      String(
        contexto.tipoUsuarioId
      ),
  };
}

export const treinosLivresController = {
  async index(
    req: Request,
    res: Response
  ) {
    try {
      
      const atletaIdSolicitado =
        typeof req.query.atletaId === "string"
          ? req.query.atletaId.trim()
          : undefined;

      const atletaAtivo = await resolverAtletaAtivo(
        req,
        atletaIdSolicitado
      );

      if (!atletaAtivo) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Selecione seu perfil de Atleta ou um atleta sob sua responsabilidade com permissão para gerenciar treinos.",
        });
      }

      const {
        tipoAtividade,
        categoria,
      } = req.query as any;

      /*
       * Não usamos mais atletaId
       * vindo da query.
       *
       * O histórico sempre pertence
       * ao Atleta do contexto ativo.
       */
      const where: any = {
        atletaId:
          atletaAtivo.atletaId,

        ...(tipoAtividade
          ? {
              tipoAtividade: {
                equals:
                  String(
                    tipoAtividade
                  ),

                mode:
                  "insensitive",
              },
            }
          : {}),

        ...(categoria
          ? {
              categoria: {
                equals:
                  String(
                    categoria
                  ),

                mode:
                  "insensitive",
              },
            }
          : {}),
      };

      const treinos =
        await prisma
          .treinoLivre
          .findMany({
            where,

            include: {
              atleta:
                true,
            },

            orderBy: {
              data:
                "desc",
            },
          });

      return res.json(
        treinos
      );
    } catch (err) {
      console.error(
        "[treinoLivre:index]",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao listar treinos livres",

        error:
          err,
      });
    }
  },

  async show(
    req: Request,
    res: Response
  ) {
    try {
      const atletaAtivo =
        await resolverAtletaAtivo(
          req
        );

      if (!atletaAtivo) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Use seu perfil de Atleta para acessar este treino livre.",
        });
      }

      const id =
        String(
          req.params.id ??
          ""
        ).trim();

      if (!id) {
        return res.status(400).json({
          message:
            "Treino inválido.",
        });
      }

      const treino =
        await prisma
          .treinoLivre
          .findFirst({
            where: {
              id,

              /*
               * Segurança importante:
               * o treino precisa pertencer
               * ao Atleta ativo.
               */
              atletaId:
                atletaAtivo.atletaId,
            },

            include: {
              atleta:
                true,
            },
          });

      if (!treino) {
        return res.status(404).json({
          message:
            "Treino não encontrado.",
        });
      }

      return res.json(
        treino
      );
    } catch (err) {
      console.error(
        "[treinoLivre:show]",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao buscar treino",

        error:
          err,
      });
    }
  },

  async create(
    req: Request,
    res: Response
  ) {
    try {
      const atletaAtivo = await resolverAtletaAtivo(
        req,
        typeof req.body?.atletaId === "string"
          ? req.body.atletaId.trim()
          : undefined
      );

      if (!atletaAtivo) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Use seu perfil de Atleta para registrar um treino livre.",
        });
      }

      const {
        data,
        descricao,
        duracaoMin,
        tipoAtividade,
        categoria,
      } = req.body as any;

      /*
       * IMPORTANTE:
       *
       * Mesmo se o front legado ainda
       * enviar atletaId no body,
       * ignoramos esse valor.
       */
      const atletaId =
        atletaAtivo.atletaId;

      const atletaExiste =
        await prisma
          .atleta
          .findUnique({
            where: {
              id:
                atletaId,
            },

            select: {
              id:
                true,

              usuarioId:
                true,
            },
          });

      if (!atletaExiste) {
        return res.status(400).json({
          message:
            "Atleta inválido.",
        });
      }

      const contextoAtual = await getActiveContext(
        atletaAtivo.usuarioId
      );

      if (
        contextoAtual?.kind === "PERSONAL" &&
        contextoAtual.tipoUsuario === TipoUsuario.Atleta &&
        atletaExiste.usuarioId !== atletaAtivo.usuarioId
      ) {
        return res.status(403).json({
          code: "ACTIVE_CONTEXT_MISMATCH",
          message:
            "O atleta ativo não pertence à conta autenticada.",
        });
      }

      if (
        !data ||
        !duracaoMin ||
        !String(
          tipoAtividade ??
          descricao ??
          ""
        ).trim()
      ) {
        return res.status(400).json({
          message:
            "Campos obrigatórios: data, duração e atividade/descrição.",
        });
      }

      const dataTreino =
        new Date(data);

      if (
        Number.isNaN(
          dataTreino.getTime()
        )
      ) {
        return res.status(400).json({
          message:
            "Data inválida.",
        });
      }
      
      if (dataTreino.getTime() > Date.now()) {
        return res.status(400).json({
          code: "FUTURE_TRAINING_DATE",
          message:
            "A data do treino livre não pode estar no futuro.",
        });
      }

      const duracao =
        Number(
          duracaoMin
        );

      if (
        !Number.isFinite(
          duracao
        ) ||
        duracao <= 0
      ) {
        return res.status(400).json({
          message:
            "A duração do treino deve ser maior que zero.",
        });
      }

      const file =
        (req as any)
          .file as
          | Express.Multer.File
          | undefined;

      const urlEvidencia =
        file
          ? `/uploads/treinos-livres/${file.filename}`
          : null;

      const novo =
        await prisma
          .treinoLivre
          .create({
            data: {
              atletaId,

              data:
                dataTreino,

              descricao:
                String(
                  descricao ??
                  ""
                ).trim(),

              duracaoMin:
                duracao,

              tipoAtividade:
                tipoAtividade
                  ? String(
                      tipoAtividade
                    )
                  : null,

              categoria:
                categoria
                  ? String(
                      categoria
                    )
                  : null,

              urlEvidencia,
            },
          });

      try {
        await recomputePontuacaoAtleta(
          atletaId
        );
      } catch (e) {
        console.warn(
          "[treinoLivre] falha ao recalcular pontuação:",
          e
        );
      }

      return res
        .status(201)
        .json(
          novo
        );
    } catch (err) {
      console.error(
        "Erro ao criar treino livre:",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao criar treino",

        error:
          err,
      });
    }
  },

  async delete(
    req: Request,
    res: Response
  ) {
    try {
      const atletaAtivo =
        await resolverAtletaAtivo(
          req
        );

      if (!atletaAtivo) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Use seu perfil de Atleta para excluir um treino livre.",
        });
      }

      const id =
        String(
          req.params.id ??
          ""
        ).trim();

      if (!id) {
        return res.status(400).json({
          message:
            "Treino inválido.",
        });
      }

      /*
       * Não fazemos findUnique(id)
       * seguido de delete sem autorização.
       *
       * Primeiro garantimos que pertence
       * ao Atleta ativo.
       */
      const treino =
        await prisma
          .treinoLivre
          .findFirst({
            where: {
              id,

              atletaId:
                atletaAtivo.atletaId,
            },

            select: {
              id:
                true,

              atletaId:
                true,
            },
          });

      if (!treino) {
        return res.status(404).json({
          message:
            "Treino não encontrado.",
        });
      }

      await prisma
        .treinoLivre
        .delete({
          where: {
            id:
              treino.id,
          },
        });

      try {
        await recomputePontuacaoAtleta(
          treino.atletaId
        );
      } catch (e) {
        console.warn(
          "[treinoLivre] falha ao recalcular pontuação após exclusão:",
          e
        );
      }

      return res
        .status(204)
        .send();
    } catch (err) {
      console.error(
        "[treinoLivre:delete]",
        err
      );

      return res.status(500).json({
        message:
          "Erro ao deletar treino",

        error:
          err,
      });
    }
  },
};