// server/controllers/convitesController.ts
import { Request, Response } from "express";
import {
  ConviteStatus,
  ConviteTipo,
  OrganizacaoTipo,
  Prisma,
} from "@prisma/client";
import { prisma } from "../prisma.js";

type PermissaoOrganizacao = "professores" | "atletasTurmas";
type StatusPublico = "ATIVO" | "EXPIRADO" | "CANCELADO" | "USADO";

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getUsuarioId(req: Request) {
  return String((req as any).user?.id || (req as any).userId || "").trim();
}

function reqEhAdmin(req: Request) {
  return (
    (req as any).user?.isAdmin === true ||
    String((req as any).user?.tipo || "").trim().toLowerCase() === "admin"
  );
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizarTipoConvite(value: unknown): ConviteTipo | null {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === "ORGANIZACAO") return ConviteTipo.ORGANIZACAO;
  if (raw === "TURMA") return ConviteTipo.TURMA;
  if (raw === "PROFESSOR") return ConviteTipo.PROFESSOR;
  if (raw === "ATLETA_VINCULO") return ConviteTipo.ATLETA_VINCULO;

  return null;
}

function normalizarOrganizacaoTipo(value: unknown): OrganizacaoTipo | null {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === "CLUBE") return OrganizacaoTipo.CLUBE;
  if (raw === "ESCOLA" || raw === "ESCOLINHA") {
    return OrganizacaoTipo.ESCOLINHA;
  }

  return null;
}

function temPermissaoOrganizacao(
  raw: unknown,
  permissao: PermissaoOrganizacao
) {
  const chaves =
    permissao === "professores"
      ? new Set([
          "professores",
          "gerenciarprofessores",
          "professoresvinculo",
          "professoreswrite",
          "professoresreadwrite",
        ])
      : new Set([
          "atletasturmas",
          "gerenciaratletasturmas",
          "atletas",
          "turmas",
          "atletaswrite",
          "turmaswrite",
          "atletasturmaswrite",
        ]);

  const aceita = (key: unknown) => chaves.has(normalizeKey(key));

  if (!raw) return false;

  if (Array.isArray(raw)) {
    return raw.some((item) => aceita(item));
  }

  if (typeof raw === "string") {
    const texto = raw.trim();

    try {
      const parsed = JSON.parse(texto);
      if (parsed !== raw) {
        return temPermissaoOrganizacao(parsed, permissao);
      }
    } catch {}

    return texto
      .split(/[\s,;|]+/)
      .filter(Boolean)
      .some((item) => aceita(item));
  }

  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).some(
      ([key, value]) => value === true && aceita(key)
    );
  }

  return false;
}

function mediaAbsoluta(req: Request, raw?: string | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  const base =
    process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;

  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

async function buscarOrganizacao(tipo: OrganizacaoTipo, id: string) {
  if (tipo === OrganizacaoTipo.CLUBE) {
    const row = await prisma.clube.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        logo: true,
        usuarioId: true,
        cidade: true,
        estado: true,
        usuario: {
          select: {
            nomeDeUsuario: true,
          },
        },
      },
    });

    return row
      ? {
          tipo: OrganizacaoTipo.CLUBE,
          ...row,
        }
      : null;
  }

  const row = await prisma.escolinha.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      logo: true,
      usuarioId: true,
      cidade: true,
      estado: true,
      usuario: {
        select: {
          nomeDeUsuario: true,
        },
      },
    },
  });

  return row
    ? {
        tipo: OrganizacaoTipo.ESCOLINHA,
        ...row,
      }
    : null;
}

async function podeGerenciarOrganizacao(
  req: Request,
  tipo: OrganizacaoTipo,
  ownerId: string,
  permissao: PermissaoOrganizacao
) {
  if (reqEhAdmin(req)) return true;

  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return false;

  const org = await buscarOrganizacao(tipo, ownerId);
  if (!org) return false;

  if (org.usuarioId && String(org.usuarioId) === usuarioId) {
    return true;
  }

  const professor = await prisma.professor.findUnique({
    where: { usuarioId },
    select: { id: true },
  });

  if (!professor) return false;

  const gestor = await prisma.organizacaoGestor.findFirst({
    where: {
      tipo,
      ownerId,
      professorId: professor.id,
      ativo: true,
    },
    select: {
      permissoes: true,
    },
  });

  return temPermissaoOrganizacao(gestor?.permissoes, permissao);
}

