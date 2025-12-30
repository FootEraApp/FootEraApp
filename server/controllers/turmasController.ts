import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import type { TurmaUsuario, Usuario as UsuarioModel, Atleta as AtletaModel } from "@prisma/client";

const prisma = new PrismaClient();

function uniqById<T extends { id: string }>(arr: T[]) {
  const map = new Map<string, T>();
  for (const item of arr) {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

const REL_USUARIO = [
  "alunos","usuarios","membros","participantes",
  "usuariosTurma","alunosTurma","membrosTurma","participantesTurma"
];
const REL_ATLETA  = [
  "atletas","jogadores","membros","participantes",
  "atletasTurma","jogadoresTurma","membrosTurma","participantesTurma"
];

type AlunoTurmaDTO = {
  id: string;
  usuarioId: string;
  nome: string;
  foto: string | null;
  usuario?: {
    id: string;
    nome: string;
    foto: string | null;
  };
};

type TurmaUsuarioComUsuario = TurmaUsuario & {
  usuario: Pick<UsuarioModel, "id" | "nome" | "foto"> | null;
};

export async function getAlunosTurma(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const turma = await prisma.turma.findUnique({
      where: { id },
      include: {
        membros: {
          include: {
            usuario: { select: { id: true, nome: true, foto: true } },
          },
        },
      },
    });

    if (!turma) {
      return res.status(404).json({ error: "Turma não encontrada" });
    }

    const usuarioIds = turma.membros.map((m) => m.usuarioId).filter(Boolean);

    const atletas = usuarioIds.length
      ? await prisma.atleta.findMany({
          where: { usuarioId: { in: usuarioIds } },
          select: {
            id: true,
            usuarioId: true,
            posicao: true,
          },
        })
      : [];

    const atletaByUsuarioId = new Map(
      atletas.map((a) => [
        a.usuarioId,
        { atletaId: a.id, posicao: a.posicao },
      ])
    );

    const alunos = turma.membros.map((m) => {
      const usuarioId = m.usuarioId;
      const atletaInfo = atletaByUsuarioId.get(usuarioId) ?? null;

      return {
        atletaId: atletaInfo?.atletaId ?? null,
        usuarioId,
        id: atletaInfo?.atletaId ?? usuarioId,
        posicao: atletaInfo?.posicao ?? null, 
        usuario: {
          id: m.usuario?.id ?? usuarioId,
          nome: m.usuario?.nome ?? "Atleta da turma",
          foto: m.usuario?.foto ?? null,
        },
      };
    });

    return res.json({
      alunos,
      atletaIds: alunos.map((a) => a.atletaId).filter(Boolean),
      usuarioIds,
    });
  } catch (e) {
    console.error("[turmas] erro ao buscar alunos da turma", id, e);
    return res.status(500).json({ error: "Erro interno ao buscar alunos" });
  }
}

export async function obterAlunosTurma(req: Request, res: Response) {
  const { id } = req.params;

  const membros = await prisma.turmaUsuario.findMany({
    where: { turmaId: id },
    select: { usuarioId: true },
  });

  const usuarioIds = membros.map((m) => m.usuarioId).filter(Boolean);

  const atletas = usuarioIds.length
    ? await prisma.atleta.findMany({
        where: { usuarioId: { in: usuarioIds } },
        select: { id: true, usuarioId: true },
      })
    : [];

  const atletaIds = atletas.map((a) => a.id);

  return res.json({ usuarioIds, atletaIds });
}

export async function listarMinhasTurmas(req: AuthenticatedRequest, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "").trim();
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId obrigatório" });

    const turmas = await prisma.turma.findMany({
      where: {
        OR: [
          { clubeId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { professores: { some: { professor: { usuarioId: tipoUsuarioId } } } },
        ],
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
        professores: {
          select: {
            professor: {
              select: {
                id: true,
                nome: true,
                usuario: { select: { nome: true } },
              },
            },
          },
        },
        _count: { select: { membros: true } },
      },
      orderBy: { nome: "asc" },
    });

    const items = turmas.map((t) => {
    const profsRaw = (t.professores ?? [])
      .map((tp) => tp?.professor ?? null)
      .filter((p): p is { id: string; nome: string; usuario: { nome: string } } => Boolean(p?.id));

    const profs = uniqById(profsRaw);

    return {
      id: t.id,
      nome: t.nome,
      categoria: t.categoria ?? null,
      professorIds: profs.map((p) => p.id),
      professorNomes: profs.map((p) => p.nome),
      professorNome: profs.map((p) => p.nome).join(", ") || null,
      alunosCount: t._count.membros,
    };
    });

    return res.json({ items });
  } catch (e) {
    console.error("[listarMinhasTurmas] erro:", e);
    return res.status(500).json({ error: "Erro ao listar turmas" });
  }
}

