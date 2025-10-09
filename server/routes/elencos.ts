import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/auth.js";
import { requireMembership } from "../middlewares/requireMembership.js";
import { getEscalaPorElencoId, getEscalaPorDono } from "../controllers/treinosController.js";

const prisma = new PrismaClient();
const router = Router();

async function resolveOwner(req: any, organizacaoId?: string) {
  if (organizacaoId) {
    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
      prisma.escolinha.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
      prisma.professor.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
    ]);
    if (clube) return { kind: "clube" as const, id: clube.id };
    if (escolinha) return { kind: "escolinha" as const, id: escolinha.id };
    if (professor) return { kind: "professor" as const, id: professor.id };
  }

  const userId = req.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const [prof, clube, escolinha] = await Promise.all([
    prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
  ]);

  if (prof) return { kind: "professor" as const, id: prof.id };
  if (clube) return { kind: "clube" as const, id: clube.id };
  if (escolinha) return { kind: "escolinha" as const, id: escolinha.id };
  throw new Error("Não foi possível identificar a entidade (Professor/Clube/Escolinha).");
}

async function filtraVinculados(owner: { kind: "professor"|"clube"|"escolinha"; id: string}, atletasIds: string[]) {
  if (atletasIds.length === 0) return [];
  const whereOwner =
    owner.kind === "professor" ? { professorId: owner.id } :
    owner.kind === "clube"     ? { clubeId: owner.id } :
                                 { escolinhaId: owner.id };

  const rels = await prisma.relacaoTreinamento.findMany({
    where: { ...whereOwner, atletaId: { in: atletasIds } },
    select: { atletaId: true },
  });

  if (owner.kind !== "professor") {
    const direta = await prisma.atleta.findMany({
      where: owner.kind === "clube" ? { id: { in: atletasIds }, clubeId: owner.id }
                                    : { id: { in: atletasIds }, escolinhaId: owner.id },
      select: { id: true },
    });
    const ids = new Set([ ...rels.map(r => r.atletaId), ...direta.map(a => a.id) ]);
    return Array.from(ids);
  }

  return Array.from(new Set(rels.map(r => r.atletaId)));
}

router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const { nome, organizacaoId, atletasIds = [] } = req.body as { nome: string; organizacaoId?: string; atletasIds?: string[] };
    if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório." });

    const owner = await resolveOwner(req, organizacaoId);
    const validIds = await filtraVinculados(owner, atletasIds);

    const data: any = { nome: nome.trim(), atletasIds: validIds };
    if (owner.kind === "professor") data.professorId = owner.id;
    if (owner.kind === "clube") data.clubeId = owner.id;
    if (owner.kind === "escolinha") data.escolinhaId = owner.id;

    const turma = await prisma.elenco.create({ data });
    res.json(turma);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Falha ao criar turma." });
  }
});

router.post("/../turmas", (req, res, next) => (router as any).handle(req, res, next));

router.get("/", async (req, res) => {
  try {
    const { organizacaoId, tipoUsuarioId } = req.query as any;

    const where: any = {};
    if (organizacaoId) {
      const [clube, escolinha] = await Promise.all([
        prisma.clube.findUnique({ where: { id: String(organizacaoId) }, select: { id: true } }),
        prisma.escolinha.findUnique({ where: { id: String(organizacaoId) }, select: { id: true } }),
      ]);
      if (clube) where.clubeId = clube.id;
      else if (escolinha) where.escolinhaId = escolinha.id;
      else return res.json([]);
    } else if (tipoUsuarioId) {
      where.OR = [
        { professorId: String(tipoUsuarioId) },
        { clubeId: String(tipoUsuarioId) },
        { escolinhaId: String(tipoUsuarioId) },
      ];
    } else {
      const owner = await resolveOwner(req);
      if (owner.kind === "professor") where.professorId = owner.id;
      if (owner.kind === "clube") where.clubeId = owner.id;
      if (owner.kind === "escolinha") where.escolinhaId = owner.id;
    }

    const turmas = await prisma.elenco.findMany({
      where,
      orderBy: { dataCriacao: "desc" },
      select: { id: true, nome: true, atletasIds: true },
    });

    res.json(turmas);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Falha ao listar turmas." });
  }
});

router.get("/minha", async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const where =
      owner.kind === "professor" ? { professorId: owner.id } :
      owner.kind === "clube"     ? { clubeId: owner.id } :
                                   { escolinhaId: owner.id };

    const turmas = await prisma.elenco.findMany({
      where, orderBy: { dataCriacao: "desc" },
      select: { id: true, nome: true, atletasIds: true },
    });

    res.json(turmas);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Falha ao listar turmas do usuário." });
  }
});

router.get("/:id/escala", authenticateToken, getEscalaPorElencoId);
router.get("/por-escolinha/:escolinhaId/escala", authenticateToken, requireMembership, getEscalaPorDono);
router.get("/por-clube/:clubeId/escala", authenticateToken, requireMembership, getEscalaPorDono);

export default router;