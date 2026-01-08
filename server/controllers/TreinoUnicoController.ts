import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";

const prisma = new PrismaClient();

type RowEx = {
  id?: string;
  repeticoes?: string | null;
  ordem?: number | null;
  exercicio?: {
    id: string;
    nome: string;
    descricao: string | null;
    videoDemonstrativoUrl: string | null;
  } | null;
  exercicioTemporario?: {
    id: string;
    nome: string;
    descricao: string | null;
    videoDemonstrativoUrl: string | null;
  } | null;
};

function montarExercicios(rows: RowEx[]) {
  return (rows ?? [])
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((x) => {
      const base = x.exercicio ?? x.exercicioTemporario;
      return {
        id: base?.id ?? x.id ?? "",
        nome: base?.nome ?? "",
        repeticoes: x.repeticoes ?? null,
        descricao: base?.descricao ?? null,
        videoUrl: base?.videoDemonstrativoUrl ?? null,
      };
    })
    .filter((e) => e.nome);
}

function montarOrigem(tp: any) {
  const profNome = tp?.professor?.nome ?? tp?.Professor?.nome ?? null;

  if (profNome) return { tipo: "professor" as const, nome: profNome };
  if (tp?.escolinha?.nome) return { tipo: "escolinha" as const, nome: tp.escolinha.nome };
  if (tp?.clube?.nome) return { tipo: "clube" as const, nome: tp.clube.nome };
  return null;
}

function montarPayloadFromProgramado(tp: any, realizacoes: number) {
  return {
    tipo: "programado" as const,
    id: tp.id,
    treinoProgramadoId: tp.id,
    titulo: tp.nome,
    descricao: tp.descricao ?? null,
    nivel: tp.nivel ?? null,
    objetivo: tp.objetivo ?? null,
    duracao: tp.duracao ?? null,
    dicas: tp.dicas ?? [],
    prazoEnvio: tp.dataAgendada ? tp.dataAgendada.toISOString() : null,
    dataTreino: null,
    dataExpiracao: tp.expiraEm ? tp.expiraEm.toISOString() : null,
    exercicios: montarExercicios(tp.exercicios ?? []),
    origem: montarOrigem(tp),
    realizacoes,
  };
}

function montarPayloadFromAgendado(ag: any, realizacoes: number) {
  const tp = ag.treinoProgramado;

  return {
    tipo: "agendado" as const,
    id: ag.id,
    treinoProgramadoId: tp?.id ?? null,
    titulo: ag.titulo ?? tp?.nome ?? "Treino",
    descricao: tp?.descricao ?? null,
    nivel: tp?.nivel ?? null,
    objetivo: tp?.objetivo ?? null,
    duracao: tp?.duracao ?? null,
    dicas: tp?.dicas ?? [],
    prazoEnvio:
      (ag.dataExpiracao ?? ag.dataTreino ?? tp?.dataAgendada ?? tp?.expiraEm)?.toISOString?.() ??
      null,
    dataTreino: ag.dataTreino ? ag.dataTreino.toISOString() : null,
    dataExpiracao: ag.dataExpiracao ? ag.dataExpiracao.toISOString() : null,
    exercicios: montarExercicios(tp?.exercicios ?? []),
    origem: montarOrigem(tp),
    realizacoes,
  };
}

