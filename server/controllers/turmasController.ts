import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/turmas
// filtros: ownerTipo=Escolinha|Clube, ownerId=<id do tipo>, professorId=<id do professor>
export async function listTurmas(req: Request, res: Response) {
  try {
    const { ownerTipo, ownerId, professorId } = req.query as {
      ownerTipo?: "Escolinha" | "Clube";
      ownerId?: string;
      professorId?: string;
    };

    const where: any = {};
    if (ownerTipo === "Escolinha" && ownerId) where.escolinhaId = ownerId;
    if (ownerTipo === "Clube" && ownerId) where.clubeId = ownerId;
    if (professorId) where.professorId = professorId;

    const turmas = await prisma.turma.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        professor: { select: { id: true, nome: true, usuarioId: true, codigo: true, cref: true } },
        escolinha: { select: { id: true, nome: true } },
        clube: { select: { id: true, nome: true } },
      },
    });

    res.json({ items: turmas });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao listar turmas" });
  }
}

// POST /api/turmas
// body: { nome, categoria?, descricao?, ownerTipo, ownerId, professorId? }
export async function createTurma(req: Request, res: Response) {
  try {
    const { nome, categoria, descricao, ownerTipo, ownerId, professorId } = req.body as {
      nome: string; categoria?: string; descricao?: string;
      ownerTipo: "Escolinha" | "Clube"; ownerId: string; professorId?: string;
    };

    if (!nome?.trim()) return res.status(400).json({ message: "Nome é obrigatório" });
    if (!ownerTipo || !ownerId) return res.status(400).json({ message: "Owner da turma é obrigatório" });

    const data: any = { nome: nome.trim(), categoria, descricao, ativo: true };
    if (ownerTipo === "Escolinha") data.escolinhaId = ownerId;
    if (ownerTipo === "Clube") data.clubeId = ownerId;
    if (professorId) data.professorId = professorId;

    const nova = await prisma.turma.create({ data });
    res.status(201).json(nova);
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao criar turma" });
  }
}

// PUT /api/turmas/:id
export async function updateTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { nome, categoria, descricao, ativo } = req.body as Partial<{ nome: string; categoria: string; descricao: string; ativo: boolean }>;
    const up = await prisma.turma.update({
      where: { id },
      data: { nome, categoria, descricao, ativo },
    });
    res.json(up);
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao atualizar turma" });
  }
}

// PUT /api/turmas/:id/atribuir-professor  { professorId: string|null }
export async function setProfessorTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { professorId } = req.body as { professorId: string | null };
    const up = await prisma.turma.update({
      where: { id },
      data: { professorId: professorId || null },
    });
    res.json(up);
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao atribuir professor" });
  }
}

// DELETE /api/turmas/:id
export async function deleteTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.turma.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao remover turma" });
  }
}

// GET /api/turmas/professores-disponiveis?ownerTipo=&ownerId=
export async function professoresDisponiveis(req: Request, res: Response) {
  try {
    const { ownerTipo, ownerId } = req.query as { ownerTipo?: "Escolinha" | "Clube"; ownerId?: string };

    if (!ownerTipo || !ownerId) return res.status(400).json({ message: "Informe ownerTipo e ownerId" });

    // ⚠️ Ajuste o filtro conforme o teu schema real de vínculo professor↔organização.
    // Aqui tentamos por campos diretos (escolinhaId/clubeId) e fallback por heurística.
    const where: any = {};
    if (ownerTipo === "Escolinha") where.escolinhaId = ownerId;
    if (ownerTipo === "Clube") where.clubeId = ownerId;

    const profs = await prisma.professor.findMany({
      where,
      select: { id: true, nome: true, codigo: true, cref: true, usuarioId: true },
      orderBy: { nome: "asc" },
    });

    res.json({ items: profs });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao listar professores" });
  }
}