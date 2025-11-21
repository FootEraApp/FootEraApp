import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import { requireUsage } from '../services/usage.js';
import { agendarTreino } from '../controllers/treinosController.js';

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const chk = await requireUsage(req as any, res, 'treinos_semana');
  if (chk === undefined) return; 
  return agendarTreino(req, res);
});

export default router;
