import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

function getTurmaPivot(): any {
  const p: any = prisma as any;

  const preferred = [
    "turmaAluno","turmaAlunos","alunoTurma","alunosTurma",
    "turmaUsuario","turmaUsuarios",
    "turmaAtleta","turmaAtletas","atletaTurma","atletasTurma",
    "turmaMembro","turmaIntegrante","membroTurma","membrosTurma",
    "participanteTurma","turmaParticipante"
  ];
  for (const k of preferred) if (p[k]) return p[k];

  const keys = Object.keys(p).filter((k) => typeof p[k]?.findMany === "function");
  const candidates = keys.filter((k) =>
    /turm/i.test(k) && /(alun|usuari|atlet|memb|particip|integr)/i.test(k)
  );

  for (const k of candidates) return p[k];

  return null;
}

const REL_USUARIO = [
  "alunos","usuarios","membros","participantes",
  "usuariosTurma","alunosTurma","membrosTurma","participantesTurma"
];
const REL_ATLETA  = [
  "atletas","jogadores","membros","participantes",
  "atletasTurma","jogadoresTurma","membrosTurma","participantesTurma"
];

export const getAlunosTurma = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    for (const rel of REL_USUARIO) {
      try {
        const row = await prisma.turma.findUnique({
          where: { id },
          select: { [rel]: { select: { id: true } } } as any,
        });
        const arr = (row as any)?.[rel];
        if (Array.isArray(arr)) {
          const usuarioIds = arr.map((u: any) => String(u.id)).filter(Boolean);
          return res.json({ usuarioIds });
        }
      } catch {}
    }

    for (const rel of REL_ATLETA) {
      try {
        const row = await prisma.turma.findUnique({
          where: { id },
          select: { [rel]: { select: { usuarioId: true } } } as any,
        });
        const arr = (row as any)?.[rel];
        if (Array.isArray(arr)) {
          const usuarioIds = arr.map((a: any) => String(a.usuarioId)).filter(Boolean);
          return res.json({ usuarioIds });
        }
      } catch {}
      try {
        const row = await prisma.turma.findUnique({
          where: { id },
          select: { [rel]: { select: { id: true } } } as any,
        });
        const arr = (row as any)?.[rel];
        if (Array.isArray(arr) && arr.length) {
          const atletaIds = arr.map((a: any) => String(a.id)).filter(Boolean);
          const atletas = await prisma.atleta.findMany({
            where: { id: { in: atletaIds } },
            select: { usuarioId: true },
          });
          const usuarioIds = atletas.map((a) => String(a.usuarioId)).filter(Boolean);
          return res.json({ usuarioIds });
        }
      } catch {}
    }

    const pivot = getTurmaPivot();
    if (!pivot) {
      return res.status(500).json({
        message:
          "Não foi possível ler alunos: nem relação direta nem pivô encontrado. Verifique o schema da Turma.",
      });
    }

    try {
      const rows = await pivot.findMany({
        where: { turmaId: id },
        select: { turmaId: true, usuarioId: true },
      });
      const usuarioIds = rows.map((r: any) => String(r.usuarioId)).filter(Boolean);
      return res.json({ usuarioIds });
    } catch {}

    const rows = await pivot.findMany({
      where: { turmaId: id },
      select: { turmaId: true, atletaId: true },
    });
    const atletaIds = rows.map((r: any) => String(r.atletaId)).filter(Boolean);
    if (!atletaIds.length) return res.json({ usuarioIds: [] });

    const atletas = await prisma.atleta.findMany({
      where: { id: { in: atletaIds } },
      select: { usuarioId: true },
    });
    const usuarioIds = atletas.map((a) => String(a.usuarioId)).filter(Boolean);
    return res.json({ usuarioIds });
  } catch (e) {
    console.error("[getAlunosTurma]", e);
    return res.status(500).json({ message: "Erro ao carregar alunos da turma" });
  }
};

