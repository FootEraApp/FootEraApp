import type { Request, Response } from "express";
import {Prisma, TipoUsuario, Nivel, StatusUsuarioPapel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import {
  listarActiveContexts,
} from "../services/activeContext.js";

export async function getMe(
  req: Request,
  res: Response
) {
  const usuarioId =
    String(
      (req as any).userId ??
        (req as any).user?.id ??
        (req as any).authUser?.id ??
        ""
    ).trim();

  if (!usuarioId) {
    return res.status(401).json({
      error:
        "Não autenticado",
    });
  }

  const me =
    await prisma.usuario.findUnique({
      where: {
        id:
          usuarioId,
      },

      include: {
        administrador:
          true,
      },
    });

  if (
    !me ||
    !me.administrador
  ) {
    return res.status(403).json({
      error:
        "Acesso restrito a administradores.",
    });
  }

  const adminNivel =
    me.administrador
      .nivel ??
    null;

  const adminCargo =
    me.administrador
      .cargo ??
    null;

  const cargo =
    String(
      adminCargo ?? ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      );

  const nivel =
    String(
      adminNivel ?? ""
    )
      .trim()
      .toLowerCase();

  const isByCargo =
    cargo === "owner" ||
    cargo === "superadmin" ||
    cargo === "super admin";

  const isByNivel =
    nivel ===
    "performance";

  const isByEnv =
    Boolean(
      process.env
        .SUPERADMIN_EMAIL
    ) &&
    me.email
      ?.toLowerCase() ===
      process.env
        .SUPERADMIN_EMAIL!
        .toLowerCase();

  const canManageAdmins =
    isByCargo ||
    isByNivel ||
    isByEnv;

  return res.json({
    id:
      me.id,

    nome:
      me.nome,

    email:
      me.email,

    tipo:
      "Admin",

    adminNivel,
    adminCargo,

    canManageAdmins,
  });
}

export async function createAdmin(req: Request, res: Response) {
  const {
    email,
    senha,
    nome,
    nomeDeUsuario,
  } = req.body ?? {};
  if (!email || !senha) {
    return res.status(400).json({ error: "Informe email e senha." });
  }

  const emailNormalizado = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNormalizado)) {
    return res.status(400).json({
      code: "INVALID_EMAIL",
      error: "E-mail inválido.",
    });
  }

  if (
    typeof senha !== "string" ||
    !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(senha)
  ) {
    return res.status(400).json({
      code: "WEAK_PASSWORD",
      error: "A senha deve ter pelo menos 8 caracteres, com letras e números.",
    });
  }

  const exists = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
  });
  if (exists) return res.status(409).json({ error: "Já existe usuário com este email." });

  const hash = await bcrypt.hash(String(senha), 10);

  const username = String(nomeDeUsuario ?? "")
    .trim()
    .toLowerCase();

  if (!/^(?=.{3,20}$)[a-z0-9._]+$/.test(username)) {
    return res.status(400).json({
      code: "INVALID_USERNAME",
      error: "Nome de usuário inválido.",
    });
  }

  const usernameExistente = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: username },
    select: { id: true },
  });

  if (usernameExistente) {
    return res.status(409).json({
      code: "USERNAME_ALREADY_EXISTS",
      error: "Este nome de usuário já está em uso.",
    });
  }

  const nomeFinal = String(nome ?? "").trim();

  if (!nomeFinal) {
    return res.status(400).json({
      code: "NAME_REQUIRED",
      error: "Informe o nome completo.",
    });
  }

  const nivelFinal: Nivel = Nivel.Base;

  const created =
    await prisma.$transaction(
      async (tx) => {
        const usuario =
          await tx.usuario.create({
            data: {
              email: emailNormalizado,
              senhaHash:
                hash,
              nome:
                nomeFinal,
              nomeDeUsuario: username,
              tipo:
                TipoUsuario.Admin,
              verified:
                true,

              administrador: {
                create: {
                  cargo: "admin",
                  nivel: nivelFinal,
                },
              },
            },

            include: {
              administrador:
                true,
            },
          });

        await tx.usuarioPapel.upsert({
          where: {
            usuarioId_papel: {
              usuarioId:
                usuario.id,

              papel:
                TipoUsuario.Admin,
            },
          },

          update: {
            status:
              StatusUsuarioPapel.ATIVO,

            ativadoEm:
              new Date(),

            desativadoEm:
              null,
          },

          create: {
            usuarioId:
              usuario.id,

            papel:
              TipoUsuario.Admin,

            status:
              StatusUsuarioPapel.ATIVO,

            ativadoEm:
              new Date(),
          },
        });

        return usuario;
      }
    );

  return res.status(201).json({
    id: created.id,
    email: created.email,
    tipo: created.tipo,
    administrador: created.administrador,
  });
}