async function podeGerenciarTurma(req: Request, turmaId: string) {
  if (reqEhAdmin(req)) return true;

  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return false;

  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    select: {
      id: true,
      clubeId: true,
      escolinhaId: true,
      professores: {
        select: {
          professor: {
            select: {
              usuarioId: true,
            },
          },
        },
      },
    },
  });

  if (!turma) return false;

  if (
    turma.professores.some(
      (item) => String(item.professor.usuarioId || "") === usuarioId
    )
  ) {
    return true;
  }

  if (turma.clubeId) {
    return podeGerenciarOrganizacao(
      req,
      OrganizacaoTipo.CLUBE,
      turma.clubeId,
      "atletasTurmas"
    );
  }

  if (turma.escolinhaId) {
    return podeGerenciarOrganizacao(
      req,
      OrganizacaoTipo.ESCOLINHA,
      turma.escolinhaId,
      "atletasTurmas"
    );
  }

  return false;
}

async function carregarConvite(token: string) {
  return prisma.convite.findUnique({
    where: { token },
    include: {
      criadoPor: {
        select: {
          id: true,
          nome: true,
          nomeDeUsuario: true,
          foto: true,
          tipo: true,
        },
      },
      destinatarioUsuario: {
        select: {
          id: true,
        },
      },
      turma: {
        select: {
          id: true,
          nome: true,
          descricao: true,
          categoria: true,
          ativo: true,
          clubeId: true,
          escolinhaId: true,
        },
      },
      professor: {
        select: {
          id: true,
          nome: true,
          fotoUrl: true,
          usuarioId: true,
          usuario: {
            select: {
              nomeDeUsuario: true,
            },
          },
        },
      },
      usos: {
        select: {
          usuarioId: true,
          createdAt: true,
        },
      },
    },
  });
}

function statusPublico(
  convite: {
    status: ConviteStatus;
    expiresAt: Date;
    usoUnico: boolean;
  },
  totalUsos: number
): StatusPublico {
  if (convite.status === ConviteStatus.CANCELADO) {
    return "CANCELADO";
  }

  if (convite.expiresAt.getTime() <= Date.now()) {
    return "EXPIRADO";
  }

  if (
    convite.usoUnico &&
    (convite.status === ConviteStatus.UTILIZADO || totalUsos > 0)
  ) {
    return "USADO";
  }

  return "ATIVO";
}

function papelDestino(tipo: ConviteTipo) {
  return tipo === ConviteTipo.PROFESSOR ? "Professor" : "Atleta";
}

async function redirectDoConvite(convite: {
  tipo: ConviteTipo;
  turmaId: string | null;
  professorId: string | null;
  organizacaoTipo: OrganizacaoTipo | null;
  organizacaoId: string | null;
}) {
  if (convite.turmaId) {
    return `/turma/${encodeURIComponent(convite.turmaId)}`;
  }

  if (convite.organizacaoTipo && convite.organizacaoId) {
    const org = await buscarOrganizacao(
      convite.organizacaoTipo,
      convite.organizacaoId
    );

    if (org) {
      const ref = String(org.usuario?.nomeDeUsuario || org.id);
      return `/organizacao/${encodeURIComponent(ref)}`;
    }
  }

  if (convite.professorId) {
    const professor = await prisma.professor.findUnique({
      where: { id: convite.professorId },
      select: { usuarioId: true },
    });

    if (professor?.usuarioId) {
      return `/perfil/${encodeURIComponent(professor.usuarioId)}`;
    }
  }

  return "/perfil";
}

