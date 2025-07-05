import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();

export const buscar = async (req: Request, res: Response) => {
  try {
    const termo = req.query.termo?.toString().toLowerCase();
    const userId = req.userId;

    if (!termo) {
      return res.status(400).json({ message: "Digite algo para buscar." });
    }

    const seguindoIds = await prisma.seguidor.findMany({
      where: { seguidorUsuarioId: userId },
      select: { seguidoUsuarioId: true }
    });

    const seguidos = seguindoIds.map(s => s.seguidoUsuarioId);

    const atletas = await prisma.atleta.findMany({
      where: {
        OR: [
          { nome: { contains: termo, mode: "insensitive" } },
          { sobrenome: { contains: termo, mode: "insensitive" } }
        ]
      },
      include: { usuario: true }
    });

    const clubes = await prisma.clube.findMany({
      where: {
        nome: { contains: termo, mode: "insensitive" }
      },
      include: { usuario: true }
    });

    const escolinhas = await prisma.escolinha.findMany({
      where: {
        nome: { contains: termo, mode: "insensitive" }
      },
      include: { usuario: true }
    });

    const postagens = await prisma.postagem.findMany({
      include: { usuario: true },
      orderBy: { dataCriacao: "desc" },
      take: 10
    });

    res.json({ atletas, clubes, escolinhas, postagens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro interno." });
  }
};

export const explorar = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });

    let local: any = {};
    if (usuario.tipo === "Atleta") {
      local = await prisma.atleta.findUnique({
        where: { usuarioId: userId },
        select: { nacionalidade: true, naturalidade: true }
      });
    } else if (usuario.tipo === "Clube") {
      local = await prisma.clube.findUnique({
        where: { usuarioId: userId },
        select: { cidade: true, estado: true, pais: true, bairro: true }
      });
    } else if (usuario.tipo === "Escolinha") {
      local = await prisma.escolinha.findUnique({
        where: { usuarioId: userId },
        select: { cidade: true, estado: true, pais: true, bairro: true }
      });
    }

    const seguindoIds = await prisma.seguidor.findMany({
      where: { seguidorUsuarioId: userId },
      select: { seguidoUsuarioId: true }
    });
    const seguidos = seguindoIds.map(s => s.seguidoUsuarioId);

    const atletas = await prisma.atleta.findMany({
      where: {
        usuarioId: { not: userId },
        AND: [
          { naturalidade: local.estado },
          { naturalidade: local.cidade},
          { nacionalidade: local.pais }
        ],
        NOT: { usuarioId: { in: seguidos } }
      },
      include: { usuario: true },
      take: 9
    });

    const clubes = await prisma.clube.findMany({
      where: {
        usuarioId: { not: userId },
        AND: [
          { cidade: local.cidade },
          { estado: local.estado },
          { pais: local.pais },
          { bairro: local.bairro }
        ],
        NOT: { usuarioId: { in: seguidos } }
      },
      include: { usuario: true }
    });

    const escolinhas = await prisma.escolinha.findMany({
      where: {
        usuarioId: { not: userId },
        AND: [
          { cidade: local.cidade },
          { estado: local.estado },
          { pais: local.pais },
          { bairro: local.bairro }
        ],
        NOT: { usuarioId: { in: seguidos } }
      },
      include: { usuario: true }
    });

    const postagens = await prisma.postagem.findMany({
      include: { usuario: true },
      orderBy: { dataCriacao: "desc" },
      take: 10
    });

    res.json({ atletas, clubes, escolinhas, postagens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro interno." });
  }
};
