// server/controllers/turmasController
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import { sendError } from "../utils/httpError.js";

function uniqById<T extends { id: string }>(arr: T[]) {
  const map = new Map<string, T>();
  for (const item of arr) {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function parseCategoriasTurma(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map(String).map((x) => x.trim()).filter(Boolean);
  }

  if (typeof input === "string" && input.trim()) {
    return [input.trim()];
  }

  return [];
}

export async function getAlunosTurma(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const usuarioLogadoId = String((req as any).userId || (req as any).userCtx?.id || "").trim();
    const turma = await prisma.turma.findUnique({
      where: { id },
      select: { id: true, clubeId: true, escolinhaId: true },
    });

    if (!turma) {
      return res.status(404).json({ error: "Turma não encontrada" });
    }

    const membros = await prisma.turmaUsuario.findMany({
      where: { turmaId: id },
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
    });

    const usuarioIdsFromVinculo = membros.map((m) => m.usuarioId).filter(Boolean);

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

    const usuarioIdsTurma = Array.from(
      new Set([...usuarioIdsFromVinculo, ...usuarioIdsFromTurmaLegacy].map(String))
    ).filter(Boolean);

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

      const map = new Map<string, typeof base[number]>();
      for (const a of base) map.set(String(a.usuarioId), a);

      disponiveis = Array.from(map.values()).map((a) => ({
        atletaId: String(a.id),
        usuarioId: String(a.usuarioId),
        id: String(a.id),
        posicao: (a.posicao as any) ?? null,
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

    const usuarioIdsTodos = Array.from(
      new Set([...usuarioIdsTurma, ...disponiveis.map((d) => d.usuarioId)].map(String))
    ).filter(Boolean);

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

    if (!ownerClubeId && !ownerEscolinhaId) {
      for (const uid of usuarioIdsTodos) {
        const isDisponivel = disponiveis.some((d) => d.usuarioId === uid);
        vinculoByUsuarioId.set(uid, {
          vinculado: isDisponivel, 
          tipo: isDisponivel ? "RELACAO_PROFESSOR" : "NENHUM",
          professorId: isDisponivel ? professorIdLogado : null,
        });
      }
    } else {
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

    const atletas = usuarioIdsTodos.length
      ? await prisma.atleta.findMany({
          where: { usuarioId: { in: usuarioIdsTodos } },
          select: { id: true, usuarioId: true, posicao: true },
        })
      : [];

    const atletaByUsuarioId = new Map(
      atletas.map((a) => [String(a.usuarioId), { atletaId: String(a.id), posicao: (a.posicao as any) ?? null }])
    );

    const usuarios = usuarioIdsTodos.length
      ? await prisma.usuario.findMany({
          where: { id: { in: usuarioIdsTodos } },
          select: { id: true, nome: true, foto: true },
        })
      : [];

    const usuarioById = new Map(usuarios.map((u) => [String(u.id), u]));

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
        inTurma: usuarioIdsTurma.includes(usuarioId),
        usuario: {
          id: u?.id ?? usuarioId,
          nome: u?.nome ?? "Atleta",
          foto: (u?.foto ?? null) as any,
        },
      };
    });

    const naoVinculadosUsuarioIds =
      ownerClubeId || ownerEscolinhaId
        ? alunos.filter((a) => a.inTurma && !a.vinculado).map((a) => a.usuarioId)
        : [];

    return res.json({
      alunos,
      usuarioIds: usuarioIdsTurma,
      atletaIds: alunos.filter((a) => a.inTurma).map((a) => a.atletaId).filter(Boolean),
      naoVinculadosUsuarioIds,
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
          { professores: { some: { professorId: tipoUsuarioId } } },
        ],
      },
      select: {
        id: true,
        nome: true,
        categoria: true,
        descricao: true,
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
      descricao: t.descricao ?? null,
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
    const ownerTipoRaw = req.query.ownerTipo ? String(req.query.ownerTipo).trim() : "";
    const ownerIdRaw = req.query.ownerId ? String(req.query.ownerId).trim() : "";
    const professorId = req.query.professorId
      ? String(req.query.professorId).trim()
      : undefined;

    if ((!ownerTipoRaw || !ownerIdRaw) && !professorId) {
      return res.status(400).json({
        message: "Informe ownerTipo + ownerId OU professorId",
      });
    }

    const where: any = {};
    const ownerTipoNorm = ownerTipoRaw.toLowerCase();

    if (ownerTipoRaw && ownerIdRaw) {
      if (ownerTipoNorm === "clube") where.clubeId = ownerIdRaw;
      else if (ownerTipoNorm === "escolinha") where.escolinhaId = ownerIdRaw;
      else {
        return res.status(400).json({
          message: "ownerTipo deve ser Clube ou Escolinha",
        });
      }
    }

    if (professorId) {
      where.professores = { some: { professorId } };
    }

    const rows = await prisma.turma.findMany({
      where,
      include: {
        professores: {
          include: {
            professor: {
              select: { id: true, nome: true },
            },
          },
        },
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
        descricao: (t as any).descricao ?? null,
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
    return sendError(res, e, "Erro ao listar turmas");
  }
}

export async function listarTurmasComoProfessor(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = String((req as any).userId || "").trim();

    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

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

      const profs = uniqById(profsRaw);
      const ownerTipo = t.clubeId ? "Clube" : t.escolinhaId ? "Escolinha" : null;
      const ownerId = t.clubeId ?? t.escolinhaId ?? null;

      return {
        id: t.id,
        nome: t.nome,
        categoria: t.categoria ?? null,
        descricao: (t as any).descricao ?? null,
        professorIds: profs.map((p) => p.id),
        professorNomes: profs.map((p) => p.nome),
        professorNome: profs.map((p) => p.nome).join(", ") || null,
        alunosCount: t._count.membros,
        ownerTipo,
        ownerId,
        criadoPorProfessorId: !ownerId ? professorId : null,
      };
    });

    return res.json({ items });
  } catch (e: any) {
    return sendError(res, e, "Erro ao listar turmas do professor");
  }
}

export async function criarTurma(req: Request, res: Response) {
  try {
    const {
      ownerTipo,
      ownerId,
      nome,
      descricao,
      categoria,
      professorId,
      atletaIds,
      usuarioIds,
    } = req.body || {};

    if (!nome) {
      return res.status(400).json({
        message: "nome é obrigatório",
      });
    }

    const usuarioLogadoId = String((req as any).userId || (req as any).userCtx?.id || "").trim();

    let professorIds: string[] = Array.isArray(req.body?.professorIds)
      ? req.body.professorIds.map(String).filter(Boolean)
      : professorId
        ? [String(professorId)]
        : [];

    if (!ownerTipo && !ownerId && professorIds.length === 0 && usuarioLogadoId) {
      const professorLogado = await prisma.professor.findFirst({
        where: { usuarioId: usuarioLogadoId },
        select: { id: true },
      });

      if (professorLogado?.id) {
        professorIds = [String(professorLogado.id)];
      }
    }

    if (!ownerTipo && !ownerId && professorIds.length === 0) {
      return res.status(400).json({
        message: "Não foi possível identificar o professor para criar a turma.",
      });
    }

    const data: any = {
      nome: String(nome).trim(),
      categoria: parseCategoriasTurma(categoria),
    };

    if (descricao !== undefined) {
      data.descricao = String(descricao || "").trim() || null;
    }

    if (ownerTipo && ownerId) {
      if (ownerTipo === "Clube") {
        data.clubeId = String(ownerId);
      } else if (ownerTipo === "Escolinha") {
        data.escolinhaId = String(ownerId);
      } else {
        return res.status(400).json({
          message: "ownerTipo deve ser Clube ou Escolinha",
        });
      }
    }

    const turma = await prisma.turma.create({ data });

    if (professorIds.length) {
      await prisma.turmaProfessor.createMany({
        data: professorIds.map((pid) => ({
          turmaId: turma.id,
          professorId: pid,
        })),
        skipDuplicates: true,
      });
    }

    let usuarioIdsFinal: string[] = [];

    if (Array.isArray(usuarioIds)) {
      usuarioIdsFinal.push(
        ...usuarioIds.map(String).filter((x) => x && x.trim())
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
          .filter((id): id is string => Boolean(id))
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
    return sendError(res, e, "Erro ao criar turma");
  }
}

export async function updateTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { nome, categoria, descricao, ativo } = req.body as Partial<{
      nome: string;
      categoria: string | string[];
      descricao: string;
      ativo: boolean;
    }>;

    const data: any = {};
    if (nome !== undefined) data.nome = nome;
    if (categoria !== undefined) data.categoria = parseCategoriasTurma(categoria);
    if (descricao !== undefined) data.descricao = descricao;
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const up = await prisma.turma.update({ where: { id }, data });
    res.json(up);
  } catch (e: any) {
    sendError(res, e, "Falha ao atualizar turma");
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
    return sendError(res, e, "Falha ao atribuir professores");
  }
}

export async function deleteTurma(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.turma.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    sendError(res, e, "Falha ao remover turma");
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
    sendError(res, e, "Falha ao listar professores");
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

export async function frequencia(req: Request, res: Response) {
  try {
    const turmaId = String(req.params.id || "").trim();
    if (!turmaId) return res.status(400).json({ message: "turmaId inválido" });

    const year = Number(req.query.year || new Date().getFullYear());
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "year inválido" });
    }

    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
    const membros = await prisma.turmaUsuario.findMany({
      where: { turmaId },
      select: { usuarioId: true },
    });

    const usuarioIds = membros.map((m) => String(m.usuarioId)).filter(Boolean);

    const atletas = usuarioIds.length
      ? await prisma.atleta.findMany({
          where: { usuarioId: { in: usuarioIds } },
          select: {
            id: true,
            usuarioId: true,
            nome: true,
            sobrenome: true,
            usuario: { select: { nome: true, foto: true } }, 
          },
        })
      : [];

    const atletaNomeByAtletaId = new Map<string, { nome: string; foto: string | null }>();

    for (const a of atletas) {
      const aid = String(a.id);

      const nomeBase = String(a.nome || a.usuario?.nome || "").trim();
      const sobrenomeBase = String(a.sobrenome || "").trim();
      const nome = [nomeBase, sobrenomeBase].filter(Boolean).join(" ").trim() || "Atleta";

      atletaNomeByAtletaId.set(aid, { nome, foto: (a.usuario?.foto ?? null) as any });
    }

    const agendados = await prisma.treinoAgendado.findMany({
      where: {
        turmaId,
        dataTreino: { gte: start, lt: end },
      },
      select: {
        id: true,
        atletaId: true,
        dataTreino: true,
      },
    });

    const agendadosIds = agendados.map((t) => String(t.id)).filter(Boolean);
    const realizadosTreinoAgendadoIds = new Set<string>();
    const contagemPorAtleta = new Map<string, number>();
    const realizadosPorMes = Array.from({ length: 12 }).map(() => 0);

    if (agendadosIds.length) {
      const submissoes = await prisma.submissaoTreino.findMany({
        where: {
          treinoAgendadoId: { in: agendadosIds },
          criadoEm: { gte: start, lt: end },
        },
        select: { treinoAgendadoId: true, atletaId: true, criadoEm: true },
      });

      for (const s of submissoes) {
        const tid = String(s.treinoAgendadoId || "");
        if (tid) realizadosTreinoAgendadoIds.add(tid);

        const aid = s.atletaId ? String(s.atletaId) : "";
        if (aid) contagemPorAtleta.set(aid, (contagemPorAtleta.get(aid) || 0) + 1);

        const m = new Date(s.criadoEm).getUTCMonth();
        if (m >= 0 && m < 12) realizadosPorMes[m] += 1;
      }
    }

    const agendadosPorMes = Array.from({ length: 12 }).map(() => 0);

    for (const a of agendados) {
      const d = a?.dataTreino ? new Date(a.dataTreino) : null;
      if (!d) continue;
      const m = d.getUTCMonth();
      if (m >= 0 && m < 12) agendadosPorMes[m] += 1;
    }

    const historicoMensal = Array.from({ length: 12 }).map((_, i) => ({
      mes: i + 1,
      agendados: agendadosPorMes[i],
      realizados: realizadosPorMes[i],
    }));

    const topAtletas = Array.from(contagemPorAtleta.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([atletaId, qtd]) => ({
        atletaId,
        qtd,
        nome: atletaNomeByAtletaId.get(atletaId)?.nome ?? "Atleta",
        foto: atletaNomeByAtletaId.get(atletaId)?.foto ?? null,
      }));

    return res.json({
      turmaId,
      year,
      totalAlunos: usuarioIds.length,
      totalAgendados: agendados.length,
      totalRealizados: realizadosTreinoAgendadoIds.size,
      topAtletas,
      historicoMensal,
    });
  } catch (e: any) {
    return sendError(res, e, "Falha ao carregar frequência.");
  }
}