export async function obterConvite(req: Request, res: Response) {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Token de convite inválido." });
    }

    const convite = await carregarConvite(token);
    if (!convite) {
      return res.status(404).json({ message: "Convite não encontrado." });
    }

    const usuarioId = getUsuarioId(req);
    const authenticated = Boolean(usuarioId);
    const jaUtilizadoPorMim = Boolean(
      usuarioId && convite.usos.some((uso) => uso.usuarioId === usuarioId)
    );

    const totalUsos = convite.usos.length;
    const status = statusPublico(convite, totalUsos);

    const alvoCorreto =
      !convite.destinatarioUsuarioId ||
      !authenticated ||
      convite.destinatarioUsuarioId === usuarioId;

    const organizacao =
      convite.organizacaoTipo && convite.organizacaoId
        ? await buscarOrganizacao(convite.organizacaoTipo, convite.organizacaoId)
        : null;

    return res.json({
      convite: {
        id: convite.id,
        token: convite.token,
        tipo: convite.tipo,
        status,
        papelDestino: papelDestino(convite.tipo),
        expiresAt: convite.expiresAt,
        usoUnico: convite.usoUnico,
        ativo: status === "ATIVO",
        totalUsos,
      },
      contexto: {
        organizacao: organizacao
          ? {
              tipo: organizacao.tipo,
              id: organizacao.id,
              nome: organizacao.nome,
              logo: mediaAbsoluta(req, organizacao.logo),
              usuarioId: organizacao.usuarioId ?? null,
              cidade: organizacao.cidade ?? null,
              estado: organizacao.estado ?? null,
            }
          : null,
        turma: convite.turma
          ? {
              id: convite.turma.id,
              nome: convite.turma.nome,
              descricao: convite.turma.descricao,
              categoria: convite.turma.categoria,
            }
          : null,
        professor: convite.professor
          ? {
              ...convite.professor,
              fotoUrl: mediaAbsoluta(req, convite.professor.fotoUrl),
            }
          : null,
        atleta: null,
        criadoPor: {
          ...convite.criadoPor,
          foto: mediaAbsoluta(req, convite.criadoPor.foto),
        },
      },
      viewer: {
        authenticated,
        jaUtilizadoPorMim,
      },
      podeAceitar: status === "ATIVO" && alvoCorreto,
    });
  } catch (error) {
    console.error("obterConvite", error);
    return res.status(500).json({ message: "Falha ao carregar convite." });
  }
}

