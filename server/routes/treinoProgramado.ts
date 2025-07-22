import express from "express";
import { prisma }  from "../lib/prisma";
import { getAllTreinos, createTreinoProgramado, getTreinoById, updateTreino } from "../controllers/treinosProgramadosController";

const router = express.Router();

router.post("/", createTreinoProgramado);
router.get("/", getAllTreinos);
router.get("/:id", getTreinoById);
router.put("/:id", updateTreino);
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.treinoProgramadoExercicio.deleteMany({
      where: { treinoProgramadoId: id },
    });

    await prisma.treinoProgramado.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir treino:", error);
    res.status(500).json({ message: 'Erro ao excluir treino.' });
  }
});


export default router;
