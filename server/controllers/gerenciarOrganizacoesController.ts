// server/controllers/gerenciarOrganizacoesController.ts
import type { Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

type VinculoGestor = Prisma.OrganizacaoGestorGetPayload<{
  select: {
    id: true;
    tipo: true;
    ownerId: true;
    papel: true;
    permissoes: true;
    ativo: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

export async function listarMinhasOrganizacoesGerenciaveis(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = String(req.user?.id || "");
    const tipoUsuario = String(req.user?.tipo || "");

    if (!userId) {
      return res.status(401).json({ items: [] });
    }

    if (tipoUsuario !== "Professor") {
      return res.json({ items: [] });
    }

    const prof = await prisma.professor.findFirst({
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

    await sincronizarVinculosProfessorOrganizacao(prof.id);

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
      message: e?.message || "Erro ao listar organizações gerenciáveis.",
    });
  }
}

export async function criarVinculoGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuario = String(req.user?.tipo || "");
    if (!req.user?.id) return res.status(401).json({ error: "Não autenticado." });

    if (tipoUsuario !== "Admin") {
      return res.status(403).json({ error: "Sem permissão." });
    }

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

    if (tipo === "CLUBE") {
      const clube = await prisma.clube.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });
    } else {
      const esc = await prisma.escolinha.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!esc) return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const prof = await prisma.professor.findUnique({
      where: { id: professorId },
      select: { id: true },
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

    return res.status(201).json({ item: created });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao criar vínculo." });
  }
}

export async function desativarVinculoGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuario = String(req.user?.tipo || "");
    if (!req.user?.id) return res.status(401).json({ error: "Não autenticado." });

    if (tipoUsuario !== "Admin") {
      return res.status(403).json({ error: "Sem permissão." });
    }

    const id = String(req.params?.id || "");
    if (!id) return res.status(400).json({ error: "id obrigatório." });

    const updated = await prisma.organizacaoGestor.update({
      where: { id },
      data: { ativo: false },
    });

    return res.json({ item: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao desativar vínculo." });
  }
}

function canManageOwnerOrAdmin(tipoUsuario: string, myOwnerId: string | null, tipo: string, ownerId: string) {
  if (tipoUsuario === "Admin") return true;
  if (!myOwnerId) return false;

  if (tipoUsuario === "Clube" && tipo === "CLUBE" && myOwnerId === ownerId) return true;
  if (tipoUsuario === "Escolinha" && tipo === "ESCOLINHA" && myOwnerId === ownerId) return true;

  return false;
}

async function getMyOwnerId(req: AuthenticatedRequest) {
  const userId = String(req.user?.id || "");
  const tipoUsuario = String(req.user?.tipo || "");

  if (!userId) return { tipoUsuario, myOwnerId: null as string | null };

  if (tipoUsuario === "Clube") {
    const clube = await prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } });
    return { tipoUsuario, myOwnerId: clube?.id ?? null };
  }

  if (tipoUsuario === "Escolinha") {
    const esc = await prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } });
    return { tipoUsuario, myOwnerId: esc?.id ?? null };
  }

  return { tipoUsuario, myOwnerId: null as string | null };
}

type OrgTipo = "CLUBE" | "ESCOLINHA";

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

