import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import { listarAuditoria } from '../controllers/auditoriaController.js';

const router = express.Router();

router.get('/', authenticateToken, listarAuditoria);

export default router;