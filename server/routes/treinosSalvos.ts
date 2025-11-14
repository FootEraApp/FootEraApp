import express from 'express';
import {
  criarTreinoSalvo,
  listarTreinosSalvos,
  reutilizarTreinoSalvo,
  deletarTreinoSalvo,
  limparTreinosSalvosExpirados,
} from '../controllers/treinosSalvosController.js';
import { requireUsage } from '../services/usage.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authenticateToken, listarTreinosSalvos);

router.post('/', authenticateToken, async (req, res) => {
  const chk = await requireUsage(req as any, res, 'treinos_salvos_total');
  if (chk === undefined) return; // bloqueado ou já respondeu
  return criarTreinoSalvo(req, res);
});

router.post('/:id/reutilizar', authenticateToken, reutilizarTreinoSalvo);
router.delete('/:id', authenticateToken, deletarTreinoSalvo);

// manutenção
router.delete('/__maintenance__/expirados', authenticateToken, limparTreinosSalvosExpirados);

export default router;