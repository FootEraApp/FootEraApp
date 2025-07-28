import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

export async function login(req: Request, res: Response) {
  const { nomeDeUsuario, senha } = req.body;

  if (!nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Nome de usuário e senha são obrigatórios" });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { nomeDeUsuario },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaCorreta) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    let tipoUsuarioId: string | null = null;

    if (usuario.tipo === "Atleta") {
      const atleta = await prisma.atleta.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = atleta?.id || null;
    } else if (usuario.tipo === "Professor") {
      const professor = await prisma.professor.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = professor?.id || null;
    } else if (usuario.tipo === "Clube") {
      const clube = await prisma.clube.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = clube?.id || null;
    } else if (usuario.tipo === "Escolinha") {
      const escolinha = await prisma.escolinha.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = escolinha?.id || null;
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        tipo: usuario.tipo,
      },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login bem-sucedido",
      token,
      tipo: usuario.tipo,
      nome: usuario.nomeDeUsuario,
      id: usuario.id,
      tipoUsuarioId, 
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
  } catch (err) {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
};