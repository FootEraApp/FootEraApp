import { Request, Response, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  userId: string;
}

export const seguirUsuario: RequestHandler = async (req, res) => {
  const seguidorUsuarioId = req.userId!;
  const { seguidoUsuarioId } = req.body as { seguidoUsuarioId?: string };

  if (!seguidoUsuarioId) return res.status(400).json({ message: "seguidoUsuarioId é obrigatório" });
  if (seguidoUsuarioId === seguidorUsuarioId)
    return res.status(400).json({ message: "Não é permitido seguir a si mesmo." });

  const jaSegue = await prisma.seguidor.findFirst({
    where: { seguidorUsuarioId, seguidoUsuarioId },
  });
  if (jaSegue) return res.status(409).json({ message: "Você já segue este usuário." });

  await prisma.seguidor.create({ data: { seguidorUsuarioId, seguidoUsuarioId } });
  res.sendStatus(201);
};

export const deixarDeSeguir: RequestHandler = async (req, res) => {
  const seguidorUsuarioId = req.userId!;
  const seguidoUsuarioId = (req.params as any).seguidoUsuarioId || (req.body as any).seguidoUsuarioId;

  if (!seguidoUsuarioId) return res.status(400).json({ message: "seguidoUsuarioId é obrigatório" });

  const del = await prisma.seguidor.deleteMany({ where: { seguidorUsuarioId, seguidoUsuarioId } });
  if (del.count === 0) return res.status(404).json({ message: "Relação de follow não encontrada." });

  res.sendStatus(204);
};

export const listarSeguindo: RequestHandler = async (req, res) => {
  const meuId = req.userId!;
  const rows = await prisma.seguidor.findMany({
    where: { seguidorUsuarioId: meuId },
    include: { seguidoUsuario: { select: { id: true, nome: true, foto: true } } },
  });
  const seguindo = rows.map(r => ({
    id: r.seguidoUsuario.id,
    nome: r.seguidoUsuario.nome,
    foto: r.seguidoUsuario.foto ?? null,
  }));
  res.json(seguindo);
};

export async function minhaRede(req: any, res: Response) {
  try {
    const usuarioId = (req as any).userId as string; 
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const seguidos = await prisma.seguidor.findMany({
      where: { seguidorUsuarioId: usuarioId },
      include: { seguidoUsuario: { select: { id: true, nome: true, foto: true } } },
    });

    const seguidores = await prisma.seguidor.findMany({
      where: { seguidoUsuarioId: usuarioId },
      include: { seguidorUsuario: { select: { id: true, nome: true, foto: true } } },
    });

    const seguindo = seguidos.map((s) => s.seguidoUsuario);
    const seguindoSet = new Set(seguindo.map((u) => u.id));
    const seguidoresFmt = seguidores.map((s) => ({
      ...s.seguidorUsuario,
      isSeguindo: seguindoSet.has(s.seguidorUsuario.id),
    }));

    return res.json({ seguindo, seguidores: seguidoresFmt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao carregar minha rede" });
  }
}