export async function criarConvite(req: Request, res: Response) {
  try {
    const criadoPorId = getUsuarioId(req);
    if (!criadoPorId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const tipo = normalizarTipoConvite(req.body?.tipo);
    if (!tipo) {
      return res.status(400).json({ message: "Tipo de convite inválido." });
    }

    let organizacaoTipo = normalizarOrganizacaoTipo(req.body?.organizacaoTipo);
    let organizacaoId = String(req.body?.organizacaoId || "").trim() || null;
    let turmaId = String(req.body?.turmaId || "").trim() || null;
    let professorId = String(req.body?.professorId || "").trim() || null;
    const destinatarioUsuarioId =
      String(req.body?.destinatarioUsuarioId || "").trim() || null;

    if (destinatarioUsuarioId) {
      const destinatario = await prisma.usuario.findUnique({
        where: { id: destinatarioUsuarioId },
        select: { id: true },
      });

      if (!destinatario) {
        return res.status(404).json({ message: "Destinatário não encontrado." });
      }
    }

    if (tipo === ConviteTipo.TURMA) {
      if (!turmaId) {
        return res.status(400).json({ message: "turmaId é obrigatório." });
      }

      const turma = await prisma.turma.findFirst({
        where: { id: turmaId, ativo: true },
        select: {
          id: true,
          clubeId: true,
          escolinhaId: true,
        },
      });

      if (!turma) {
        return res.status(404).json({ message: "Turma não encontrada." });
      }

      if (!(await podeGerenciarTurma(req, turmaId))) {
        return res.status(403).json({ message: "Você não pode convidar atletas para esta turma." });
      }

      if (turma.clubeId) {
        organizacaoTipo = OrganizacaoTipo.CLUBE;
        organizacaoId = turma.clubeId;
      } else if (turma.escolinhaId) {
        organizacaoTipo = OrganizacaoTipo.ESCOLINHA;
        organizacaoId = turma.escolinhaId;
      }
    }

    if (tipo === ConviteTipo.PROFESSOR) {
      if (!organizacaoTipo || !organizacaoId) {
        return res.status(400).json({
          message: "organizacaoTipo e organizacaoId são obrigatórios para convite de professor.",
        });
      }

      if (!(await buscarOrganizacao(organizacaoTipo, organizacaoId))) {
        return res.status(404).json({ message: "Organização não encontrada." });
      }

      if (
        !(await podeGerenciarOrganizacao(
          req,
          organizacaoTipo,
          organizacaoId,
          "professores"
        ))
      ) {
        return res.status(403).json({ message: "Você não pode convidar professores para esta organização." });
      }
    }

    if (tipo === ConviteTipo.ORGANIZACAO) {
      if (!organizacaoTipo || !organizacaoId) {
        return res.status(400).json({
          message: "organizacaoTipo e organizacaoId são obrigatórios.",
        });
      }

      if (!(await buscarOrganizacao(organizacaoTipo, organizacaoId))) {
        return res.status(404).json({ message: "Organização não encontrada." });
      }

      if (
        !(await podeGerenciarOrganizacao(
          req,
          organizacaoTipo,
          organizacaoId,
          "atletasTurmas"
        ))
      ) {
        return res.status(403).json({ message: "Você não pode criar convite para esta organização." });
      }
    }

    if (tipo === ConviteTipo.ATLETA_VINCULO) {
      if (!professorId && !organizacaoId) {
        const professor = await prisma.professor.findUnique({
          where: { usuarioId: criadoPorId },
          select: { id: true },
        });

        professorId = professor?.id ?? null;
      }

      if (professorId) {
        const professor = await prisma.professor.findUnique({
          where: { id: professorId },
          select: { id: true, usuarioId: true },
        });

        if (!professor) {
          return res.status(404).json({ message: "Professor não encontrado." });
        }

        if (!reqEhAdmin(req) && professor.usuarioId !== criadoPorId) {
          return res.status(403).json({ message: "Você não pode criar convite por este professor." });
        }
      } else {
        if (!organizacaoTipo || !organizacaoId) {
          return res.status(400).json({
            message: "Informe professorId ou uma organização para o vínculo.",
          });
        }

        if (!(await buscarOrganizacao(organizacaoTipo, organizacaoId))) {
          return res.status(404).json({ message: "Organização não encontrada." });
        }

        if (
          !(await podeGerenciarOrganizacao(
            req,
            organizacaoTipo,
            organizacaoId,
            "atletasTurmas"
          ))
        ) {
          return res.status(403).json({ message: "Você não pode criar este convite de vínculo." });
        }
      }
    }

    const diasRaw = Number(req.body?.expiresInDays ?? 30);
    const expiresInDays = Number.isFinite(diasRaw)
      ? Math.min(365, Math.max(1, Math.trunc(diasRaw)))
      : 30;

    let expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    if (req.body?.expiresAt) {
      const informado = new Date(req.body.expiresAt);

      if (!Number.isNaN(informado.getTime()) && informado.getTime() > Date.now()) {
        expiresAt = informado;
      }
    }

    const usoUnico =
      typeof req.body?.usoUnico === "boolean"
        ? req.body.usoUnico
        : tipo === ConviteTipo.TURMA || tipo === ConviteTipo.ORGANIZACAO
        ? false
        : true;
    
      if (
        !destinatarioUsuarioId &&
        usoUnico === false &&
        (
          tipo === ConviteTipo.TURMA ||
          tipo === ConviteTipo.ORGANIZACAO
        )
      ) {
        const whereExistente:
          Prisma.ConviteWhereInput = {
            tipo,
            status:
              ConviteStatus.ATIVO,

            canceladoEm:
              null,

            expiresAt: {
              gt: new Date(),
            },

            usoUnico:
              false,

            destinatarioUsuarioId:
              null,
          };

        if (
          tipo ===
          ConviteTipo.TURMA
        ) {
          whereExistente.turmaId =
            turmaId;
        } else {
          whereExistente.organizacaoTipo =
            organizacaoTipo;

          whereExistente.organizacaoId =
            organizacaoId;
        }

        const existente =
          await prisma.convite.findFirst({
            where:
              whereExistente,

            orderBy: {
              createdAt:
                "desc",
            },

            select: {
              id: true,
              token: true,
              tipo: true,
              expiresAt: true,
              usoUnico: true,
            },
          });

        if (existente) {
          return res.status(200).json({
            ok: true,
            reutilizado: true,

            token:
              existente.token,

            convite:
              existente,

            path:
              `/join/${existente.token}`,
          });
        }
      }

    const convite = await prisma.convite.create({
      data: {
        tipo,
        status: ConviteStatus.ATIVO,
        criadoPorId,
        destinatarioUsuarioId,
        organizacaoTipo,
        organizacaoId,
        turmaId,
        professorId,
        usoUnico,
        expiresAt,
      },
      select: {
        id: true,
        token: true,
        tipo: true,
        expiresAt: true,
        usoUnico: true,
      },
    });

    return res.status(201).json({
      ok: true,
      token: convite.token,
      convite,
      path: `/join/${convite.token}`,
    });
  } catch (error) {
    console.error("criarConvite", error);
    return res.status(500).json({ message: "Falha ao criar convite." });
  }
}

async function reativarRelacaoTreinamento(
  tx: Prisma.TransactionClient,
  data: {
    atletaId: string;
    professorId?: string | null;
    clubeId?: string | null;
    escolinhaId?: string | null;
  }
) {
  const shape = {
    atletaId: data.atletaId,
    professorId: data.professorId ?? null,
    clubeId: data.clubeId ?? null,
    escolinhaId: data.escolinhaId ?? null,
  };

  const existente = await tx.relacaoTreinamento.findFirst({
    where: shape,
    select: { id: true },
  });

  if (existente) {
    await tx.relacaoTreinamento.update({
      where: { id: existente.id },
      data: {
        ativo: true,
        encerradoEm: null,
      },
    });
    return;
  }

  await tx.relacaoTreinamento.create({
    data: {
      ...shape,
      ativo: true,
      encerradoEm: null,
    },
  });
}

async function exigirAtleta(tx: Prisma.TransactionClient, usuarioId: string) {
  const atleta = await tx.atleta.findUnique({
    where: { usuarioId },
    select: { id: true },
  });

  if (!atleta) {
    throw new ApiError(
      409,
      "Este convite precisa ser aceito por uma conta que possua perfil de Atleta.",
      "ATLETA_REQUIRED"
    );
  }

  return atleta;
}

async function exigirProfessor(tx: Prisma.TransactionClient, usuarioId: string) {
  const professor = await tx.professor.findUnique({
    where: { usuarioId },
    select: { id: true },
  });

  if (!professor) {
    throw new ApiError(
      409,
      "Este convite precisa ser aceito por uma conta que possua perfil de Professor.",
      "PROFESSOR_REQUIRED"
    );
  }

  return professor;
}

async function vincularAtletaOrganizacao(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  tipo: OrganizacaoTipo,
  organizacaoId: string
) {
  const atleta = await exigirAtleta(tx, usuarioId);

  if (tipo === OrganizacaoTipo.CLUBE) {
    const clube = await tx.clube.findUnique({
      where: { id: organizacaoId },
      select: { id: true },
    });

    if (!clube) throw new ApiError(404, "Clube não encontrado.");

    await reativarRelacaoTreinamento(tx, {
      atletaId: atleta.id,
      clubeId: clube.id,
    });

    await tx.atleta.update({
      where: { id: atleta.id },
      data: { clubeId: clube.id },
    });

    const formacao = await tx.vinculoFormacao.findFirst({
      where: {
        atletaId: atleta.id,
        origem: "Clube",
        origemId: clube.id,
      },
      select: { id: true },
    });

    if (formacao) {
      await tx.vinculoFormacao.update({
        where: { id: formacao.id },
        data: { fim: null },
      });
    } else {
      await tx.vinculoFormacao.create({
        data: {
          atletaId: atleta.id,
          origem: "Clube",
          origemId: clube.id,
          inicio: new Date(),
          documentos: [],
        },
      });
    }

    return atleta;
  }

  const escolinha = await tx.escolinha.findUnique({
    where: { id: organizacaoId },
    select: { id: true },
  });

  if (!escolinha) throw new ApiError(404, "Escolinha não encontrada.");

  await reativarRelacaoTreinamento(tx, {
    atletaId: atleta.id,
    escolinhaId: escolinha.id,
  });

  await tx.atleta.update({
    where: { id: atleta.id },
    data: { escolinhaId: escolinha.id },
  });

  const formacao = await tx.vinculoFormacao.findFirst({
    where: {
      atletaId: atleta.id,
      origem: "Escolinha",
      origemId: escolinha.id,
    },
    select: { id: true },
  });

  if (formacao) {
    await tx.vinculoFormacao.update({
      where: { id: formacao.id },
      data: { fim: null },
    });
  } else {
    await tx.vinculoFormacao.create({
      data: {
        atletaId: atleta.id,
        origem: "Escolinha",
        origemId: escolinha.id,
        inicio: new Date(),
        documentos: [],
      },
    });
  }

  return atleta;
}

async function vincularAtletaProfessor(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  professorId: string
) {
  const atleta = await exigirAtleta(tx, usuarioId);

  const professor = await tx.professor.findUnique({
    where: { id: professorId },
    select: { id: true },
  });

  if (!professor) throw new ApiError(404, "Professor não encontrado.");

  await reativarRelacaoTreinamento(tx, {
    atletaId: atleta.id,
    professorId: professor.id,
  });

  return atleta;
}

async function vincularProfessorOrganizacao(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  tipo: OrganizacaoTipo,
  organizacaoId: string
) {
  const professor = await exigirProfessor(tx, usuarioId);

  if (tipo === OrganizacaoTipo.CLUBE) {
    const clube = await tx.clube.findUnique({
      where: { id: organizacaoId },
      select: { id: true },
    });

    if (!clube) throw new ApiError(404, "Clube não encontrado.");

    await tx.professorClube.upsert({
      where: {
        professorId_clubeId: {
          professorId: professor.id,
          clubeId: clube.id,
        },
      },
      update: {},
      create: {
        professorId: professor.id,
        clubeId: clube.id,
      },
    });

    await tx.professor.update({
      where: { id: professor.id },
      data: { clubeId: clube.id },
    });

    return professor;
  }

  const escolinha = await tx.escolinha.findUnique({
    where: { id: organizacaoId },
    select: { id: true },
  });

  if (!escolinha) throw new ApiError(404, "Escolinha não encontrada.");

  await tx.professorEscolinha.upsert({
    where: {
      professorId_escolinhaId: {
        professorId: professor.id,
        escolinhaId: escolinha.id,
      },
    },
    update: {},
    create: {
      professorId: professor.id,
      escolinhaId: escolinha.id,
    },
  });

  await tx.professor.update({
    where: { id: professor.id },
    data: { escolinhaId: escolinha.id },
  });

  return professor;
}

async function aceitarConviteTurma(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  turmaId: string
) {
  const atleta = await exigirAtleta(tx, usuarioId);

  const turma = await tx.turma.findFirst({
    where: {
      id: turmaId,
      ativo: true,
    },
    select: {
      id: true,
      vagas: true,
      clubeId: true,
      escolinhaId: true,
      professores: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: {
          professorId: true,
        },
      },
      _count: {
        select: {
          membros: true,
        },
      },
    },
  });

  if (!turma) throw new ApiError(404, "Turma não encontrada.");

  const jaMembro = await tx.turmaUsuario.findUnique({
    where: {
      turmaId_usuarioId: {
        turmaId: turma.id,
        usuarioId,
      },
    },
    select: { id: true },
  });

  if (
    !jaMembro &&
    turma.vagas != null &&
    turma._count.membros >= turma.vagas
  ) {
    throw new ApiError(409, "Esta turma não possui mais vagas.", "TURMA_LOTADA");
  }

  if (turma.clubeId) {
    await vincularAtletaOrganizacao(
      tx,
      usuarioId,
      OrganizacaoTipo.CLUBE,
      turma.clubeId
    );
  } else if (turma.escolinhaId) {
    await vincularAtletaOrganizacao(
      tx,
      usuarioId,
      OrganizacaoTipo.ESCOLINHA,
      turma.escolinhaId
    );
  } else if (turma.professores[0]?.professorId) {
    await vincularAtletaProfessor(
      tx,
      usuarioId,
      turma.professores[0].professorId
    );
  }

  await tx.turmaUsuario.upsert({
    where: {
      turmaId_usuarioId: {
        turmaId: turma.id,
        usuarioId,
      },
    },
    update: {},
    create: {
      turmaId: turma.id,
      usuarioId,
    },
  });

  return atleta;
}

