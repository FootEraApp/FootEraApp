import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const SECRET = process.env.JWT_SECRET || "footera_secret"

export const adminDashboard = async (
  _: Request,
  res: Response
) => {
  try {
    const [
      porTipo,
      totalUsuarios,
      totalVerificados,
      totalNaoVerificados,
      totalPostsCriados,
      totalTreinos,
      totalDesafios,
      exercicios,
      professores,
      treinos,
      desafios,
    ] = await Promise.all([
      prisma.usuario.groupBy({
        by: ["tipo"],

        _count: {
          _all: true,
        },
      }),

      prisma.usuario.count(),

      prisma.usuario.count({
        where: {
          verified: true,
        },
      }),

      prisma.usuario.count({
        where: {
          verified: false,
        },
      }),
      prisma.postagem.count(),
      prisma.treinoProgramado.count(),
      prisma.desafioOficial.count(),
      prisma.exercicio.findMany(),
      prisma.professor.findMany({
        include: {
          usuario: true,
        },
      }),
      prisma.treinoProgramado.findMany(),
      prisma.desafioOficial.findMany(),
    ]);

    const mapaPorTipo =
      Object.fromEntries(
        porTipo.map((registro) => [
          String(
            registro.tipo || ""
          ),
          registro._count._all,
        ])
      ) as Record<string, number>;

    const totalAtletas =
      mapaPorTipo.Atleta ?? 0;

    const totalClubes =
      mapaPorTipo.Clube ?? 0;

    const totalEscolinhas =
      mapaPorTipo.Escolinha ?? 0;

    const totalAdministradores =
      mapaPorTipo.Admin ?? 0;

    const totalProfessores =
      mapaPorTipo.Professor ?? 0;

    const totalOlheiros =
      mapaPorTipo.Olheiro ?? 0;

    const totalLearning =
      mapaPorTipo.Learning ?? 0;

    const totalMarcas =
      mapaPorTipo.Marca ?? 0;

    const totalFederacoes =
      mapaPorTipo.Federacao ?? 0;

    const totalTiposConhecidos =
      totalAtletas +
      totalClubes +
      totalEscolinhas +
      totalAdministradores +
      totalProfessores +
      totalOlheiros +
      totalLearning +
      totalMarcas +
      totalFederacoes;

    const totalOutros =
      Math.max(
        0,
        totalUsuarios -
          totalTiposConhecidos
      );

    return res.json({
      totalUsuarios,

      totalAtletas,
      totalClubes,
      totalEscolinhas,
      totalAdministradores,
      totalProfessores,
      totalOlheiros,

      totalLearning,
      totalMarcas,
      totalFederacoes,
      totalOutros,

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
    console.error(
      "Erro no dashboard admin:",
      error
    );

    return res.status(500).json({
      error:
        "Erro ao carregar dados do painel",
    });
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