import {
  TipoOrganizacao,
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  getActiveContext,
} from "../services/activeContext.js";

import {
  canPermission,
} from "../services/permissions.js";

export async function requireElencoOwner(
  req: any,
  res: any,
  next: any,
) {
  try {
    const elencoId =
      String(
        req.params.id ??
        "",
      ).trim();

    const usuarioId =
      String(
        req.userId ??
        req.user?.id ??
        "",
      ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        error:
          "Não autenticado",
      });
    }

    if (!elencoId) {
      return res.status(400).json({
        error:
          "Elenco inválido",
      });
    }

    const isAdmin =
      await canPermission(
        usuarioId,
        "VER_ADMIN",
      );

    if (isAdmin) {
      return next();
    }

    const contexto =
      await getActiveContext(
        usuarioId,
      );

    if (!contexto) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        error:
          "Nenhum contexto ativo válido.",
      });
    }

    const podeGerenciar =
      await canPermission(
        usuarioId,
        "GERENCIAR_TURMA",
      );

    if (!podeGerenciar) {
      return res.status(403).json({
        code:
          "PERMISSION_DENIED",

        error:
          "O contexto ativo não pode gerenciar elencos.",
      });
    }

    const elenco =
      await prisma.elenco.findUnique({
        where: {
          id:
            elencoId,
        },

        select: {
          id: true,
          professorId: true,
          clubeId: true,
          escolinhaId: true,
        },
      });

    if (!elenco) {
      return res.status(404).json({
        error:
          "Elenco não encontrado",
      });
    }

    let permitido =
      false;

    /*
     * Professor pessoal.
     */
    if (
      contexto.kind ===
        "PERSONAL" &&
      contexto.tipoUsuario ===
        TipoUsuario.Professor &&
      contexto.tipoUsuarioId
    ) {
      permitido =
        elenco.professorId ===
        contexto.tipoUsuarioId;
    }

    /*
     * Organização ativa.
     */
    if (
      contexto.kind ===
        "ORGANIZATION" &&
      contexto
        .legacyOrganizationId
    ) {
      const orgId =
        contexto
          .legacyOrganizationId;

      if (
        contexto.organizationType ===
          TipoOrganizacao.CLUBE
      ) {
        permitido =
          elenco.clubeId ===
          orgId;
      }

      if (
        contexto.organizationType ===
          TipoOrganizacao.ESCOLA
      ) {
        permitido =
          elenco.escolinhaId ===
          orgId;
      }
    }

    if (!permitido) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_MISMATCH",

        error:
          "Este elenco não pertence ao contexto ativo.",
      });
    }

    return next();
  } catch (error) {
    console.error(
      "[requireElencoOwner]",
      error,
    );

    return res.status(500).json({
      error:
        "Erro ao validar acesso ao elenco.",
    });
  }
}

export async function requireVinculoComAtleta(
  req: any,
  res: any,
  next: any,
) {
  try {
    const atletaId =
      String(
        req.params.atletaId ??
        req.query.atletaId ??
        "",
      ).trim();

    const usuarioId =
      String(
        req.userId ??
        req.user?.id ??
        "",
      ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        error:
          "Não autenticado",
      });
    }

    if (!atletaId) {
      return res.status(400).json({
        error:
          "atletaId é obrigatório",
      });
    }

    const isAdmin =
      await canPermission(
        usuarioId,
        "VER_ADMIN",
      );

    if (isAdmin) {
      return next();
    }

    const contexto =
      await getActiveContext(
        usuarioId,
      );

    if (!contexto) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        error:
          "Nenhum contexto ativo válido.",
      });
    }

    let ownerWhere:
      | {
          professorId: string;
        }
      | {
          clubeId: string;
        }
      | {
          escolinhaId: string;
        }
      | null =
      null;

    /*
     * Professor pessoal.
     */
    if (
      contexto.kind ===
        "PERSONAL" &&
      contexto.tipoUsuario ===
        TipoUsuario.Professor &&
      contexto.tipoUsuarioId
    ) {
      ownerWhere = {
        professorId:
          contexto.tipoUsuarioId,
      };
    }

    /*
     * Dentro de uma organização,
     * o vínculo usado é o da própria
     * organização ativa.
     *
     * Assim um Professor que pertence
     * a Clube A e Clube B não consegue
     * usar os atletas de B enquanto
     * está em "Clube A — Professor".
     */
    if (
      contexto.kind ===
        "ORGANIZATION" &&
      contexto
        .legacyOrganizationId
    ) {
      if (
        contexto.organizationType ===
          TipoOrganizacao.CLUBE
      ) {
        ownerWhere = {
          clubeId:
            contexto
              .legacyOrganizationId,
        };
      }

      if (
        contexto.organizationType ===
          TipoOrganizacao.ESCOLA
      ) {
        ownerWhere = {
          escolinhaId:
            contexto
              .legacyOrganizationId,
        };
      }
    }

    if (!ownerWhere) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_MISMATCH",

        error:
          "O contexto ativo não pode acessar atletas vinculados para treino.",
      });
    }

    const vinculo =
      await prisma.relacaoTreinamento.findFirst({
        where: {
          atletaId,

          ...ownerWhere,

          ativo:
            true,

          encerradoEm:
            null,
        },

        select: {
          id:
            true,
        },
      });

    if (!vinculo) {
      return res.status(403).json({
        error:
          "Sem vínculo com o atleta",
      });
    }

    return next();
  } catch (error) {
    console.error(
      "[requireVinculoComAtleta]",
      error,
    );

    return res.status(500).json({
      error:
        "Erro ao validar vínculo com o atleta.",
    });
  }
}