import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "server/middlewares/auth.js";

const prisma = new PrismaClient();
const router = Router();

router.get("/clubes", authenticateToken, async (_req, res) => {
  try {
    const rows = await prisma.clube.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    res.json(rows);
  } catch (e) {
    console.error("GET /catalogo/clubes", e);
    res.status(500).json([]);
  }
});

router.get("/escolinhas", authenticateToken, async (_req, res) => {
  try {
    const rows = await prisma.escolinha.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    res.json(rows);
  } catch (e) {
    console.error("GET /catalogo/escolinhas", e);
    res.status(500).json([]);
  }
});

export default router;