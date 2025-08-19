import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js"; 
import { AuthenticatedRequest } from "server/middlewares/auth.js";
import { TipoMembro } from "@prisma/client";

export async function criarGrupo(req: AuthenticatedRequest, res: Response) {
  const { nome, descricao, membros } = req.body as {
    nome: string;
    descricao?: string;
    membros: string[];
  };

  const ownerId = req.userId;
  if (!ownerId) return res.status(401).json({ error: "Não autenticado" });
  if (!nome || !Array.isArray(membros)) {
    return res.status(400).json({ error: "Nome e lista de membros são obrigatórios" });
  }

  try {
    const membrosUnicos = Array.from(new Set(membros)).filter((id) => id !== ownerId);

    const grupo = await prisma.grupo.create({
      data: {
        nome,
        descricao: descricao ?? null,
        ownerId,
        membros: {
          create: [
            {
              usuarioId: ownerId,         
              tipo: TipoMembro.ADMIN,    
            },
            ...membrosUnicos.map((uid) => ({
              usuarioId: uid,          
              tipo: TipoMembro.MEMBRO,
            })),
          ],
        },
      },
      include: {
        owner: true,
        membros: { include: { usuario: true } },
      },
    });

    return res.status(201).json(grupo);
  } catch (error) {
    console.error("Erro ao criar grupo:", error);
    return res.status(500).json({ error: "Erro ao criar grupo" });
  }
}

export async function listarMeusGrupos(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  try {
    const grupos = await prisma.grupo.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { membros: { some: { usuarioId: userId } } },
        ],
      },
      include: {
        _count: { select: { membros: true } },
        membros: {
          take: 5,
          include: { usuario: { select: { id: true, nome: true, foto: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const payload = grupos.map(g => ({
      id: g.id,
      nome: g.nome,
      descricao: g.descricao,
      ownerId: g.ownerId,
      totalMembros: g._count.membros,
      membrosPreview: g.membros.map(m => m.usuario),
    }));

    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
}