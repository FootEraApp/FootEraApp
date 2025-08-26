import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";

export const enviarMensagem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deId = req.userId; 
    const { paraId, conteudo, tipo } = req.body;

    if (!deId || !paraId || !conteudo) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const novaMensagem = await prisma.mensagem.create({
      data: {
        deId,
        paraId,
        conteudo,
        tipo,
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

export const listarMensagensGrupo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usuarioId = req.userId!;
    const { grupoId } = req.params as { grupoId: string };
    const { cursor, limit = 20 } = req.query as { cursor?: string; limit?: string };

    const ehMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId } },
    });
    if (!ehMembro) return res.status(403).json({ error: "Você não participa deste grupo." });

    const mensagens = await prisma.mensagemGrupo.findMany({
      where: { grupoId },
      orderBy: { criadaEm: "desc" },
      take: Number(limit ?? 20),
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
    });

    res.json(mensagens);
  } catch (error) {
    console.error("Erro ao listar mensagens do grupo:", error);
    res.status(500).json({ error: "Erro ao listar mensagens do grupo" });
  }
};

export const enviarMensagemGrupo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usuarioId = req.userId!;
    const { grupoId } = req.params as { grupoId: string };
    const { conteudo } = req.body as { conteudo: string };

    if (!conteudo?.trim()) return res.status(400).json({ error: "Conteúdo obrigatório." });

    const ehMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId } },
    });
    if (!ehMembro) return res.status(403).json({ error: "Você não participa deste grupo." });

    const nova = await prisma.mensagemGrupo.create({
      data: { grupoId, usuarioId, conteudo }, 
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
    });

    res.status(201).json(nova);
  } catch (error) {
    console.error("Erro ao enviar mensagem ao grupo:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem ao grupo" });
  }
};