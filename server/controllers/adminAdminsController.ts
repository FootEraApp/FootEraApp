import type { Request, Response } from "express";
import { TipoUsuario, Nivel, StatusUsuarioPapel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";

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
  const { email, senha, nome, nivel, cargo } = req.body ?? {};
  if (!email || !senha) {
    return res.status(400).json({ error: "Informe email e senha." });
  }

  const exists = await prisma.usuario.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Já existe usuário com este email." });

  const hash = await bcrypt.hash(String(senha), 10);

  const base = (String(email).split("@")[0] || "admin")
    .replace(/[^a-z0-9._-]/gi, "")
    .toLowerCase();
  const nomeDeUsuario = `${base}-${Date.now().toString(36)}`;
  const nomeFinal = (nome && String(nome).trim()) || base;

  const nivelMap: Record<string, Nivel> = {
    Base: Nivel.Base,
    Avancado: Nivel.Avancado,
    Performance: Nivel.Performance,
  };
  const nivelFinal: Nivel = nivelMap[String(nivel)] ?? Nivel.Base;

  const created =
    await prisma.$transaction(
      async (tx) => {
        const usuario =
          await tx.usuario.create({
            data: {
              email,
              senhaHash:
                hash,
              nome:
                nomeFinal,
              nomeDeUsuario,
              tipo:
                TipoUsuario.Admin,
              verified:
                true,

              administrador: {
                create: {
                  cargo:
                    cargo ??
                    "admin",

                  nivel:
                    nivelFinal,
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

  const countAdmins =
    await prisma.administrador.count();

  if (
    countAdmins <= 1
  ) {
    return res.status(400).json({
      error:
        "Não é possível remover o último administrador.",
    });
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.administrador.delete({
        where: {
          usuarioId:
            id,
        },
      });

      await tx.usuarioPapel.updateMany({
        where: {
          usuarioId:
            id,

          papel:
            TipoUsuario.Admin,
        },

        data: {
          status:
            StatusUsuarioPapel.INATIVO,

          desativadoEm:
            new Date(),
        },
      });

      await tx.usuario.update({
        where: {
          id,
        },

        data: {
          tokenVersion: {
            increment:
              1,
          },
        },
      });
    }
  );

  return res.json({
    ok:
      true,

    message:
      "Acesso administrativo removido. A conta do usuário foi preservada.",
  });
}