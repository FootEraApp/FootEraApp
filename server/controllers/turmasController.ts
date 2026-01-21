// server/controllers/turmasController
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import type { TurmaUsuario, Usuario as UsuarioModel, Atleta as AtletaModel } from "@prisma/client";
import { prisma } from "../prisma.js";


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
    // 1) Turma existe?
    const turma = await prisma.turma.findUnique({
      where: { id },
      select: { id: true, clubeId: true, escolinhaId: true },
    });

    if (!turma) {
      return res.status(404).json({ error: "Turma não encontrada" });
    }

    // 2) Fonte OFICIAL: TurmaUsuario (membros)
    const membros = await prisma.turmaUsuario.findMany({
      where: { turmaId: id },
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
    });

    const usuarioIdsFromVinculo = membros
      .map((m) => m.usuarioId)
      .filter(Boolean);

    // 3) Camada de precaução: checar colunas legadas na tabela Turma (se existirem)
    //    Ex.: usuarioIds (text[]), atletaIds (text[])
    //    - Se o seu schema NÃO tiver isso, não quebra: só ignora.
    let usuarioIdsFromTurmaLegacy: string[] = [];

    try {
      const cols = await prisma.$queryRaw<
        { column_name: string }[]
      >`
        SELECT column_name
        FROM information_schema.columns
        WHERE (table_name = 'Turma' OR table_name = 'turma')
          AND column_name IN ('usuarioIds', 'atletaIds')
      `;

      const hasUsuarioIds = cols.some((c) => c.column_name === "usuarioIds");
      const hasAtletaIds = cols.some((c) => c.column_name === "atletaIds");

      if (hasUsuarioIds || hasAtletaIds) {
        // pega os arrays (se existirem) dessa turma
        const rows = await prisma.$queryRaw<any[]>`
          SELECT
            ${hasUsuarioIds ? prisma.$queryRaw`"usuarioIds"` : prisma.$queryRaw`NULL`} as "usuarioIds",
            ${hasAtletaIds ? prisma.$queryRaw`"atletaIds"` : prisma.$queryRaw`NULL`} as "atletaIds"
          FROM "Turma"
          WHERE id = ${id}
          LIMIT 1
        `;

        const row = rows?.[0];

        const legacyUsuarioIds: string[] = Array.isArray(row?.usuarioIds)
          ? row.usuarioIds.map(String).filter(Boolean)
          : [];

        const legacyAtletaIds: string[] = Array.isArray(row?.atletaIds)
          ? row.atletaIds.map(String).filter(Boolean)
          : [];

        if (legacyAtletaIds.length) {
          const atletasLegacy = await prisma.atleta.findMany({
            where: { id: { in: legacyAtletaIds } },
            select: { usuarioId: true },
          });

          const uids = atletasLegacy
            .map((a) => a.usuarioId)
            .filter((x): x is string => Boolean(x));

          usuarioIdsFromTurmaLegacy.push(...uids);
        }

        usuarioIdsFromTurmaLegacy.push(...legacyUsuarioIds);
      }
    } catch (legacyErr) {
      // Se não existir tabela/coluna com esse nome (ou for outro nome), só ignora
      // e segue com o vínculo oficial TurmaUsuario.
      console.warn("[turmas] legacy check ignorado:", legacyErr);
    }

    // 4) União + dedupe
    const usuarioIdsFinal = Array.from(
      new Set([...usuarioIdsFromVinculo, ...usuarioIdsFromTurmaLegacy].map(String))
    ).filter(Boolean);

    // 4.1) Descobrir se cada membro está VINCULADO ao dono da turma (clube/escolinha)
    const ownerClubeId = turma.clubeId ? String(turma.clubeId) : null;
    const ownerEscolinhaId = turma.escolinhaId ? String(turma.escolinhaId) : null;

    const vinculadoByUsuarioId = new Map<string, boolean>();

    if (usuarioIdsFinal.length && (ownerClubeId || ownerEscolinhaId)) {
      const atletasParaChecar = await prisma.atleta.findMany({
        where: { usuarioId: { in: usuarioIdsFinal } },
        select: {
          id: true,
          usuarioId: true,
          clubeId: true,
          escolinhaId: true,
          relacoesTreinamento: {
            where: {
              ...(ownerClubeId ? { clubeId: ownerClubeId } : {}),
              ...(ownerEscolinhaId ? { escolinhaId: ownerEscolinhaId } : {}),
              ativo: { not: false }, // mesma ideia que você usa no gerenciar
            },
            select: { id: true },
            take: 1,
          },
        },
      });

      for (const a of atletasParaChecar) {
        const direct =
          (ownerClubeId && a.clubeId === ownerClubeId) ||
          (ownerEscolinhaId && a.escolinhaId === ownerEscolinhaId);

        const viaRelacao = (a.relacoesTreinamento?.length ?? 0) > 0;

        vinculadoByUsuarioId.set(String(a.usuarioId), !!(direct || viaRelacao));
      }
    }

    // Se não achou atleta (usuário sem registro de atleta), considera NÃO vinculado
    for (const uid of usuarioIdsFinal) {
      if (!vinculadoByUsuarioId.has(uid)) vinculadoByUsuarioId.set(uid, false);
    }


    // 5) Carrega atletas (para mapear atletaId/posicao)
    const atletas = usuarioIdsFinal.length
      ? await prisma.atleta.findMany({
          where: { usuarioId: { in: usuarioIdsFinal } },
          select: { id: true, usuarioId: true, posicao: true },
        })
      : [];

    const atletaByUsuarioId = new Map(
      atletas.map((a) => [a.usuarioId, { atletaId: a.id, posicao: a.posicao }])
    );

    // 6) Monta alunos no mesmo formato do seu front
    //    - garante que até usuário vindo do legacy (sem TurmaUsuario) tenha "usuario" preenchido
    const usuarios = usuarioIdsFinal.length
      ? await prisma.usuario.findMany({
          where: { id: { in: usuarioIdsFinal } },
          select: { id: true, nome: true, foto: true },
        })
      : [];

    const usuarioById = new Map(usuarios.map((u) => [u.id, u]));

    const alunos = usuarioIdsFinal.map((usuarioId) => {
      const atletaInfo = atletaByUsuarioId.get(usuarioId) ?? null;
      const u = usuarioById.get(usuarioId) ?? null;

      const vinculado = !!vinculadoByUsuarioId.get(usuarioId);

      return {
        atletaId: atletaInfo?.atletaId ?? null,
        usuarioId,
        id: atletaInfo?.atletaId ?? usuarioId,
        posicao: atletaInfo?.posicao ?? null,
        vinculado,
        usuario: {
          id: u?.id ?? usuarioId,
          nome: u?.nome ?? "Atleta da turma",
          foto: u?.foto ?? null,
        },
      };
    });

    const naoVinculadosUsuarioIds = alunos
      .filter((a) => !a.vinculado)
      .map((a) => a.usuarioId);

    return res.json({
      alunos,
      atletaIds: alunos.map((a) => a.atletaId).filter(Boolean),
      usuarioIds: usuarioIdsFinal,
      naoVinculadosUsuarioIds,
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