export const setAlunosTurma = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const usuarioIds: string[] = Array.isArray(req.body?.usuarioIds)
      ? req.body.usuarioIds.map(String)
      : [];

    const turma = await prisma.turma.findUnique({ where: { id }, select: { id: true } });
    if (!turma) return res.status(404).json({ message: "Turma não encontrada" });

    for (const rel of REL_USUARIO) {
      try {
        await prisma.turma.update({
          where: { id },
          data: { [rel]: { set: usuarioIds.map((uid) => ({ id: uid })) } } as any,
        });
        return res.json({ ok: true, turmaId: id, total: usuarioIds.length });
      } catch {}
    }

    const atletas = usuarioIds.length
      ? await prisma.atleta.findMany({
          where: { usuarioId: { in: usuarioIds } },
          select: { id: true },
        })
      : [];
    const atletaIds = atletas.map((a) => a.id);

    for (const rel of REL_ATLETA) {
      try {
        await prisma.turma.update({
          where: { id },
          data: { [rel]: { set: atletaIds.map((aid) => ({ id: aid })) } } as any,
        });
        return res.json({ ok: true, turmaId: id, total: atletaIds.length });
      } catch {}
    }

    const pivot = getTurmaPivot();
    if (!pivot) {
      return res.status(500).json({
        message:
          "Não foi possível salvar: nem relação direta nem pivô encontrado. Verifique o schema da Turma.",
      });
    }

    try {
      await prisma.$transaction([
        pivot.deleteMany({
          where: { turmaId: id, NOT: { usuarioId: { in: usuarioIds } } },
        }),
        pivot.createMany({
          data: usuarioIds.map((uid) => ({ turmaId: id, usuarioId: uid })),
          skipDuplicates: true,
        }),
      ]);
      return res.json({ ok: true, turmaId: id, total: usuarioIds.length });
    } catch {}

    await prisma.$transaction([
      pivot.deleteMany({
        where: { turmaId: id, NOT: { atletaId: { in: atletaIds } } },
      }),
      pivot.createMany({
        data: atletaIds.map((aid) => ({ turmaId: id, atletaId: aid })),
        skipDuplicates: true,
      }),
    ]);
    return res.json({ ok: true, turmaId: id, total: atletaIds.length });
  } catch (e) {
    console.error("[setAlunosTurma]", e);
    return res.status(500).json({ message: "Erro ao salvar alunos da turma" });
  }
};

export async function obterAlunosTurma(req: Request, res: Response) {
  const { id } = req.params;
  const membros = await prisma.turmaUsuario.findMany({
    where: { turmaId: id },
    select: { usuarioId: true },
  });
  return res.json({ usuarioIds: membros.map(m => m.usuarioId) });
}

export async function listarMinhasTurmas(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "");
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId obrigatório" });

    const turmas = await prisma.turma.findMany({
      where: {
        OR: [{ clubeId: tipoUsuarioId }, { escolinhaId: tipoUsuarioId }, { professorId: tipoUsuarioId }],
      },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });

    return res.json({ items: turmas });
  } catch (e) {
    console.error("[listarMinhasTurmas] erro:", e);
    return res.status(500).json({ error: "Erro ao listar turmas" });
  }
}

