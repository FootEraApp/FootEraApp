// server/controllers/loginController.ts
import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

const hashSenha = (senha: string) =>
  createHash("sha256").update(senha).digest("base64");

export const login = async (req: Request, res: Response) => {
  const { nomeDeUsuario, senha } = req.body;

  if (!nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Usuário e senha obrigatórios." });
  }

  try {
    const senhaHash = hashSenha(senha);

    const usuario = await prisma.usuario.findFirst({
      where: { nomeDeUsuario, senhaHash }
    });

    if (!usuario) {
      return res.status(401).json({ message: "Usuário ou senha inválidos." });
    }

    // Verificação extra para atletas
    if (usuario.tipo === "Atleta") {
      const atleta = await prisma.atleta.findUnique({ where: { usuarioId: usuario.id } });
      if (!atleta) {
        return res.status(403).json({ message: "Perfil de atleta não encontrado." });
      }
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        tipo: usuario.tipo,
        nome: usuario.nomeDeUsuario
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
        email: usuario.email
      }
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno ao tentar logar." });
  }
};

export const logout = async (_req: Request, res: Response) => {
  // Como JWT é stateless, o logout depende do front-end apagar o token.
  // Se você quiser invalidar tokens, use lista de blacklist no servidor.
  res.status(200).json({ message: "Logout efetuado com sucesso (front deve apagar o token)." });
};
