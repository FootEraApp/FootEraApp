import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Listar amigos (usuários seguidos)
export const listarAmigos = async (req: Request, res: Response) => {
  const usuarioId = req.headers["usuarioid"] as string;

  if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

  const amigos = await prisma.seguidor.findMany({
    where: { seguidorUsuarioId: usuarioId },
    select: {
      seguidoUsuario: {
        select: { id: true, nome: true, tipo: true }
      }
    }
  });

  const amigosDetalhados = await Promise.all(amigos.map(async (entry) => {
    const { id, nome, tipo } = entry.seguidoUsuario;
    let foto: string | null = null;

    if (tipo === "Atleta") {
      foto = await prisma.atleta.findFirst({ where: { usuarioId: id }, select: { foto: true } }).then(x => x?.foto ?? null);
    } else if (tipo === "Clube") {
      foto = await prisma.clube.findFirst({ where: { usuarioId: id }, select: { logo: true } }).then(x => x?.logo ?? null);
    } else if (tipo === "Escolinha") {
      foto = await prisma.escolinha.findFirst({ where: { usuarioId: id }, select: { logo: true } }).then(x => x?.logo ?? null);
    }

    return { id, nome, tipo, foto: foto ?? "/uploads/fotos/semfoto.jpg" };
  }));

  res.json({ amigos: amigosDetalhados });
};

// Seguir um usuário
export const seguirUsuario = async (req: Request, res: Response) => {
  const seguidorId = req.headers["usuarioid"] as string;
  const { seguidoId } = req.body;

  if (!seguidorId || !seguidoId || seguidorId === seguidoId) {
    return res.status(400).json({ message: "Dados inválidos" });
  }

  const jaSegue = await prisma.seguidor.findFirst({
    where: {
      seguidorUsuarioId: seguidorId,
      seguidoUsuarioId: seguidoId
    }
  });

  if (jaSegue) {
    return res.status(409).json({ message: "Você já segue este usuário" });
  }

  await prisma.seguidor.create({
    data: {
      seguidorUsuarioId: seguidorId,
      seguidoUsuarioId: seguidoId
    }
  });

  res.status(201).json({ message: "Agora você está seguindo este usuário" });
};

// Deixar de seguir
export const deixarDeSeguir = async (req: Request, res: Response) => {
  const seguidorId = req.headers["usuarioid"] as string;
  const { seguidoId } = req.body;

  const relacionamento = await prisma.seguidor.findFirst({
    where: {
      seguidorUsuarioId: seguidorId,
      seguidoUsuarioId: seguidoId
    }
  });

  if (!relacionamento) {
    return res.status(404).json({ message: "Você não segue este usuário" });
  }

  await prisma.seguidor.delete({
    where: { id: relacionamento.id }
  });

  res.json({ message: "Você deixou de seguir este usuário" });
};

// Listar seguidores
export const listarSeguidores = async (req: Request, res: Response) => {
  const usuarioId = req.headers["usuarioid"] as string;

  const seguidores = await prisma.seguidor.findMany({
    where: { seguidoUsuarioId: usuarioId },
    select: {
      seguidorUsuario: {
        select: { id: true, nome: true, tipo: true }
      }
    }
  });

  res.json({ seguidores });
};

// Listar seguidos
export const listarSeguindo = async (req: Request, res: Response) => {
  const usuarioId = req.headers["usuarioid"] as string;

  const seguindo = await prisma.seguidor.findMany({
    where: { seguidorUsuarioId: usuarioId },
    select: {
      seguidoUsuario: {
        select: { id: true, nome: true, tipo: true }
      }
    }
  });

  res.json({ seguindo });
};
