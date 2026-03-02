import { Router } from "express";
import { getDashboardOrganizacao } from "../controllers/dashboardOrganizacaoController.js";

const router = Router();

// GET /api/dashboard/organizacao?ownerTipo=Clube&ownerId=...&ano=2026
// o index está com /api/dashboard
router.get("/organizacao", getDashboardOrganizacao);

export default router;