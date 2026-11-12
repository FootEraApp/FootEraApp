import type { Response } from "express";
import { Prisma, TipoUsuario, FuncaoMembroOrganizacao } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { sendError } from "../utils/httpError.js";
import {
  criarNotificacaoEEnviarPush,
} from "./notificacoesController.js";
import {
  hasActiveRole,
} from "../services/roles.js";
import {
  sincronizarMembroOrganizacaoLegada,
} from "../services/organizacoes.js";
import {
  canPermission,
} from "../services/permissions.js";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  ErroTransferencia,
  responderTransferenciaPropriedade,
} from "../services/transferenciaOrganizacaoService.js";

export async function listarMinhasOrganizacoesGerenciaveis(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId =
      String(
        req.user?.id || "",
      ).trim();

    if (!userId) {
      return res.status(401).json({
        items: [],
      });
    }

    const professorAtivo =
      await hasActiveRole(
        userId,
        TipoUsuario.Professor,
      );

    if (!professorAtivo) {
      return res.json({
        items: [],
      });
    }

    const prof =
      await prisma.professor.findFirst({
      where: { usuarioId: userId },
      select: {
        id: true,
        nome: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

    if (!prof?.id) {
      return res.json({ items: [] });
    }

    const [gestores, professorClubes, professorEscolinhas] = await Promise.all([
      prisma.organizacaoGestor.findMany({
        where: { professorId: prof.id, ativo: true },
        select: {
          id: true,
          tipo: true,
          ownerId: true,
          papel: true,
          permissoes: true,
          ativo: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.professorClube.findMany({
        where: { professorId: prof.id },
        select: {
          clubeId: true,
          papel: true,
          createdAt: true,
        },
      }),

      prisma.professorEscolinha.findMany({
        where: { professorId: prof.id },
        select: {
          escolinhaId: true,
          papel: true,
          createdAt: true,
        },
      }),
    ]);

    const clubeIdSet = new Set<string>();
    const escolinhaIdSet = new Set<string>();

    if (prof.clubeId) clubeIdSet.add(prof.clubeId);
    if (prof.escolinhaId) escolinhaIdSet.add(prof.escolinhaId);

    for (const g of gestores) {
      if (String(g.tipo) === "CLUBE" && g.ownerId) clubeIdSet.add(g.ownerId);
      if (String(g.tipo) === "ESCOLINHA" && g.ownerId) escolinhaIdSet.add(g.ownerId);
    }

    for (const pc of professorClubes) {
      if (pc.clubeId) clubeIdSet.add(pc.clubeId);
    }

    for (const pe of professorEscolinhas) {
      if (pe.escolinhaId) escolinhaIdSet.add(pe.escolinhaId);
    }

    const clubeIds = Array.from(clubeIdSet);
    const escolinhaIds = Array.from(escolinhaIdSet);

    const [clubes, escolinhas] = await Promise.all([
      clubeIds.length
        ? prisma.clube.findMany({
            where: { id: { in: clubeIds } },
            select: {
              id: true,
              nome: true,
              logo: true,
              cidade: true,
              estado: true,
            },
          })
        : Promise.resolve([]),

      escolinhaIds.length
        ? prisma.escolinha.findMany({
            where: { id: { in: escolinhaIds } },
            select: {
              id: true,
              nome: true,
              logo: true,
              cidade: true,
              estado: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const clubeMap = new Map(clubes.map((c) => [c.id, c]));
    const escolinhaMap = new Map(escolinhas.map((e) => [e.id, e]));

    const gestorMap = new Map<
      string,
      {
        id: string;
        tipo: string;
        ownerId: string;
        papel: string | null;
        permissoes: any;
        ativo: boolean;
        createdAt: Date;
        updatedAt: Date;
      }
    >();

    for (const g of gestores) {
      const key = `${String(g.tipo)}:${g.ownerId}`;
      if (!gestorMap.has(key)) {
        gestorMap.set(key, {
          id: g.id,
          tipo: String(g.tipo),
          ownerId: g.ownerId,
          papel: g.papel ?? null,
          permissoes: g.permissoes ?? null,
          ativo: g.ativo,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        });
      }
    }

    const items: Array<{
      id: string;
      tipo: "CLUBE" | "ESCOLINHA";
      ownerId: string;
      papel: string | null;
      permissoes: any;
      ativo: boolean;
      createdAt: Date;
      updatedAt: Date;
      nome: string | null;
      logo: string | null;
      cidade: string | null;
      estado: string | null;
    }> = [];

    for (const clubeId of clubeIds) {
      const detalhes = clubeMap.get(clubeId);
      if (!detalhes) continue;

      const key = `CLUBE:${clubeId}`;
      const gestor = gestorMap.get(key);

      const pivot = professorClubes.find((p) => p.clubeId === clubeId);

      items.push({
        id: gestor?.id ?? `clube-${clubeId}`,
        tipo: "CLUBE",
        ownerId: clubeId,
        papel: gestor?.papel ?? pivot?.papel ?? "Professor",
        permissoes: gestor?.permissoes ?? null,
        ativo: gestor?.ativo ?? true,
        createdAt: gestor?.createdAt ?? pivot?.createdAt ?? new Date(),
        updatedAt: gestor?.updatedAt ?? pivot?.createdAt ?? new Date(),
        nome: detalhes.nome ?? null,
        logo: detalhes.logo ?? null,
        cidade: detalhes.cidade ?? null,
        estado: detalhes.estado ?? null,
      });
    }

    for (const escolinhaId of escolinhaIds) {
      const detalhes = escolinhaMap.get(escolinhaId);
      if (!detalhes) continue;

      const key = `ESCOLINHA:${escolinhaId}`;
      const gestor = gestorMap.get(key);

      const pivot = professorEscolinhas.find((p) => p.escolinhaId === escolinhaId);

      items.push({
        id: gestor?.id ?? `escolinha-${escolinhaId}`,
        tipo: "ESCOLINHA",
        ownerId: escolinhaId,
        papel: gestor?.papel ?? pivot?.papel ?? "Professor",
        permissoes: gestor?.permissoes ?? null,
        ativo: gestor?.ativo ?? true,
        createdAt: gestor?.createdAt ?? pivot?.createdAt ?? new Date(),
        updatedAt: gestor?.updatedAt ?? pivot?.createdAt ?? new Date(),
        nome: detalhes.nome ?? null,
        logo: detalhes.logo ?? null,
        cidade: detalhes.cidade ?? null,
        estado: detalhes.estado ?? null,
      });
    }

    items.sort((a, b) => {
      const da = new Date(a.updatedAt).getTime();
      const db = new Date(b.updatedAt).getTime();
      return db - da;
    });

    return res.json({
      professorId: prof.id,
      items,
    });
  } catch (e: any) {
    console.error("[listarMinhasOrganizacoesGerenciaveis]", e);
    return res.status(500).json({
      items: [],
      message: "Erro ao listar organizações gerenciáveis.",
    });
  }
}

export async function criarVinculoGestor(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error:
          "Não autenticado.",
      });
    }

    const podeAdministrar =
      await canPermission(
        String(req.user.id),
        "VER_ADMIN",
      );

    if (!podeAdministrar) {
      return res.status(403).json({
        error:
          "Sem permissão.",
      });
    }

    const tipo =
      String(
        req.body?.tipo || "",
      ).toUpperCase();

    const ownerId =
      String(
        req.body?.ownerId || "",
      ).trim();

    const professorId =
      String(
        req.body?.professorId || "",
      ).trim();

    const papel =
      req.body?.papel
        ? String(req.body.papel)
        : null;

    const permissoes =
      req.body?.permissoes ??
      null;

    if (!["CLUBE", "ESCOLINHA"].includes(tipo)) {
      return res.status(400).json({ error: "tipo deve ser CLUBE ou ESCOLINHA." });
    }
    if (!ownerId) return res.status(400).json({ error: "ownerId obrigatório." });
    if (!professorId) return res.status(400).json({ error: "professorId obrigatório." });

    if (tipo === "CLUBE") {
      const clube = await prisma.clube.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });
    } else {
      const esc = await prisma.escolinha.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!esc) return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const prof =
      await prisma.professor.findUnique({
        where: {
          id:
            professorId,
        },

        select: {
          id: true,
          usuarioId: true,
        },
      });
    if (!prof) return res.status(404).json({ error: "Professor não encontrado." });

    const created = await prisma.organizacaoGestor.upsert({
      where: {
        tipo_ownerId_professorId: {
          tipo: tipo as any,
          ownerId,
          professorId,
        },
      },
      update: {
        ativo: true,
        papel,
        permissoes,
      },
      create: {
        tipo: tipo as any,
        ownerId,
        professorId,
        papel,
        permissoes,
        ativo: true,
      },
    });

    if (tipo === "CLUBE") {
      await prisma.professorClube.upsert({
        where: {
          professorId_clubeId: {
            professorId,
            clubeId: ownerId,
          },
        },
        update: {
          papel: papel ?? "Professor",
        },
        create: {
          professorId,
          clubeId: ownerId,
          papel: papel ?? "Professor",
        },
      });
    } else {
      await prisma.professorEscolinha.upsert({
        where: {
          professorId_escolinhaId: {
            professorId,
            escolinhaId: ownerId,
          },
        },
        update: {
          papel: papel ?? "Professor",
        },
        create: {
          professorId,
          escolinhaId: ownerId,
          papel: papel ?? "Professor",
        },
      });
    }

    await prisma.professor.update({
      where: { id: professorId },
      data:
        tipo === "CLUBE"
          ? { clubeId: ownerId }
          : { escolinhaId: ownerId },
    });

    if (
      prof.usuarioId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo:
          tipo === "CLUBE"
            ? "CLUBE"
            : "ESCOLINHA",

        ownerId,

        usuarioId:
          prof.usuarioId,

        funcao:
          FuncaoMembroOrganizacao.ADMINISTRADOR,

        permissoes,
      });
    }

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao criar vínculo." });
  }
}

export async function desativarVinculoGestor(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error:
          "Não autenticado.",
      });
    }

    const podeAdministrar =
      await canPermission(
        String(req.user.id),
        "VER_ADMIN",
      );

    if (!podeAdministrar) {
      return res.status(403).json({
        error:
          "Sem permissão.",
      });
    }

    const id =
      String(
        req.params?.id || "",
      );

    if (!id) {
      return res.status(400).json({
        error:
          "id obrigatório.",
      });
    }

    const updated =
      await prisma.organizacaoGestor.update({
        where: {
          id,
        },

        data: {
          ativo: false,
        },
      });

    const professor =
      await prisma.professor.findUnique({
        where: {
          id:
            updated.professorId,
        },

        select: {
          usuarioId: true,
        },
      });

    if (
      professor?.usuarioId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo:
          String(
            updated.tipo
          ) === "CLUBE"
            ? "CLUBE"
            : "ESCOLINHA",

        ownerId:
          updated.ownerId,

        usuarioId:
          professor.usuarioId,

        funcao:
          FuncaoMembroOrganizacao.PROFESSOR,

        permissoes:
          null,

        ativo:
          true,

        preservarMaiorFuncao:
          false,
      });
    }

    return res.json({
      item: updated,
    });
  } catch (e: any) {
    return res.status(500).json({
      error:
        e?.message ||
        "Erro ao desativar vínculo.",
    });
  }
}

