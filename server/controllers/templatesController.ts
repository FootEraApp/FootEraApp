import {
  Nivel,
  TipoTreino,
  Categoria,
} from "@prisma/client";
import type { Response } from "express";
import type {
  AuthenticatedRequest,
} from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import {
  getActiveContext,
} from "../services/activeContext.js";

type TemplateOwner = {
  tipo:
    | "professor"
    | "clube"
    | "escolinha";

  ownerId: string;

  data:
    | { professorId: string }
    | { clubeId: string }
    | { escolinhaId: string };
};

async function getTemplateOwner(
  req: AuthenticatedRequest
): Promise<TemplateOwner | null> {
  const usuarioId = String(
    req.userId ??
      req.user?.id ??
      ""
  ).trim();

  if (!usuarioId) {
    return null;
  }

  const contexto =
    req.authUser?.activeContext ??
    await getActiveContext(usuarioId);

  if (!contexto) {
    return null;
  }

  if (contexto.kind === "PERSONAL") {
    const papel = String(
      contexto.role ??
        contexto.tipoUsuario ??
        ""
    )
      .trim()
      .toLowerCase();

    const profileId = String(
      contexto.profileId ??
        contexto.tipoUsuarioId ??
        ""
    ).trim();

    if (
      papel === "professor" &&
      profileId
    ) {
      return {
        tipo: "professor",
        ownerId: profileId,

        data: {
          professorId: profileId,
        },
      };
    }

    return null;
  }

  if (contexto.kind === "ORGANIZATION") {
    const organizationType = String(
      contexto.organizationType ??
        ""
    )
      .trim()
      .toLowerCase();

    const legacyOrganizationId =
      String(
        contexto.legacyOrganizationId ??
          ""
      ).trim();

    if (!legacyOrganizationId) {
      return null;
    }

    if (organizationType === "clube") {
      return {
        tipo: "clube",
        ownerId:
          legacyOrganizationId,

        data: {
          clubeId:
            legacyOrganizationId,
        },
      };
    }

    if (
      organizationType === "escolinha" ||
      organizationType === "escola"
    ) {
      return {
        tipo: "escolinha",
        ownerId:
          legacyOrganizationId,

        data: {
          escolinhaId:
            legacyOrganizationId,
        },
      };
    }
  }

  return null;
}

