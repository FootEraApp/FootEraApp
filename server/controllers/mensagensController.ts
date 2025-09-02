import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";

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

export const enviarMensagem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deId = req.userId!;
    const { paraId, conteudo, tipo = "NORMAL", clientMsgId } = req.body;

    if (!deId || !paraId || !conteudo) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const nova = await prisma.mensagem.create({
      data: { deId, paraId, conteudo, tipo },
    });

    const payload = { ...nova, clientMsgId, pending: false };

    const io = getIO();
    if (io) {
      io.to(deId).emit("novaMensagem", payload);
      io.to(paraId).emit("novaMensagem", payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
};

export const enviarMensagemGrupo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usuarioId = req.userId!;
    const { grupoId } = req.params as { grupoId: string };
    const { conteudo, clientMsgId } = req.body as { conteudo: string; clientMsgId?: string };

    if (!conteudo?.trim()) return res.status(400).json({ error: "Conteúdo obrigatório." });

    const ehMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId } },
    });
    if (!ehMembro) return res.status(403).json({ error: "Você não participa deste grupo." });

    const nova = await prisma.mensagemGrupo.create({
      data: { grupoId, usuarioId, conteudo, tipo: "NORMAL" },
      include: { usuario: { select: { id: true, nome: true, foto: true } } },
    });

    const payload = { ...nova, clientMsgId, pending: false };

    const io = getIO();
    if (io) {
      io.to(grupoId).emit("novaMensagemGrupo", payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    console.error("Erro ao enviar mensagem ao grupo:", error);
    return res.status(500).json({ error: "Erro ao enviar mensagem ao grupo" });
  }
};

export async function deletarMensagem(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id || req.userId; 
  const io = getIO();

  try {
    const msgPriv = await prisma.mensagem.findUnique({ where: { id } });
    if (msgPriv) {
      if (msgPriv.deId !== userId) {
        return res.status(403).json({ error: "Sem permissão para apagar." });
      }

      await prisma.mensagem.delete({ where: { id } });

      if (io) {
        io.to(msgPriv.deId).emit("mensagemDeletada", { id });
        io.to(msgPriv.paraId).emit("mensagemDeletada", { id });
      }

      return res.status(204).send();
    }

    const msgGrupo = await prisma.mensagemGrupo.findUnique({ where: { id } });
    if (msgGrupo) {
      if (msgGrupo.usuarioId !== userId) {
        return res.status(403).json({ error: "Sem permissão para apagar." });
      }

      await prisma.mensagemGrupo.delete({ where: { id } });

      if (io) {
         io.to(msgGrupo.grupoId).emit("mensagemDeletada", { id });
      }

      return res.status(204).send();
    }

    return res.status(404).json({ error: "Mensagem não encontrada." });
  } catch (err) {
    console.error("Erro ao deletar mensagem:", err);
    return res.status(500).json({ error: "Erro interno ao deletar mensagem." });
  }
}