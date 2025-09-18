import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";

const prisma = new PrismaClient();

function montarExercicios(rows: any[]) {
  return (rows ?? []).map((x: any) => ({
    id: x.exercicio?.id,
    nome: x.exercicio?.nome ?? "",
    repeticoes: x.repeticoes ?? null,
    descricao: x.exercicio?.descricao ?? null,
    videoUrl: x.exercicio?.videoDemonstrativoUrl ?? null,
  }));
}

function montarPayloadFromProgramado(tp: any) {
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
    dataExpiracao: null,
    exercicios: montarExercicios(tp.exercicios),
    origem: tp.professor
      ? { tipo: "professor", nome: tp.professor.nome }
      : tp.escolinha
      ? { tipo: "escolinha", nome: tp.escolinha.nome }
      : tp.clube
      ? { tipo: "clube", nome: tp.clube.nome }
      : null,
  };
}

function montarPayloadFromAgendado(ag: any) {
  const tp = ag.treinoProgramado;
  return {
    tipo: "agendado" as const,
    id: ag.id,
    treinoProgramadoId: tp?.id ?? null,
    titulo: ag.titulo ?? tp?.nome ?? "Treino",
    descricao: tp?.descricao ?? null,
    nivel: tp?.nivel ?? ag.nivel ?? null,
    objetivo: tp?.objetivo ?? null,
    duracao: tp?.duracao ?? ag.duracaoMinutos ?? null,
    dicas: tp?.dicas ?? [],
    prazoEnvio: (ag.dataExpiracao ?? ag.dataTreino ?? tp?.dataAgendada)?.toISOString?.() ?? null,
    dataTreino: ag.dataTreino ? ag.dataTreino.toISOString() : null,
    dataExpiracao: ag.dataExpiracao ? ag.dataExpiracao.toISOString() : null,
    exercicios: montarExercicios(tp?.exercicios ?? []),
    origem: tp?.professor
      ? { tipo: "professor", nome: tp.professor.nome }
      : tp?.escolinha
      ? { tipo: "escolinha", nome: tp.escolinha.nome }
      : tp?.clube
      ? { tipo: "clube", nome: tp.clube.nome }
      : null,
  };
}

export async function getTreinoUnico(req: AuthenticatedRequest, res: Response) {
  try {
    const agendadoId = String(req.query.agendadoId ?? "");
    const programadoId = String(req.query.programadoId ?? "");

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
                },
              },
              professor: { select: { nome: true } },
              escolinha: { select: { nome: true } },
              clube: { select: { nome: true } },
            },
          },
        },
      });
      if (!ag) return res.status(404).json({ message: "Treino agendado não encontrado." });
      return res.json(montarPayloadFromAgendado(ag));
    }

    const tp = await prisma.treinoProgramado.findUnique({
      where: { id: programadoId },
      include: {
        exercicios: {
          include: {
            exercicio: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
            },
          },
        },
        professor: { select: { nome: true } },
        escolinha: { select: { nome: true } },
        clube: { select: { nome: true } },
      },
    });
    if (!tp) return res.status(404).json({ message: "Treino programado não encontrado." });

    return res.json(montarPayloadFromProgramado(tp));
  } catch (e) {
    console.error("Erro em getTreinoUnico:", e);
    return res.status(500).json({ message: "Erro ao buscar treino." });
  }
}
