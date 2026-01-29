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
    // ✅ usuário logado (quando existir)
    const usuarioLogadoId = String((req as any).userId || (req as any).userCtx?.id || "").trim();

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

    const usuarioIdsFromVinculo = membros.map((m) => m.usuarioId).filter(Boolean);

    // 3) Legacy (se existir)
    let usuarioIdsFromTurmaLegacy: string[] = [];
    try {
      const cols = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE (table_name = 'Turma' OR table_name = 'turma')
          AND column_name IN ('usuarioIds', 'atletaIds')
      `;

      const hasUsuarioIds = cols.some((c) => c.column_name === "usuarioIds");
      const hasAtletaIds = cols.some((c) => c.column_name === "atletaIds");

      if (hasUsuarioIds || hasAtletaIds) {
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

          usuarioIdsFromTurmaLegacy.push(
            ...atletasLegacy.map((a) => a.usuarioId).filter((x): x is string => Boolean(x))
          );
        }

        usuarioIdsFromTurmaLegacy.push(...legacyUsuarioIds);
      }
    } catch (legacyErr) {
      console.warn("[turmas] legacy check ignorado:", legacyErr);
    }

    // ✅ ids DA TURMA (somente membros)
    const usuarioIdsTurma = Array.from(
      new Set([...usuarioIdsFromVinculo, ...usuarioIdsFromTurmaLegacy].map(String))
    ).filter(Boolean);

    // =========================================================
    // ✅ NOVO: se for professor logado, buscar "disponíveis"
    // =========================================================
    let disponiveis: Array<{
      atletaId: string | null;
      usuarioId: string;
      id: string;
      posicao: string | null;
      vinculado: boolean;
      vinculoTipo: string;
      vinculoProfessorId: string | null;
      usuario: { id: string; nome: string; foto: string | null };
    }> = [];

    let professorIdLogado: string | null = null;

    if (usuarioLogadoId) {
      const prof = await prisma.professor.findFirst({
        where: { usuarioId: usuarioLogadoId },
        select: { id: true },
      });

      if (prof?.id) professorIdLogado = String(prof.id);
    }

    if (professorIdLogado) {
      // ⚠️ Ajuste aqui se seu schema tiver outro nome/estrutura
      // A ideia: pegar atletas com RelacaoTreinamento ativa para esse professor
      const rels = await prisma.relacaoTreinamento.findMany({
        where: {
          professorId: professorIdLogado,
          ativo: { not: false },
        },
        select: {
          atleta: {
            select: {
              id: true,
              usuarioId: true,
              posicao: true,
              usuario: { select: { id: true, nome: true, foto: true } },
            },
          },
        },
        take: 2000,
      });

      const base = rels
        .map((r) => r.atleta)
        .filter((a): a is NonNullable<typeof a> => Boolean(a?.usuarioId));

      // dedupe por usuarioId
      const map = new Map<string, typeof base[number]>();
      for (const a of base) map.set(String(a.usuarioId), a);

      disponiveis = Array.from(map.values()).map((a) => ({
        atletaId: String(a.id),
        usuarioId: String(a.usuarioId),
        id: String(a.id),
        posicao: (a.posicao as any) ?? null,

        // ✅ aqui, no modo professor, consideramos "vinculado"
        vinculado: true,
        vinculoTipo: "RELACAO_PROFESSOR",
        vinculoProfessorId: professorIdLogado,

        usuario: {
          id: String(a.usuario?.id ?? a.usuarioId),
          nome: String(a.usuario?.nome ?? "Atleta"),
          foto: (a.usuario?.foto ?? null) as any,
        },
      }));
    }

    // =========================================================
    // ✅ Agora monta "alunos" como união: turma + disponiveis
    // (mas sem marcar todos como selecionados)
    // =========================================================
    const usuarioIdsTodos = Array.from(
      new Set([...usuarioIdsTurma, ...disponiveis.map((d) => d.usuarioId)].map(String))
    ).filter(Boolean);

    // ---------------------------------------------------------
    // Sua lógica de "vinculado ao dono da turma" só faz sentido
    // quando existe clubeId/escolinhaId na turma.
    // No modo professor puro, não vamos bloquear por isso.
    // ---------------------------------------------------------
    const ownerClubeId = turma.clubeId ? String(turma.clubeId) : null;
    const ownerEscolinhaId = turma.escolinhaId ? String(turma.escolinhaId) : null;

    type VinculoTipo =
      | "CLUBE"
      | "ESCOLINHA"
      | "RELACAO_INSTITUICAO"
      | "RELACAO_PROFESSOR"
      | "NENHUM";

    type VinculoInfo = {
      vinculado: boolean;
      tipo: VinculoTipo;
      professorId?: string | null;
    };

    const vinculoByUsuarioId = new Map<string, VinculoInfo>();

    // ✅ se NÃO tem owner (clube/escolinha), e temos disponiveis, não bloqueia.
    if (!ownerClubeId && !ownerEscolinhaId) {
      for (const uid of usuarioIdsTodos) {
        const isDisponivel = disponiveis.some((d) => d.usuarioId === uid);
        vinculoByUsuarioId.set(uid, {
          vinculado: isDisponivel, // true se vem do vínculo do professor
          tipo: isDisponivel ? "RELACAO_PROFESSOR" : "NENHUM",
          professorId: isDisponivel ? professorIdLogado : null,
        });
      }
    } else {
      // ✅ mantém sua lógica atual (instituição)
      const professorIdsDaInstituicao = new Set<string>();

      const profsDiretos = await prisma.professor.findMany({
        where: {
          OR: [
            ...(ownerClubeId ? [{ clubeId: ownerClubeId }] : []),
            ...(ownerEscolinhaId ? [{ escolinhaId: ownerEscolinhaId }] : []),
          ],
        },
        select: { id: true },
      });
      profsDiretos.forEach((p) => professorIdsDaInstituicao.add(String(p.id)));

      if (ownerClubeId) {
        const profClubes = await prisma.professorClube.findMany({
          where: { clubeId: ownerClubeId },
          select: { professorId: true },
        });
        profClubes.forEach((p) => professorIdsDaInstituicao.add(String(p.professorId)));
      }

      if (ownerEscolinhaId) {
        const profEscolinhas = await prisma.professorEscolinha.findMany({
          where: { escolinhaId: ownerEscolinhaId },
          select: { professorId: true },
        });
        profEscolinhas.forEach((p) => professorIdsDaInstituicao.add(String(p.professorId)));
      }

      const professorIdsArr = Array.from(professorIdsDaInstituicao);

      if (usuarioIdsTodos.length) {
        const atletasParaChecar = await prisma.atleta.findMany({
          where: { usuarioId: { in: usuarioIdsTodos } },
          select: {
            usuarioId: true,
            clubeId: true,
            escolinhaId: true,
            relacoesTreinamento: {
              where: {
                ativo: { not: false },
                OR: [
                  ...(ownerClubeId ? [{ clubeId: ownerClubeId }] : []),
                  ...(ownerEscolinhaId ? [{ escolinhaId: ownerEscolinhaId }] : []),
                  ...(professorIdsArr.length ? [{ professorId: { in: professorIdsArr } }] : []),
                ],
              },
              select: { professorId: true, clubeId: true, escolinhaId: true },
              take: 50,
            },
          },
        });

        for (const a of atletasParaChecar) {
          const uid = String(a.usuarioId);

          const directClube = ownerClubeId && a.clubeId === ownerClubeId;
          const directEscolinha = ownerEscolinhaId && a.escolinhaId === ownerEscolinhaId;

          if (directClube) {
            vinculoByUsuarioId.set(uid, { vinculado: true, tipo: "CLUBE" });
            continue;
          }
          if (directEscolinha) {
            vinculoByUsuarioId.set(uid, { vinculado: true, tipo: "ESCOLINHA" });
            continue;
          }

          const relacaoInstituicao = (a.relacoesTreinamento ?? []).find((r) => {
            const rClubeOk = ownerClubeId && r.clubeId === ownerClubeId;
            const rEscolinhaOk = ownerEscolinhaId && r.escolinhaId === ownerEscolinhaId;
            return Boolean(rClubeOk || rEscolinhaOk);
          });

          if (relacaoInstituicao) {
            vinculoByUsuarioId.set(uid, { vinculado: true, tipo: "RELACAO_INSTITUICAO" });
            continue;
          }

          const relacaoProfessor = (a.relacoesTreinamento ?? []).find((r) => {
            if (!r.professorId) return false;
            return professorIdsDaInstituicao.has(String(r.professorId));
          });

          if (relacaoProfessor) {
            vinculoByUsuarioId.set(uid, {
              vinculado: true,
              tipo: "RELACAO_PROFESSOR",
              professorId: relacaoProfessor.professorId ? String(relacaoProfessor.professorId) : null,
            });
            continue;
          }

          vinculoByUsuarioId.set(uid, { vinculado: false, tipo: "NENHUM" });
        }
      }

      for (const uid of usuarioIdsTodos) {
        if (!vinculoByUsuarioId.has(uid)) {
          vinculoByUsuarioId.set(uid, { vinculado: false, tipo: "NENHUM" });
        }
      }
    }

    // 5) Carrega atletas p/ mapear atletaId/posicao (para TODOS)
    const atletas = usuarioIdsTodos.length
      ? await prisma.atleta.findMany({
          where: { usuarioId: { in: usuarioIdsTodos } },
          select: { id: true, usuarioId: true, posicao: true },
        })
      : [];

    const atletaByUsuarioId = new Map(
      atletas.map((a) => [String(a.usuarioId), { atletaId: String(a.id), posicao: (a.posicao as any) ?? null }])
    );

    // 6) Carrega usuários p/ nome/foto
    const usuarios = usuarioIdsTodos.length
      ? await prisma.usuario.findMany({
          where: { id: { in: usuarioIdsTodos } },
          select: { id: true, nome: true, foto: true },
        })
      : [];

    const usuarioById = new Map(usuarios.map((u) => [String(u.id), u]));

    // 7) Monta "alunos" no formato do front
    const alunos = usuarioIdsTodos.map((usuarioId) => {
      const atletaInfo = atletaByUsuarioId.get(usuarioId) ?? null;
      const u = usuarioById.get(usuarioId) ?? null;

      const vinc = vinculoByUsuarioId.get(usuarioId) ?? {
        vinculado: false,
        tipo: "NENHUM" as const,
        professorId: null,
      };

      return {
        atletaId: atletaInfo?.atletaId ?? null,
        usuarioId,
        id: atletaInfo?.atletaId ?? usuarioId,
        posicao: atletaInfo?.posicao ?? null,

        vinculado: vinc.vinculado,
        vinculoTipo: vinc.tipo,
        vinculoProfessorId: vinc.professorId ?? null,

        // ✅ ajuda o front: saber se já é membro da turma
        inTurma: usuarioIdsTurma.includes(usuarioId),

        usuario: {
          id: u?.id ?? usuarioId,
          nome: u?.nome ?? "Atleta",
          foto: (u?.foto ?? null) as any,
        },
      };
    });

    // ✅ só bloqueia quando tem instituição; no modo professor puro fica vazio
    const naoVinculadosUsuarioIds =
      ownerClubeId || ownerEscolinhaId
        ? alunos.filter((a) => a.inTurma && !a.vinculado).map((a) => a.usuarioId)
        : [];

    return res.json({
      alunos,
      // ✅ membros da turma (selecionados)
      usuarioIds: usuarioIdsTurma,
      atletaIds: alunos.filter((a) => a.inTurma).map((a) => a.atletaId).filter(Boolean),
      naoVinculadosUsuarioIds,

      // ✅ extra: lista “fora da turma” no modo professor
      disponiveis,
      usuarioIdsTodos,
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

export async function listarTurmasComoProfessor(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // ✅ usuário logado (JWT)
    const usuarioId = String((req as any).userId || "").trim();

    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    // ✅ acha o Professor vinculado a esse usuário
    const professor = await prisma.professor.findFirst({
      where: { usuarioId },
      select: { id: true },
    });

    if (!professor?.id) {
      return res.status(200).json({ items: [] });
    }

    const professorId = String(professor.id);

    const rows = await prisma.turma.findMany({
      where: {
        professores: {
          some: { professorId },
        },
        ativo: true,
      },
      include: {
        professores: {
          include: { professor: { select: { id: true, nome: true } } },
        },
        _count: { select: { membros: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = rows.map((t) => {
      const profsRaw = (t.professores ?? [])
        .map((tp) => tp?.professor ?? null)
        .filter((p): p is { id: string; nome: string } => Boolean(p?.id));

      // usa sua util uniqById se já existir no arquivo
      const profs = uniqById(profsRaw);

      // owner (clube/escolinha) vem do próprio registro
      const ownerTipo = t.clubeId ? "Clube" : t.escolinhaId ? "Escolinha" : null;
      const ownerId = t.clubeId ?? t.escolinhaId ?? null;

      return {
        id: t.id,
        nome: t.nome,
        categoria: t.categoria ?? null,
        professorIds: profs.map((p) => p.id),
        professorNomes: profs.map((p) => p.nome),
        professorNome: profs.map((p) => p.nome).join(", ") || null,
        alunosCount: t._count.membros,
        ownerTipo,
        ownerId,
      };
    });

    return res.json({ items });
  } catch (e: any) {
    console.error("[listarTurmasComoProfessor] erro:", e);
    return res
      .status(500)
      .json({ message: e.message || "Erro ao listar turmas do professor" });
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