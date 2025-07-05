import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// POST /api/login
export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { nomeDeUsuario: username }
    });

    if (!usuario) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(password, usuario.senhaHash);
    if (!senhaValida) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        tipo: usuario.tipo
      },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo
      }
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

// POST /api/logout (apenas simbólico em JWT)
export const logout = async (_req: Request, res: Response) => {
  // Em JWT, o logout é gerenciado no cliente, mas você pode invalidar tokens com blacklist se quiser.
  res.json({ message: "Logout efetuado (JWT inválido do lado cliente)" });
};

// GET /api/validate-token (validação de token)
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
