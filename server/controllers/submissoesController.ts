import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { aplicarEstatisticasPosSubmissao } from "./submissoes/utilsEstatistica.js";

const prisma = new PrismaClient();

export async function criarOuAprovarSubmissaoTreino(req: Request, res: Response) {
  const { atletaId, treinoAgendadoId, aprovado, duracaoMinutos } = req.body;

  try {
    const created = await prisma.submissaoTreino.create({
      data: { 
        atletaId, 
        treinoAgendadoId, 
        aprovado: !!aprovado,
        duracaoMinutos: Number(duracaoMinutos) || undefined
      }
    });

    if (created.aprovado) {
      await aplicarEstatisticasPosSubmissao(
        created.id,
        atletaId,
        treinoAgendadoId,
        Number(duracaoMinutos)
      );
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Falha na submissão" });
  }
}
