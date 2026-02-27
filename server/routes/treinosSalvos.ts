// server/routes/treinosSalvos
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

router.post('/:id/reutilizar', authenticateToken, reutilizarTreinoSalvo);
router.delete('/:id', authenticateToken, deletarTreinoSalvo);
router.delete('/__maintenance__/expirados', authenticateToken, limparTreinosSalvosExpirados);
router.get('/', authenticateToken, listarTreinosSalvos);
router.post("/", authenticateToken, criarTreinoSalvo);

export default router;