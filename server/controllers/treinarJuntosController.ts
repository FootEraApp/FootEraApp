import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendError } from "../utils/httpError.js";
import {
  TipoUsuario,
} from "@prisma/client";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  hasRole,
} from "../services/roles.js";

type SideInfo = {
  atletaId: string | null;
  professorId: string | null;
  clubeId: string | null;
  escolinhaId: string | null;
};

type PapelVinculo =
  | "Atleta"
  | "Professor"
  | "Clube"
  | "Escolinha";

function normalizarPapelVinculo(
  valor: unknown
): PapelVinculo | null {
  const raw =
    String(valor ?? "")
      .trim()
      .toLowerCase();

  if (raw === "atleta") {
    return "Atleta";
  }

  if (raw === "professor") {
    return "Professor";
  }

  if (raw === "clube") {
    return "Clube";
  }

  if (
    raw === "escola" ||
    raw === "escolinha"
  ) {
    return "Escolinha";
  }

  return null;
}

function enumPapelVinculo(
  papel: PapelVinculo
): TipoUsuario {
  switch (papel) {
    case "Atleta":
      return TipoUsuario.Atleta;

    case "Professor":
      return TipoUsuario.Professor;

    case "Clube":
      return TipoUsuario.Clube;

    case "Escolinha":
      return TipoUsuario.Escolinha;
  }
}

async function getSide(
  usuarioId: string,
  papel: PapelVinculo
): Promise<SideInfo | null> {
  const possui =
    await hasRole(
      usuarioId,
      enumPapelVinculo(
        papel
      )
    );

  if (!possui) {
    return null;
  }

  const result: SideInfo = {
    atletaId: null,
    professorId: null,
    clubeId: null,
    escolinhaId: null,
  };

  if (papel === "Atleta") {
    const row =
      await prisma.atleta.findUnique({
        where: {
          usuarioId,
        },
        select: {
          id: true,
        },
      });

    result.atletaId =
      row?.id ?? null;
  }

  if (papel === "Professor") {
    const row =
      await prisma.professor.findUnique({
        where: {
          usuarioId,
        },
        select: {
          id: true,
        },
      });

    result.professorId =
      row?.id ?? null;
  }

  if (papel === "Clube") {
    const row =
      await prisma.clube.findUnique({
        where: {
          usuarioId,
        },
        select: {
          id: true,
        },
      });

    result.clubeId =
      row?.id ?? null;
  }

  if (papel === "Escolinha") {
    const row =
      await prisma.escolinha.findUnique({
        where: {
          usuarioId,
        },
        select: {
          id: true,
        },
      });

    result.escolinhaId =
      row?.id ?? null;
  }

  return result;
}

export const treinarJuntosController = {
  status: async (req: Request, res: Response) => {
    try {
      const viewerUsuarioId =
        (req as any).userId ||
        (req as any).user?.id ||
        (req as any).user?.usuarioId;

      const perfilUsuarioId = String(req.params.perfilUsuarioId || "");

      if (!viewerUsuarioId) {
        return res
          .status(401)
          .json({ message: "Usuário não autenticado (sem userId no token)" });
      }

      if (!perfilUsuarioId) {
        return res
          .status(400)
          .json({ message: "perfilUsuarioId é obrigatório na URL" });
      }

      if (viewerUsuarioId === perfilUsuarioId) {
        return res.json({
          treinandoJunto: false,
          status: "NUNCA",
        });
      }

      const contextoViewer =
        await getActiveContext(
          String(viewerUsuarioId)
        );

      const viewerPapel =
        normalizarPapelVinculo(
          contextoViewer?.tipoUsuario
        );

      const alvoPapel =
        normalizarPapelVinculo(
          req.query.alvoPapel
        );

      if (!viewerPapel) {
        return res.status(400).json({
          message:
            "O contexto ativo não permite vínculo de treino.",
        });
      }

      if (!alvoPapel) {
        return res.status(400).json({
          message:
            "alvoPapel é obrigatório.",
        });
      }

      const [viewerSide, perfilSide] = await Promise.all([
        getSide(
          String(viewerUsuarioId),
          viewerPapel
        ),

        getSide(
          perfilUsuarioId,
          alvoPapel
        ),
      ]);

      if (!viewerSide || !perfilSide) {
        return res
          .status(404)
          .json({ message: "Usuário (viewer ou perfil) não encontrado" });
      }

      const orClauses: any[] = [];

      if (perfilSide.atletaId) {
        if (viewerSide.professorId) {
          orClauses.push({
            atletaId: perfilSide.atletaId,
            professorId: viewerSide.professorId,
          });
        }
        if (viewerSide.clubeId) {
          orClauses.push({
            atletaId: perfilSide.atletaId,
            clubeId: viewerSide.clubeId,
          });
        }
        if (viewerSide.escolinhaId) {
          orClauses.push({
            atletaId: perfilSide.atletaId,
            escolinhaId: viewerSide.escolinhaId,
          });
        }
      }

      if (viewerSide.atletaId) {
        if (perfilSide.professorId) {
          orClauses.push({
            atletaId: viewerSide.atletaId,
            professorId: perfilSide.professorId,
          });
        }
        if (perfilSide.clubeId) {
          orClauses.push({
            atletaId: viewerSide.atletaId,
            clubeId: perfilSide.clubeId,
          });
        }
        if (perfilSide.escolinhaId) {
          orClauses.push({
            atletaId: viewerSide.atletaId,
            escolinhaId: perfilSide.escolinhaId,
          });
        }
      }

      if (orClauses.length === 0) {
        return res.json({
          treinandoJunto: false,
          status: "NUNCA",
        });
      }

      const relAtiva = await prisma.relacaoTreinamento.findFirst({
        where: {
          OR: orClauses,
          ativo: true,
          encerradoEm: null,
        },
        select: {
          id: true,
          atletaId: true,
          professorId: true,
          clubeId: true,
          escolinhaId: true,
          criadoEm: true,
        },
      });

      if (relAtiva) {
        return res.json({
          treinandoJunto: true,
          status: "ATIVO",
          relacao: {
            id: relAtiva.id,
            desde: relAtiva.criadoEm,
          },
        });
      }

      const umAnoAtras = new Date();
      umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);

      const historico =
        await prisma.atletaHistoricoVinculo.findFirst({
          where: {
            OR: orClauses,
            fimVinculo: {
              gte: umAnoAtras, 
            },
          },
          orderBy: { fimVinculo: "desc" },
          select: { id: true, fimVinculo: true },
        });

      if (historico) {
        return res.json({
          treinandoJunto: false,
          status: "DESVINCULADO",
          historico: {
            id: historico.id,
            fim: historico.fimVinculo,
          },
        });
      }

      return res.json({
        treinandoJunto: false,
        status: "NUNCA",
      });
    } catch (e: any) {
      return sendError(res, e, "Erro ao verificar vínculo de treino");
    }
  },
};