export async function getTreinoUnico(req: AuthenticatedRequest, res: Response) {
  try {
    const agendadoId = String(req.query.agendadoId ?? "").trim();
    const programadoId = String(req.query.programadoId ?? "").trim();

    if (!agendadoId && !programadoId) {
      return res.status(400).json({ message: "Informe agendadoId OU programadoId." });
    }

    if (agendadoId) {
      const ag = await prisma.treinoAgendado.findUnique({
        where: { id: agendadoId },
        include: {
          treinoProgramado: {
            include: {
              exercicios: {
                include: {
                  exercicio: {
                    select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
                  },
                  exercicioTemporario: {
                    select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
                  },
                },
              },
              Professor: { select: { nome: true } },
              escolinha: { select: { nome: true } },
              clube: { select: { nome: true } },
            },
          },
        },
      });

      if (!ag) return res.status(404).json({ message: "Treino agendado não encontrado." });

      const tpId = ag.treinoProgramado?.id ?? null;

      const est = tpId
        ? await prisma.estatisticaTreino.findUnique({
            where: { treinoId: tpId },
            select: { realizacoes: true },
          })
        : null;

      const realizacoes = Number(est?.realizacoes ?? 0);

      const agg = await prisma.avaliacaoTreino.aggregate({
        where: { treinoAgendadoId: agendadoId },
        _avg: { nota: true },
        _count: { nota: true },
      });

      const avaliacaoMedia = agg._avg.nota ?? null;
      const avaliacaoCount = agg._count.nota ?? 0;

      return res.json({
        ...montarPayloadFromAgendado(ag, realizacoes),
        avaliacaoMedia,
        avaliacaoCount,
      });
    }

    const tp = await prisma.treinoProgramado.findUnique({
      where: { id: programadoId },
      include: {
        exercicios: {
          include: {
            exercicio: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
            },
            exercicioTemporario: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
            },
          },
        },
        Professor: { select: { nome: true } },
        escolinha: { select: { nome: true } },
        clube: { select: { nome: true } },
      },
    });

    if (!tp) return res.status(404).json({ message: "Treino programado não encontrado." });

    const est = await prisma.estatisticaTreino.findUnique({
      where: { treinoId: tp.id },
      select: { realizacoes: true },
    });

    const realizacoes = Number(est?.realizacoes ?? 0);

    const ags = await prisma.treinoAgendado.findMany({
      where: { treinoProgramadoId: tp.id },
      select: {
        id: true,
        atleta: {
          select: {
            nome: true,
            usuario: {
              select: {
                nome: true,
                nomeDeUsuario: true,
              },
            },
          },
        },
      },
    });

    const ids = ags.map((a) => a.id);

    const nomePorAgendadoId = new Map<string, string>();
    for (const a of ags) {
      const nome =
        a.atleta?.usuario?.nome ||
        a.atleta?.usuario?.nomeDeUsuario ||
        a.atleta?.nome ||
        "Atleta";
      nomePorAgendadoId.set(a.id, nome);
    }

    const grupos = ids.length
      ? await prisma.avaliacaoTreino.groupBy({
          by: ["treinoAgendadoId"],
          where: { treinoAgendadoId: { in: ids } },
          _avg: { nota: true },
          _count: { nota: true },
        })
      : [];

    const ultimas = ids.length
      ? await prisma.avaliacaoTreino.findMany({
          where: { treinoAgendadoId: { in: ids } },
          select: { treinoAgendadoId: true, createdAt: true }, 
        })
      : [];

    const ultimaDataPorAgendadoId = new Map<string, Date>();
    for (const u of ultimas) {
      if (!ultimaDataPorAgendadoId.has(u.treinoAgendadoId)) {
        ultimaDataPorAgendadoId.set(u.treinoAgendadoId, u.createdAt);
      }
    }

    const avaliacoesPorAgendado = grupos.map((g) => ({
      treinoAgendadoId: g.treinoAgendadoId,
      media: Number(g._avg.nota ?? 0),
      count: Number(g._count.nota ?? 0),
      avaliadorNome: nomePorAgendadoId.get(g.treinoAgendadoId) ?? "Atleta",
      avaliadoEm: (ultimaDataPorAgendadoId.get(g.treinoAgendadoId) ?? null)?.toISOString?.() ?? null,
    }));

    return res.json({
      ...montarPayloadFromProgramado(tp, realizacoes),
      avaliacoesPorAgendado,
    });
  } catch (e) {
    console.error("Erro em getTreinoUnico:", e);
    return res.status(500).json({ message: "Erro ao buscar treino." });
  }
}