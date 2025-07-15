import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  const { nomeDeUsuario, senha } = req.body;

  console.log("BODY RECEBIDO:", req.body);

  if (!nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Usuário e senha obrigatórios." });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { nomeDeUsuario: nomeDeUsuario.toLowerCase() } });

    if (!usuario) {
      console.log("Usuário não encontrado:", nomeDeUsuario);
      return res.status(401).json({ message: "Usuário ou senha inválidos." });
    }

    console.log("Buscando por nomeDeUsuario:", nomeDeUsuario);
    console.log("Senha digitada:", senha);
    console.log("Hash salvo no banco:", usuario.senhaHash);

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      return res.status(401).json({ message: "Usuário ou senha inválidos." });
    }

    
console.log("Senha correta?", senhaCorreta);

    const token = jwt.sign(
      {
        id: usuario.id,
        tipo: usuario.tipo,
        nome: usuario.nomeDeUsuario,
      },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: "Login efetuado com sucesso.",
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        tipo: usuario.tipo,
        email: usuario.email,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno ao tentar logar." });
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.status(200).json({ message: "Logout efetuado com sucesso (o front deve apagar o token)." });
};