export async function criarTemplate(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = String(
      req.userId ??
        req.user?.id ??
        ""
    ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        error: "Não autenticado",
      });
    }

    const isAdmin =
      !!req.user?.isAdmin;

    const owner =
      await getTemplateOwner(req);

    if (!owner && !isAdmin) {
      return res.status(403).json({
        error:
          "Somente professor/organização podem criar templates.",
      });
    }

    const {
      titulo,
      descricao,
      nivel,
      tipoTreino,
      categoria,
      duracao,
      dicas,
      conteudo,
      publico,
      parceiro,
      expiraEm,
      naoExpira,
    } = (req.body ?? {}) as {
      titulo: string;
      descricao?: string | null;
      nivel?: Nivel | null;
      tipoTreino?: TipoTreino | null;
      categoria?: Categoria[] | null;
      duracao?: number | null;
      dicas?: string[] | null;
      conteudo: any;
      publico?: boolean;
      parceiro?: boolean;
      expiraEm?: string | null;
      naoExpira?: boolean;
    };

    if (!titulo || !conteudo) {
      return res.status(400).json({
        error:
          "Campos obrigatórios: titulo, conteudo.",
      });
    }

    const fakeTreinoProgramadoId =
      `tpl_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const created =
      await prisma.treinoSalvo.create({
        data: {
          usuarioId,

          treinoProgramadoId:
            fakeTreinoProgramadoId,

          titulo,

          descricao:
            descricao ?? null,

          nivel:
            nivel ?? null,

          tipoTreino:
            tipoTreino ?? null,

          categoria:
            (categoria ?? []) as any,

          duracao:
            duracao ?? null,

          dicas:
            (dicas ?? []) as any,

          conteudo:
            conteudo as any,

          publico:
            !!publico,

          parceiro:
            !!parceiro,

          expiraEm:
            naoExpira
              ? null
              : expiraEm
                ? new Date(expiraEm)
                : null,

          naoExpira:
            !!naoExpira,

          criadoPorUsuarioId:
            usuarioId,

          ...(owner?.data ?? {}),
        },
      });

    return res
      .status(201)
      .json(created);
  } catch (e) {
    console.error(
      "POST /api/templates",
      e
    );

    return res.status(500).json({
      error:
        "Falha ao criar template.",
    });
  }
}

export async function listarTemplates(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = String(
      req.userId ??
        req.user?.id ??
        ""
    ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        error: "Não autenticado",
      });
    }

    const { scope } =
      req.query as {
        scope?: "me" | "public" | "org";
      };

    const where: any = {};

    if (scope === "public") {
      where.publico = true;
    }

    else if (scope === "me") {
      where.criadoPorUsuarioId =
        usuarioId;
    }

    else if (scope === "org") {
      const owner =
        await getTemplateOwner(req);

      if (!owner) {
        return res.json([]);
      }

      if (owner.tipo === "professor") {
        const prof =
          await prisma.professor.findUnique({
            where: {
              id: owner.ownerId,
            },

            select: {
              escolinhaId: true,
              clubeId: true,
            },
          });

        const orgs: any[] = [];

        if (prof?.escolinhaId) {
          orgs.push({
            escolinhaId:
              prof.escolinhaId,
          });
        }

        if (prof?.clubeId) {
          orgs.push({
            clubeId:
              prof.clubeId,
          });
        }

        if (!orgs.length) {
          return res.json([]);
        }

        where.OR = orgs;
      } else {
        Object.assign(
          where,
          owner.data
        );
      }
    }

    const list =
      await prisma.treinoSalvo.findMany({
        where,

        orderBy: {
          criadoEm: "desc",
        },

        take: 100,
      });

    return res.json(list);
  } catch (e) {
    console.error(
      "GET /api/templates",
      e
    );

    return res.status(500).json({
      error:
        "Falha ao listar templates.",
    });
  }
}

export async function deletarTemplate(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = String(
      req.userId ??
        req.user?.id ??
        ""
    ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        error: "Não autenticado",
      });
    }

    const isAdmin =
      !!req.user?.isAdmin;

    const { id } =
      req.params as {
        id: string;
      };

    const tpl =
      await prisma.treinoSalvo.findUnique({
        where: {
          id,
        },
      });

    if (!tpl) {
      return res.status(404).json({
        error:
          "Template não encontrado.",
      });
    }

    if (isAdmin) {
      await prisma.treinoSalvo.delete({
        where: {
          id,
        },
      });

      return res.json({
        ok: true,
      });
    }

    const owner =
      await getTemplateOwner(req);

    let isOwner = false;

    if (owner?.tipo === "professor") {
      isOwner =
        tpl.professorId ===
        owner.ownerId;
    }

    if (owner?.tipo === "clube") {
      isOwner =
        tpl.clubeId ===
        owner.ownerId;
    }

    if (owner?.tipo === "escolinha") {
      isOwner =
        tpl.escolinhaId ===
        owner.ownerId;
    }

    /*
     * Compatibilidade para templates antigos
     * que não possuem owner específico.
     */
    const semOwner =
      !tpl.professorId &&
      !tpl.clubeId &&
      !tpl.escolinhaId;

    const isLegacyOwner =
      semOwner &&
      tpl.criadoPorUsuarioId ===
        usuarioId;

    if (!isOwner && !isLegacyOwner) {
      return res.status(403).json({
        error:
          "Sem permissão para remover este template.",
      });
    }

    await prisma.treinoSalvo.delete({
      where: {
        id,
      },
    });

    return res.json({
      ok: true,
    });
  } catch (e) {
    console.error(
      "DELETE /api/templates/:id",
      e
    );

    return res.status(500).json({
      error:
        "Falha ao deletar template.",
    });
  }
}