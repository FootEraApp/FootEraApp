
import { Request, Response } from "express";
import { TipoUsuario } from "@prisma/client";
import { prisma } from "../prisma.js";
import {
  verificarPermissaoResponsavelAtleta,
} from "../services/responsavelPermissoes.service.js";
import {
  recomputePontuacaoAtleta,
} from "../services/recomputePontuacao.js";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  executarComLimiteDiarioTreinos,
  registrarRealizacaoDiaria,
  respostaErroLimiteDiario,
} from "../services/limiteDiarioTreinos.service.js";

type AtletaAtivo = {
  usuarioId: string;
  atletaId: string;
};

/**
 * Identifica o atleta da operação.
 *
 * Pode ser:
 * - O próprio atleta autenticado;
 * - Um atleta gerenciado por responsável.
 *
 * A autorização do responsável continua
 * sendo feita pelo serviço existente.
 */
async function resolverAtletaAtivo(
  req: Request,
  atletaIdSolicitado?: string
): Promise<AtletaAtivo | null> {
  const usuarioId = String(
    (req as any).userId ??
    (req as any).usuarioId ??
    (req as any).user?.id ??
    ""
  ).trim();

  if (!usuarioId) {
    return null;
  }

  const contexto = await getActiveContext(usuarioId);

  if (
    contexto?.kind === "PERSONAL" &&
    contexto.tipoUsuario === TipoUsuario.Responsavel &&
    atletaIdSolicitado
  ) {
    const autorizado =
      await verificarPermissaoResponsavelAtleta({
        responsavelUsuarioId: usuarioId,
        atletaId: atletaIdSolicitado,
        permissao: "podeGerenciarTreinos",
      });

    if (!autorizado) {
      return null;
    }

    return {
      usuarioId,
      atletaId: atletaIdSolicitado,
    };
  }

  if (
    !contexto ||
    contexto.kind !== "PERSONAL" ||
    contexto.tipoUsuario !== TipoUsuario.Atleta ||
    !contexto.tipoUsuarioId
  ) {
    return null;
  }

  return {
    usuarioId,
    atletaId: String(contexto.tipoUsuarioId),
  };
}