async function canManageOwnerOrAdmin(
  req: AuthenticatedRequest,
  tipo: string,
  ownerId: string,
): Promise<boolean> {
  const userId = String(
    req.user?.id ?? req.userId ?? "",
  ).trim();

  if (!userId || !ownerId) {
    return false;
  }

  if (
    tipo !== "CLUBE" &&
    tipo !== "ESCOLINHA"
  ) {
    return false;
  }

  if (
    await canPermission(
      userId,
      "VER_ADMIN",
    )
  ) {
    return true;
  }

  const podeGerenciar =
    await canPermission(
      userId,
      "GERENCIAR_ORGANIZACAO",
    );

  if (!podeGerenciar) {
    return false;
  }

  const contexto =
    await getActiveContext(userId);

  if (
    contexto?.kind !== "ORGANIZATION" ||
    !contexto.organizationId
  ) {
    return false;
  }

  const entidade =
    tipo === "CLUBE"
      ? await prisma.clube.findUnique({
          where: { id: ownerId },
          select: {
            organizacaoId: true,
          },
        })
      : await prisma.escolinha.findUnique({
          where: { id: ownerId },
          select: {
            organizacaoId: true,
          },
        });

  if (!entidade?.organizacaoId) {
    return false;
  }

  return (
    contexto.organizationId ===
    entidade.organizacaoId
  );
}

