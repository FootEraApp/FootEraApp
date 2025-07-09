import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


const prisma = new PrismaClient();

export async function login(req: Request, res: Response) {
  const { username, senha } = req.body;

  const usuario = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: username },
  });

  if (!usuario ) {
    return res.status(401).json({ message: "Usuário inválido" });
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) { 
    return res.status(401).json({ message: "Senha inválida" });
  }

  return res.json({ usuario });
}

export const logout = async (_req: Request, res: Response) => {
  // Em JWT, o logout é gerenciado no cliente, mas você pode invalidar tokens com blacklist se quiser.
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