export async function listarGestores(req: AuthenticatedRequest, res: Response) {
  try {
    const tipo = String(req.query?.tipo || "").toUpperCase(); 
    const ownerId = String(req.query?.ownerId || "").trim();

    if (!["CLUBE", "ESCOLINHA"].includes(tipo)) {
      return res.status(400).json({ message: "tipo deve ser CLUBE ou ESCOLINHA." });
    }
    if (!ownerId) {
      return res.status(400).json({ message: "ownerId obrigatório." });
    }

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);

    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, tipo, ownerId)) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const professorIdsSet = new Set<string>();

    const gestores = await prisma.organizacaoGestor.findMany({
      where: {
        tipo: tipo as any,
        ownerId,
        ativo: true,
      },
      include: {
        professor: {
          select: { id: true, nome: true, cref: true, fotoUrl: true, usuarioId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const g of gestores) {
      if (g.professorId) professorIdsSet.add(g.professorId);
    }

    if (tipo === "CLUBE") {
      const pivot = await prisma.professorClube.findMany({
        where: { clubeId: ownerId },
        select: { professorId: true },
      });
      for (const p of pivot) professorIdsSet.add(p.professorId);

      const diretos = await prisma.professor.findMany({
        where: { clubeId: ownerId },
        select: { id: true },
      });
      for (const p of diretos) professorIdsSet.add(p.id);
    } else {
      const pivot = await prisma.professorEscolinha.findMany({
        where: { escolinhaId: ownerId },
        select: { professorId: true },
      });
      for (const p of pivot) professorIdsSet.add(p.professorId);

      const diretos = await prisma.professor.findMany({
        where: { escolinhaId: ownerId },
        select: { id: true },
      });
      for (const p of diretos) professorIdsSet.add(p.id);
    }

    const professorIds = Array.from(professorIdsSet);

    if (!professorIds.length) {
      return res.json({ items: [] });
    }

    const professores = await prisma.professor.findMany({
      where: { id: { in: professorIds } },
      select: {
        id: true,
        nome: true,
        cref: true,
        fotoUrl: true,
      },
      orderBy: { nome: "asc" },
    });

    const gestorMap = new Map(
      gestores.map((g) => [
        g.professorId,
        {
          id: g.id,
          ativo: g.ativo,
          papel: g.papel ?? null,
          permissoes: g.permissoes ?? null,
        },
      ])
    );

    return res.json({
      items: professores.map((p) => {
        const g = gestorMap.get(p.id);
        return {
          id: g?.id ?? `${tipo.toLowerCase()}-${ownerId}-${p.id}`,
          professorId: p.id,
          ativo: g?.ativo ?? true,
          papel: g?.papel ?? "Professor",
          permissoes: g?.permissoes ?? null,
          professorNome: p.nome ?? null,
          professorCref: p.cref ?? null,
          professorFoto: p.fotoUrl ?? null,
        };
      }),
    });
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Falha ao carregar responsáveis.",
    });
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

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);
    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, tipo, ownerId)) {
      return res.status(403).json({ error: "Sem permissão." });
    }

    if (tipo === "CLUBE") {
      const clube = await prisma.clube.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });
    } else {
      const esc = await prisma.escolinha.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!esc) return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const prof = await prisma.professor.findUnique({ where: { id: professorId }, select: { id: true } });
    if (!prof) return res.status(404).json({ error: "Professor não encontrado." });

    const existente = await prisma.organizacaoGestor.findFirst({
      where: { tipo: tipo as any, ownerId, professorId },
      select: { id: true },
    });

    const item = existente
      ? await prisma.organizacaoGestor.update({
          where: { id: existente.id },
          data: { ativo: true, papel, permissoes },
        })
      : await prisma.organizacaoGestor.create({
          data: { tipo: tipo as any, ownerId, professorId, papel, permissoes, ativo: true },
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
    return res.status(201).json({ item });
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
      select: { id: true, tipo: true, ownerId: true },
    });
    if (!found) return res.status(404).json({ error: "Vínculo não encontrado." });

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);
    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, String(found.tipo), found.ownerId)) {
      return res.status(403).json({ error: "Sem permissão." });
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

    return res.json({ item });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao salvar responsável." });
  }
}

export async function removerGestor(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params?.id || "");
    if (!id) return res.status(400).json({ error: "id obrigatório." });

    const found = await prisma.organizacaoGestor.findUnique({
      where: { id },
      select: { id: true, tipo: true, ownerId: true },
    });
    if (!found) return res.status(404).json({ error: "Vínculo não encontrado." });

    const { tipoUsuario, myOwnerId } = await getMyOwnerId(req);
    if (!canManageOwnerOrAdmin(tipoUsuario, myOwnerId, String(found.tipo), found.ownerId)) {
      return res.status(403).json({ error: "Sem permissão." });
    }

    await prisma.organizacaoGestor.update({ where: { id }, data: { ativo: false } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erro ao remover responsável." });
  }
}