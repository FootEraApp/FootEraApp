import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import {
  createTreinoProgramado,
  updateTreino,
  deleteTreino,
  getTreinoById,
  getAllTreinos,
} from '../controllers/treinosProgramadosController.js';
import { requireUsage } from '../services/usage.js';

const router = express.Router();

router.get('/:id', authenticateToken, getTreinoById);
router.get('/', authenticateToken, getAllTreinos);

router.post('/', authenticateToken, async (req, res) => {
  const isTemplate = !!req.body?.naoExpira === true;
  const key = isTemplate ? 'templates_total' : 'planos_ativos_total';
  const chk = await requireUsage(req as any, res, key);
  if (chk === undefined) return;
  return createTreinoProgramado(req, res);
});

router.put('/:id', authenticateToken, updateTreino);
router.delete('/:id', authenticateToken, deleteTreino);

export default router;