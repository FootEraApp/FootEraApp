import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// Login do admin
export const loginAdmin = async (req: Request, res: Response) => {
  const { nomeDeUsuario, senha } = req.body;

  const usuario = await prisma.usuario.findUnique({
    where: { nomeDeUsuario }
  });

  if (!usuario || usuario.tipo !== TipoUsuario.Admin) {
    return res.status(401).json({ message: "Acesso negado" });
  }

  const isValid = await bcrypt.compare(senha, usuario.senhaHash);
  if (!isValid) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const token = jwt.sign({ id: usuario.id, tipo: usuario.tipo }, process.env.JWT_SECRET || "defaultsecret", {
    expiresIn: "1d"
  });

  res.json({ token });
};

// Dashboard de estatísticas
export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const totalUsuarios = await prisma.usuario.count();
    const totalAtletas = await prisma.usuario.count({ where: { tipo: TipoUsuario.Atleta } });
    const totalClubes = await prisma.usuario.count({ where: { tipo: TipoUsuario.Clube } });
    const totalEscolinhas = await prisma.usuario.count({ where: { tipo: TipoUsuario.Escolinha } });
    const totalAdmins = await prisma.usuario.count({ where: { tipo: TipoUsuario.Admin } });

    const totalVerificados = await prisma.usuario.count({ where: { codigo: { not: null } } }); // Exemplo para simular "verificado"
    const totalNaoVerificados = totalUsuarios - totalVerificados;

    const totalMidias = await prisma.midia.count();
    const totalTreinos = await prisma.treinoProgramado.count();
    const totalDesafios = await prisma.desafioOficial.count();
    const totalPosts = await prisma.postagem.count();

    const ultimosUsuarios = await prisma.usuario.findMany({
      orderBy: { dataCriacao: "desc" },
      take: 5
    });

    const exercicios = await prisma.exercicio.findMany();
    const treinosProgramados = await prisma.treinoProgramado.findMany();
    const professores = await prisma.professor.findMany();
    const desafiosOficiais = await prisma.desafioOficial.findMany();

    return res.json({
      totalUsuarios,
      totalAtletas,
      totalClubes,
      totalEscolinhas,
      totalAdmins,
      totalVerificados,
      totalNaoVerificados,
      totalMidias,
      totalTreinos,
      totalDesafios,
      totalPosts,
      taxaVerificacao: totalUsuarios ? totalVerificados / totalUsuarios : 0,
      ultimosUsuarios,
      exercicios,
      treinosProgramados,
      professores,
      desafiosOficiais
    });
  } catch (err) {
    console.error("Erro ao carregar dashboard admin:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
};

export const listUsuarios = async (_req: Request, res: Response) => {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { dataCriacao: "desc" }
  });
  res.json(usuarios);
};

export const deleteUsuario = async (req: Request, res: Response) => {
  const id = req.params.id;
  await prisma.usuario.delete({ where: { id } });
  res.json({ message: "Usuário excluído com sucesso" });
};

export const listClubes = async (_req: Request, res: Response) => {
  const clubes = await prisma.clube.findMany({
    orderBy: { dataCriacao: "desc" },
    include: { atletas: true }
  });
  res.json(clubes);
};

export const deleteClube = async (req: Request, res: Response) => {
  const id = req.params.id;
  await prisma.clube.delete({ where: { id } });
  res.json({ message: "Clube excluído com sucesso" });
};

export const listEscolinhas = async (_req: Request, res: Response) => {
  const escolinhas = await prisma.escolinha.findMany({
    orderBy: { dataCriacao: "desc" },
    include: { atletas: true }
  });
  res.json(escolinhas);
};

export const deleteEscolinha = async (req: Request, res: Response) => {
  const id = req.params.id;
  await prisma.escolinha.delete({ where: { id } });
  res.json({ message: "Escolinha excluída com sucesso" });
};

export const listAtletas = async (_req: Request, res: Response) => {
  const atletas = await prisma.atleta.findMany({
    orderBy: { dataCriacao: "desc" },
    include: { clube: true, escolinha: true }
  });
  res.json(atletas);
};

export const deleteAtleta = async (req: Request, res: Response) => {
  const id = req.params.id;
  await prisma.atleta.delete({ where: { id } });
  res.json({ message: "Atleta excluído com sucesso" });
};
