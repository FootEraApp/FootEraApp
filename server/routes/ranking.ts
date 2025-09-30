import { Router } from "express";
import { rankingController, getRanking} from "../controllers/rankingController.js";
import { rankingSemanal } from "../controllers/rankingSemanalController.js";
import { rankingGlobal, rankingPosicao } from "../controllers/rankingGlobalController.js";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.get("/snapshot", async (req, res) => {
  const last = await prisma.rankingSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
  if (!last) return res.json({ generatedAt: null, rows: [], total: 0, limit: 0, offset: 0 });

  const limit  = Math.min(Number(req.query.limit)  || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0,   0);

  const [rows, total] = await prisma.$transaction([
    prisma.rankingRow.findMany({
      where: { snapshotId: last.id },
      orderBy: { posicao: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.rankingRow.count({ where: { snapshotId: last.id } }),
  ]);

  res.json({ generatedAt: last.generatedAt, rows, total, limit, offset });
});

router.get("/weekly", rankingSemanal);
router.get("/", authenticateToken, getRanking);
router.get("/", rankingController.index);

router.get("/global", rankingGlobal);
router.get("/posicao", rankingPosicao);

export default router;