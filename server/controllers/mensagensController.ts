// server/controllers/mensagemController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../types/auth"; // Assume um middleware que injeta req.userId

const prisma = new PrismaClient();

// GET /api/mensagens/:destinatarioId
export const getMensagens = async (req: AuthenticatedRequest, res: Response) => {
  const { destinatarioId } = req.params;
  const usuarioId = req.userId;

  if (!usuarioId || !destinatarioId) {
    return res.status(400).json({ message: "Parâmetros inválidos." });
  }

  try {
    const mensagens = await prisma.mensagem.findMany({
      where: {
        OR: [
          { deId: usuarioId, paraId: destinatarioId },
          { deId: destinatarioId, paraId: usuarioId }
        ]
      },
      orderBy: { criadaEm: "asc" },
      include: {
        de: true,
        para: true
      }
    });

    // Marcar como lidas
    await prisma.mensagem.updateMany({
      where: {
        deId: destinatarioId,
        paraId: usuarioId,
        lida: false
      },
      data: { lida: true }
    });

    res.json(mensagens);
  } catch (err) {
    console.error("Erro ao buscar mensagens:", err);
    res.status(500).json({ message: "Erro interno ao buscar mensagens." });
  }
};

// POST /api/mensagens/:destinatarioId
export const enviarMensagem = async (req: AuthenticatedRequest, res: Response) => {
  const { destinatarioId } = req.params;
  const { conteudo } = req.body;
  const usuarioId = req.userId;

  if (!usuarioId || !conteudo) {
    return res.status(400).json({ message: "Dados incompletos." });
  }

  try {
    const mensagem = await prisma.mensagem.create({
      data: {
        deId: usuarioId,
        paraId: destinatarioId,
        conteudo
      }
    });

    res.status(201).json(mensagem);
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    res.status(500).json({ message: "Erro interno ao enviar mensagem." });
  }
};

// GET /api/mensagens/caixa
export const getCaixasDeMensagens = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.userId;

  try {
    const mensagens = await prisma.mensagem.findMany({
      where: {
        OR: [
          { deId: usuarioId },
          { paraId: usuarioId }
        ]
      },
      include: {
        de: true,
        para: true
      }
    });

    const caixasMap = new Map<string, any>();

    for (const m of mensagens.reverse()) {
      const outroId = m.deId === usuarioId ? m.paraId : m.deId;

      if (!caixasMap.has(outroId)) {
        caixasMap.set(outroId, {
          outroUsuarioId: outroId,
          outroUsuarioNome: m.deId === usuarioId ? m.para.nome : m.de.nome,
          outroUsuarioFoto: m.deId === usuarioId ? m.para.foto : m.de.foto,
          ultimaMensagem: m.conteudo,
          dataUltimaMensagem: m.criadaEm,
          lida: m.lida
        });
      }
    }

    res.json(Array.from(caixasMap.values()));
  } catch (err) {
    console.error("Erro ao carregar caixas de mensagens:", err);
    res.status(500).json({ message: "Erro interno." });
  }
};
