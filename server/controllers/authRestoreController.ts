import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const SECRET = process.env.JWT_SECRET || "footera_secret";

export async function restaurarConta(req: Request, res: Response) {
  // ✅ aceita nomeDeUsuario (seu front manda isso)
  const { nomeDeUsuario, email, senha } = req.body ?? {};

  if ((!nomeDeUsuario && !email) || !senha) {
    return res.status(400).json({
      ok: false,
      message: "Informe nomeDeUsuario (ou email) e senha.",
    });
  }

  // ✅ busca por nomeDeUsuario (prioridade), senão por email
  const usuario = await prisma.usuario.findFirst({
    where: nomeDeUsuario
      ? { nomeDeUsuario: String(nomeDeUsuario).trim() }
      : { email: String(email).toLowerCase().trim() },
    select: {
      id: true,
      nomeDeUsuario: true,
      email: true,
      senhaHash: true,
      tipo: true,
      tokenVersion: true,
      deletedAt: true,
      deleteScheduledAt: true,
    },
  });

  if (!usuario) {
    return res.status(404).json({ ok: false, message: "Usuário não encontrado." });
  }

  if (!usuario.deletedAt) {
    return res.status(400).json({ ok: false, message: "Sua conta não está na lixeira." });
  }

  // ✅ prazo igual ao login: deleteScheduledAt OU deletedAt + 30d
  const now = Date.now();
  const base = usuario.deleteScheduledAt
    ? new Date(usuario.deleteScheduledAt).getTime()
    : new Date(usuario.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;

  const msLeft = base - now;
  if (msLeft <= 0) {
    return res.status(410).json({
      ok: false,
      code: "RESTORE_EXPIRED",
      message: "O prazo de recuperação expirou. Entre em contato com o suporte.",
    });
  }

  const ok = await bcrypt.compare(String(senha), String(usuario.senhaHash ?? ""));
  if (!ok) {
    return res.status(401).json({ ok: false, message: "Senha inválida." });
  }

  // ✅ restaura + derruba sessões antigas
  const updated = await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      deletedAt: null,
      deleteScheduledAt: null,
      tokenVersion: { increment: 1 },
      lastLogoutAt: null,
    },
    select: { id: true, tipo: true, tokenVersion: true, nomeDeUsuario: true },
  });

  // ✅ token novo (opcional, mas útil pro auto-login)
  const token = jwt.sign(
    { id: updated.id, tipo: updated.tipo, tokenVersion: updated.tokenVersion },
    SECRET,
    { expiresIn: "7d" }
  );

  return res.json({
    ok: true,
    message: "Conta restaurada com sucesso!",
    token,
    usuario: {
      id: updated.id,
      tipo: updated.tipo,
      nomeDeUsuario: updated.nomeDeUsuario,
    },
  });
}