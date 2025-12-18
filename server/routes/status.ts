import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/status/maintenance
router.get("/maintenance", async (_req, res) => {
  try {
    const cfg = await prisma.configuracaoSistema.findFirst({
      select: { maintenanceMode: true },
    });
    return res.json({ maintenanceMode: !!cfg?.maintenanceMode });
  } catch {
    return res.json({ maintenanceMode: false });
  }
});

export default router;
