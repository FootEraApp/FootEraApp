import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { aplicarEstatisticasPosSubmissao } from "./submissoes/utilsEstatistica.js";
import { inferirTipoTreino } from "../utils/inferirTipoTreino.js";
import { atualizarCachePontuacao } from "server/services/pontuacao.service.js";

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

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id: treinoAgendadoId },
      include: { treinoProgramado: true },
    });

    const tipo = inferirTipoTreino({
      nome: ag?.treinoProgramado?.nome ?? undefined,
      tipoTreino: ag?.treinoProgramado?.tipoTreino ?? null,
      categorias: ag?.treinoProgramado?.categoria ?? null,
    });

    if (tipo) {
      await prisma.atleta.update({
        where: { id: atletaId },
        data: {
          perfilTipoTreino: tipo,
          perfilTipoTreinoAtualizadoEm: new Date(),
        },
      });
    }

    if (created.aprovado) {
      await aplicarEstatisticasPosSubmissao(
        created.id,
        atletaId,
        treinoAgendadoId,
        Number(duracaoMinutos)
      );
    }

    const atleta = await prisma.atleta.findUnique({ where: { id: atletaId }, select: { usuarioId: true } });
    if (atleta?.usuarioId) {
      atualizarCachePontuacao(atleta.usuarioId).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Falha na submissão" });
  }

}
