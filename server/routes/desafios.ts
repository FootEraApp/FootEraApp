import express from "express";
import { authenticateToken } from "server/middlewares/auth";
import { prisma } from "server/lib/prisma";
import {
  getDesafioById,
  criarSubmissaoDesafio,
  getSubmissoesPorDesafio,
  getSubmissoesPorAtleta,
  editarDesafio,
  excluirDesafio
} from "../controllers/desafiosController";

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  const { tipoUsuarioId } = req.query;

  if (!tipoUsuarioId || typeof tipoUsuarioId !== "string") {
    return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
  }

  try {
    const desafios = await prisma.desafioOficial.findMany({
      where: {
        submissoes: {
          none: {
            atletaId: tipoUsuarioId
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json(desafios);
  } catch (err) {
    console.error("Erro ao buscar desafios:", err);
    return res.status(500).json({ error: "Erro interno ao buscar desafios" });
  }
});

router.get("/:id", getDesafioById);
router.put("/:id", authenticateToken, editarDesafio);
router.delete("/:id", authenticateToken, excluirDesafio);
router.post("/:id/submissoes", criarSubmissaoDesafio);
router.get("/:id/submissoes", getSubmissoesPorDesafio);
router.get("/atleta/:atletaId/submissoes", getSubmissoesPorAtleta);

export default router;