export async function deleteAdmin(
  req: Request,
  res: Response
) {
  const { id } =
    req.params;

  const me =
    (req as any).me;

  if (!id) {
    return res.status(400).json({
      error:
        "ID é obrigatório.",
    });
  }

  if (
    String(me?.id) ===
    String(id)
  ) {
    return res.status(400).json({
      error:
        "Você não pode remover seu próprio acesso administrativo.",
    });
  }

  const target =
    await prisma.usuario.findUnique({
      where: {
        id,
      },

      include: {
        administrador:
          true,
      },
    });

  if (
    !target ||
    !target.administrador
  ) {
    return res.status(404).json({
      error:
        "Admin não encontrado.",
    });
  }

  const cargo =
    String(
      target.administrador
        ?.cargo ??
        ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      );

  const nivel =
    String(
      target.administrador
        ?.nivel ??
        ""
    )
      .trim()
      .toLowerCase();

  const targetIsSuper =
    cargo === "owner" ||
    cargo === "superadmin" ||
    cargo === "super admin" ||
    nivel === "performance" ||
    (
      Boolean(
        process.env
          .SUPERADMIN_EMAIL
      ) &&
      target.email
        ?.toLowerCase() ===
        process.env
          .SUPERADMIN_EMAIL!
          .toLowerCase()
    );

  if (targetIsSuper) {
    return res.status(403).json({
      error:
        "Não é permitido remover o super admin.",
    });
  }

  const contextos = await listarActiveContexts(id);

  const alternativas = contextos.filter(
    (contexto) =>
      !(
        contexto.kind === "PERSONAL" &&
        contexto.tipoUsuario === TipoUsuario.Admin
      ),
  );

  if (alternativas.length === 0) {
    return res.status(409).json({
      code: "ADMIN_ONLY_ACCOUNT",
      error:
        "Este usuário possui apenas o perfil administrativo. " +
        "É necessário utilizar o fluxo de desativação da conta administrativa.",
    });
  }

  if (target.tipo === TipoUsuario.Admin) {
    return res.status(409).json({
      code: "ADMIN_CONTEXT_TRANSFER_REQUIRED",
      error:
        "Esta conta está usando Admin como perfil ativo. " +
        "Selecione outro perfil antes de revogar o acesso administrativo.",
      nextContexts: alternativas.map((contexto) => ({
        key: contexto.key,
        label: contexto.label,
      })),
    });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const conta = await tx.usuario.findUnique({
          where: { id },
          select: {
            tipo: true,
            deletedAt: true,
            email: true,
            administrador: {
              select: {
                id: true,
                cargo: true,
                nivel: true,
              },
            },
          },
        });

        if (!conta || conta.deletedAt || !conta.administrador) {
          throw new Error("ADMIN_NOT_AVAILABLE");
        }

        const emailSuperAdmin = process.env.SUPERADMIN_EMAIL
          ?.trim()
          .toLowerCase();

        if (
          emailSuperAdmin &&
          conta.email?.trim().toLowerCase() === emailSuperAdmin
        ) {
          throw new Error("PROTECTED_SUPERADMIN");
        }

        const cargoAtual = String(
          conta.administrador.cargo ?? ""
        )
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");

        const nivelAtual = String(
          conta.administrador.nivel ?? ""
        )
          .trim()
          .toLowerCase();

        if (
          ["owner", "superadmin", "super admin"].includes(cargoAtual) ||
          nivelAtual === "performance"
        ) {
          throw new Error("PROTECTED_SUPERADMIN");
        }

        if (conta.tipo === TipoUsuario.Admin) {
          throw new Error("ADMIN_CONTEXT_TRANSFER_REQUIRED");
        }

        const totalAdmins = await tx.administrador.count();

        if (totalAdmins <= 1) {
          throw new Error("LAST_ADMIN");
        }

        const agora = new Date();

        await tx.administrador.delete({
          where: {
            usuarioId: id,
          },
        });

        await tx.usuarioPapel.updateMany({
          where: {
            usuarioId: id,
            papel: TipoUsuario.Admin,
          },
          data: {
            status: StatusUsuarioPapel.INATIVO,
            desativadoEm: agora,
          },
        });

        await tx.usuario.update({
          where: { id },
          data: {
            tokenVersion: {
              increment: 1,
            },
          },
        });

        await tx.logAuditoria.create({
          data: {
            usuarioId: String(me.id),
            acao: "ACESSO_ADMIN_REVOGADO",
            entidade: "Administrador",
            entidadeId: conta.administrador.id,
            descricao:
              "Superadministrador revogou o acesso administrativo de um usuário.",
            ip: String(req.ip ?? ""),
            userAgent: String(req.headers["user-agent"] ?? ""),
            meta: {
              usuarioAfetadoId: id,
              cargoAnterior: conta.administrador.cargo,
              nivelAnterior: String(conta.administrador.nivel),
            },
          },
        });

      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ADMIN_CONTEXT_TRANSFER_REQUIRED"
    ) {
      return res.status(409).json({
        code: "ADMIN_CONTEXT_TRANSFER_REQUIRED",
        error:
          "Selecione outro perfil ativo antes de revogar o acesso administrativo.",
      });
    }

    if (
      error instanceof Error &&
      error.message === "LAST_ADMIN"
    ) {
      return res.status(409).json({
        code: "LAST_ADMIN",
        error:
          "Não é possível remover o último administrador.",
      });
    }

    if (
      error instanceof Error &&
      error.message === "ADMIN_NOT_AVAILABLE"
    ) {
      return res.status(409).json({
        code: "ADMIN_NOT_AVAILABLE",
        error:
          "A conta ou seu vínculo administrativo não está disponível.",
      });
    }

    if (
      error instanceof Error &&
      error.message === "PROTECTED_SUPERADMIN"
    ) {
      return res.status(403).json({
        code: "PROTECTED_SUPERADMIN",
        error: "Não é permitido revogar o acesso do superadministrador.",
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return res.status(409).json({
        code: "ADMIN_CONCURRENT_CHANGE",
        error:
          "Outra operação administrativa ocorreu ao mesmo tempo. Atualize a página e tente novamente.",
      });
    }

    console.error("[deleteAdmin]", error);

    return res.status(500).json({
      code: "ADMIN_REVOCATION_FAILED",
      error:
        "Não foi possível revogar o acesso administrativo.",
    });
  }

  return res.json({
    ok:
      true,

    message:
      "Acesso administrativo removido. A conta do usuário foi preservada.",
  });
}