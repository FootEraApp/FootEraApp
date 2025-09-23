import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toAtletaCard(a: any) {
  const nome = a?.nome ?? a?.usuario?.nome ?? "Atleta";
  const foto = a?.foto ?? a?.usuario?.foto ?? null;
  return { id: a.id, nome, foto };
}

export async function getAtletasPorVinculo(req: Request, res: Response) {
  try {
    const vinculoRaw = String(req.query.vinculo || "").toLowerCase(); 
    const entidadeId = String(req.query.id || "");
    if (!vinculoRaw || !entidadeId) {
      return res.status(400).json({ error: "Parâmetros 'vinculo' e 'id' são obrigatórios." });
    }

    const vinculo = vinculoRaw === "escola" ? "escolinha" : vinculoRaw;

    const diretos = await prisma.atleta.findMany({
      where: {
        ...(vinculo === "clube" ? { clubeId: entidadeId } : {}),
        ...(vinculo === "escolinha" ? { escolinhaId: entidadeId } : {}),
      },
      select: {
        id: true, nome: true, foto: true,
        usuario: { select: { nome: true, foto: true } },
      },
    });

    const relacoes = await prisma.relacaoTreinamento.findMany({
      where: {
        atletaId: { not: null },
        ...(vinculo === "clube" ? { clubeId: entidadeId } : {}),
        ...(vinculo === "escolinha" ? { escolinhaId: entidadeId } : {}),
        ...(vinculo === "professor" ? { professorId: entidadeId } : {}),
      },
      include: {
        atleta: {
          select: {
            id: true, nome: true, foto: true,
            usuario: { select: { nome: true, foto: true } },
          },
        },
      },
    });

    const map = new Map<string, { id: string; nome: string; foto?: string | null }>();
    diretos.forEach((a) => map.set(a.id, toAtletaCard(a)));
    relacoes.forEach((r) => r.atleta && map.set(r.atleta.id, toAtletaCard(r.atleta)));

    return res.json(Array.from(map.values()));
  } catch (e) {
    console.error("[getAtletasPorVinculo] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar atletas vinculados." });
  }
}

export async function getAtletasVinculadosPorTipoUsuarioId(req: Request, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "");
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId ausente" });

    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findUnique({ where: { id: tipoUsuarioId }, select: { id: true } }),
      prisma.escolinha.findUnique({ where: { id: tipoUsuarioId }, select: { id: true } }),
      prisma.professor.findUnique({ where: { id: tipoUsuarioId }, select: { id: true } }),
    ]);

    let vinculo: "clube" | "escolinha" | "professor" | null = null;
    if (clube) vinculo = "clube";
    else if (escolinha) vinculo = "escolinha";
    else if (professor) vinculo = "professor";

    if (!vinculo) return res.json([]);

    (req.query as any).vinculo = vinculo;
    (req.query as any).id = tipoUsuarioId;
    return getAtletasPorVinculo(req, res);
  } catch (e) {
    console.error("[getAtletasVinculadosPorTipoUsuarioId] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar atletas." });
  }
}