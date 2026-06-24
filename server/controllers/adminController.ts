import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const SECRET = process.env.JWT_SECRET || "footera_secret"

export const adminDashboard = async (_: Request, res: Response) => {
  try {
    const porTipo = await prisma.usuario.groupBy({
      by: ["tipo"],
      _count: { _all: true },
    });

    const map = Object.fromEntries(
      porTipo.map((r) => [r.tipo, r._count._all])
    );

    const totalAtletas         = map.Atleta      ?? 0;
    const totalClubes          = map.Clube       ?? 0;
    const totalEscolinhas      = map.Escolinha   ?? 0;
    const totalAdministradores = map.Admin       ?? 0;
    const totalProfessores     = map.Professor   ?? 0;
    const totalOlheiros        = map.Olheiro     ?? 0;

    const totalUsuarios =
      totalAtletas +
      totalClubes +
      totalEscolinhas +
      totalAdministradores +
      totalProfessores +
      totalOlheiros;

    const totalVerificados = await prisma.usuario.count({ where: { verified: true } });
    const totalNaoVerificados = await prisma.usuario.count({ where: { verified: false } });
    const totalPostsCriados = await prisma.postagem.count();
    const totalTreinos = await prisma.treinoProgramado.count();
    const totalDesafios = await prisma.desafioOficial.count();
    const exercicios = await prisma.exercicio.findMany();
    const professores = await prisma.professor.findMany({ include: { usuario: true } });
    const treinos = await prisma.treinoProgramado.findMany();
    const desafios = await prisma.desafioOficial.findMany();

    res.json({
      totalUsuarios,
      totalAtletas,
      totalClubes,
      totalEscolinhas,
      totalAdministradores,
      totalProfessores,
      totalOlheiros,
      totalVerificados,
      totalNaoVerificados,
      totalPostsCriados,
      totalTreinos,
      totalDesafios,
      exercicios,
      professores,
      treinos,
      desafios,
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
    {
      id: usuario.id,
      tipo: "Admin",
      tipoUsuario: "Admin",
      role: "admin",
      isAdmin: true,
      email: usuario.email,
      nome: usuario.nome,
    },
    SECRET,
    { expiresIn: "10h" }
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

export async function adminDiagnostico(req: Request, res: Response) {
  const startedAt = Date.now();

  const checks: Array<{
    nome: string;
    status: "ok" | "erro";
    detalhes?: string;
    tempoMs?: number;
  }> = [];

  async function runCheck(nome: string, fn: () => Promise<void>) {
    const inicio = Date.now();

    try {
      await fn();

      checks.push({
        nome,
        status: "ok",
        tempoMs: Date.now() - inicio,
      });
    } catch (e: any) {
      checks.push({
        nome,
        status: "erro",
        detalhes: e?.message || "Erro desconhecido.",
        tempoMs: Date.now() - inicio,
      });
    }
  }

  await runCheck("Banco de dados Prisma", async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  await runCheck("Tabela usuarios", async () => {
    await prisma.usuario.count();
  });

  await runCheck("Tabela treinos programados", async () => {
    await prisma.treinoProgramado.count();
  });

  await runCheck("Tabela professores", async () => {
    await prisma.professor.count();
  });

  await runCheck("Tabela metodologias", async () => {
    await prisma.metodologia.count();
  });

  const hasError = checks.some((c) => c.status === "erro");

  return res.status(hasError ? 500 : 200).json({
    ok: !hasError,
    ambiente: process.env.NODE_ENV || "development",
    node: process.version,
    apiBaseUrl: process.env.API_BASE_URL || null,
    frontendUrl: process.env.FRONTEND_URL || null,
    uptimeSegundos: Math.round(process.uptime()),
    tempoTotalMs: Date.now() - startedAt,
    dataHora: new Date().toISOString(),
    usuario: {
      id: (req as any).authUser?.id ?? null,
      tipo:
        (req as any).authUser?.tipo ??
        (req as any).authUser?.tipoUsuario ??
        null,
    },
    checks,
  });
}