type OrgTipo = "CLUBE" | "ESCOLINHA";

async function buscarProfessorIdsVinculados(
  tipo: OrgTipo,
  ownerId: string
): Promise<Set<string>> {
  const [relacoesAtivas, vinculosDiretos] =
    await Promise.all([
      prisma.relacaoTreinamento.findMany({
        where: {
          professorId: {
            not: null,
          },
          atletaId: null,
          ativo: true,
          encerradoEm: null,

          ...(tipo === "CLUBE"
            ? {
                clubeId: ownerId,
              }
            : {
                escolinhaId: ownerId,
              }),
        },
        select: {
          professorId: true,
        },
      }),

      tipo === "CLUBE"
        ? prisma.professorClube.findMany({
            where: {
              clubeId: ownerId,
            },
            select: {
              professorId: true,
            },
          })
        : prisma.professorEscolinha.findMany({
            where: {
              escolinhaId: ownerId,
            },
            select: {
              professorId: true,
            },
          }),
    ]);

  return new Set(
    [
      ...vinculosDiretos.map(
        (vinculo) => vinculo.professorId
      ),

      ...relacoesAtivas
        .map((relacao) => relacao.professorId)
        .filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0
        ),
    ]
  );
}

async function garantirOrganizacaoGestor(params: {
  professorId: string;
  tipo: OrgTipo;
  ownerId: string;
  papel?: string | null;
  permissoes?: any;
}) {
  const { professorId, tipo, ownerId, papel = null, permissoes = null } = params;

  const existente = await prisma.organizacaoGestor.findFirst({
    where: { professorId, tipo: tipo as any, ownerId },
    select: { id: true, ativo: true },
  });

  if (existente) {
    await prisma.organizacaoGestor.update({
      where: { id: existente.id },
      data: {
        ativo: true,
        ...(papel !== undefined ? { papel } : {}),
        ...(permissoes !== undefined ? { permissoes } : {}),
      },
    });
    return;
  }

  await prisma.organizacaoGestor.create({
    data: {
      professorId,
      tipo: tipo as any,
      ownerId,
      ativo: true,
      papel,
      permissoes,
    },
  });
}

async function sincronizarVinculosProfessorOrganizacao(professorId: string) {
  const professor = await prisma.professor.findUnique({
    where: { id: professorId },
    select: {
      id: true,
      clubeId: true,
      escolinhaId: true,
    },
  });

  if (!professor) return;

  if (professor.clubeId) {
    await prisma.professorClube.upsert({
      where: {
        professorId_clubeId: {
          professorId,
          clubeId: professor.clubeId,
        },
      },
      update: {},
      create: {
        professorId,
        clubeId: professor.clubeId,
        papel: "Professor",
      },
    });

    await garantirOrganizacaoGestor({
      professorId,
      tipo: "CLUBE",
      ownerId: professor.clubeId,
    });
  }

  if (professor.escolinhaId) {
    await prisma.professorEscolinha.upsert({
      where: {
        professorId_escolinhaId: {
          professorId,
          escolinhaId: professor.escolinhaId,
        },
      },
      update: {},
      create: {
        professorId,
        escolinhaId: professor.escolinhaId,
        papel: "Professor",
      },
    });

    await garantirOrganizacaoGestor({
      professorId,
      tipo: "ESCOLINHA",
      ownerId: professor.escolinhaId,
    });
  }

  const gestores = await prisma.organizacaoGestor.findMany({
    where: { professorId, ativo: true },
    select: { tipo: true, ownerId: true },
  });

  for (const g of gestores) {
    const tipo = String(g.tipo).toUpperCase() as OrgTipo;

    if (tipo === "CLUBE") {
      await prisma.professorClube.upsert({
        where: {
          professorId_clubeId: {
            professorId,
            clubeId: g.ownerId,
          },
        },
        update: {},
        create: {
          professorId,
          clubeId: g.ownerId,
          papel: "Professor",
        },
      });

      await prisma.professor.update({
        where: { id: professorId },
        data: { clubeId: g.ownerId },
      });
    }

    if (tipo === "ESCOLINHA") {
      await prisma.professorEscolinha.upsert({
        where: {
          professorId_escolinhaId: {
            professorId,
            escolinhaId: g.ownerId,
          },
        },
        update: {},
        create: {
          professorId,
          escolinhaId: g.ownerId,
          papel: "Professor",
        },
      });

      await prisma.professor.update({
        where: { id: professorId },
        data: { escolinhaId: g.ownerId },
      });
    }
  }

  const [clubesPivot, escolinhasPivot] = await Promise.all([
    prisma.professorClube.findMany({
      where: { professorId },
      select: { clubeId: true },
    }),
    prisma.professorEscolinha.findMany({
      where: { professorId },
      select: { escolinhaId: true },
    }),
  ]);

  for (const pc of clubesPivot) {
    await garantirOrganizacaoGestor({
      professorId,
      tipo: "CLUBE",
      ownerId: pc.clubeId,
    });
  }

  for (const pe of escolinhasPivot) {
    await garantirOrganizacaoGestor({
      professorId,
      tipo: "ESCOLINHA",
      ownerId: pe.escolinhaId,
    });
  }
}