export async function aceitarConvite(req: Request, res: Response) {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Token de convite inválido." });
    }

    const convite = await carregarConvite(token);
    if (!convite) {
      return res.status(404).json({ message: "Convite não encontrado." });
    }

    if (
      convite.destinatarioUsuarioId &&
      convite.destinatarioUsuarioId !== usuarioId
    ) {
      return res.status(403).json({ message: "Este convite foi criado para outro usuário." });
    }

    const jaUtilizou = convite.usos.some((uso) => uso.usuarioId === usuarioId);
    const redirectTo = await redirectDoConvite(convite);

    if (jaUtilizou) {
      return res.json({
        ok: true,
        jaAceito: true,
        message: "Este convite já foi aceito por você.",
        redirectTo,
      });
    }

    const publico = statusPublico(convite, convite.usos.length);

    if (publico === "EXPIRADO") {
      return res.status(410).json({ message: "Este convite expirou.", code: "CONVITE_EXPIRADO" });
    }

    if (publico === "CANCELADO") {
      return res.status(410).json({ message: "Este convite foi cancelado.", code: "CONVITE_CANCELADO" });
    }

    if (publico === "USADO") {
      return res.status(409).json({ message: "Este convite de uso único já foi utilizado.", code: "CONVITE_UTILIZADO" });
    }

    await prisma.$transaction(async (tx) => {
      const agora = new Date();

      if (convite.usoUnico) {
        const claim = await tx.convite.updateMany({
          where: {
            id: convite.id,
            status: ConviteStatus.ATIVO,
            canceladoEm: null,
            expiresAt: { gt: agora },
          },
          data: {
            status: ConviteStatus.UTILIZADO,
            utilizadoEm: agora,
          },
        });

        if (claim.count !== 1) {
          throw new ApiError(409, "Este convite não está mais disponível.", "CONVITE_INDISPONIVEL");
        }
      } else {
        const atual = await tx.convite.findUnique({
          where: { id: convite.id },
          select: {
            status: true,
            canceladoEm: true,
            expiresAt: true,
          },
        });

        if (
          !atual ||
          atual.status !== ConviteStatus.ATIVO ||
          atual.canceladoEm ||
          atual.expiresAt.getTime() <= Date.now()
        ) {
          throw new ApiError(409, "Este convite não está mais disponível.", "CONVITE_INDISPONIVEL");
        }
      }

      switch (convite.tipo) {
        case ConviteTipo.PROFESSOR: {
          if (!convite.organizacaoTipo || !convite.organizacaoId) {
            throw new ApiError(409, "Convite de professor sem organização válida.");
          }

          await vincularProfessorOrganizacao(
            tx,
            usuarioId,
            convite.organizacaoTipo,
            convite.organizacaoId
          );
          break;
        }

        case ConviteTipo.ORGANIZACAO: {
          if (!convite.organizacaoTipo || !convite.organizacaoId) {
            throw new ApiError(409, "Convite sem organização válida.");
          }

          await vincularAtletaOrganizacao(
            tx,
            usuarioId,
            convite.organizacaoTipo,
            convite.organizacaoId
          );
          break;
        }

        case ConviteTipo.TURMA: {
          if (!convite.turmaId) {
            throw new ApiError(409, "Convite sem turma válida.");
          }

          await aceitarConviteTurma(tx, usuarioId, convite.turmaId);
          break;
        }

        case ConviteTipo.ATLETA_VINCULO: {
          if (convite.professorId) {
            await vincularAtletaProfessor(tx, usuarioId, convite.professorId);
          } else if (convite.organizacaoTipo && convite.organizacaoId) {
            await vincularAtletaOrganizacao(
              tx,
              usuarioId,
              convite.organizacaoTipo,
              convite.organizacaoId
            );
          } else {
            throw new ApiError(409, "Convite de vínculo sem contexto válido.");
          }
          break;
        }
      }

      await tx.conviteUso.upsert({
        where: {
          conviteId_usuarioId: {
            conviteId: convite.id,
            usuarioId,
          },
        },
        update: {},
        create: {
          conviteId: convite.id,
          usuarioId,
        },
      });
    });

    return res.json({
      ok: true,
      message: "Convite aceito com sucesso!",
      redirectTo,
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return res.status(error.status).json({
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }

    console.error("aceitarConvite", error);
    return res.status(500).json({ message: "Falha ao aceitar convite." });
  }
}

export async function cancelarConvite(req: Request, res: Response) {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Token de convite inválido." });
    }

    const convite = await carregarConvite(token);
    if (!convite) {
      return res.status(404).json({ message: "Convite não encontrado." });
    }

    let permitido = reqEhAdmin(req) || convite.criadoPorId === usuarioId;

    if (!permitido && convite.turmaId) {
      permitido = await podeGerenciarTurma(req, convite.turmaId);
    }

    if (
      !permitido &&
      convite.organizacaoTipo &&
      convite.organizacaoId
    ) {
      permitido = await podeGerenciarOrganizacao(
        req,
        convite.organizacaoTipo,
        convite.organizacaoId,
        convite.tipo === ConviteTipo.PROFESSOR ? "professores" : "atletasTurmas"
      );
    }

    if (!permitido) {
      return res.status(403).json({ message: "Você não pode cancelar este convite." });
    }

    if (convite.status === ConviteStatus.CANCELADO) {
      return res.json({ ok: true, message: "Convite já estava cancelado." });
    }

    if (convite.usoUnico && convite.status === ConviteStatus.UTILIZADO) {
      return res.status(409).json({ message: "Este convite já foi utilizado." });
    }

    await prisma.convite.update({
      where: { id: convite.id },
      data: {
        status: ConviteStatus.CANCELADO,
        canceladoEm: new Date(),
      },
    });

    return res.json({ ok: true, message: "Convite cancelado." });
  } catch (error) {
    console.error("cancelarConvite", error);
    return res.status(500).json({ message: "Falha ao cancelar convite." });
  }
}

