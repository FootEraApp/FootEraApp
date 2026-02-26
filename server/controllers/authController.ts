import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getUserFlags } from "../services/flags.js";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || "footera_secret";

export async function logout(req: any, res: any) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Não autenticado." });

  await prisma.usuario.update({
    where: { id: userId },
    data: { lastLogoutAt: new Date(), lastSeenAt: new Date() },
  });

  return res.json({ ok: true });
}

export async function me(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        email: true,
        tipo: true,
        foto: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const flags = await getUserFlags(req.userId);

    return res.json({
      ...usuario,
      plano: flags.plano,
      adsEnabled: flags.adsEnabled,
      capabilities: flags.capabilities,
    });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: "Erro ao carregar dados do usuário." });
  }
}

export async function login(req: Request, res: Response) {
  const { nomeDeUsuario, senha } = req.body as { nomeDeUsuario: string; senha: string };

  if (!nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Nome de usuário e senha são obrigatórios" });
  }

  try {
    const userKey = String(nomeDeUsuario).trim();
    const lowerKey = userKey.toLowerCase();

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { nomeDeUsuario: userKey },       // mantém case como está
          { email: lowerKey },              // email normalizado
        ],
      },
      include: {
        atleta: { select: { id: true } },
        professor: { select: { id: true } },
        clube: { select: { id: true } },
        escolinha: { select: { id: true } },
        olheiro: { select: { id: true } },
        administrador: { select: { id: true } },
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (!usuario.senhaHash) {
      console.error("Usuário sem senhaHash no banco:", usuario.id, usuario.nomeDeUsuario);
      return res
        .status(500)
        .json({ message: "Usuário sem senha configurada. Contate o suporte ou recrie o usuário." });
    }

    if (usuario.deletedAt) {
      const now = Date.now();
      const base = usuario.deleteScheduledAt
        ? new Date(usuario.deleteScheduledAt).getTime()
        : new Date(usuario.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;

      const msLeft = base - now;
      const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
      const restoreAvailable = msLeft > 0;

      return res.status(410).json({
        ok: false,
        code: "ACCOUNT_DELETED",
        restoreAvailable,
        daysLeft,
        message: restoreAvailable
          ? `Sua conta foi excluída. Caso queira recuperar, faltam ${daysLeft} dia(s).`
          : "Sua conta foi excluída e o prazo de recuperação expirou.",
      });
    }

    const status = String((usuario as any).status ?? "").toUpperCase();

    if (status === "BLOQUEADO" || (usuario as any).blockedAt) {
      return res.status(403).json({
        ok: false,
        code: "ACCOUNT_BLOCKED",
        message:
          "Sua conta foi bloqueada pelo admin. Se quiser saber mais informações clique abaixo.",
        blockedReason: (usuario as any).blockedReason ?? null,
      });
    }

    const senhaCorreta = await bcrypt.compare(String(senha), usuario.senhaHash);
    if (!senhaCorreta) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    if (!usuario.verified) {
      return res.json({
        ok: false,
        needVerification: true,
        emailDestino: usuario.responsavelEmail ?? usuario.email,
        message: "Verifique seu e-mail para concluir o cadastro.",
      });
    }

    const tipoUsuarioId: string | null =
      usuario.atleta?.id ??
      usuario.professor?.id ??
      usuario.clube?.id ??
      usuario.escolinha?.id ??
      usuario.olheiro?.id ??
      usuario.administrador?.id ??
      null;

    await prisma.loginEvent.create({
      data: { usuarioId: usuario.id },
    });

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { lastLoginAt: new Date(), lastSeenAt: new Date() },
    });

    const token = jwt.sign(
      {
        id: usuario.id,
        tipo: usuario.tipo,
        tokenVersion: usuario.tokenVersion ?? 0, 
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      ok: true,
      message: "Login bem-sucedido",
      token,
      tipo: usuario.tipo,
      nomeDeUsuario: usuario.nomeDeUsuario,
      id: usuario.id,
      tipoUsuarioId,
      usuario: {
        id: usuario.id,
        nomeDeUsuario: usuario.nomeDeUsuario,
        tipo: usuario.tipo,
        email: usuario.email,
        verified: usuario.verified,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ message: "Erro no servidor" });
  }
}

export const validateToken = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token ausente" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, decoded });
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
};
