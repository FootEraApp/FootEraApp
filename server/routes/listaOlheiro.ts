import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import {
  criarLista, minhasListas, deletarLista, adicionarAtleta, removerAtleta,
} from '../controllers/listasOlheiroController.js';

const router = express.Router();

router.get('/', authenticateToken, minhasListas);
router.post('/', authenticateToken, criarLista);
router.delete('/:id', authenticateToken, deletarLista);

router.post('/:id/itens', authenticateToken, adicionarAtleta);
router.delete('/:id/itens/:atletaId', authenticateToken, removerAtleta);

export default router;
