import { Router } from "express";
import { getDashboardOrganizacao } from "../controllers/dashboardOrganizacaoController.js";

const router = Router();

router.get("/organizacao", getDashboardOrganizacao);

export default router;