import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  const { nomeDeUsuario, senha } = req.body;

  if (!nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Usuário e senha obrigatórios." });
  }

  try {
    const usuario = await prisma.usuario.findFirst({ where: { nomeDeUsuario } });
    if (!usuario) return res.status(401).json({ message: "Usuário inválido." });

    const ok = await bcrypt.compare(senha, usuario.senhaHash);
    if (!ok) return res.status(401).json({ message: "Senha inválida." });
    
    if (usuario.tipo === "Atleta") {
      const atleta = await prisma.atleta.findUnique({ where: { usuarioId: usuario.id } });
      if (!atleta) {
        return res.status(403).json({ message: "Perfil de atleta não encontrado." });
      }
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        tipo: usuario.tipo,
        nome: usuario.nomeDeUsuario
      },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "1d" }
    );

    let tipoUsuarioId: string | undefined;
    if (usuario.tipo === "Atleta") {
      const a = await prisma.atleta.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = a?.id;
    }
    if (usuario.tipo === "Professor") {
      const p = await prisma.professor.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = p?.id;
    }
    if (usuario.tipo === "Clube") {
      const c = await prisma.clube.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = c?.id;
    }
    if (usuario.tipo === "Escolinha") {
      const e = await prisma.escolinha.findUnique({ where: { usuarioId: usuario.id } });
      tipoUsuarioId = e?.id;
    }

    return res.status(200).json({
      message: "Login efetuado com sucesso.",
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nomeDeUsuario,
        tipo: usuario.tipo,
        email: usuario.email
      }
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno ao tentar logar." });
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.status(200).json({ message: "Logout efetuado com sucesso (front deve apagar o token)." });
};