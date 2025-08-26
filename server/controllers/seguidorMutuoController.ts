import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;

export const buscarSeguidoresMutuos = async (req: Request, res: Response) => {
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({ mensagem: "Usuário não autenticado." });
  }

  try {
    const seguindo = await prisma.seguidor.findMany({
      where: { seguidorUsuarioId: usuarioId },
      select: { seguidoUsuarioId: true },
    });

    const idsSeguindo = seguindo.map((s) => s.seguidoUsuarioId);

    const seguidores = await prisma.seguidor.findMany({
      where: { seguidoUsuarioId: usuarioId },
      select: { seguidorUsuarioId: true },
    });

    const idsSeguidores = seguidores.map((s) => s.seguidorUsuarioId);

    const idsMutuos = idsSeguindo.filter((id) => idsSeguidores.includes(id));

    const usuariosMutuos = await prisma.usuario.findMany({
      where: { id: { in: idsMutuos } },
      select: {
        id: true,
        nome: true,
        foto: true,
        tipo: true,
      },
    });

    res.json(usuariosMutuos);
  } catch (erro) {
    console.error("Erro ao buscar seguidores mútuos:", erro);
    res.status(500).json({ mensagem: "Erro interno do servidor." });
  }
};