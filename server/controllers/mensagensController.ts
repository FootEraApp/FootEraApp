import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";
import fs from "fs/promises";
import path from "path";

async function salvarDataUrlComoPng(dataUrl: string, sub = "cards") {
  const [meta, b64] = dataUrl.split(",");
  if (!meta?.startsWith("data:image/")) throw new Error("formato inválido");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const dir = path.join(process.cwd(), "uploads", sub);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(b64, "base64"));
  return `/uploads/${sub}/${filename}`;
}

export async function enviarMensagem(req: AuthenticatedRequest, res: Response) {
  try {
    const { tipo, conteudo, paraId, clientMsgId } = req.body as {
      tipo: "NORMAL" | "POST" | "DESAFIO" | "USUARIO" | "CARD";
      conteudo: string;
      paraId: string;
      clientMsgId?: string;
    };

    let conteudoFinal = conteudo;
    if (tipo === "CARD" && typeof conteudo === "string" && conteudo.startsWith("data:image/")) {
      conteudoFinal = await salvarDataUrlComoPng(conteudo, "cards");
    }

    const saved = await prisma.mensagem.create({
      data: {
        tipo,
        conteudo: conteudoFinal,
        paraId,
        deId: req.userId!,
      },
    });

    const payload = { ...saved, clientMsgId, pending: false };

    const io = getIO();
    if (io) {
      io.to(paraId).emit("novaMensagem", payload);
      io.to(req.userId!).emit("novaMensagem", payload);
    }

    return res.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ error: msg });
  }
}

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
      ...(cursor && { skip: 1, cursor: { id: cursor as string } }),
    });

    res.json(mensagens);
  } catch {
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