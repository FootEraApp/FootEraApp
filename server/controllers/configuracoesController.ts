import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const getConfiguracoes = async (req: Request, res: Response) => {
  try {
    let config = await prisma.configuracaoSistema.findFirst();

    if (!config) {
      config = await prisma.configuracaoSistema.create({
        data: {
          registrationEnabled: true,
          maintenanceMode: false,
          allowAthleteChallenges: true,
          allowProfileEditing: true,
          maxDailyPosts: 5,
        },
      });
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar configurações", err });
  }
};


export const atualizarConfiguracoes = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const config = await prisma.configuracaoSistema.findFirst();

    if (!config) return res.status(404).json({ message: "Configuração não encontrada" });

    const atualizada = await prisma.configuracaoSistema.update({
      where: { id: config.id },
      data,
    });

    res.json(atualizada);
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar configurações", err });
  }
};
