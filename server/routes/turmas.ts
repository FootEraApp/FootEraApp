import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/auth.js";

const prisma = new PrismaClient();
const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const q = req.query || {};
    const owner = String(
      q.organizacaoId || q.tipoUsuarioId || q.escolinhaId || q.clubeId || q.professorId || ""
    );

    let where = {};
    if (q.escolinhaId) where = { escolinhaId: String(q.escolinhaId) };
    else if (q.clubeId) where = { clubeId: String(q.clubeId) };
    else if (q.professorId) where = { professorId: String(q.professorId) };
    else if (owner) where = { OR: [{ escolinhaId: owner }, { clubeId: owner }, { professorId: owner }] };

    const rows = await prisma.elenco.findMany({
      where: Object.keys(where).length ? where : undefined,
      select: { id: true, nome: true, atletasIds: true },
      orderBy: { dataCriacao: "desc" },
    });

    res.json(rows.map(r => ({ id: r.id, nome: r.nome, atletasIds: r.atletasIds ?? [] })));
  } catch (e) {
    console.error("Erro /api/turmas:", e);
    res.status(500).json({ error: "Erro ao listar turmas." });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { nome, organizacaoId: orgFromBody, tipoUsuarioId, atletasIds } = req.body || {};
    const organizacaoId = orgFromBody || tipoUsuarioId; // <- aceita os dois

    if (!nome || !organizacaoId) {
      return res.status(400).json({ error: "nome e organizacaoId são obrigatórios" });
    }

    const [escolinha, clube, professor] = await Promise.all([
      prisma.escolinha.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
      prisma.clube.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
      prisma.professor.findUnique({ where: { id: organizacaoId }, select: { id: true } }),
    ]);
    if (!escolinha && !clube && !professor) {
      return res.status(404).json({ error: "Organização não encontrada" });
    }

    const created = await prisma.elenco.create({
      data: {
        nome: String(nome),
        atletasIds: Array.isArray(atletasIds) ? atletasIds.map(String) : [],
        escolinhaId: escolinha ? organizacaoId : null,
        clubeId: clube ? organizacaoId : null,
        professorId: professor ? organizacaoId : null,
      },
      select: { id: true, nome: true, atletasIds: true },
    });

    res.status(201).json(created);
  } catch (e) {
    console.error("Erro ao criar turma:", e);
    res.status(500).json({ error: "Erro ao criar turma." });
  }
});

export default router;