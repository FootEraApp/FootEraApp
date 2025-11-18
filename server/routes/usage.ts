import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import { getUsage } from '../controllers/usageController.js';

const router = express.Router();

router.get('/', authenticateToken, getUsage);

export default router;