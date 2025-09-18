import { PrismaClient, $Enums } from "@prisma/client";
import { Request, Response } from "express";
import { aplicarEstatisticasPosSubmissao } from "./submissoes/utilsEstatistica.js";
import { inferirTipoTreino } from "../utils/inferirTipoTreino.js";
import { atualizarCachePontuacao } from "server/services/pontuacao.service.js";

const prisma = new PrismaClient();

function toPrismaTipoTreino(value?: string | null): $Enums.TipoTreino | null {
  if (!value) return null;

  const v = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  switch (v) {
    case "fisico":  return $Enums.TipoTreino.Fisico;
    case "tecnico": return $Enums.TipoTreino.Tecnico;
    case "tatico":  return $Enums.TipoTreino.Tatico;
    case "mental":  return $Enums.TipoTreino.Mental;
    default:        return null;
  }
}

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

    const tipoStr = inferirTipoTreino({
      nome: ag?.treinoProgramado?.nome ?? undefined,
      tipoTreino: ag?.treinoProgramado?.tipoTreino ?? null,
      categorias: ag?.treinoProgramado?.categoria ?? null,
    });

    const tipoEnum = toPrismaTipoTreino(tipoStr);

    if (tipoEnum) {
      await prisma.atleta.update({
        where: { id: atletaId },
        data: {
          perfilTipoTreino: tipoEnum,
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
