import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";

const prisma = new PrismaClient();

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