export const treinosLivresController = {
  /**
   * GET /api/treinos-livres
   *
   * Lista o histórico do atleta selecionado.
   */
  async index(req: Request, res: Response) {
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
          code: "ACTIVE_CONTEXT_MISMATCH",
          message:
            "Selecione seu perfil de Atleta ou um atleta sob sua responsabilidade com permissão para gerenciar treinos.",
        });
      }

      const { tipoAtividade, categoria } =
        req.query as any;

      const where: any = {
        atletaId: atletaAtivo.atletaId,

        ...(tipoAtividade
          ? {
              tipoAtividade: {
                equals: String(tipoAtividade),
                mode: "insensitive",
              },
            }
          : {}),

        ...(categoria
          ? {
              categoria: {
                equals: String(categoria),
                mode: "insensitive",
              },
            }
          : {}),
      };

      const treinos = await prisma.treinoLivre.findMany({
        where,

        include: {
          atleta: true,
        },

        orderBy: {
          data: "desc",
        },
      });

      return res.json(treinos);
    } catch (error) {
      console.error(
        "[treinoLivre:index]",
        error
      );

      return res.status(500).json({
        message: "Erro ao listar treinos livres",
      });
    }
  },

  /**
   * GET /api/treinos-livres/:id
   *
   * Consulta um treino livre específico.
   */
  async show(req: Request, res: Response) {
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
          code: "ACTIVE_CONTEXT_MISMATCH",
          message:
            "Use seu perfil de Atleta para acessar este treino livre.",
        });
      }

      const id = String(
        req.params.id ?? ""
      ).trim();

      if (!id) {
        return res.status(400).json({
          message: "Treino inválido.",
        });
      }

      const treino = await prisma.treinoLivre.findFirst({
        where: {
          id,
          atletaId: atletaAtivo.atletaId,
        },

        include: {
          atleta: true,
        },
      });

      if (!treino) {
        return res.status(404).json({
          message: "Treino não encontrado.",
        });
      }

      return res.json(treino);
    } catch (error) {
      console.error(
        "[treinoLivre:show]",
        error
      );

      return res.status(500).json({
        message: "Erro ao buscar treino",
      });
    }
  },

  /**
   * POST /api/treinos-livres
   *
   * Registra um treino livre com limite diário.
   *
   * O limite pertence ao atleta, nunca
   * ao responsável que registra o treino.
   */
  async create(req: Request, res: Response) {
    try {
      const atletaAtivo = await resolverAtletaAtivo(
        req,
        typeof req.body?.atletaId === "string"
          ? req.body.atletaId.trim()
          : undefined
      );

      if (!atletaAtivo) {
        return res.status(403).json({
          code: "ACTIVE_CONTEXT_MISMATCH",
          message:
            "Selecione seu perfil de Atleta ou um atleta autorizado para registrar treinos.",
        });
      }

      const {
        data,
        descricao,
        duracaoMin,
        tipoAtividade,
        categoria,
      } = req.body as any;

      /**
       * O atletaId sempre vem do
       * contexto validado pelo backend.
       */
      const atletaId = atletaAtivo.atletaId;

      const atletaExiste = await prisma.atleta.findUnique({
        where: {
          id: atletaId,
        },

        select: {
          id: true,
          usuarioId: true,
        },
      });

      if (!atletaExiste) {
        return res.status(400).json({
          message: "Atleta inválido.",
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

      const dataTreino = new Date(data);

      if (Number.isNaN(dataTreino.getTime())) {
        return res.status(400).json({
          message: "Data inválida.",
        });
      }

      /**
       * Um treino livre precisa ter sido
       * realizado na data informada.
       */
      if (dataTreino.getTime() > Date.now()) {
        return res.status(400).json({
          code: "FUTURE_TRAINING_DATE",
          message:
            "A data do treino livre não pode estar no futuro.",
        });
      }

      const duracao = Number(duracaoMin);

      if (
        !Number.isFinite(duracao) ||
        duracao <= 0
      ) {
        return res.status(400).json({
          message:
            "A duração do treino deve ser maior que zero.",
        });
      }

      const file =
        (req as any).file as
          | Express.Multer.File
          | undefined;

      const urlEvidencia = file
        ? `/uploads/treinos-livres/${file.filename}`
        : null;

      /**
       * NOVA REGRA:
       *
       * Confere a cota diária e grava o
       * treino livre na mesma transação.
       *
       * O serviço identifica se o atleta
       * possui PRO ou Learning.
       */
      const novo = await executarComLimiteDiarioTreinos({
        atletaId,
        data: dataTreino,

      gravar: async (tx) => {
        const novo = await tx.treinoLivre.create({
          data: {
            atletaId,
            data: dataTreino,
            descricao: String(descricao ?? "").trim(),
            duracaoMin: duracao,
            tipoAtividade: tipoAtividade
              ? String(tipoAtividade)
              : null,
            categoria: categoria
              ? String(categoria)
              : null,
            urlEvidencia,
          },
        });

        await registrarRealizacaoDiaria(tx, {
          atletaId,
          origem: "LIVRE",
          origemId: novo.id,
          realizadoEm: dataTreino,
        });

        return novo;
      },
      });

      try {
        await recomputePontuacaoAtleta(atletaId);
      } catch (error) {
        console.warn(
          "[treinoLivre] Falha ao recalcular pontuação:",
          error
        );
      }

      return res.status(201).json(novo);
    } catch (error) {
      /**
       * Resposta específica quando o
       * atleta ultrapassar a cota.
       */
      const limite = respostaErroLimiteDiario(error);

      if (limite) {
        return res.status(403).json(limite);
      }

      if (
        error instanceof Error &&
        error.message === "ATLETA_NAO_ENCONTRADO"
      ) {
        return res.status(404).json({
          code: "ATLETA_NOT_FOUND",
          message: "Atleta não encontrado.",
        });
      }

      console.error(
        "[treinoLivre:create]",
        error
      );

      return res.status(500).json({
        message: "Erro ao criar treino livre",
      });
    }
  },

  /**
   * DELETE /api/treinos-livres/:id
   *
   * Mantém a autorização e exclusão
   * utilizadas no controller original.
   */
  async delete(req: Request, res: Response) {
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
          code: "ACTIVE_CONTEXT_MISMATCH",
          message:
            "Selecione seu perfil de Atleta ou um atleta autorizado para excluir um treino livre.",
        });
      }

      const id = String(
        req.params.id ?? ""
      ).trim();

      if (!id) {
        return res.status(400).json({
          message: "Treino inválido.",
        });
      }

      /**
       * Primeiro confere se o treino
       * pertence ao atleta autorizado.
       */
      const treino = await prisma.treinoLivre.findFirst({
        where: {
          id,
          atletaId: atletaAtivo.atletaId,
        },

        select: {
          id: true,
          atletaId: true,
        },
      });

      if (!treino) {
        return res.status(404).json({
          message: "Treino não encontrado.",
        });
      }

      await prisma.treinoLivre.delete({
        where: {
          id: treino.id,
        },
      });

      try {
        await recomputePontuacaoAtleta(
          treino.atletaId
        );
      } catch (error) {
        console.warn(
          "[treinoLivre] Falha ao recalcular pontuação após exclusão:",
          error
        );
      }

      return res.status(204).send();
    } catch (error) {
      console.error(
        "[treinoLivre:delete]",
        error
      );

      return res.status(500).json({
        message: "Erro ao deletar treino",
      });
    }
  },
};