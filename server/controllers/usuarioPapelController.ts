// server/controllers/usuarioPapelController.ts
import { Response } from "express";
import { StatusUsuarioPapel, TipoUsuario } from "@prisma/client";

import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";

function normalizarTexto(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarPapel(valor: unknown): TipoUsuario | null {
  switch (normalizarTexto(valor)) {
    case "atleta":
      return TipoUsuario.Atleta;
    case "professor":
    case "profissional":
      return TipoUsuario.Professor;
    case "clube":
      return TipoUsuario.Clube;
    case "escola":
    case "escolinha":
      return TipoUsuario.Escolinha;
    case "olheiro":
    case "scout":
      return TipoUsuario.Olheiro;
    case "learning":
      return TipoUsuario.Learning;
    case "federacao":
      return TipoUsuario.Federacao;
    case "marca":
      return TipoUsuario.Marca;
    case "creator":
      return TipoUsuario.Creator;
    default:
      return null;
  }
}

function obterUsuarioId(req: AuthenticatedRequest, res: Response) {
  const usuarioId = String(req.userId ?? "").trim();

  if (!usuarioId) {
    res.status(401).json({
      error: "Usuário não autenticado.",
      code: "UNAUTHENTICATED",
    });
    return null;
  }

  return usuarioId;
}

function papelCanonico(papel: TipoUsuario) {
  return papel === TipoUsuario.Escola ? TipoUsuario.Escolinha : papel;
}

function papeisEquivalentes(a: TipoUsuario, b: TipoUsuario) {
  return papelCanonico(a) === papelCanonico(b);
}

async function buscarRegistroPapel(usuarioId: string, papel: TipoUsuario) {
  if (papel === TipoUsuario.Escolinha || papel === TipoUsuario.Escola) {
    return prisma.usuarioPapel.findFirst({
      where: {
        usuarioId,
        papel: {
          in: [TipoUsuario.Escolinha, TipoUsuario.Escola],
        },
      },
      orderBy: { criadoEm: "asc" },
    });
  }

  return prisma.usuarioPapel.findUnique({
    where: {
      usuarioId_papel: {
        usuarioId,
        papel,
      },
    },
  });
}

async function perfilEspecificoExiste(
  usuarioId: string,
  papel: TipoUsuario,
): Promise<boolean> {
  switch (papel) {
    case TipoUsuario.Atleta:
      return Boolean(
        await prisma.atleta.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Professor:
      return Boolean(
        await prisma.professor.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Clube:
      return Boolean(
        await prisma.clube.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Escolinha:
    case TipoUsuario.Escola:
      return Boolean(
        await prisma.escolinha.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Olheiro:
      return Boolean(
        await prisma.olheiro.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Learning:
      return Boolean(
        await prisma.learningProfile.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Federacao:
      return Boolean(
        await prisma.federacao.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Marca:
      return Boolean(
        await prisma.marca.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    case TipoUsuario.Creator:
      return Boolean(
        await prisma.creator.findUnique({
          where: { usuarioId },
          select: { id: true },
        }),
      );

    default:
      return false;
  }
}

async function obterPerfilEspecificoId(
  usuarioId: string,
  papel: TipoUsuario,
): Promise<string | null> {
  switch (papel) {
    case TipoUsuario.Atleta:
      return (
        (
          await prisma.atleta.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Professor:
      return (
        (
          await prisma.professor.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Clube:
      return (
        (
          await prisma.clube.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Escolinha:
    case TipoUsuario.Escola:
      return (
        (
          await prisma.escolinha.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Olheiro:
      return (
        (
          await prisma.olheiro.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Learning:
      return (
        (
          await prisma.learningProfile.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Federacao:
      return (
        (
          await prisma.federacao.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Marca:
      return (
        (
          await prisma.marca.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    case TipoUsuario.Creator:
      return (
        (
          await prisma.creator.findUnique({
            where: { usuarioId },
            select: { id: true },
          })
        )?.id ?? null
      );

    default:
      return null;
  }
}

export async function listarMeusPapeis(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  try {
    const [usuario, papeis] = await prisma.$transaction([
      prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { tipo: true },
      }),
      prisma.usuarioPapel.findMany({
        where: { usuarioId },
        select: {
          id: true,
          papel: true,
          status: true,
          criadoEm: true,
          atualizadoEm: true,
          ativadoEm: true,
          desativadoEm: true,
          perfilCompletoEm: true,
        },
        orderBy: { criadoEm: "asc" },
      }),
    ]);

    if (!usuario) {
      return res.status(404).json({
        error: "Usuário não encontrado.",
        code: "USER_NOT_FOUND",
      });
    }

    return res.json({
      papelAtivo: usuario.tipo,
      papeis,
    });
  } catch (error) {
    console.error("[UsuarioPapel] Erro ao listar papéis:", error);
    return res.status(500).json({
      error: "Não foi possível carregar os perfis da conta.",
    });
  }
}

export async function adicionarPapel(req: AuthenticatedRequest, res: Response) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  const papel = normalizarPapel(req.body?.papel);

  if (!papel) {
    return res.status(400).json({
      error: "Papel inválido.",
      code: "INVALID_ROLE",
    });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tipo: true },
    });

    if (!usuario) {
      return res.status(404).json({
        error: "Usuário não encontrado.",
        code: "USER_NOT_FOUND",
      });
    }

    const existente = await buscarRegistroPapel(usuarioId, papel);

    if (existente && existente.status !== StatusUsuarioPapel.INATIVO) {
      return res.status(200).json({
        papel: existente,
        jaExistia: true,
      });
    }

    const ehPapelEmUso = papeisEquivalentes(usuario.tipo, papel);

    const registro = existente
      ? await prisma.usuarioPapel.update({
          where: { id: existente.id },
          data: {
            status: ehPapelEmUso
              ? StatusUsuarioPapel.ATIVO
              : StatusUsuarioPapel.PENDENTE,
            ativadoEm: ehPapelEmUso ? new Date() : null,
            desativadoEm: null,
            perfilCompletoEm: null,
          },
        })
      : await prisma.usuarioPapel.create({
          data: {
            usuarioId,
            papel,
            status: ehPapelEmUso
              ? StatusUsuarioPapel.ATIVO
              : StatusUsuarioPapel.PENDENTE,
            ativadoEm: ehPapelEmUso ? new Date() : null,
          },
        });

    return res.status(existente ? 200 : 201).json({
      papel: registro,
      jaExistia: Boolean(existente),
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      const existente = await buscarRegistroPapel(usuarioId, papel);

      if (existente) {
        return res.status(200).json({
          papel: existente,
          jaExistia: true,
        });
      }
    }

    console.error("[UsuarioPapel] Erro ao adicionar papel:", error);
    return res.status(500).json({
      error: "Não foi possível liberar este perfil para configuração.",
    });
  }
}

export async function concluirPapel(req: AuthenticatedRequest, res: Response) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  const papel = normalizarPapel(req.params.papel);

  if (!papel) {
    return res.status(400).json({
      error: "Papel inválido.",
      code: "INVALID_ROLE",
    });
  }

  try {
    const registro = await buscarRegistroPapel(usuarioId, papel);

    if (!registro) {
      return res.status(404).json({
        error: "Este papel ainda não foi adicionado à conta.",
        code: "ROLE_NOT_FOUND",
      });
    }

    if (registro.status === StatusUsuarioPapel.INATIVO) {
      return res.status(409).json({
        error: "Este papel está inativo. Ative-o antes de concluir o perfil.",
        code: "ROLE_INACTIVE",
      });
    }

    const perfilExiste = await perfilEspecificoExiste(usuarioId, papel);

    if (!perfilExiste) {
      return res.status(409).json({
        error: "Salve os dados deste perfil antes de concluir a ativação.",
        code: "ROLE_PROFILE_MISSING",
      });
    }

    const agora = new Date();
    const papelAtualizado = await prisma.usuarioPapel.update({
      where: { id: registro.id },
      data: {
        status: StatusUsuarioPapel.ATIVO,
        ativadoEm: registro.ativadoEm ?? agora,
        desativadoEm: null,
        perfilCompletoEm: registro.perfilCompletoEm ?? agora,
      },
    });

    return res.json({
      papel: papelAtualizado,
    });
  } catch (error) {
    console.error("[UsuarioPapel] Erro ao concluir papel:", error);
    return res.status(500).json({
      error: "Não foi possível concluir a ativação deste perfil.",
    });
  }
}

export async function alterarPapelAtivo(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = obterUsuarioId(req, res);
  if (!usuarioId) return;

  const papelRecebido = normalizarPapel(req.body?.papel);

  if (!papelRecebido) {
    return res.status(400).json({
      error: "Papel inválido.",
      code: "INVALID_ROLE",
    });
  }

  const papel = papelCanonico(papelRecebido);

  try {
    const [usuario, registro] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { tipo: true },
      }),
      buscarRegistroPapel(usuarioId, papel),
    ]);

    if (!usuario) {
      return res.status(404).json({
        error: "Usuário não encontrado.",
        code: "USER_NOT_FOUND",
      });
    }

    if (!registro) {
      return res.status(404).json({
        error: "Este papel não foi adicionado à sua conta.",
        code: "ROLE_NOT_FOUND",
      });
    }

    if (registro.status !== StatusUsuarioPapel.ATIVO) {
      return res.status(409).json({
        error:
          registro.status === StatusUsuarioPapel.PENDENTE
            ? "Conclua a configuração deste perfil antes de usá-lo."
            : "Este perfil está inativo.",
        code:
          registro.status === StatusUsuarioPapel.PENDENTE
            ? "ROLE_PENDING"
            : "ROLE_INACTIVE",
      });
    }

    const tipoUsuarioId = await obterPerfilEspecificoId(usuarioId, papel);

    if (!tipoUsuarioId) {
      return res.status(409).json({
        error: "Salve os dados deste perfil antes de colocá-lo em uso.",
        code: "ROLE_PROFILE_MISSING",
      });
    }

    const jaEstavaEmUso = papeisEquivalentes(usuario.tipo, papel);

    if (!jaEstavaEmUso) {
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { tipo: papel },
      });
    }

    return res.json({
      papelAtivo: papel,
      tipoUsuario: normalizarTexto(papel),
      tipoUsuarioId,
      jaEstavaEmUso,
    });
  } catch (error) {
    console.error("[UsuarioPapel] Erro ao alterar papel ativo:", error);
    return res.status(500).json({
      error: "Não foi possível colocar este perfil em uso.",
    });
  }
}
