// server/controllers/consentimentoController.ts
import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { audit } from "../services/audit.js";

export async function atualizarConsentimentoOlheiro(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { atletaId } = req.params as { atletaId: string };
    const { permitido } = req.body as { permitido: boolean };

    const atleta = await prisma.atleta.findUnique({
      where: { id: atletaId },
      select: { id: true, contatoOlheiroPermitido: true },
    });

    if (!atleta) {
      return res.status(404).json({ message: "Atleta não encontrado." });
    }

    const antigoValor = !!atleta.contatoOlheiroPermitido;
    const novoValor = !!permitido;

    if (antigoValor === novoValor) {
      return res.json({ ok: true, permitido: novoValor });
    }

    const updated = await prisma.atleta.update({
      where: { id: atletaId },
      data: {
        contatoOlheiroPermitido: novoValor,
        contatoOlheiroConsentidoEm: novoValor ? new Date() : null,
        contatoOlheiroConsentidoPorId: req.userId ?? null,
      },
    });

    // >>> AQUI entra exatamente o trecho que você perguntou <<<
    await audit(req as any, {
      acao: "CONSENTIMENTO_OLHEIRO_ATUALIZADO",
      entidade: "Atleta",
      entidadeId: atletaId,
      descricao: `Responsável alterou consentimento para ${novoValor}`,
      meta: { antigoValor, novoValor },
    });

    return res.json({ ok: true, permitido: updated.contatoOlheiroPermitido });
  } catch (error) {
    console.error("atualizarConsentimentoOlheiro error:", error);
    return res.status(500).json({ message: "Erro ao atualizar consentimento." });
  }
}