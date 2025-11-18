import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

async function montarRespostaElencos(donoId: string, turmaId?: string) {
  const whereBase: any = {
    OR: [{ clubeId: donoId }, { escolinhaId: donoId }, { professorId: donoId }],
  };
  if (turmaId) whereBase.turmaId = turmaId;

  const elencos = await prisma.elenco.findMany({
    where: whereBase,
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
  for (const r of atletasPorElenco) bucket.get(r.elencoId)?.push(r.atletaId);

  return elencos.map((e) => ({
    id: e.id,
    nome: e.nome ?? "Elenco",
    atletasIds: bucket.get(e.id) ?? [],
  }));
}

export async function listarElencos(req: Request, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "");
    const turmaId = req.query.turmaId ? String(req.query.turmaId) : undefined;
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId ausente" });
    const data = await montarRespostaElencos(tipoUsuarioId, turmaId);
    return res.json(data);
  } catch (e) {
    console.error("[listarElencos] erro:", e);
    return res.status(500).json({ error: "Erro ao listar elencos." });
  }
}

export async function listarElencosMinha(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const turmaId = req.query.turmaId ? String(req.query.turmaId) : undefined;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    ]);

    const donoId = clube?.id || escolinha?.id || professor?.id;
    if (!donoId) return res.json([]);

    if (turmaId) {
      const turma = await prisma.turma.findUnique({
        where: { id: turmaId },
        select: { id: true, clubeId: true, escolinhaId: true, professorId: true },
      });
      if (!turma) return res.status(404).json({ error: "Turma não encontrada" });

      const ligado =
        turma.clubeId === donoId || turma.escolinhaId === donoId || turma.professorId === donoId;
      if (!ligado) return res.status(403).json({ error: "Sem permissão nesta turma" });
    }

    const data = await montarRespostaElencos(donoId, turmaId);
    return res.json(data);
  } catch (e) {
    console.error("[listarElencosMinha] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar elencos." });
  }
}

export async function escalaPorTurma(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const turmaId = String(req.query.turmaId || "");
    if (!userId) return res.status(401).json({ error: "Não autenticado" });
    if (!turmaId) return res.status(400).json({ error: "turmaId obrigatório" });

    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    ]);
    const donoId = clube?.id || escolinha?.id || professor?.id || null;

    const turma = await prisma.turma.findUnique({
      where: { id: turmaId },
      select: { id: true, clubeId: true, escolinhaId: true, professorId: true, nome: true },
    });
    if (!turma) return res.status(404).json({ error: "Turma não encontrada" });
    if (!donoId ||
        (turma.clubeId !== donoId && turma.escolinhaId !== donoId && turma.professorId !== donoId)) {
      return res.status(403).json({ error: "Sem permissão nesta turma" });
    }

    const elenco = await prisma.elenco.findFirst({
      where: { turmaId: turmaId },
      select: { id: true, nome: true, maxJogadores: true, escala: true },
    });

    if (!elenco) return res.json(null);

    const escala = (elenco.escala as Record<string, string | null>) || {};
    const atletasIds = Object.values(escala).filter(Boolean) as string[];

    const atletas = atletasIds.length
      ? await prisma.atleta.findMany({
          where: { id: { in: atletasIds } },
          select: { id: true, usuarioId: true, nome: true, foto: true, idade: true, posicao: true },
        })
      : [];

    const byId = new Map(atletas.map(a => [a.id, a]));
    const escalaEnriquecida: any = {};
    Object.entries(escala).forEach(([pos, atletaId]) => {
      const a = atletaId ? byId.get(atletaId) : null;
      escalaEnriquecida[pos] = a
        ? { atletaId: a.id, usuarioId: a.usuarioId, nome: a.nome, foto: a.foto, idade: a.idade, posicao: a.posicao }
        : null;
    });

    return res.json({
      id: elenco.id,
      nome: elenco.nome ?? turma.nome ?? "Elenco",
      maxJogadores: elenco.maxJogadores ?? 11,
      escala: escalaEnriquecida,
    });
  } catch (e) {
    console.error("[escalaPorTurma] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar escala." });
  }
}

export async function criarElenco(req: AuthenticatedRequest, res: Response) {
  try {
    const { nome, maxJogadores, escala, turmaId } = req.body as {
      nome?: string; maxJogadores?: number; escala?: any; turmaId: string;
    };
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });
    if (!turmaId) return res.status(400).json({ error: "turmaId obrigatório" });

    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    ]);
    const donoId = clube?.id || escolinha?.id || professor?.id || null;

    const turma = await prisma.turma.findUnique({
      where: { id: turmaId },
      select: { id: true, clubeId: true, escolinhaId: true, professorId: true },
    });
    if (!turma) return res.status(404).json({ error: "Turma não encontrada" });
    if (!donoId ||
        (turma.clubeId !== donoId && turma.escolinhaId !== donoId && turma.professorId !== donoId)) {
      return res.status(403).json({ error: "Sem permissão nesta turma" });
    }

    const created = await prisma.elenco.create({
      data: {
        nome: nome ?? "Elenco",
        maxJogadores: maxJogadores ?? 11,
        escala: escala ?? {},
        turmaId,
        clubeId: turma.clubeId ?? null,
        escolinhaId: turma.escolinhaId ?? null,
        professorId: turma.professorId ?? null,
      },
      select: { id: true },
    });
    return res.json(created);
  } catch (e) {
    console.error("[criarElenco] erro:", e);
    return res.status(500).json({ error: "Erro ao criar elenco." });
  }
}

export async function atualizarElenco(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id || "");
    const { nome, maxJogadores, escala, turmaId } = req.body as {
      nome?: string; maxJogadores?: number; escala?: any; turmaId?: string;
    };
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const elenco = await prisma.elenco.findUnique({
      where: { id },
      select: { id: true, turmaId: true },
    });
    if (!elenco) return res.status(404).json({ error: "Elenco não encontrado" });

    const turma = await prisma.turma.findUnique({
      where: { id: turmaId || elenco.turmaId || "" },
      select: { id: true, clubeId: true, escolinhaId: true, professorId: true },
    });
    if (!turma) return res.status(404).json({ error: "Turma do elenco não encontrada" });

    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    ]);
    const donoId = clube?.id || escolinha?.id || professor?.id || null;

    if (!donoId ||
        (turma.clubeId !== donoId && turma.escolinhaId !== donoId && turma.professorId !== donoId)) {
      return res.status(403).json({ error: "Sem permissão nesta turma" });
    }

    await prisma.elenco.update({
      where: { id },
      data: {
        nome: nome ?? undefined,
        maxJogadores: maxJogadores ?? undefined,
        escala: escala ?? undefined,
        turmaId: turmaId ?? undefined,
      },
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error("[atualizarElenco] erro:", e);
    return res.status(500).json({ error: "Erro ao atualizar elenco." });
  }
}