export async function listarTurmas(req: Request, res: Response) {
  const ownerTipo = String(req.query.ownerTipo || "");
  const ownerId   = String(req.query.ownerId || "");
  const professorId = req.query.professorId ? String(req.query.professorId) : undefined;

  if (!ownerTipo || !ownerId) {
    return res.status(400).json({ message: "ownerTipo e ownerId são obrigatórios" });
  }

  const where: any = {};
  if (ownerTipo === "Clube") where.clubeId = ownerId;
  if (ownerTipo === "Escolinha") where.escolinhaId = ownerId;
  if (professorId) where.professorId = professorId;

  const rows = await prisma.turma.findMany({
    where,
    include: {
      professor: { select: { id: true, nome: true } },
      _count: { select: { membros: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = rows.map((t) => ({
    id: t.id,
    nome: t.nome,
    categoria: t.categoria,
    professorId: t.professorId,
    professorNome: t.professor?.nome ?? null,
    alunosCount: t._count.membros,
    ownerTipo,
    ownerId,
  }));

  return res.json(items);
}

export async function criarTurma(req: Request, res: Response) {
  const { ownerTipo, ownerId, nome, categoria, professorId } = req.body || {};
  if (!ownerTipo || !ownerId || !nome) {
    return res.status(400).json({ message: "ownerTipo, ownerId e nome são obrigatórios" });
  }

  const data: any = { nome: String(nome).trim() };
  if (categoria)   data.categoria = String(categoria);
  if (professorId) data.professorId = String(professorId);
  if (ownerTipo === "Clube")     data.clubeId = String(ownerId);
  if (ownerTipo === "Escolinha") data.escolinhaId = String(ownerId);

  const turma = await prisma.turma.create({ data });
  return res.status(201).json({ id: turma.id });
}

export async function updateTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { nome, categoria, descricao, ativo } = req.body as Partial<{
      nome: string;
      categoria: string;
      descricao: string;
      ativo: boolean;
    }>;

    const data: any = {};
    if (nome !== undefined) data.nome = nome;
    if (categoria !== undefined) data.categoria = categoria;
    if (descricao !== undefined) data.descricao = descricao;
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const up = await prisma.turma.update({ where: { id }, data });
    res.json(up);
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao atualizar turma" });
  }
}

export async function setProfessorTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { professorId } = req.body as { professorId: string | null };
    const up = await prisma.turma.update({
      where: { id },
      data: { professorId: professorId || null },
    });
    res.json(up);
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao atribuir professor" });
  }
}

export async function deleteTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.turma.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao remover turma" });
  }
}

export async function professoresDisponiveis(req: Request, res: Response) {
  try {
    const { ownerTipo, ownerId } = req.query as { ownerTipo?: "Escolinha" | "Clube"; ownerId?: string };

    if (!ownerTipo || !ownerId) return res.status(400).json({ message: "Informe ownerTipo e ownerId" });

    const where: any = {};
    if (ownerTipo === "Escolinha") where.escolinhaId = ownerId;
    if (ownerTipo === "Clube") where.clubeId = ownerId;

    const profs = await prisma.professor.findMany({
      where,
      select: { id: true, nome: true, codigo: true, cref: true, usuarioId: true },
      orderBy: { nome: "asc" },
    });

    res.json({ items: profs });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Falha ao listar professores" });
  }
}

export async function substituirAlunosTurma(req: Request, res: Response) {
  const { id } = req.params;
  const usuarioIds: string[] = Array.isArray(req.body?.usuarioIds) ? req.body.usuarioIds : [];

  const turma = await prisma.turma.findUnique({ where: { id } });
  if (!turma) return res.status(404).json({ message: "Turma não encontrada" });

  const atuais = await prisma.turmaUsuario.findMany({
    where: { turmaId: id },
    select: { usuarioId: true },
  });
  const atuaisSet = new Set(atuais.map(a => a.usuarioId));
  const novosSet  = new Set(usuarioIds.map(String));

  const paraRemover = [...atuaisSet].filter(u => !novosSet.has(u));
  const paraAdicionar = [...novosSet].filter(u => !atuaisSet.has(u));

  if (paraRemover.length === 0 && paraAdicionar.length === 0) {
    const total = await prisma.turmaUsuario.count({ where: { turmaId: id } });
    return res.json({ ok: true, added: 0, removed: 0, total });
  }

  await prisma.$transaction([
      ...paraRemover.map(u =>
      prisma.turmaUsuario.delete({
        where: { turmaId_usuarioId: { turmaId: id, usuarioId: u } },
      })
    ),
    ...paraAdicionar.map(u =>
      prisma.turmaUsuario.create({
        data: { turmaId: id, usuarioId: u },
      })
    ),
  ]);

  const total = await prisma.turmaUsuario.count({ where: { turmaId: id } });

  return res.json({
    ok: true,
    added: paraAdicionar.length,
    removed: paraRemover.length,
    total,
  });
}

export async function vincularProfessor(req: Request, res: Response) {
  const { id } = req.params;
  const { professorId } = req.body || {};
  const turma = await prisma.turma.update({
    where: { id },
    data: { professorId: professorId || null },
    select: { id: true },
  });
  return res.json({ id: turma.id, ok: true });
}