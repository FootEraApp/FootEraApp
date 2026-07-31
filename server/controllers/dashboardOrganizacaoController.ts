import type { Response } from "express";
import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import { sendError } from "../utils/httpError.js";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const TREINO_PROGRAMADO_DATE_FIELD = "createdAt" as const;
const SUBMISSAO_TREINO_DATE_FIELD = "criadoEm" as const;

export async function getDashboardOrganizacao(req: any, res: Response) {
  try {
    const ownerTipoRaw = String(req.query.ownerTipo || "");
    const ownerId = String(req.query.ownerId || "");
    const ano = Number(req.query.ano || new Date().getFullYear());

    const ownerTipo = ownerTipoRaw === "Escolinha" ? "Escolinha" : "Clube";

    if (!ownerId) {
      return res.status(400).json({ message: "ownerId é obrigatório" });
    }

    const ownerTipoLower = ownerTipo.toLowerCase(); 
    const tokenTipo = String(
      req.user?.tipo ??
        req.user?.tipoUsuario ??
        req.user?.usuarioTipoRaw ??
        ""
    ).toLowerCase();

    const tokenTipoId = String(
      req.user?.tipoUsuarioId ??
        req.user?.tipoUsuarioID ??
        req.user?.clubeId ??
        req.user?.escolinhaId ??
        req.user?.tipoId ??
        ""
    );

    const headerTipo = String(req.headers["x-tipo-usuario"] ?? "").toLowerCase();
    const headerTipoId = String(req.headers["x-tipo-usuario-id"] ?? "");
    const finalTipo = (tokenTipo || headerTipo).toLowerCase();
    const finalTipoId = String(tokenTipoId || headerTipoId || "");

    let isAdmin =
      finalTipo === "admin" ||
      finalTipo === "administrador" ||
      finalTipo === "adm";

    if (!isAdmin && req.user?.id) {
      try {
        const adminRow = await prisma.administrador.findFirst({
          where: { usuarioId: String(req.user.id) },
          select: { id: true },
        });
        isAdmin = !!adminRow;
      } catch {
      }
    }

    const isSameOwner =
      (finalTipo === "clube" &&
        ownerTipoLower === "clube" &&
        finalTipoId === ownerId) ||
      (finalTipo === "escolinha" &&
        ownerTipoLower === "escolinha" &&
        finalTipoId === ownerId);

    if (!isAdmin && !isSameOwner) {
      return res.status(403).json({
        message: "Sem permissão para ver este dashboard.",
      });
    }

    const now = new Date();
    const mesAtualStart = startOfMonth(now);
    const mesAtualEnd = endOfMonth(now);

    const whereTreinoProgramado: any =
      ownerTipo === "Clube" ? { clubeId: ownerId } : { escolinhaId: ownerId };

    const whereTreinoAgendadoOrganizacao:
      Prisma.TreinoAgendadoWhereInput =
      ownerTipo === "Clube"
        ? {
            OR: [
              {
                treinoProgramado: {
                  is: {
                    clubeId: ownerId,
                  },
                },
              },
              {
                turma: {
                  is: {
                    clubeId: ownerId,
                  },
                },
              },
            ],
          }
        : {
            OR: [
              {
                treinoProgramado: {
                  is: {
                    escolinhaId: ownerId,
                  },
                },
              },
              {
                turma: {
                  is: {
                    escolinhaId: ownerId,
                  },
                },
              },
            ],
          };

    /*
    * Filtro utilizado nas consultas de SubmissaoTreino.
    */
    const whereSubmissaoOrganizacao:
      Prisma.SubmissaoTreinoWhereInput = {
      treinoAgendado: {
        is: whereTreinoAgendadoOrganizacao,
      },
    };

    const treinosLancadosTotal = await prisma.treinoProgramado.count({
      where: whereTreinoProgramado,
    });

    const treinosLancadosMes = await prisma.treinoProgramado.count({
      where: {
        ...whereTreinoProgramado,
        [TREINO_PROGRAMADO_DATE_FIELD]: { gte: mesAtualStart, lt: mesAtualEnd },
      } as any,
    });

    const agendamentosMes =
      await prisma.treinoAgendado.count({
        where: {
          ...whereTreinoAgendadoOrganizacao,

          dataTreino: {
            gte: mesAtualStart,
            lt: mesAtualEnd,
          },
        },
      });

    const concluidosMes =
      await prisma.submissaoTreino.count({
        where: {
          aprovado: true,

          [SUBMISSAO_TREINO_DATE_FIELD]: {
            gte: mesAtualStart,
            lt: mesAtualEnd,
          },

          ...whereSubmissaoOrganizacao,
        },
      });

    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);

    const ativos30d =
      await prisma.submissaoTreino.findMany({
        where: {
          aprovado: true,

          [SUBMISSAO_TREINO_DATE_FIELD]: {
            gte: d30,
          },

          ...whereSubmissaoOrganizacao,
        },

        select: {
          atletaId: true,
        },

        distinct: ["atletaId"],
      });

    const alunosAtivos30d = ativos30d.length;
    const taxaConclusaoMes = agendamentosMes > 0 ? (concluidosMes / agendamentosMes) * 100 : 0;
    const historicoPorMes: Array<{
      mes: string;
      lancados: number;
      agendados: number;
      concluidos: number;
    }> = [];

    for (let m = 0; m < 12; m++) {
      const ini = new Date(ano, m, 1);
      const fim = new Date(ano, m + 1, 1);

      const [lancados, agendados, concluidos] = await Promise.all([
        prisma.treinoProgramado.count({
          where: {
            ...whereTreinoProgramado,
            [TREINO_PROGRAMADO_DATE_FIELD]: { gte: ini, lt: fim },
          } as any,
        }),
        prisma.treinoAgendado.count({
          where: {
            ...whereTreinoAgendadoOrganizacao,

            dataTreino: {
              gte: ini,
              lt: fim,
            },
          },
        }),
        prisma.submissaoTreino.count({
          where: {
            aprovado: true,

            [SUBMISSAO_TREINO_DATE_FIELD]: {
              gte: ini,
              lt: fim,
            },

            ...whereSubmissaoOrganizacao,
          },
        }),
      ]);

      historicoPorMes.push({
        mes: `${pad2(m + 1)}/${ano}`,
        lancados,
        agendados,
        concluidos,
      });
    }

    const submissoesMes =
      await prisma.submissaoTreino.findMany({
        where: {
          aprovado: true,

          [SUBMISSAO_TREINO_DATE_FIELD]: {
            gte: mesAtualStart,
            lt: mesAtualEnd,
          },

          ...whereSubmissaoOrganizacao,
        },

        select: {
          atletaId: true,
        },
      });

    const countByAtleta = new Map<string, number>();
    for (const s of submissoesMes) {
      if (!s.atletaId) continue;
      countByAtleta.set(s.atletaId, (countByAtleta.get(s.atletaId) || 0) + 1);
    }

    const top = Array.from(countByAtleta.entries())
      .map(([atletaId, presencasMes]) => ({ atletaId, presencasMes }))
      .sort((a, b) => b.presencasMes - a.presencasMes)
      .slice(0, 10);

    const atletaIds = top.map((t) => t.atletaId);

    const atletas = atletaIds.length
      ? await prisma.atleta.findMany({
          where: { id: { in: atletaIds } },
          select: {
            id: true,
            usuario: { select: { nome: true, foto: true } },
          },
        })
      : [];

    const atletaById = new Map(atletas.map((a) => [a.id, a]));

    const topFrequencia = top.map((t) => {
      const a = atletaById.get(t.atletaId);
      return {
        atletaId: t.atletaId,
        nome: a?.usuario?.nome || "Atleta",
        foto: a?.usuario?.foto || null,
        presencasMes: t.presencasMes,
      };
    });

    const porTurma: any[] = [];

    return res.json({
      kpis: {
        treinosLancadosTotal,
        treinosLancadosMes,
        agendamentosMes,
        concluidosMes,
        alunosAtivos30d,
        taxaConclusaoMes,
      },
      historicoPorMes,
      topFrequencia,
      porTurma,
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao gerar dashboard.");
  }
}