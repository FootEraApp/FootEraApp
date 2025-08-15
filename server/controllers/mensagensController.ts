import { Request, Response } from "express";
import { AuthenticatedRequest } from "server/middlewares/auth.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;

export const enviarMensagem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deId = req.userId;  
    const { paraId, conteudo } = req.body;

    if (!deId || !paraId || !conteudo) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const novaMensagem = await prisma.mensagem.create({
      data: {
        deId,
        paraId,
        conteudo,
      },
    });

    res.status(201).json(novaMensagem);
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
};

export const buscarMensagens = async (req: Request, res: Response) => {
  try {
    const { deId, paraId, cursor, limit = 20 } = req.query;

    const mensagens = await prisma.mensagem.findMany({
      where: {
        OR: [
          { deId: deId as string, paraId: paraId as string },
          { deId: paraId as string, paraId: deId as string },
        ],
      },
      orderBy: { criadaEm: "desc" },
      take: Number(limit),
      ...(cursor && {
        skip: 1,
        cursor: {
          id: cursor as string,
        },
      }),
    });

    res.json(mensagens);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
};