export async function listarGestores(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const tipo = String(
      req.query?.tipo || ""
    ).toUpperCase() as OrgTipo;

    const ownerId = String(
      req.query?.ownerId || ""
    ).trim();

    if (!["CLUBE", "ESCOLINHA"].includes(tipo)) {
      return res.status(400).json({
        message:
          "tipo deve ser CLUBE ou ESCOLINHA.",
      });
    }

    if (!ownerId) {
      return res.status(400).json({
        message: "ownerId obrigatório.",
      });
    }
    if (
      !(
        await canManageOwnerOrAdmin(
          req,
          tipo,
          ownerId,
        )
      )
    ) {
      return res.status(403).json({
        error: "Sem permissão.",
      });
    }

    const professorIdsVinculados =
      await buscarProfessorIdsVinculados(
        tipo,
        ownerId
      );

    const professorIds = Array.from(
      professorIdsVinculados
    );

    if (professorIds.length === 0) {
      await prisma.organizacaoGestor.updateMany({
        where: {
          tipo: tipo as any,
          ownerId,
          ativo: true,
        },
        data: {
          ativo: false,
        },
      });

      return res.json({
        items: [],
      });
    }

    const gestoresExistentes =
      await prisma.organizacaoGestor.findMany({
        where: {
          tipo: tipo as any,
          ownerId,
          professorId: {
            in: professorIds,
          },
        },
        select: {
          professorId: true,
        },
      });

    const professorIdsComGestor = new Set(
      gestoresExistentes.map(
        (gestor) => gestor.professorId
      )
    );

    const professorIdsSemGestor =
      professorIds.filter(
        (professorId) =>
          !professorIdsComGestor.has(professorId)
      );

    if (professorIdsSemGestor.length > 0) {
      await prisma.organizacaoGestor.createMany({
        data: professorIdsSemGestor.map(
          (professorId) => ({
            tipo: tipo as any,
            ownerId,
            professorId,
            papel: "Professor",
            ativo: true,
          })
        ),
        skipDuplicates: true,
      });
    }

    await prisma.organizacaoGestor.updateMany({
      where: {
        tipo: tipo as any,
        ownerId,
        professorId: {
          notIn: professorIds,
        },
        ativo: true,
      },
      data: {
        ativo: false,
      },
    });

    const gestoresValidos =
      await prisma.organizacaoGestor.findMany({
        where: {
          tipo: tipo as any,
          ownerId,
          professorId: {
            in: professorIds,
          },
        },
        include: {
          professor: {
            select: {
              id: true,
              nome: true,
              cref: true,
              fotoUrl: true,
              usuarioId: true,
              usuario: {
                select: {
                  nome: true,
                  foto: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.json({
      items: gestoresValidos.map(
        (gestor) => ({
          id: gestor.id,
          professorId:
            gestor.professorId,
          ativo: gestor.ativo,
          papel:
            gestor.papel ?? "Professor",
          permissoes:
            gestor.permissoes ?? null,

          professorNome:
            gestor.professor?.nome ||
            gestor.professor?.usuario?.nome ||
            null,

          professorCref:
            gestor.professor?.cref ??
            null,

          professorFoto:
            gestor.professor?.fotoUrl ||
            gestor.professor?.usuario?.foto ||
            null,
        })
      ),
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Falha ao carregar responsáveis."
    );
  }
}

export async function criarGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const tipo = String(req.body?.tipo || "").toUpperCase();
    const ownerId = String(req.body?.ownerId || "").trim();
    const professorId = String(req.body?.professorId || "").trim();
    const papel = req.body?.papel ? String(req.body.papel) : null;
    const permissoes = req.body?.permissoes ?? null;

    if (!["CLUBE", "ESCOLINHA"].includes(tipo)) {
      return res.status(400).json({ error: "tipo deve ser CLUBE ou ESCOLINHA." });
    }
    if (!ownerId) return res.status(400).json({ error: "ownerId obrigatório." });
    if (!professorId) return res.status(400).json({ error: "professorId obrigatório." });

    if (
      !(
        await canManageOwnerOrAdmin(
          req,
          tipo,
          ownerId,
        )
      )
    ) {
      return res.status(403).json({
        error:
          "Sem permissão.",
      });
    }

    if (tipo === "CLUBE") {
      const clube = await prisma.clube.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });
    } else {
      const esc = await prisma.escolinha.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!esc) return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const prof =
      await prisma.professor.findUnique({
        where: {
          id:
            professorId,
        },

        select: {
          id: true,
          usuarioId: true,
        },
      });
    if (!prof) return res.status(404).json({ error: "Professor não encontrado." });

    const professorIdsVinculados =
      await buscarProfessorIdsVinculados(
        tipo as OrgTipo,
        ownerId
      );

    if (
      !professorIdsVinculados.has(professorId)
    ) {
      return res.status(409).json({
        error:
          "Este professor não está vinculado ao clube/escolinha.",
      });
    }

    const existente = await prisma.organizacaoGestor.findFirst({
      where: { tipo: tipo as any, ownerId, professorId },
      select: { id: true },
    });

    const item = existente
      ? await prisma.organizacaoGestor.update({
          where: {
            id: existente.id,
          },

          data: {
            ativo: true,
            papel,
            permissoes,
          },
        })
      : await prisma.organizacaoGestor.create({
          data: {
            tipo:
              tipo as any,

            ownerId,
            professorId,
            papel,
            permissoes,
            ativo: true,
          },
        });

    if (
      prof.usuarioId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo:
          tipo === "CLUBE"
            ? "CLUBE"
            : "ESCOLINHA",

        ownerId,

        usuarioId:
          prof.usuarioId,

        funcao:
          FuncaoMembroOrganizacao.ADMINISTRADOR,

        permissoes,

        ativo: true,
      });
    }

    return res
      .status(201)
      .json({
        item,
      });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao adicionar responsável." });
  }
}

export async function atualizarGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params?.id || "");
    if (!id) return res.status(400).json({ error: "id obrigatório." });

    const found = await prisma.organizacaoGestor.findUnique({
      where: { id },
      select: { id: true, tipo: true, ownerId: true, professorId: true },
    });
    if (!found) return res.status(404).json({ error: "Vínculo não encontrado." });

    if (
      !(
        await canManageOwnerOrAdmin(
          req,
          String(found.tipo),
          found.ownerId,
        )
      )
    ) {
      return res.status(403).json({
        error:
          "Sem permissão.",
      });
    }

    const papel = req.body?.papel !== undefined ? (req.body.papel ? String(req.body.papel) : null) : undefined;
    const permissoes = req.body?.permissoes !== undefined ? req.body.permissoes : undefined;
    const ativo = req.body?.ativo !== undefined ? !!req.body.ativo : undefined;

    const item = await prisma.organizacaoGestor.update({
      where: { id },
      data: {
        ...(papel !== undefined ? { papel } : {}),
        ...(permissoes !== undefined ? { permissoes } : {}),
        ...(ativo !== undefined ? { ativo } : {}),
      },
    });

    const professor =
      await prisma.professor.findUnique({
        where: {
          id:
            found.professorId,
        },

        select: {
          usuarioId: true,
        },
      });

    if (
      professor?.usuarioId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo:
          String(
            found.tipo
          ) === "CLUBE"
            ? "CLUBE"
            : "ESCOLINHA",

        ownerId:
          found.ownerId,

        usuarioId:
          professor.usuarioId,

        funcao:
          item.ativo
            ? FuncaoMembroOrganizacao.ADMINISTRADOR
            : FuncaoMembroOrganizacao.PROFESSOR,

        permissoes:
          item.ativo
            ? item.permissoes
            : null,

        ativo:
          true,

        preservarMaiorFuncao:
          item.ativo,
      });
    }

    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao salvar responsável." });
  }
}

