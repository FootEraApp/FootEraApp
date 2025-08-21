import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/utils/mailer.js";
import { APP } from "server/config.js";

const prisma = new PrismaClient();
const RESET_TTL_MS = 30 * 60 * 1000;

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email?: string };
  const okMessage = { message: "Se este e-mail estiver cadastrado, enviaremos instruções." };
  if (!email) return res.status(200).json(okMessage);

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return res.status(200).json(okMessage);

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await prisma.passwordReset.deleteMany({ where: { usuarioId: usuario.id, usedAt: null } });
    await prisma.passwordReset.create({
      data: {
        usuarioId: usuario.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const link = `${APP.FRONTEND_URL.replace(/\/$/, "")}/resetar-senha?uid=${usuario.id}&token=${token}`;

    if (process.env.NODE_ENV !== "production") {
      console.log("[password-reset] link:", link);
    }

    await sendPasswordResetEmail(email, link);

    return res.status(200).json(okMessage);
  } catch (e) {
    console.error("forgotPassword error:", e);
    return res.status(200).json(okMessage);
  }
}


export async function resetPassword(req: Request, res: Response) {
  const { uid, token, senha } = req.body as { uid?: string; token?: string; senha?: string };

  if (!uid || !token || !senha) {
    return res.status(400).json({ message: "Dados incompletos." });
  }
  if (senha.length < 8) {
    return res.status(400).json({ message: "A senha deve ter pelo menos 8 caracteres." });
  }

  try {
    const pr = await prisma.passwordReset.findFirst({
      where: { usuarioId: uid, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
    });
    if (!pr) return res.status(400).json({ message: "Token inválido ou expirado." });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    if (tokenHash !== pr.tokenHash) {
      return res.status(400).json({ message: "Token inválido ou expirado." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await prisma.$transaction([
      prisma.usuario.update({ where: { id: uid }, data: { senhaHash } }),
      prisma.passwordReset.update({ where: { id: pr.id }, data: { usedAt: new Date() } }),
      prisma.passwordReset.deleteMany({ where: { usuarioId: uid, usedAt: null } }),
    ]);

    return res.json({ message: "Senha alterada com sucesso." });
  } catch (e) {
    console.error("resetPassword error:", e);
    return res.status(500).json({ message: "Erro ao redefinir senha." });
  }
}
