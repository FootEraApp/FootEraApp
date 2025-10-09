import express from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import {
  criarProfessor,
  editarProfessor,
  excluirProfessor,
  listarProfessores,
  buscarProfessorPorId,
} from "../controllers/professoresController.js";
import { authenticateToken } from "../middlewares/auth.js";

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ dest: "upload/" });

router.post("/:id/vinculo", async (req, res, next) => {
  try {
    const { id: professorId } = req.params;
    const { organizacaoId } = req.body || {};
    if (!organizacaoId) {
      return res.status(400).json({ error: "organizacaoId é obrigatório" });
    }

    const [e, c] = await Promise.all([
      prisma.escolinha.findUnique({ where: { id: organizacaoId }, select: { id: true, nome: true } }),
      prisma.clube.findUnique({ where: { id: organizacaoId }, select: { id: true, nome: true } }),
    ]);
    const tipo: "Escolinha" | "Clube" | null = e ? "Escolinha" : c ? "Clube" : null;
    if (!tipo) return res.status(404).json({ error: "Organização não encontrada" });

    await prisma.$transaction(async (tx) => {
      await tx.relacaoTreinamento.deleteMany({
        where: { professorId, atletaId: null },
      });

      await tx.relacaoTreinamento.create({
        data: {
          professorId,
          atletaId: null,
          escolinhaId: tipo === "Escolinha" ? organizacaoId : null,
          clubeId: tipo === "Clube" ? organizacaoId : null,
        },
      });
    });

    res.status(200).json({ ok: true, tipo, organizacaoId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/vinculos", authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const prof = await prisma.professor.findUnique({
      where: { id },
      select: { escolinhaId: true, clubeId: true },
    });
    if (!prof) return res.json([]);

    const [e, c] = await Promise.all([
      prof.escolinhaId
        ? prisma.escolinha.findUnique({ where: { id: prof.escolinhaId }, select: { id: true, nome: true } })
        : null,
      prof.clubeId
        ? prisma.clube.findUnique({ where: { id: prof.clubeId }, select: { id: true, nome: true } })
        : null,
    ]);

    const out = [];
    if (e) out.push({ id: e.id, nome: e.nome, tipo: "Escolinha" });
    if (c) out.push({ id: c.id, nome: c.nome, tipo: "Clube" });

    res.json(out);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", buscarProfessorPorId);
router.post("/", upload.single("fotoUrl"), criarProfessor);
router.patch("/:id", upload.single("fotoUrl"), editarProfessor);
router.put("/:id", upload.single("fotoUrl"), editarProfessor);
router.delete("/:id", excluirProfessor);
router.get("/", listarProfessores);

export default router;