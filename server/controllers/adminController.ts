import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import {
  StatusUsuarioPapel,
  TipoUsuario,
} from "@prisma/client";

const SECRET = process.env.JWT_SECRET || "footera_secret"

export const adminDashboard = async (
  _: Request,
  res: Response
) => {
  try {
    const [
      usuariosBase,
      registrosPapel,
      administradores,
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
      prisma.usuario.findMany({
        select: {
          id: true,
          tipo: true,
        },
      }),

      prisma.usuarioPapel.findMany({
        select: {
          usuarioId: true,
          papel: true,
          status: true,
        },
      }),

      prisma.administrador.findMany({
        select: {
          usuarioId:
            true,
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

    const papeisPorUsuario =
      new Map<
        string,
        Set<TipoUsuario>
      >();

    for (
      const usuario of
        usuariosBase
    ) {
      papeisPorUsuario.set(
        usuario.id,
        new Set()
      );
    }

    const usuariosComRegistroPapel =
      new Set(
        registrosPapel.map(
          (registro) =>
            registro.usuarioId
        )
      );

    for (
      const registro of
      registrosPapel
    ) {
      if (
        registro.status !==
        StatusUsuarioPapel.ATIVO
      ) {
        continue;
      }

      const papel =
        registro.papel ===
        TipoUsuario.Escola
          ? TipoUsuario.Escolinha
          : registro.papel;

      const set =
        papeisPorUsuario.get(
          registro.usuarioId
        ) ??
        new Set<TipoUsuario>();

      set.add(papel);

      papeisPorUsuario.set(
        registro.usuarioId,
        set
      );
    }

    for (
      const usuario of
        usuariosBase
    ) {
      if (
        usuariosComRegistroPapel.has(
          usuario.id
        )
      ) {
        continue;
      }

      const papel =
        usuario.tipo ===
        TipoUsuario.Escola
          ? TipoUsuario.Escolinha
          : usuario.tipo;

      if (
        papel === TipoUsuario.Admin
      ) {
        continue;
      }

      papeisPorUsuario
        .get(usuario.id)
        ?.add(papel);
    }

    for (
      const admin of
        administradores
    ) {
      const set =
        papeisPorUsuario.get(
          admin.usuarioId
        ) ??
        new Set<TipoUsuario>();

      set.add(
        TipoUsuario.Admin
      );

      papeisPorUsuario.set(
        admin.usuarioId,
        set
      );
    }

    function contarPapel(
      papel: TipoUsuario
    ) {
      let total = 0;

      for (
        const papeis of
          papeisPorUsuario.values()
      ) {
        if (
          papeis.has(papel)
        ) {
          total++;
        }
      }

      return total;
    }

    const totalAtletas =
      contarPapel(
        TipoUsuario.Atleta
      );

    const totalClubes =
      contarPapel(
        TipoUsuario.Clube
      );

    const totalEscolinhas =
      contarPapel(
        TipoUsuario.Escolinha
      );

    const totalAdministradores =
      contarPapel(
        TipoUsuario.Admin
      );

    const totalProfessores =
      contarPapel(
        TipoUsuario.Professor
      );

    const totalOlheiros =
      contarPapel(
        TipoUsuario.Olheiro
      );

    const totalLearning =
      contarPapel(
        TipoUsuario.Learning
      );

    const totalMarcas =
      contarPapel(
        TipoUsuario.Marca
      );

    const totalFederacoes =
      contarPapel(
        TipoUsuario.Federacao
      );

    const totalCreators =
      contarPapel(
        TipoUsuario.Creator
      );

    /*
    * "Outros" agora significa:
    * contas sem nenhum papel
    * reconhecido.
    *
    * Não podemos mais subtrair os
    * totais, porque uma mesma conta
    * pode aparecer em vários papéis.
    */
    let totalOutros =
      0;

    for (
      const papeis of
        papeisPorUsuario.values()
    ) {
      if (
        papeis.size === 0
      ) {
        totalOutros++;
      }
    }

    return res.json({
      totalUsuarios,
      totalCreators,
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
    const usuario =
      await prisma.usuario.findUnique({
        where: {
          email,
        },

        include: {
          administrador: true,
        },
      });

    if (!usuario) {
      return res.status(401).json({ message: "Email incorreto." });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      return res.status(401).json({ message: "Senha incorretos." });
    }

    if (!usuario.administrador) {
      return res.status(403).json({
        message:
          "Você não é um administrador.",
      });
    }

    const token = jwt.sign(
      {
        id:
          usuario.id,

        tipo:
          "Admin",

        tipoUsuario:
          "Admin",

        role:
          "admin",

        isAdmin:
          true,

        email:
          usuario.email,

        nome:
          usuario.nome,

        tokenVersion:
          usuario.tokenVersion ?? 0,
      },
      SECRET,
      {
        expiresIn:
          "10h",
      }
    );

    return res.json({
      message: "Login como administrador realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: "Admin",
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