export async function listarTurmas(req: Request, res: Response) {
  try {
    const ownerTipoRaw = req.query.ownerTipo ? String(req.query.ownerTipo) : "";
    const ownerIdRaw   = req.query.ownerId   ? String(req.query.ownerId)   : "";
    const professorId  = req.query.professorId ? String(req.query.professorId) : undefined;

    if (!ownerTipoRaw && !ownerIdRaw && !professorId) {
      return res.status(400).json({
        message: "Informe ownerTipo + ownerId OU professorId",
      });
    }

    const where: any = {};

    if (ownerTipoRaw && ownerIdRaw) {
      if (ownerTipoRaw === "Clube")     where.clubeId     = ownerIdRaw;
      if (ownerTipoRaw === "Escolinha") where.escolinhaId = ownerIdRaw;
    }

    if (professorId) {
      where.professores = { some: { professorId } };
    }

    const rows = await prisma.turma.findMany({
      where,
      include: {
        professores: { include: { professor: { select: { id: true, nome: true } } } }, 
        _count: { select: { membros: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = rows.map((t) => {
    const profsRaw = (t.professores ?? [])
      .map((tp) => tp?.professor ?? null)
      .filter((p): p is { id: string; nome: string } => Boolean(p?.id));

    const profs = uniqById(profsRaw);

    return {
      id: t.id,
      nome: t.nome,
      categoria: t.categoria,
      professorIds: profs.map((p) => p.id),
      professorNomes: profs.map((p) => p.nome),
      professorNome: profs.map((p) => p.nome).join(", ") || null,
      alunosCount: t._count.membros,
      ownerTipo: ownerTipoRaw || null,
      ownerId: ownerIdRaw || null,
    };
  });
    return res.json(items);
  } catch (e: any) {
    console.error("[listarTurmas] erro:", e);
    return res.status(500).json({ message: e.message || "Erro ao listar turmas" });
  }
}

export async function criarTurma(req: Request, res: Response) {
  try {
    const {
      ownerTipo,
      ownerId,
      nome,
      categoria,
      professorId,
      atletaIds,
      usuarioIds,
    } = req.body || {};

    if (!ownerTipo || !ownerId || !nome) {
      return res.status(400).json({
        message: "ownerTipo, ownerId e nome são obrigatórios",
      });
    }

    const data: any = { nome: String(nome).trim() };

    if (categoria)   data.categoria = String(categoria);
    if (ownerTipo === "Clube") {
      data.clubeId = String(ownerId);
    }
    if (ownerTipo === "Escolinha") {
      data.escolinhaId = String(ownerId);
    }

    const turma = await prisma.turma.create({ data });

    const professorIds: string[] = Array.isArray(req.body?.professorIds)
      ? req.body.professorIds.map(String).filter(Boolean)
      : professorId ? [String(professorId)] : [];

    if (professorIds.length) {
      await prisma.turmaProfessor.createMany({
        data: professorIds.map((pid) => ({ turmaId: turma.id, professorId: pid })),
        skipDuplicates: true,
      });
    }

    let usuarioIdsFinal: string[] = [];

    if (Array.isArray(usuarioIds)) {
      usuarioIdsFinal.push(
        ...usuarioIds.map(String).filter((x) => x && x.trim()),
      );
    }

    if (Array.isArray(atletaIds) && atletaIds.length) {
      const atletas = await prisma.atleta.findMany({
        where: { id: { in: atletaIds.map(String) } },
        select: { usuarioId: true },
      });

      usuarioIdsFinal.push(
        ...atletas
          .map((a) => a.usuarioId)
          .filter((id): id is string => Boolean(id)),
      );
    }

    usuarioIdsFinal = Array.from(new Set(usuarioIdsFinal));

    if (usuarioIdsFinal.length) {
      await prisma.turmaUsuario.createMany({
        data: usuarioIdsFinal.map((uid) => ({
          turmaId: turma.id,
          usuarioId: uid,
        })),
        skipDuplicates: true,
      });
    }

    return res.status(201).json({
      id: turma.id,
      totalMembros: usuarioIdsFinal.length,
    });
  } catch (e: any) {
    console.error("[criarTurma] erro:", e);
    return res
      .status(500)
      .json({ message: e.message || "Erro ao criar turma" });
  }
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

export async function setProfessoresTurma(req: Request, res: Response) {
  try {
    const turmaId = String(req.params.id);
    const professorIds: string[] = Array.isArray(req.body?.professorIds)
      ? req.body.professorIds.map(String).filter(Boolean)
      : [];

    await prisma.$transaction([
      prisma.turmaProfessor.deleteMany({ where: { turmaId } }),
      ...(professorIds.length
        ? [prisma.turmaProfessor.createMany({
            data: professorIds.map((professorId) => ({ turmaId, professorId })),
            skipDuplicates: true,
          })]
        : []),
    ]);

    return res.json({ ok: true, turmaId, total: professorIds.length });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || "Falha ao atribuir professores" });
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