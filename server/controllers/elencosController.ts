import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

async function montarRespostaElencos(donoId: string) {
  const elencos = await prisma.elenco.findMany({
    where: {
      OR: [
        { clubeId: donoId },
        { escolinhaId: donoId },
        { professorId: donoId },
      ],
    },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const ids = elencos.map((e) => e.id);
  const atletasPorElenco = ids.length
    ? await prisma.atletaElenco.findMany({
        where: { elencoId: { in: ids } },
        select: { elencoId: true, atletaId: true },
      })
    : [];

  const bucket = new Map<string, string[]>();
  ids.forEach((id) => bucket.set(id, []));
  for (const r of atletasPorElenco) {
    bucket.get(r.elencoId)?.push(r.atletaId);
  }

  return elencos.map((e) => ({
    id: e.id,
    nome: e.nome ?? "Elenco",
    atletasIds: bucket.get(e.id) ?? [],
  }));
}

export async function listarElencos(req: Request, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "");
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId ausente" });
    const data = await montarRespostaElencos(tipoUsuarioId);
    return res.json(data);
  } catch (e) {
    console.error("[listarElencos] erro:", e);
    return res.status(500).json({ error: "Erro ao listar elencos." });
  }
}

export async function listarElencosMinha(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    ]);

    const donoId = clube?.id || escolinha?.id || professor?.id;
    if (!donoId) return res.json([]);

    const data = await montarRespostaElencos(donoId);
    return res.json(data);
  } catch (e) {
    console.error("[listarElencosMinha] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar elencos." });
  }
}