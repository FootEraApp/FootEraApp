import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SideInfo = {
  atletaId: string | null;
  professorId: string | null;
  clubeId: string | null;
  escolinhaId: string | null;
};

async function getSide(usuarioId: string): Promise<SideInfo | null> {
  if (!usuarioId) return null;

  const [atleta, professor, clube, escolinha] = await Promise.all([
    prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true },
    }),
    prisma.professor.findUnique({
      where: { usuarioId },
      select: { id: true },
    }),
    prisma.clube.findUnique({
      where: { usuarioId },
      select: { id: true },
    }),
    prisma.escolinha.findUnique({
      where: { usuarioId },
      select: { id: true },
    }),
  ]);

  if (!atleta && !professor && !clube && !escolinha) return null;

  return {
    atletaId: atleta?.id ?? null,
    professorId: professor?.id ?? null,
    clubeId: clube?.id ?? null,
    escolinhaId: escolinha?.id ?? null,
  };
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

      const [viewerSide, perfilSide] = await Promise.all([
        getSide(String(viewerUsuarioId)),
        getSide(perfilUsuarioId),
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
      console.error("[treinarJuntos.status]", e);
      return res
        .status(500)
        .json({ message: e?.message || "Erro ao verificar vínculo de treino" });
    }
  },
};
