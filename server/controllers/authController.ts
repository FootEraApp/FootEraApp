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
      where: {
        nomeDeUsuario,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaCorreta) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: usuario.id,
        tipo: usuario.tipo,
       },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "7d" }
    );

    console.log("TOKEN GERADO:", token);
    console.log("USUÁRIO ENCONTRADO:", usuario);

    return res.json({
      message: "Login bem-sucedido",
      token,
      usuario,
      tipo: usuario.tipo, 
      nome: usuario.nomeDeUsuario,
      id: usuario.id,
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

export async function cadastrarUsuario(req: Request, res: Response) {
  const { tipo, nome, email, nomeDeUsuario, senha } = req.body;

  if (!tipo || !nome || !email || !nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Dados incompletos." });
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { nomeDeUsuario },
  });

  if (usuarioExistente) {
    return res.status(400).json({ message: "Usuário já existe." });
  }

  const senhaHash = bcrypt.hashSync(senha, 10);

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      nomeDeUsuario,
      email,
      senhaHash,
      tipo,
    },
  });

  return res.status(201).json({ usuario });
}