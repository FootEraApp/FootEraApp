import express from "express";
import {
  getAllAtletas,
  getAtletaById,
  createAtleta,
  updateAtleta,
  deleteAtleta,
  getMidiasAtleta,
  uploadMidiaAtleta,
  getProfessorDoAtleta,
  vinculosBasic,
} from "../controllers/atletaController.js";
import { authenticateToken } from "server/middlewares/auth.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/:id/vinculos-basic", authenticateToken, vinculosBasic);

router.get("/:id/midias", getMidiasAtleta);
router.post("/:id/midias", uploadMidiaAtleta);

router.get("/:id/vinculos-basic", async (req, res) => {
  try {
    const id = req.params.id;

    const atleta = await prisma.atleta.findFirst({
      where: { OR: [{ id }, { usuarioId: id }] },
      select: {
        id: true,
        escolinha: { select: { id: true, nome: true } },
        clube:     { select: { id: true, nome: true } },
      },
    });
    if (!atleta) return res.json({ professor: null, clube: null, escolinha: null });

    const [profRel, clubeRel, escolinhaRel] = await Promise.all([
      prisma.relacaoTreinamento.findFirst({
        where: { atletaId: atleta.id, NOT: { professorId: null } },
        orderBy: { criadoEm: "desc" },
        include: { professor: true },
      }),
      prisma.relacaoTreinamento.findFirst({
        where: { atletaId: atleta.id, NOT: { clubeId: null } },
        orderBy: { criadoEm: "desc" },
        include: { clube: true },
      }),
      prisma.relacaoTreinamento.findFirst({
        where: { atletaId: atleta.id, NOT: { escolinhaId: null } },
        orderBy: { criadoEm: "desc" },
        include: { escolinha: true },
      }),
    ]);

    const escolaFinal = atleta.escolinha ?? escolinhaRel?.escolinha ?? null;
    const clubeFinal  = atleta.clube     ?? clubeRel?.clube     ?? null;

    res.json({
      professor: profRel?.professor
        ? { id: profRel.professor.id, nome: profRel.professor.nome }
        : null,
      escolinha: escolaFinal
        ? { id: escolaFinal.id, nome: escolaFinal.nome }
        : null,
      clube: clubeFinal
        ? { id: clubeFinal.id, nome: clubeFinal.nome }
        : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar vínculos do atleta" });
  }
});

router.get("/:atletaId/professor", authenticateToken, getProfessorDoAtleta);
router.get("/:id", getAtletaById);
router.get("/", getAllAtletas);
router.post("/", createAtleta);
router.patch("/:id", updateAtleta);
router.delete("/:id", deleteAtleta);


export default router;