export async function removerGestor(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const id =
      String(
        req.params?.id || "",
      );

    if (!id) {
      return res.status(400).json({
        error:
          "id obrigatório.",
      });
    }

    const found =
      await prisma.organizacaoGestor.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          tipo: true,
          ownerId: true,
          professorId: true,
        },
      });

    if (!found) {
      return res.status(404).json({
        error:
          "Vínculo não encontrado.",
      });
    }

    if (
      !(
        await canManageOwnerOrAdmin(
          req,
          String(
            found.tipo
          ),
          found.ownerId,
        )
      )
    ) {
      return res.status(403).json({
        error:
          "Sem permissão.",
      });
    }

    const professor =
      await prisma.professor.findUnique({
        where: {
          id:
            found.professorId,
        },

        select: {
          usuarioId: true,
        },
      });

    await prisma.organizacaoGestor.update({
      where: {
        id,
      },

      data: {
        ativo: false,
      },
    });

    if (
      professor?.usuarioId
    ) {
      await sincronizarMembroOrganizacaoLegada({
        tipo:
          String(
            found.tipo
          ) === "CLUBE"
            ? "CLUBE"
            : "ESCOLINHA",

        ownerId:
          found.ownerId,

        usuarioId:
          professor.usuarioId,

        funcao:
          FuncaoMembroOrganizacao.PROFESSOR,

        permissoes:
          null,

        ativo:
          true,

        preservarMaiorFuncao:
          false,
      });
    }

    return res.json({
      ok: true,
    });
  } catch (e: any) {
    return res.status(500).json({
      error:
        e?.message ||
        "Erro ao remover responsável.",
    });
  }
}


