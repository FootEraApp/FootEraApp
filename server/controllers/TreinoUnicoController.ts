// server/controllers/TreinoUnicoController
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
        // id do item (pra key da UI) - se não tiver exercicioId, usa o id do temporário
        id: base?.id ?? x.id ?? "",
        nome: base?.nome ?? "",
        repeticoes: x.repeticoes ?? null,
        descricao: base?.descricao ?? null,
        videoUrl: base?.videoDemonstrativoUrl ?? null,
      };
    })
    .filter((e) => e.nome); // evita itens totalmente vazios
}

function montarOrigem(tp: any) {
  const profNome = tp?.professor?.nome ?? tp?.Professor?.nome ?? null;

  if (profNome) return { tipo: "professor" as const, nome: profNome };
  if (tp?.escolinha?.nome) return { tipo: "escolinha" as const, nome: tp.escolinha.nome };
  if (tp?.clube?.nome) return { tipo: "clube" as const, nome: tp.clube.nome };
  return null;
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
    dataExpiracao: tp.expiraEm ? tp.expiraEm.toISOString() : null,
    exercicios: montarExercicios(tp.exercicios ?? []),
    origem: montarOrigem(tp),
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
    nivel: tp?.nivel ?? null,
    objetivo: tp?.objetivo ?? null,
    duracao: tp?.duracao ?? null,
    dicas: tp?.dicas ?? [],
    // "Prazo/Agendamento" na UI
    prazoEnvio:
      (ag.dataExpiracao ?? ag.dataTreino ?? tp?.dataAgendada ?? tp?.expiraEm)?.toISOString?.() ??
      null,
    dataTreino: ag.dataTreino ? ag.dataTreino.toISOString() : null,
    dataExpiracao: ag.dataExpiracao ? ag.dataExpiracao.toISOString() : null,
    exercicios: montarExercicios(tp?.exercicios ?? []),
    origem: montarOrigem(tp),
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
              Professor: { select: { nome: true } }, // ✅ correto no schema
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
            exercicioTemporario: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
            },
          },
        },
        Professor: { select: { nome: true } }, // ✅ correto no schema
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
