import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "server/middlewares/auth.js";

const prisma = new PrismaClient();

const BADGES: Record<string, { nome: string; iconUrl?: string }> = {
  "1": { nome: "Disciplina",  iconUrl: "/assets/badges/disciplina.png" },
  "2": { nome: "Pontualidade", iconUrl: "/assets/badges/pontualidade.png" },
  "3": { nome: "Liderança",   iconUrl: "/assets/badges/lideranca.png" },
};

export async function compartilharConquista(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Sem autenticação." });

  const { badgeId, mensagem } = req.body as { badgeId?: string; mensagem?: string };
  if (!badgeId) return res.status(400).json({ message: "badgeId é obrigatório." });

  const badge = BADGES[badgeId];
  if (!badge) return res.status(404).json({ message: "Badge não encontrada." });

  const conteudo =
    mensagem?.trim() ||
    `Conquista desbloqueada: ${badge.nome}! 💪`;
 try {
    const post = await prisma.postagem.create({
      data: {
        usuarioId: userId,
        conteudo,                         
        tipo: "CONQUISTA" as any,        
        badgeId: badgeId as any,          
        imagemUrl: badge.iconUrl || null, 
        dataCriacao: new Date(),
      } as any,
    });
    return res.status(201).json({ ok: true, post });
  } catch {
     const post = await prisma.postagem.create({
      data: {
        usuarioId: userId,
        conteudo,                      
        imagemUrl: badge.iconUrl || null,
        dataCriacao: new Date(),
      } as any,
    });
    return res.status(201).json({ ok: true, post });
  }
}
