// server/controllers/logErroController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/logs
export const getLogs = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    const logs = await prisma.logErro.findMany({
      where: search
        ? {
            OR: [
              { errorMessage: { contains: String(search), mode: "insensitive" } },
              { path: { contains: String(search), mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: { timestamp: "desc" }
    });

    res.json(logs);
  } catch (error) {
    console.error("Erro ao buscar logs:", error);
    res.status(500).json({ message: "Erro interno ao buscar logs." });
  }
};

// POST /api/logs
export const createLog = async (req: Request, res: Response) => {
  try {
    const { errorMessage, requestId, timestamp, path, clientIp, userAgent, referer } = req.body;

    if (!errorMessage || !timestamp || !path || !clientIp || !userAgent) {
      return res.status(400).json({ message: "Campos obrigatórios ausentes." });
    }

    await prisma.logErro.create({
      data: {
        errorMessage,
        requestId: requestId ?? "",
        timestamp: new Date(timestamp),
        path,
        clientIp,
        userAgent,
        referer
      }
    });

    res.status(201).json({ message: "Log criado com sucesso." });
  } catch (error) {
    console.error("Erro ao registrar log:", error);
    res.status(500).json({ message: "Erro interno ao registrar log." });
  }
};