export async function renovarConvite(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      getUsuarioId(req);

    if (!usuarioId) {
      return res.status(401).json({
        message:
          "Não autenticado.",
      });
    }

    const token =
      String(
        req.params.token || ""
      ).trim();

    if (!token) {
      return res.status(400).json({
        message:
          "Token de convite inválido.",
      });
    }

    const convite =
      await carregarConvite(
        token
      );

    if (!convite) {
      return res.status(404).json({
        message:
          "Convite não encontrado.",
      });
    }

    if (
      convite.tipo !==
        ConviteTipo.TURMA &&
      convite.tipo !==
        ConviteTipo.ORGANIZACAO
    ) {
      return res.status(400).json({
        message:
          "Este tipo de convite não possui QR renovável.",
      });
    }

    let permitido =
      reqEhAdmin(req) ||
      convite.criadoPorId ===
        usuarioId;

    if (
      !permitido &&
      convite.turmaId
    ) {
      permitido =
        await podeGerenciarTurma(
          req,
          convite.turmaId
        );
    }

    if (
      !permitido &&
      convite.organizacaoTipo &&
      convite.organizacaoId
    ) {
      permitido =
        await podeGerenciarOrganizacao(
          req,
          convite.organizacaoTipo,
          convite.organizacaoId,
          "atletasTurmas"
        );
    }

    if (!permitido) {
      return res.status(403).json({
        message:
          "Você não pode renovar este convite.",
      });
    }

    const diasRaw =
      Number(
        req.body?.expiresInDays ??
          30
      );

    const expiresInDays =
      Number.isFinite(
        diasRaw
      )
        ? Math.min(
            365,
            Math.max(
              1,
              Math.trunc(
                diasRaw
              )
            )
          )
        : 30;

    const agora =
      new Date();

    const expiresAt =
      new Date(
        Date.now() +
          expiresInDays *
            24 *
            60 *
            60 *
            1000
      );

    const whereContexto:
      Prisma.ConviteWhereInput =
      {
        tipo:
          convite.tipo,

        status:
          ConviteStatus.ATIVO,

        canceladoEm:
          null,

        usoUnico:
          false,

        destinatarioUsuarioId:
          null,
      };

    if (
      convite.tipo ===
      ConviteTipo.TURMA
    ) {
      whereContexto.turmaId =
        convite.turmaId;
    } else {
      whereContexto.organizacaoTipo =
        convite.organizacaoTipo;

      whereContexto.organizacaoId =
        convite.organizacaoId;
    }

    const novoConvite =
      await prisma.$transaction(
        async (tx) => {
          await tx.convite.updateMany({
            where:
              whereContexto,

            data: {
              status:
                ConviteStatus.CANCELADO,

              canceladoEm:
                agora,
            },
          });

          return tx.convite.create({
            data: {
              tipo:
                convite.tipo,

              status:
                ConviteStatus.ATIVO,

              criadoPorId:
                usuarioId,

              destinatarioUsuarioId:
                null,

              organizacaoTipo:
                convite.organizacaoTipo,

              organizacaoId:
                convite.organizacaoId,

              turmaId:
                convite.turmaId,

              professorId:
                convite.professorId,

              usoUnico:
                false,

              expiresAt,
            },

            select: {
              id: true,
              token: true,
              tipo: true,
              expiresAt: true,
              usoUnico: true,
            },
          });
        }
      );

    return res.status(201).json({
      ok: true,

      token:
        novoConvite.token,

      convite:
        novoConvite,

      path:
        `/join/${novoConvite.token}`,
    });
  } catch (error) {
    console.error(
      "renovarConvite",
      error
    );

    return res.status(500).json({
      message:
        "Falha ao renovar convite.",
    });
  }
}