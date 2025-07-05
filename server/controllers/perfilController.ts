// src/controllers/perfilController.ts
import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();

export const getPerfil = async (req: Request, res: Response) => {
  const id = req.params.id;
  const userId = req.userId as string;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        seguidores: true,
        seguindo: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    switch (usuario.tipo) {
      case "Atleta": {
        const atleta = await prisma.atleta.findUnique({
          where: { usuarioId: id },
          include: {
            midias: true,
            clube: true,
            escolinha: true,
          },
        });

        if (!atleta) return res.status(404).json({ error: "Perfil de atleta não encontrado." });

        const seguindo = await prisma.seguidor.findFirst({
          where: {
            seguidorUsuarioId: userId,
            seguidoUsuarioId: usuario.id,
          },
        });

        return res.json({
          ...atleta,
          nomeCompleto: `${atleta.nome} ${atleta.sobrenome}`,
          seguindo: !!seguindo,
        });
      }

      case "Clube": {
        const clube = await prisma.clube.findUnique({
          where: { usuarioId: id },
          include: {
            midias: true,
          },
        });

        if (!clube) return res.status(404).json({ error: "Perfil de clube não encontrado." });

        const seguindo = await prisma.seguidor.findFirst({
          where: {
            seguidorUsuarioId: userId,
            seguidoUsuarioId: usuario.id,
          },
        });

        return res.json({
          ...clube,
          seguindo: !!seguindo,
        });
      }

      case "Escolinha": {
        const escolinha = await prisma.escolinha.findUnique({
          where: { usuarioId: id },
          include: {
            midias: true,
          },
        });

        if (!escolinha) return res.status(404).json({ error: "Perfil de escolinha não encontrado." });

        const seguindo = await prisma.seguidor.findFirst({
          where: {
            seguidorUsuarioId: userId,
            seguidoUsuarioId: usuario.id,
          },
        });

        return res.json({
          ...escolinha,
          seguindo: !!seguindo,
        });
      }

      default:
        return res.status(400).json({ error: "Tipo de usuário inválido." });
    }
  } catch (err) {
    console.error("Erro ao carregar perfil:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
};
