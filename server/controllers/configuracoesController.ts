import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import jwt from "jsonwebtoken";

const REQUIRED_PHRASE = "Excluir Conta Footera";

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

function extractUserId(req: Request): string | null {
  const r: any = req;
  if (r.user?.id) return r.user.id;
  if (r.usuarioId) return r.usuarioId;
  if (r.usuario?.id) return r.usuario.id;
  if (r.auth?.id) return r.auth.id;
  if (r.userId) return r.userId;

  const raw = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  if (!raw) return null;
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  try {
    const payload: any = jwt.verify(token, process.env.JWT_SECRET || "");
    return payload?.id || payload?.sub || null;
  } catch {
    return null;
  }
}

export async function solicitarExclusaoConta(req: Request, res: Response) {
  const userId = req.userId; 
  const { confirm } = req.body ?? {};

  if (!userId) return res.status(401).json({ message: "Não autenticado." });
  if ((confirm ?? "").trim() !== REQUIRED_PHRASE) {
    return res.status(400).json({ message: `Digite exatamente "${REQUIRED_PHRASE}".` });
  }

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.usuario.update({
    where: { id: userId },
    data: {
      deletedAt: now,
      deleteScheduledAt: in30,
      tokenVersion: { increment: 1 },
      lastLogoutAt: now,
    },
  });

  return res.status(200).json({
    message: "Conta movida para lixeira. Você tem 30 dias para reativar antes da exclusão definitiva.",
    deleteScheduledAt: in30,
  });
}