export async function sairDaOrganizacao(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = String(req.userId ?? "").trim();
  const organizacaoId = String(
    req.params.organizacaoId ?? ""
  ).trim();

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Faça login para continuar.",
    });
  }

  if (!organizacaoId) {
    return res.status(400).json({
      code: "ORGANIZATION_REQUIRED",
      message: "Informe a organização.",
    });
  }

  try {
    const resultado = await prisma.$transaction(
      async (tx) => {
        const usuario = await tx.usuario.findUnique({
          where: { id: usuarioId },
          select: {
            deletedAt: true,
            contextoOrganizacaoId: true,
          },
        });

        if (!usuario || usuario.deletedAt) {
          return {
            status: 403,
            code: "ACCOUNT_NOT_AVAILABLE",
            message: "Conta indisponível.",
          };
        }

        if (usuario.contextoOrganizacaoId === organizacaoId) {
          return {
            status: 409,
            code: "SWITCH_CONTEXT_FIRST",
            message:
              "Troque para outro perfil antes de sair desta organização.",
          };
        }

        const vinculo = await tx.membroOrganizacao.findUnique({
          where: {
            organizacaoId_usuarioId: {
              organizacaoId,
              usuarioId,
            },
          },
          select: {
            id: true,
            ativo: true,
            funcao: true,
            organizacao: {
              select: {
                ativo: true,
              },
            },
          },
        });

        if (!vinculo?.ativo || !vinculo.organizacao.ativo) {
          return {
            status: 404,
            code: "ACTIVE_MEMBERSHIP_NOT_FOUND",
            message: "Vínculo ativo não encontrado.",
          };
        }

        if (vinculo.funcao !== FuncaoMembroOrganizacao.MEMBRO) {
          return {
            status: 409,
            code: "ORGANIZATION_RESPONSIBILITIES",
            message:
              "Professores, administradores e proprietários precisam resolver suas responsabilidades antes de sair.",
          };
        }

        const atleta = await tx.atleta.findUnique({
          where: { usuarioId },
          select: {
            id: true,
            clubeId: true,
            escolinhaId: true,
          },
        });

        const organizacao = await tx.organizacao.findUnique({
          where: { id: organizacaoId },
          select: {
            tipo: true,
            clube: { select: { id: true } },
            escolinha: { select: { id: true } },
          },
        });

        if (atleta && organizacao) {
          const possuiVinculoLegado =
            (organizacao.tipo === "CLUBE" &&
              atleta.clubeId === organizacao.clube?.id) ||
            (organizacao.tipo === "ESCOLA" &&
              atleta.escolinhaId === organizacao.escolinha?.id);

          if (possuiVinculoLegado) {
            return {
              status: 409,
              code: "ORGANIZATION_LEGACY_ATHLETE_LINK",
              message:
                "Este atleta possui vínculo institucional ativo. Encerre esse vínculo antes de sair da organização.",
            };
          }

          if (
            organizacao.tipo === "CLUBE" &&
            organizacao.clube?.id
          ) {
            const participacoesEmElencos =
              await tx.atletaElenco.count({
                where: {
                  atletaId: atleta.id,
                  elenco: {
                    ativo: true,
                    clubeId: organizacao.clube.id,
                  },
                },
              });

            if (participacoesEmElencos > 0) {
              return {
                status: 409,
                code: "ORGANIZATION_ACTIVE_SQUAD_LINK",
                message:
                  "Este atleta participa de um elenco ativo. Resolva essa participação antes de sair.",
              };
            }
          }
        }

        const atualizado = await tx.membroOrganizacao.updateMany({
          where: {
            id: vinculo.id,
            usuarioId,
            ativo: true,
            funcao: FuncaoMembroOrganizacao.MEMBRO,
          },
          data: {
            ativo: false,
          },
        });

        if (atualizado.count !== 1) {
          return {
            status: 409,
            code: "MEMBERSHIP_CHANGED",
            message: "O vínculo foi alterado. Atualize a página.",
          };
        }

        await tx.usuario.update({
          where: { id: usuarioId },
          data: {
            tokenVersion: { increment: 1 },
          },
        });

        return {
          status: 200,
          code: "MEMBERSHIP_DEACTIVATED",
          message:
            "Participação encerrada. A organização e seus históricos foram preservados. Faça login novamente.",
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return res.status(resultado.status).json(resultado);
  } catch (error) {
    console.error("[sairDaOrganizacao]", error);
    return res.status(500).json({
      code: "ORGANIZATION_EXIT_FAILED",
      message: "Não foi possível encerrar a participação.",
    });
  }
}

export async function solicitarTransferenciaPropriedade(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = String(req.userId ?? "").trim();
  const organizacaoId = String(req.params.organizacaoId ?? "").trim();
  const destinatarioId = String(req.body?.destinatarioId ?? "").trim();

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Faça login novamente.",
    });
  }

  if (!organizacaoId || !destinatarioId) {
    return res.status(400).json({
      code: "INVALID_TRANSFER_REQUEST",
      message: "Informe a organização e o destinatário.",
    });
  }

  if (usuarioId === destinatarioId) {
    return res.status(400).json({
      code: "SAME_OWNER",
      message: "Selecione outra pessoa para receber a organização.",
    });
  }

  try {
    const resultado = await prisma.$transaction(
      async (tx) => {
        const organizacao = await tx.organizacao.findUnique({
          where: { id: organizacaoId },
          select: {
            id: true,
            nome: true,
            ativo: true,
            membros: {
              where: {
                ativo: true,
                funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
              },
              select: {
                id: true,
                usuarioId: true,
              },
            },
          },
        });

        if (
          !organizacao?.ativo ||
          organizacao.membros.length !== 1 ||
          organizacao.membros[0].usuarioId !== usuarioId
        ) {
          return {
            status: 403,
            code: "NOT_ORGANIZATION_OWNER",
            message: "Você não é o proprietário ativo desta organização.",
          };
        }

        const destinatario = await tx.usuario.findUnique({
          where: { id: destinatarioId },
          select: {
            id: true,
            nome: true,
            deletedAt: true,
            blockedAt: true,
          },
        });

        if (
          !destinatario ||
          destinatario.deletedAt ||
          destinatario.blockedAt
        ) {
          return {
            status: 409,
            code: "RECIPIENT_NOT_AVAILABLE",
            message: "O destinatário não está disponível.",
          };
        }

        const organizacaoTipo = await tx.organizacao.findUnique({
          where: { id: organizacaoId },
          select: { tipo: true },
        });

        if (!organizacaoTipo) {
          return {
            status: 404,
            code: "ORGANIZATION_NOT_FOUND",
            message: "Organização não encontrada.",
          };
        }

        const jaPossuiEntidade =
          organizacaoTipo.tipo === "CLUBE"
            ? await tx.clube.findUnique({
                where: { usuarioId: destinatarioId },
                select: { id: true },
              })
            : organizacaoTipo.tipo === "ESCOLA"
              ? await tx.escolinha.findUnique({
                  where: { usuarioId: destinatarioId },
                  select: { id: true },
                })
              : organizacaoTipo.tipo === "MARCA"
                ? await tx.marca.findUnique({
                    where: { usuarioId: destinatarioId },
                    select: { id: true },
                  })
                : await tx.federacao.findUnique({
                    where: { usuarioId: destinatarioId },
                    select: { id: true },
                  });

        if (jaPossuiEntidade) {
          return {
            status: 409,
            code: "RECIPIENT_ALREADY_OWNS_ORGANIZATION_TYPE",
            message:
              "Este usuário já possui uma organização deste tipo no modelo atual. Selecione outro destinatário.",
          };
        }

        const pendente = await tx.transferenciaPropriedade.findFirst({
          where: {
            organizacaoId,
            status: "PENDENTE",
            expiraEm: { gt: new Date() },
          },
          select: { id: true },
        });

        if (pendente) {
          return {
            status: 409,
            code: "TRANSFER_ALREADY_PENDING",
            message: "Já existe uma transferência pendente para esta organização.",
          };
        }

        const solicitacao = await tx.transferenciaPropriedade.create({
          data: {
            organizacaoId,
            proprietarioAtualId: usuarioId,
            destinatarioId,
            status: "PENDENTE",
            expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        return {
          status: 201,
          code: "TRANSFER_REQUEST_CREATED",
          message: `Solicitação para ${destinatario.nome} registrada. A propriedade ainda não foi alterada.`,
          solicitacaoId: solicitacao.id,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    if (
      resultado.status === 201 &&
      resultado.solicitacaoId
    ) {
      try {
        const organizacao = await prisma.organizacao.findUnique({
          where: { id: organizacaoId },
          select: { nome: true },
        });

        await criarNotificacaoEEnviarPush({
          usuarioId: destinatarioId,
          actorId: usuarioId,
          titulo: "Transferência de propriedade",
          mensagem:
            `Você recebeu uma solicitação para assumir ` +
            `${organizacao?.nome ?? "uma organização"}. ` +
            `Abra Configurações para aceitar ou recusar.`,
          link:
            `/configuracoes?secao=transferencias` +
            `&transferenciaId=${encodeURIComponent(resultado.solicitacaoId)}`,
        });
      } catch (erroNotificacao) {
        console.error(
          "[solicitarTransferenciaPropriedade] Falha ao notificar:",
          erroNotificacao,
        );
      }
    }

    return res.status(resultado.status).json(resultado);
  } catch (error) {
    console.error("[solicitarTransferenciaPropriedade]", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return res.status(409).json({
        code: "TRANSFER_CONCURRENT_CHANGE",
        message: "Ocorreu uma alteração simultânea. Tente novamente.",
      });
    }

    return res.status(500).json({
      code: "TRANSFER_REQUEST_FAILED",
      message: "Não foi possível registrar a solicitação.",
    });
  }
}

export async function buscarDestinatariosTransferencia(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = String(req.userId ?? "").trim();
  const organizacaoId = String(
    req.params.organizacaoId ?? "",
  ).trim();
  const busca = String(req.query.q ?? "").trim();

  if (!usuarioId) {
    return res.status(401).json({
      message: "Faça login novamente.",
    });
  }

  if (busca.length < 3 || busca.length > 80) {
    return res.status(400).json({
      code: "INVALID_SEARCH",
      message: "Digite pelo menos 3 caracteres.",
    });
  }

  try {
    const propriedade = await prisma.membroOrganizacao.findFirst({
      where: {
        organizacaoId,
        usuarioId,
        ativo: true,
        funcao: FuncaoMembroOrganizacao.PROPRIETARIO,
        organizacao: {
          is: { ativo: true },
        },
      },
      select: { id: true },
    });

    if (!propriedade) {
      return res.status(403).json({
        code: "NOT_ORGANIZATION_OWNER",
        message:
          "Apenas o proprietário pode buscar destinatários de transferência.",
      });
    }

    const usuarios = await prisma.usuario.findMany({
      where: {
        id: { not: usuarioId },
        deletedAt: null,
        blockedAt: null,
        OR: [
          {
            id: busca,
          },
          {
            nome: {
              contains: busca,
              mode: "insensitive",
            },
          },
          {
            nomeDeUsuario: {
              contains: busca,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        foto: true,
      },
      orderBy: {
        nome: "asc",
      },
      take: 8,
    });

    return res.json({
      items: usuarios,
    });
  } catch (error) {
    console.error(
      "[buscarDestinatariosTransferencia]",
      error,
    );

    return res.status(500).json({
      code: "RECIPIENT_SEARCH_FAILED",
      message:
        "Não foi possível buscar os usuários.",
    });
  }
}

export async function listarTransferenciasRecebidas(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = String(req.userId ?? "").trim();

  if (!usuarioId) {
    return res.status(401).json({
      message: "Não autenticado.",
    });
  }

  try {
    const registros =
      await prisma.transferenciaPropriedade.findMany({
        where: {
          destinatarioId: usuarioId,
          status: "PENDENTE",
          expiraEm: { gt: new Date() },
        },
        orderBy: { criadoEm: "desc" },
        take: 30,
      });

    const organizacoes = await prisma.organizacao.findMany({
      where: {
        id: {
          in: registros.map((item) => item.organizacaoId),
        },
      },
      select: {
        id: true,
        nome: true,
        tipo: true,
      },
    });

    const nomes = new Map(
      organizacoes.map((item) => [item.id, item]),
    );

    const proprietarios = await prisma.usuario.findMany({
      where: {
        id: {
          in: registros.map((item) => item.proprietarioAtualId),
        },
      },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        foto: true,
      },
    });

    const proprietariosPorId = new Map(
      proprietarios.map((usuario) => [usuario.id, usuario]),
    );

    return res.json({
      items: registros.map((item) => ({
        id: item.id,
        status: item.status,
        criadoEm: item.criadoEm,
        expiraEm: item.expiraEm,
        organizacao: nomes.get(item.organizacaoId) ?? null,
        proprietarioAtual:
          proprietariosPorId.get(item.proprietarioAtualId) ?? null,
      })),
    });
  } catch (error) {
    console.error("[listarTransferenciasRecebidas]", error);
    return res.status(500).json({
      message: "Erro ao listar transferências.",
    });
  }
}

export async function responderTransferenciaRecebida(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = String(req.userId ?? "").trim();
  const transferenciaId = String(
    req.params.transferenciaId ?? "",
  ).trim();

  if (!usuarioId) {
    return res.status(401).json({
      message: "Não autenticado.",
    });
  }

  if (!transferenciaId) {
    return res.status(400).json({
      message: "Informe a solicitação.",
    });
  }

  if (typeof req.body?.aceitar !== "boolean") {
    return res.status(400).json({
      message: "Informe aceitar: true ou false.",
    });
  }

  try {
    const resultado = await responderTransferenciaPropriedade({
      transferenciaId,
      destinatarioId: usuarioId,
      aceitar: req.body.aceitar,
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? ""),
    });

    try {
      const [organizacao, destinatario] = await Promise.all([
        prisma.organizacao.findUnique({
          where: { id: resultado.organizacaoId },
          select: { nome: true },
        }),
        prisma.usuario.findUnique({
          where: { id: resultado.destinatarioId },
          select: { nome: true },
        }),
      ]);

      const nomeOrganizacao =
        organizacao?.nome ?? "uma organização";

      const nomeDestinatario =
        destinatario?.nome ?? "O destinatário";

      const aceitou = resultado.status === "ACEITA";

      await criarNotificacaoEEnviarPush({
        usuarioId: resultado.proprietarioAnteriorId,
        actorId: resultado.destinatarioId,
        titulo: aceitou
          ? "Transferência de propriedade aceita"
          : "Transferência de propriedade recusada",
        mensagem: aceitou
          ? `${nomeDestinatario} aceitou a transferência ` +
            `de ${nomeOrganizacao}. A organização agora possui ` +
            `um novo proprietário.`
          : `${nomeDestinatario} recusou a transferência ` +
            `de ${nomeOrganizacao}. Você continua sendo ` +
            `o proprietário e pode solicitar novamente.`,
        link:
          "/configuracoes?secao=transferencias" +
          `&transferenciaId=${encodeURIComponent(transferenciaId)}`,
      });
    } catch (erroNotificacao) {
      console.error(
        "[responderTransferenciaRecebida] Falha ao notificar:",
        erroNotificacao,
      );
    }

    return res.json({
      ok: true,
      ...resultado,
      message:
        resultado.status === "ACEITA"
          ? "Propriedade transferida. Entre novamente para atualizar suas permissões."
          : "Solicitação recusada.",
    });
  } catch (error) {
    if (error instanceof ErroTransferencia) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2002"].includes(error.code)
    ) {
      console.error("[TRANSFERENCIA] Erro Prisma ao aceitar:", {
        prismaCode: error.code,
        meta: error.meta,
        message: error.message,
        transferenciaId,
      });

      return res.status(409).json({
        code:
          error.code === "P2034"
            ? "TRANSFER_TRANSACTION_CONFLICT"
            : "TRANSFER_UNIQUE_CONFLICT",
        message:
          error.code === "P2034"
            ? "Houve um conflito de transação. Tente novamente."
            : "Existe um conflito de unicidade nos registros da transferência. Verifique o log do servidor.",
      });
    }

    console.error("[responderTransferenciaRecebida]", error);

    return res.status(500).json({
      code: "TRANSFER_RESPONSE_FAILED",
      message: "Não foi possível responder à transferência.",
    });
  }
}

export async function listarHistoricoTransferencias(
  req: AuthenticatedRequest,
  res: Response,
) {
  const usuarioId = String(req.userId ?? "").trim();

  if (!usuarioId) {
    return res.status(401).json({
      message: "Não autenticado.",
    });
  }

  try {
    const registros =
      await prisma.transferenciaPropriedade.findMany({
        where: {
          OR: [
            { proprietarioAtualId: usuarioId },
            { destinatarioId: usuarioId },
          ],
        },
        select: {
          id: true,
          organizacaoId: true,
          proprietarioAtualId: true,
          destinatarioId: true,
          status: true,
          criadoEm: true,
          expiraEm: true,
          respondidoEm: true,
          concluidoEm: true,
        },
        orderBy: { criadoEm: "desc" },
        take: 100,
      });

    const organizacoes = await prisma.organizacao.findMany({
      where: {
        id: {
          in: [...new Set(
            registros.map((r) => r.organizacaoId),
          )],
        },
      },
      select: {
        id: true,
        nome: true,
        tipo: true,
      },
    });

    const usuarios = await prisma.usuario.findMany({
      where: {
        id: {
          in: [...new Set(
            registros.flatMap((r) => [
              r.proprietarioAtualId,
              r.destinatarioId,
            ]),
          )],
        },
      },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        foto: true,
      },
    });

    const organizacoesPorId = new Map(
      organizacoes.map((o) => [o.id, o]),
    );

    const usuariosPorId = new Map(
      usuarios.map((u) => [u.id, u]),
    );

    return res.json({
      items: registros.map((registro) => ({
        id: registro.id,
        sentido:
          registro.proprietarioAtualId === usuarioId
            ? "ENVIADA"
            : "RECEBIDA",
        statusEfetivo:
          registro.status === "PENDENTE" &&
          registro.expiraEm <= new Date()
            ? "EXPIRADA"
            : registro.status,
        status: registro.status,
        criadoEm: registro.criadoEm,
        expiraEm: registro.expiraEm,
        respondidoEm: registro.respondidoEm,
        concluidoEm: registro.concluidoEm,
        organizacao:
          organizacoesPorId.get(registro.organizacaoId) ?? null,
        remetente:
          usuariosPorId.get(registro.proprietarioAtualId) ?? null,
        destinatario:
          usuariosPorId.get(registro.destinatarioId) ?? null,
      })),
    });
  } catch (error) {
    console.error("[listarHistoricoTransferencias]", error);

    return res.status(500).json({
      code: "TRANSFER_HISTORY_FAILED",
      message: "Não foi possível carregar o histórico.",
    });
  }
}