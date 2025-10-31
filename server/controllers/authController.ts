import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

export async function login(req: Request, res: Response) {
  const { nomeDeUsuario, senha } = req.body as { nomeDeUsuario: string; senha: string };

  if (!nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Nome de usuário e senha são obrigatórios" });
  }

  try {
    const userKey = String(nomeDeUsuario).trim().toLowerCase();

    const usuario = await prisma.usuario.findUnique({
      where: { nomeDeUsuario: userKey },
      include: {
        atleta: true,
        professor: true,
        clube: true,
        escolinha: true,
        olheiro: true,
        administrador: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado" });
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

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      process.env.JWT_SECRET || "defaultsecret",
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

export const logout = async (_req: Request, res: Response) => {
  res.json({ message: "Logout efetuado (JWT inválido do lado cliente)" });
};

export const validateToken = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token ausente" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");
    res.json({ valid: true, decoded });
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
};
