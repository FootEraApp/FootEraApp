import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.post("/api/treinos/elencos", async (req, res) => {
  try {
    const { nome, atletasIds, tipoUsuarioId, organizacaoId, ownerTipo } = req.body || {};
    const ownerId = tipoUsuarioId || organizacaoId;

    if (!nome || !Array.isArray(atletasIds) || atletasIds.length === 0 || !ownerId) {
      return res.status(400).json({ error: "nome, atletasIds[] e tipoUsuarioId/organizacaoId são obrigatórios." });
    }

    let escolinhaId: string | undefined;
    let clubeId: string | undefined;
    let professorId: string | undefined;

    if (ownerTipo === "Escolinha") escolinhaId = ownerId;
    if (ownerTipo === "Clube") clubeId = ownerId;
    if (ownerTipo === "Professor") professorId = ownerId;

    if (!ownerTipo) {
      const [escolinha, clube, professor] = await Promise.all([
        prisma.escolinha.findUnique({ where: { id: ownerId } }),
        prisma.clube.findUnique({ where: { id: ownerId } }),
        prisma.professor.findUnique({ where: { id: ownerId } }),
      ]);

      if (escolinha) escolinhaId = ownerId;
      else if (clube) clubeId = ownerId;
      else if (professor) professorId = ownerId;
      else {
        return res.status(404).json({ error: "Organização/Professor não encontrado para o tipoUsuarioId/organizacaoId fornecido." });
      }
    }

    const created = await prisma.elenco.create({
      data: {
        nome,
        atletasIds,
        ativo: true,
        escolinhaId,
        clubeId,
        professorId,
      },
    });

    return res.status(201).json(created);
  } catch (e: any) {
    console.error("POST /api/treinos/elencos error:", e);
    return res.status(500).json({ error: "Falha ao criar elenco." });
  }
});

router.get("/api/treinos/elencos", async (req, res) => {
  try {
    const ownerId = (req.query.tipoUsuarioId as string) || (req.query.organizacaoId as string);
    if (!ownerId) return res.status(400).json({ error: "tipoUsuarioId/organizacaoId é obrigatório." });

    const items = await prisma.elenco.findMany({
      where: {
        OR: [
          { escolinhaId: ownerId },
          { clubeId: ownerId },
          { professorId: ownerId },
        ],
      },
      orderBy: { dataCriacao: "desc" },
    });

    return res.json(items);
  } catch (e: any) {
    console.error("GET /api/treinos/elencos error:", e);
    return res.status(500).json({ error: "Falha ao listar elencos." });
  }
});

export default router;