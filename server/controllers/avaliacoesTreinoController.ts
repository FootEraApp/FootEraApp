import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

const schema = z.object({
  treinoAgendadoId: z.string().min(1),
  submissaoTreinoId: z.string().optional().nullable(),

  nota: z.number().int().min(0).max(5).optional().default(0),
  comentario: z.string().optional().nullable(),

  concluiu: z.boolean().optional().default(true),

  teveDificuldade: z.boolean().optional().default(false),
  dificuldadeMotivo: z.string().optional().nullable(),

  motivoNaoConcluiu: z.enum(["TEMPO", "LESAO", "OBSERVACAO"]).optional().nullable(),
});

export async function criarAvaliacaoTreino(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = String(req.userId || "");
    if (!usuarioId) return res.status(401).json({ error: "Não autenticado." });

    const body = schema.parse(req.body);

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!atleta) return res.status(403).json({ error: "Apenas atleta pode avaliar treino." });

    const treinoAgendado = await prisma.treinoAgendado.findUnique({
      where: { id: body.treinoAgendadoId },
      select: { id: true, atletaId: true },
    });
    if (!treinoAgendado) return res.status(404).json({ error: "Treino agendado não encontrado." });
    if (treinoAgendado.atletaId !== atleta.id)
      return res.status(403).json({ error: "Você não pode avaliar um treino que não é seu." });

    if (body.concluiu === false && !body.motivoNaoConcluiu) {
      return res.status(400).json({ error: "Informe o motivo por não concluir o treino." });
    }

    const avaliacao = await prisma.avaliacaoTreino.upsert({
      where: {
        atletaId_treinoAgendadoId: {
          atletaId: atleta.id,
          treinoAgendadoId: body.treinoAgendadoId,
        },
      },
      update: {
        nota: body.nota,
        comentario: body.comentario ?? null,
        concluiu: body.concluiu,
        teveDificuldade: body.teveDificuldade,
        dificuldadeMotivo: body.teveDificuldade ? (body.dificuldadeMotivo ?? null) : null,
        motivoNaoConcluiu: body.concluiu ? null : (body.motivoNaoConcluiu ?? null),
        submissaoTreinoId: body.submissaoTreinoId ?? null,
      },
      create: {
        atletaId: atleta.id,
        treinoAgendadoId: body.treinoAgendadoId,
        submissaoTreinoId: body.submissaoTreinoId ?? null,
        nota: body.nota,
        comentario: body.comentario ?? null,
        concluiu: body.concluiu,
        teveDificuldade: body.teveDificuldade,
        dificuldadeMotivo: body.teveDificuldade ? (body.dificuldadeMotivo ?? null) : null,
        motivoNaoConcluiu: body.concluiu ? null : (body.motivoNaoConcluiu ?? null),
      },
    });

    return res.json({ ok: true, avaliacao });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return res.status(400).json({ error: "Dados inválidos.", details: e.errors });
    }
    console.error(e);
    return res.status(500).json({ error: "Erro interno ao salvar avaliação." });
  }
}