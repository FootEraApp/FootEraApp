import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "footera_secret"

export const adminDashboard = async (_: Request, res: Response) => {
  try {
    const [
      totalUsuarios,
      totalAtletas,
      totalClubes,
      totalEscolinhas,
      totalAdministradores,
      totalMidias,
      totalVerificados,
      totalNaoVerificados,
      totalPostsCriados,
      totalTreinos,
      totalDesafios,
      exercicios,
      professores,
      treinos,
      desafios
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.atleta.count(),
      prisma.clube.count(),
      prisma.escolinha.count(),
      prisma.usuario.count({ where: { tipo: TipoUsuario.Admin } }),
      prisma.usuario.count({ where: { tipo: TipoUsuario.Professor } }),
      prisma.usuario.count({ where: { verified: true } }),
      prisma.usuario.count({ where: { verified: false } }),
      prisma.postagem.count(),
      prisma.treinoProgramado.count(),
      prisma.desafioOficial.count(),
      prisma.exercicio.findMany(),
      prisma.professor.findMany({ include: { usuario: true } }),
      prisma.treinoProgramado.findMany(),
      prisma.desafioOficial.findMany()
    ]);

    const taxaVerificacao = totalUsuarios === 0 ? 0 : totalVerificados / totalUsuarios;

    res.json({
      totalUsuarios,
      totalAtletas,
      totalClubes,
      totalEscolinhas,
      totalAdministradores,
      totalMidias,
      totalVerificados,
      totalNaoVerificados,
      totalPostsCriados,
      totalTreinos,
      totalDesafios,
      taxaVerificacao,
      exercicios,
      professores,
      treinos,
      desafios
    });
  } catch (error) {
    console.error("Erro no dashboard admin:", error);
    res.status(500).json({ error: "Erro ao carregar dados do painel" });
  }
};
export async function loginAdmin(req: Request, res: Response) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ message: "Email e senha são obrigatórios." });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return res.status(401).json({ message: "Email incorreto." });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      return res.status(401).json({ message: "Senha incorretos." });
    }

    if (usuario.tipo !== "Admin") {
      return res.status(403).json({ message: "Você não é um administrador." });
    }

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "Login como administrador realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
      },
      token,
    });
  } catch (error) {
    console.error("Erro no login admin:", error);
    return res.status(500).json({ message: "Erro interno do servidor." });
  }
}
