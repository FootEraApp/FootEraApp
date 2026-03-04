import { Prisma, Categoria, AvaliacaoAutorTipo } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../prisma.js";

const CATEGORIA_ORDER: Categoria[] = ["Sub9", "Sub11", "Sub13", "Sub15", "Sub17", "Sub20", "Livre"];

function pickMainCategoria(categorias: Categoria[] | null | undefined): Categoria | null {
  if (!categorias || categorias.length === 0) return null;
  const sorted = [...categorias].sort((a, b) => CATEGORIA_ORDER.indexOf(b) - CATEGORIA_ORDER.indexOf(a));
  return sorted[0] ?? null;
}

function parseOrder(order?: string) {
  switch (order) {
    case "pontuacao_asc":
      return { pontuacao: "asc" as const };
    case "nome_asc":
      return { nome: "asc" as const };
    case "nome_desc":
      return { nome: "desc" as const };
    case "pontuacao_desc":
    default:
      return { pontuacao: "desc" as const };
  }
}

async function resolveUsuarioId(input: string): Promise<string | null> {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const byId = await prisma.usuario.findUnique({
    where: { id: raw },
    select: { id: true },
  });
  if (byId) return byId.id;

  const byUser = await prisma.usuario.findFirst({
    where: {
      OR: [
        { nomeDeUsuario: raw },
        { email: raw },
      ],
    },
    select: { id: true },
  });
  return byUser?.id ?? null;
}

async function resolveEntidadeId(vinculo: "clube" | "escolinha" | "professor", idOrUser: string) {
  const usuarioId = await resolveUsuarioId(idOrUser);

  if (vinculo === "clube") {
    if (usuarioId) {
      const c = await prisma.clube.findUnique({ where: { usuarioId }, select: { id: true } });
      if (c) return { entidadeId: c.id, usuarioId };
    }
    const c2 = await prisma.clube.findUnique({ where: { id: idOrUser }, select: { id: true, usuarioId: true } });
    if (c2) return { entidadeId: c2.id, usuarioId: c2.usuarioId };
    return null;
  }

  if (vinculo === "escolinha") {
    if (usuarioId) {
      const e = await prisma.escolinha.findUnique({ where: { usuarioId }, select: { id: true } });
      if (e) return { entidadeId: e.id, usuarioId };
    }
    const e2 = await prisma.escolinha.findUnique({ where: { id: idOrUser }, select: { id: true, usuarioId: true } });
    if (e2) return { entidadeId: e2.id, usuarioId: e2.usuarioId };
    return null;
  }

  if (usuarioId) {
    const p = await prisma.professor.findUnique({ where: { usuarioId }, select: { id: true } });
    if (p) return { entidadeId: p.id, usuarioId };
  }
  const p2 = await prisma.professor.findUnique({ where: { id: idOrUser }, select: { id: true, usuarioId: true } });
  if (p2) return { entidadeId: p2.id, usuarioId: p2.usuarioId };
  return null;
}

export const gerenciarAtletasController = {
  list: async (req: Request, res: Response) => {
    try {
      const vinculo = String(req.query.vinculo || "").toLowerCase();
      const idOrUser = String(req.query.id || "").trim(); 
      const tipoUsuarioId = String(req.query.tipoUsuarioId || "").trim();
      const entidadeUsuarioId = tipoUsuarioId || idOrUser;
      const search = (req.query.search as string) || "";
      const categoria = (req.query.categoria as Categoria) || undefined;
      const posicaoFiltro = (req.query.posicao as string) || undefined;
      const status = (req.query.status as "ativo" | "inativo" | undefined) || undefined;
      const order = (req.query.order as string) || "pontuacao_desc";

      if (!["escolinha", "clube", "professor"].includes(vinculo)) {
        return res.status(400).json({ message: "Parâmetro 'vinculo' inválido" });
      }
      if (!entidadeUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' (usuarioId da entidade) é obrigatório" });
      }

      let whereByVinculo: any = {};
      let entidadeId: string | null = null;

  if (vinculo === "clube") {
    let entidade = await prisma.clube.findUnique({
      where: { usuarioId: entidadeUsuarioId },
      select: { id: true },
    });
    if (!entidade) {
      entidade = await prisma.clube.findUnique({
        where: { id: entidadeUsuarioId },
        select: { id: true },
      });
    }
    if (!entidade) {
      return res.status(404).json({ message: "Entidade não encontrada" });
    }

    entidadeId = entidade.id;

    whereByVinculo = {
      OR: [
        { clubeId: entidadeId },
        { relacoesTreinamento: { some: { clubeId: entidadeId, ativo: true } } },
      ],
    };
  }
  else if (vinculo === "escolinha") {
    let entidade = await prisma.escolinha.findUnique({
      where: { usuarioId: entidadeUsuarioId },
      select: { id: true },
    });

    if (!entidade) {
      entidade = await prisma.escolinha.findUnique({
        where: { id: entidadeUsuarioId },
        select: { id: true },
      });
    }

    if (!entidade) {
      return res.status(404).json({ message: "Entidade não encontrada" });
    }

    entidadeId = entidade.id;

    const rels = await prisma.relacaoTreinamento.findMany({
      where: {
        escolinhaId: entidade.id,
        ativo: { not: false},
      },
      select: { atletaId: true },
    });

    const idsRelacao = rels
      .map((r) => r.atletaId)
      .filter((x): x is string => !!x);

      whereByVinculo = {
          OR: [
            { escolinhaId: entidade.id },
            ...(idsRelacao.length ? [{ id: { in: idsRelacao } }] : []),
          ],
        };
     } else {
        const resolved = await resolveEntidadeId("professor", entidadeUsuarioId);
        if (!resolved) return res.status(404).json({ message: "Professor não encontrado" });

        entidadeId = resolved.entidadeId;

        whereByVinculo = {
          relacoesTreinamento: {
            some: {
              professorId: entidadeId,
              ativo: { not: false }, 
            },
          },
        };
      }
      
      const where: any = { AND: [whereByVinculo] };

      if (categoria) where.AND.push({ categoria: { has: categoria } });
      if (search) {
        where.AND.push({
          OR: [
            { nome: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { usuario: { is: { nome: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
          ],
        });
      }

      const atletas = await prisma.atleta.findMany({
        where,
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          idade: true,
          foto: true,
          posicao: true,
          categoria: true,
          usuario: { select: { nome: true } },
          pontuacao: { select: { pontuacaoTotal: true } },
        },
      });

      const since = new Date();
      since.setDate(since.getDate() - 14);

      const usuarioIds = atletas
        .map((a) => a.usuarioId)
        .filter((x): x is string => typeof x === "string" && x.length > 0);

      const ativosSet = new Set<string>();

      if (usuarioIds.length) {
        const rows = await prisma.atividadeRecente.findMany({
          where: {
            usuarioId: { in: usuarioIds },
            createdAt: { gte: since },
          },
          select: { usuarioId: true },
          distinct: ["usuarioId"],
        });

        for (const r of rows) {
          if (r.usuarioId) ativosSet.add(r.usuarioId);
        }
      }

      let elencoIds: string[] = [];
      if (vinculo === "clube" && entidadeId) {
        const elencos = await prisma.elenco.findMany({ where: { clubeId: entidadeId }, select: { id: true } });
        elencoIds = elencos.map((e) => e.id);
      } else if (vinculo === "escolinha" && entidadeId) {
        const elencos = await prisma.elenco.findMany({ where: { escolinhaId: entidadeId }, select: { id: true } });
        elencoIds = elencos.map((e) => e.id);
      } else if (vinculo === "professor" && entidadeId) {
        const elencos = await prisma.elenco.findMany({ where: { professorId: entidadeId }, select: { id: true } });
        elencoIds = elencos.map((e) => e.id);
      }

      const posicaoPorAtletaId = new Map<string, string>();
      if (elencoIds.length > 0) {
        const vincs = await prisma.atletaElenco.findMany({
          where: { elencoId: { in: elencoIds } },
          select: { atletaId: true, posicao: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        for (const v of vincs) {
          if (!posicaoPorAtletaId.has(v.atletaId)) {
            posicaoPorAtletaId.set(v.atletaId, String(v.posicao));
          }
        }
      }

      const enriched = atletas.map((a) => {
        const posicaoElenco = posicaoPorAtletaId.get(a.id) ?? null;

        return {
          id: a.id,
          usuarioId: a.usuarioId,
          nome: a.nome || a.usuario?.nome || "—",
          idade: a.idade,
          foto: a.foto,
          posicao: posicaoElenco || a.posicao || null,
          categoria: pickMainCategoria(a.categoria) || null,
          pontuacao: a.pontuacao?.pontuacaoTotal ?? 0,
          ativoRecentemente: a.usuarioId ? ativosSet.has(a.usuarioId) : false,
        };
      });

      let filtered = enriched;
      if (posicaoFiltro) {
        const needle = posicaoFiltro.toLowerCase();
        filtered = filtered.filter((x) => (x.posicao || "").toLowerCase() === needle);
      }

      if (status) {
        filtered = filtered.filter((x) => (status === "ativo" ? x.ativoRecentemente : !x.ativoRecentemente));
      }

      const ord = parseOrder(order);
      if ("nome" in ord) {
        filtered.sort((a, b) => (ord.nome === "asc" ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome)));
      } else if ("pontuacao" in ord) {
        filtered.sort((a, b) =>
          ord.pontuacao === "asc" ? (a.pontuacao ?? 0) - (b.pontuacao ?? 0) : (b.pontuacao ?? 0) - (a.pontuacao ?? 0)
        );
      }

      return res.json({ atletas: filtered });
    } catch (e: any) {
      console.error("[gerenciarAtletas.list]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar atletas" });
    }
  },

  listProfessores: async (req: Request, res: Response) => {
    try {
      const vinculo = String(req.query.vinculo || "").toLowerCase() as "escolinha" | "clube";
      const entidadeUsuarioId = String(req.query.id || "").trim();
      const search = String(req.query.search || "").trim();

      if (!["escolinha", "clube"].includes(vinculo)) {
        return res.status(400).json({ message: "Parâmetro 'vinculo' inválido (use 'escolinha' ou 'clube')" });
      }
      if (!entidadeUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' é obrigatório" });
      }

      const resolved = await resolveEntidadeId(vinculo, entidadeUsuarioId);
      if (!resolved) {
        return res.status(404).json({ message: vinculo === "clube" ? "Clube não encontrado" : "Escolinha não encontrada" });
      }
      const entidadeId = resolved.entidadeId;

      const ownerWhere = vinculo === "clube" ? { clubeId: entidadeId } : { escolinhaId: entidadeId };
      const ownerDirect =
        vinculo === "clube"
          ? ({ clubeId: entidadeId } as Prisma.ProfessorWhereInput)
          : ({ escolinhaId: entidadeId } as Prisma.ProfessorWhereInput);

      const turmasDoOwner = await prisma.turma.findMany({
        where: ownerWhere,
        select: {
          id: true,
          professores: {
            select: {
              professor: {
                select: { id: true, usuarioId: true, nome: true, cref: true, fotoUrl: true },
              },
            },
          },
        },
      });

      const profsViaTurmas = turmasDoOwner.flatMap((t) =>
        t.professores.map((tp) => tp.professor)
      );

      const profIdsViaTurmas = Array.from(new Set(profsViaTurmas.map((p) => p.id)));

      const professores = await prisma.professor.findMany({
        where: {
          AND: [
            {
              OR: [{ id: { in: profIdsViaTurmas } }, ownerDirect],
            },
            ...(search
              ? [{ nome: { contains: search, mode: Prisma.QueryMode.insensitive } }]
              : []),
          ],
        },
        select: { id: true, usuarioId: true, nome: true, cref: true, fotoUrl: true },
        orderBy: { nome: "asc" },
      });

      const usuarioIds = professores
        .map((p) => p.usuarioId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      const usuarios = await prisma.usuario.findMany({
        where: { id: { in: usuarioIds } },
        select: { id: true, nome: true },
      });
      const usuarioNomeMap = new Map(usuarios.map(u => [u.id, u.nome]));

      const grupos = await prisma.turmaProfessor.groupBy({
        by: ["professorId"],
        where: { turma: ownerWhere },
        _count: { _all: true },
      });

      const turmasCountMap = new Map<string, number>(
        grupos.map((g) => [g.professorId, g._count._all])
      );

      const payload = professores.map((p) => ({
        id: p.id,
        usuarioId: p.usuarioId,
        nome: p.nome || (p.usuarioId ? (usuarioNomeMap.get(p.usuarioId) ?? null) : null) || "—",
        cref: p.cref ?? null,
        fotoUrl: p.fotoUrl ?? null,
        turmasCount: turmasCountMap.get(p.id) ?? 0,
      }));

      return res.json({ professores: payload });
    } catch (e: any) {
      console.error("[gerenciarAtletas.listProfessores]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar professores" });
    }
  },

  listTreinos: async (req: Request, res: Response) => {
    try {
      const criador = String(req.query.criador || "").toLowerCase();
      const entidadeUsuarioId = String(req.query.id || "");

      if (!["escolinha", "clube", "professor"].includes(criador)) {
        return res.status(400).json({ message: "Parâmetro 'criador' inválido" });
      }
      if (!entidadeUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' obrigatório" });
      }

      let entidadeId: string | null = null;
      if (criador === "clube") {
        const clube = await prisma.clube.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!clube) return res.status(404).json({ message: "Entidade não encontrada" });
        entidadeId = clube.id;
      } else if (criador === "escolinha") {
        const escolinha = await prisma.escolinha.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!escolinha) return res.status(404).json({ message: "Entidade não encontrada" });
        entidadeId = escolinha.id;
      } else {
        const prof = await prisma.professor.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!prof) return res.status(404).json({ message: "Professor não encontrado" });
        entidadeId = prof.id;
      }

      let whereTreino: any = {};
      if (criador === "clube") whereTreino = { clubeId: entidadeId };
      else if (criador === "escolinha") whereTreino = { escolinhaId: entidadeId };
      else {
        // professor: dono OU colaborador
        whereTreino = {
          OR: [
            { professorId: entidadeId },
            { criadorProfessorId: entidadeId },
            { professores: { some: { professorId: entidadeId } } },
          ],
        };
      }

      const treinos = await prisma.treinoProgramado.findMany({
        where: whereTreino,
        select: {
          id: true,
          nome: true,
          descricao: true,
          objetivo: true,
          pontuacao: true,
          categoria: true,
          expiraEm: true,
          naoExpira: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        items: treinos.map((t) => ({
          id: t.id,
          titulo: t.nome,
          objetivo: t.objetivo ?? null,
          pontuacao: t.pontuacao ?? null,
          categoria: pickMainCategoria(t.categoria) ?? null,
          expiraEm: t.expiraEm ?? null,
          naoExpira: t.naoExpira ?? false,
        })),
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.listTreinos]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar treinos" });
    }
  },

  listTreinosVisiveis: async (req: Request, res: Response) => {
    try {
      const vinculo = String(req.query.vinculo || "").toLowerCase() as
        | "escolinha"
        | "clube"
        | "professor";

      let idOrUser = String(req.query.id || "").trim(); // ✅ vira let
      const tipoUsuarioId = String(req.query.tipoUsuarioId || "").trim(); 
      const debug = String(req.query.debug || "") === "1";
      const conteudo = String(req.query.conteudo ?? "1") === "1";
      const userIdFromToken = String((req as any).userId || "").trim();

      // ✅ se o front não mandar id, usa o id do token
      if (!idOrUser && !tipoUsuarioId && userIdFromToken) {
        idOrUser = userIdFromToken;
      }

      if (!["escolinha", "clube", "professor"].includes(vinculo)) {
        return res.status(400).json({
          message: "Parâmetro 'vinculo' inválido (use 'professor', 'clube' ou 'escolinha')",
        });
      }

      if (!idOrUser && !tipoUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' obrigatório" });
      }

      let entidadeId = "";

      if (tipoUsuarioId) {
        entidadeId = tipoUsuarioId;
      } else {
        const resolved = await resolveEntidadeId(vinculo, idOrUser);
        if (!resolved) return res.status(404).json({ message: "Entidade não encontrada" });
        entidadeId = resolved.entidadeId;
      }

      let professorIds: string[] = [];
      let clubeIds: string[] = [];
      let escolinhaIds: string[] = [];

      const ativoOuNull = { NOT: { ativo: false } };

      if (vinculo === "clube") {
        const profsDiretos = await prisma.professor.findMany({
          where: { clubeId: entidadeId },
          select: { id: true },
        });

        const idsDiretos = profsDiretos.map((p) => p.id).filter(Boolean);
        professorIds = Array.from(new Set([...professorIds, ...idsDiretos]));
      }

      if (vinculo === "escolinha") {
        const profsDiretos = await prisma.professor.findMany({
          where: { escolinhaId: entidadeId },
          select: { id: true },
        });

        const idsDiretos = profsDiretos.map((p) => p.id).filter(Boolean);
        professorIds = Array.from(new Set([...professorIds, ...idsDiretos]));
      }

      if (vinculo === "professor") {
        const turmasDoProfessor = await prisma.turmaProfessor.findMany({
          where: { professorId: entidadeId },
          select: { turma: { select: { clubeId: true, escolinhaId: true } } },
        });

        const clubeIdsViaTurma = turmasDoProfessor
          .map((x) => x.turma?.clubeId)
          .filter((x): x is string => !!x);

        const escolinhaIdsViaTurma = turmasDoProfessor
          .map((x) => x.turma?.escolinhaId)
          .filter((x): x is string => !!x);

        const prof = await prisma.professor.findUnique({
          where: { id: entidadeId },
          select: { clubeId: true, escolinhaId: true },
        });

        const clubeIdDireto = prof?.clubeId ? [prof.clubeId] : [];
        const escolinhaIdDireto = prof?.escolinhaId ? [prof.escolinhaId] : [];

        clubeIds = Array.from(new Set([...clubeIdsViaTurma, ...clubeIdDireto]));
        escolinhaIds = Array.from(new Set([...escolinhaIdsViaTurma, ...escolinhaIdDireto]));
      }

      let relacaoRows: Array<{ professorId: string | null }> = [];

      if (vinculo === "clube") {
        const rels = await prisma.relacaoTreinamento.findMany({
          where: {
            clubeId: entidadeId,
            professorId: { not: null },
            ...ativoOuNull,
          },
          select: { professorId: true },
        });

        relacaoRows = rels;
        const profFromRel = rels.map((r) => r.professorId).filter((x): x is string => !!x);
        professorIds = Array.from(new Set([...professorIds, ...profFromRel]));
      }

      if (vinculo === "escolinha") {
        const rels = await prisma.relacaoTreinamento.findMany({
          where: {
            escolinhaId: entidadeId,
            professorId: { not: null },
            ...ativoOuNull,
          },
          select: { professorId: true },
        });

        relacaoRows = rels;
        const profFromRel = rels.map((r) => r.professorId).filter((x): x is string => !!x);
        professorIds = Array.from(new Set([...professorIds, ...profFromRel]));
      }

      if (vinculo === "professor") {
        const rels = await prisma.relacaoTreinamento.findMany({
          where: {
            professorId: entidadeId,
            ...ativoOuNull,
          },
          select: { clubeId: true, escolinhaId: true },
        });

        const clubesFromRel = rels.map((r) => r.clubeId).filter((x): x is string => !!x);
        const escolasFromRel = rels.map((r) => r.escolinhaId).filter((x): x is string => !!x);

        clubeIds = Array.from(new Set([...clubeIds, ...clubesFromRel]));
        escolinhaIds = Array.from(new Set([...escolinhaIds, ...escolasFromRel]));
      }

    const professorIdsRaw = Array.from(new Set((professorIds || []).map(String).filter(Boolean)));

    let profsFull: Array<{ id: string; usuarioId: string | null }> = [];
    let professorIdsNorm: string[] = [];
    let professorIdOrUsuarioIds: string[] = [];

    if (professorIdsRaw.length) {
      profsFull = await prisma.professor.findMany({
        where: {
          OR: [
            { id: { in: professorIdsRaw } },
            { usuarioId: { in: professorIdsRaw } },
          ],
        },
        select: { id: true, usuarioId: true },
      });

      professorIdsNorm = Array.from(new Set(profsFull.map((p) => p.id)));

      const usuarioIdsDosProfs = profsFull
        .map((p) => p.usuarioId)
        .filter((x): x is string => !!x);

      professorIdOrUsuarioIds = Array.from(
        new Set([...professorIdsNorm, ...usuarioIdsDosProfs])
      );

      professorIds = professorIdsNorm;
    } else {
      professorIdsNorm = [];
      professorIdOrUsuarioIds = [];
    }
      const orWhere: any[] = [];

      if (vinculo === "clube") {
        orWhere.push({ clubeId: entidadeId });

        if (professorIdOrUsuarioIds.length) {
          orWhere.push({
            OR: [
              { professorId: { in: professorIdOrUsuarioIds } },
              { criadorProfessorId: { in: professorIdOrUsuarioIds } },
              { professores: { some: { professorId: { in: professorIdOrUsuarioIds } } } },
            ],
          });
        }
      }

      if (vinculo === "escolinha") {
        orWhere.push({ escolinhaId: entidadeId });

        if (professorIdOrUsuarioIds.length) {
          orWhere.push({
            OR: [
              { professorId: { in: professorIdOrUsuarioIds } },
              { criadorProfessorId: { in: professorIdOrUsuarioIds } },
              { professores: { some: { professorId: { in: professorIdOrUsuarioIds } } } },
            ],
          });
        }
      }

      if (vinculo === "professor") {
        orWhere.push({
          OR: [
            { professorId: entidadeId },
            { criadorProfessorId: entidadeId },
            { professores: { some: { professorId: entidadeId } } },
          ],
        });

        if (clubeIds.length) orWhere.push({ clubeId: { in: clubeIds } });
        if (escolinhaIds.length) orWhere.push({ escolinhaId: { in: escolinhaIds } });
      }

      const selectLeve = {
        id: true,
        nome: true,
        codigo: true,
        nivel: true,
        descricao: true,
        createdAt: true,
        professorId: true,
        criadorProfessorId: true,
        clubeId: true,
        escolinhaId: true,
      } as const;

      const selectCompleto = {
        ...selectLeve,

        imagemUrl: true,
        duracao: true,
        metas: true,
        pontuacao: true,
        categoria: true,
        dicas: true,
        tipoTreino: true,
        objetivo: true,
        expiraEm: true,
        naoExpira: true,
        exercicios: {
          orderBy: { ordem: "asc" },
          select: {
            id: true,
            ordem: true,
            repeticoes: true,
            exercicioId: true,
            exercicioTemporarioId: true,

            // ✅ ADICIONAR
            exercicioPersonalizadoId: true,
            exercicioPersonalizado: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                nivel: true,
                categorias: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
              },
            },

            exercicio: {
              select: {
                id: true,
                codigo: true,
                nome: true,
                descricao: true,
                nivel: true,
                categorias: true,
                videoDemonstrativoUrl: true,
              },
            },
            exercicioTemporario: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
              },
            },
          },
        },
      } as const;

      const treinos = await prisma.treinoProgramado.findMany({
        where: { OR: orWhere.length ? orWhere : [{ id: "__never__" }] },
        orderBy: { createdAt: "desc" },
        select: conteudo ? selectCompleto : selectLeve,
      });

      const autorProfessorIds = Array.from(
        new Set(
          treinos
            .flatMap((t) => [t.professorId, t.criadorProfessorId])
            .filter((x): x is string => !!x)
        )
      );

      const autorClubeIds = Array.from(new Set(treinos.map((t) => t.clubeId).filter((x): x is string => !!x)));
      const autorEscolinhaIds = Array.from(new Set(treinos.map((t) => t.escolinhaId).filter((x): x is string => !!x)));

      const [profs, clubes, escolas] = await Promise.all([
        autorProfessorIds.length
          ? prisma.professor.findMany({ where: { id: { in: autorProfessorIds } }, select: { id: true, nome: true } })
          : Promise.resolve([]),
        autorClubeIds.length
          ? prisma.clube.findMany({ where: { id: { in: autorClubeIds } }, select: { id: true, nome: true } })
          : Promise.resolve([]),
        autorEscolinhaIds.length
          ? prisma.escolinha.findMany({ where: { id: { in: autorEscolinhaIds } }, select: { id: true, nome: true } })
          : Promise.resolve([]),
      ]);

      const profNomeMap = new Map(profs.map((p) => [p.id, p.nome]));
      const clubeNomeMap = new Map(clubes.map((c) => [c.id, c.nome]));
      const escolaNomeMap = new Map(escolas.map((e) => [e.id, e.nome]));

      const seen = new Set<string>();
      const professorIdsBeforeNormalize = [...professorIds];
      const items = treinos
        .filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        })
        .map((t) => {
          const professorAutorId = t.professorId ?? t.criadorProfessorId ?? null;
          const autor =
            professorAutorId
              ? { tipo: "Professor" as const, id: professorAutorId, nome: profNomeMap.get(professorAutorId) ?? null }
              : t.clubeId
              ? { tipo: "Clube" as const, id: t.clubeId, nome: clubeNomeMap.get(t.clubeId) ?? null }
              : t.escolinhaId
              ? { tipo: "Escolinha" as const, id: t.escolinhaId, nome: escolaNomeMap.get(t.escolinhaId) ?? null }
              : { tipo: "Desconhecido" as const, id: null, nome: null };

          const base = {
            id: t.id,
            nome: t.nome ?? "Treino",
            codigo: t.codigo ?? null,
            nivel: t.nivel ?? null,
            descricao: t.descricao ?? null,
            autor,
          };

          if (!conteudo) return base;

          // @ts-ignore
          const exercicios = (t as any).exercicios.map((e: any) => {
            // 1) Catálogo
            if (e.exercicio) {
              return {
                id: e.id,
                ordem: e.ordem,
                repeticoes: e.repeticoes,
                exercicioId: e.exercicioId,
                exercicioTemporarioId: null,
                exercicioPersonalizadoId: null,
                exercicio: {
                  tipo: "catalogo",
                  id: e.exercicio.id,
                  codigo: e.exercicio.codigo,
                  nome: e.exercicio.nome,
                  descricao: e.exercicio.descricao,
                  nivel: e.exercicio.nivel,
                  categorias: e.exercicio.categorias,
                  videoDemonstrativoUrl: e.exercicio.videoDemonstrativoUrl ?? null,
                },
              };
            }

            // 2) Temporário
            if (e.exercicioTemporario) {
              return {
                id: e.id,
                ordem: e.ordem,
                repeticoes: e.repeticoes,
                exercicioId: null,
                exercicioTemporarioId: e.exercicioTemporarioId,
                exercicioPersonalizadoId: null,
                exercicio: {
                  tipo: "temporario",
                  id: e.exercicioTemporario.id,
                  codigo: null,
                  nome: e.exercicioTemporario.nome,
                  descricao: e.exercicioTemporario.descricao,
                  nivel: null,
                  categorias: [],
                  videoDemonstrativoUrl: e.exercicioTemporario.videoDemonstrativoUrl ?? null,
                  videoPosterUrl: e.exercicioTemporario.videoPosterUrl ?? null,
                },
              };
            }

            // ✅ 3) Personalizado (NOVO)
            if (e.exercicioPersonalizado) {
              return {
                id: e.id,
                ordem: e.ordem,
                repeticoes: e.repeticoes,
                exercicioId: null,
                exercicioTemporarioId: null,
                exercicioPersonalizadoId: e.exercicioPersonalizadoId,
                exercicio: {
                  tipo: "personalizado",
                  id: e.exercicioPersonalizado.id,
                  codigo: null,
                  nome: e.exercicioPersonalizado.nome,
                  descricao: e.exercicioPersonalizado.descricao,
                  nivel: e.exercicioPersonalizado.nivel ?? null,
                  categorias: e.exercicioPersonalizado.categorias ?? [],
                  videoDemonstrativoUrl: e.exercicioPersonalizado.videoDemonstrativoUrl ?? null,
                  videoPosterUrl: e.exercicioPersonalizado.videoPosterUrl ?? null,
                },
              };
            }

            // fallback
            return {
              id: e.id,
              ordem: e.ordem,
              repeticoes: e.repeticoes,
              exercicioId: null,
              exercicioTemporarioId: null,
              exercicioPersonalizadoId: null,
              exercicio: null,
            };
          });
          return {
            ...base,
            // @ts-ignore
            imagemUrl: (t as any).imagemUrl ?? null,
            // @ts-ignore
            duracao: (t as any).duracao ?? null,
            // @ts-ignore
            metas: (t as any).metas ?? null,
            // @ts-ignore
            pontuacao: (t as any).pontuacao ?? null,
            // @ts-ignore
            categoria: (t as any).categoria ?? [],
            // @ts-ignore
            dicas: (t as any).dicas ?? [],
            // @ts-ignore
            tipoTreino: (t as any).tipoTreino ?? null,
            // @ts-ignore
            objetivo: (t as any).objetivo ?? null,
            // @ts-ignore
            expiraEm: (t as any).expiraEm ?? null,
            // @ts-ignore
            naoExpira: (t as any).naoExpira ?? false,
            exercicios,
          };
        });

      if (debug) {
        return res.json({
          items,
          debug: {
            vinculo,
            entidadeId,
            professorIds,
            professorIdOrUsuarioIds,
            relacaoProfessorIds: relacaoRows.map((r) => r.professorId).filter(Boolean),
            profsFull,
            orWhere,
            professorIdsRaw,
            professorIdsNorm,
            professorIdsBeforeNormalize,
            totalTreinos: items.length,
          },
        });
      }

      return res.json({ items });
    } catch (e: any) {
      console.error("[gerenciarAtletas.listTreinosVisiveis]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar treinos visíveis" });
    }
  },

  convocarTreino: async (req: Request, res: Response) => {
    try {
      const { treinoProgramadoId, destinatarios, objetivo, prazo, origem } = req.body as {
        treinoProgramadoId: string;
        destinatarios: string[];
        objetivo?: string;
        prazo?: string;
        origem: "escolinha" | "clube" | "professor";
      };

      if (!treinoProgramadoId || !Array.isArray(destinatarios) || destinatarios.length === 0) {
        return res.status(400).json({ message: "Dados inválidos para convocação" });
      }
      if (!["escolinha", "clube", "professor"].includes(origem)) {
        return res.status(400).json({ message: "Origem inválida" });
      }

      const treino = await prisma.treinoProgramado.findUnique({ where: { id: treinoProgramadoId } });
      if (!treino) return res.status(404).json({ message: "Treino programado não encontrado" });

      const atletas = await prisma.atleta.findMany({
        where: { usuarioId: { in: destinatarios } },
        select: { id: true, usuarioId: true },
      });
      if (atletas.length === 0) return res.status(400).json({ message: "Nenhum atleta válido encontrado" });

      const dataExpiracaoDerivada = prazo ? new Date(prazo) : treino.expiraEm ?? undefined;
      const dataTreinoDerivada = treino.dataAgendada ?? undefined;
      const objetivoSnapshot = objetivo ?? treino.objetivo ?? undefined;

      await prisma.$transaction(async (tx) => {
        for (const a of atletas) {
          const existente = await tx.treinoProgramadoRecebido.findFirst({
            where: { atletaId: a.id, treinoId: treino.id },
            select: { id: true },
          });
          if (!existente) {
            await tx.treinoProgramadoRecebido.create({
              data: { atletaId: a.id, treinoId: treino.id },
            });
          }

          await tx.treinoAgendado.create({
            data: {
              atletaId: a.id,
              treinoProgramadoId: treino.id,
              titulo: `${treino.nome}`,
              dataExpiracao: dataExpiracaoDerivada,
              dataTreino: dataTreinoDerivada,
              local: objetivoSnapshot,
            },
          });
        }
      });

      return res.json({ ok: true, count: atletas.length, criouAgendados: true });
    } catch (e: any) {
      console.error("[gerenciarAtletas.convocarTreino]", e);
      return res.status(500).json({ message: e?.message || "Erro ao convocar treino" });
    }
  },

  statsAtleta: async (req: Request, res: Response) => {
    try {
      const usuarioId = String(req.params.usuarioId || "");
      if (!usuarioId) return res.status(400).json({ message: "usuarioId obrigatório" });

      const atleta = await prisma.atleta.findUnique({ where: { usuarioId }, select: { id: true } });
      if (!atleta) return res.status(404).json({ message: "Atleta não encontrado" });

      const now = new Date();

      // ===== mês atual (mantive sua lógica) =====
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [treinosMes, desafiosMes] = await Promise.all([
        prisma.submissaoTreino.count({
          where: { atletaId: atleta.id, aprovado: true, criadoEm: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
        prisma.submissaoDesafio.count({
          where: { atletaId: atleta.id, aprovado: true, createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
      ]);

      const totalTreinosMes = treinosMes + desafiosMes;
      const concluidosMes = treinosMes;
      const desafiosFeitosMes = desafiosMes;

      // ===== rolling 28 dias =====
      const fourWeeksAgo = new Date(now);
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      // pega submissões aprovadas + pontuação do treinoProgramado
      const ultimas = await prisma.submissaoTreino.findMany({
        where: {
          atletaId: atleta.id,
          aprovado: true,
          criadoEm: { gte: fourWeeksAgo, lte: now },
        },
        select: {
          criadoEm: true,
          pontuacaoSnapshot: true,
          treinoAgendado: {
            select: {
              treinoProgramado: { select: { pontuacao: true } },
            },
          },
        },
        orderBy: { criadoEm: "asc" },
      });
      
      // buckets rolling: semana 0..3 (cada uma = janela de 7 dias a partir de fourWeeksAgo)
      const buckets = [0, 0, 0, 0];

      let totalPontos28d = 0;
      for (const s of ultimas) {
        const pts =
          (s.pontuacaoSnapshot ?? s.treinoAgendado?.treinoProgramado?.pontuacao ?? 0) || 0;

        totalPontos28d += pts;

        const diffMs = new Date(s.criadoEm).getTime() - fourWeeksAgo.getTime();
        const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)); // 0..3
        if (weekIndex >= 0 && weekIndex <= 3) buckets[weekIndex] += pts;
      }

      const series = [
        { semana: "S-3", pontos: buckets[0] },
        { semana: "S-2", pontos: buckets[1] },
        { semana: "S-1", pontos: buckets[2] },
        { semana: "S", pontos: buckets[3] },
      ];

      // ✅ média “das 4 semanas” = média por semana (28 dias / 4)
      const mediaUltimas4Semanas = totalPontos28d / 4;

      // (extra útil) média por treino concluído nos 28d
      const mediaPorTreino28d = ultimas.length ? totalPontos28d / ultimas.length : 0;

      return res.json({
        totalTreinosMes,
        concluidosMes,
        desafiosFeitosMes,

        // principal (o que você pediu)
        mediaUltimas4Semanas: Math.round(mediaUltimas4Semanas),
        evolucaoSemanas: series,

        // debug/apoio (recomendo manter)
        totalPontos28d,
        qtdTreinosConcluidos28d: ultimas.length,
        mediaPorTreino28d: Math.round(mediaPorTreino28d),
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.statsAtleta]", e);
      return res.status(500).json({ message: e?.message || "Erro ao obter estatísticas" });
    }
  },

  ranking: async (req: Request, res: Response) => {
    try {
      const vinculo = String(req.query.vinculo || "").toLowerCase() as "escolinha" | "clube" | "professor";
      const entidadeUsuarioId = String(req.query.id || "");

      if (!["escolinha", "clube", "professor"].includes(vinculo)) {
        return res.status(400).json({ message: "Parâmetro 'vinculo' inválido" });
      }
      if (!entidadeUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' obrigatório" });
      }

      const resolved = await resolveEntidadeId(vinculo, entidadeUsuarioId);
      if (!resolved) return res.status(404).json({ message: "Entidade não encontrada" });

      const entidadeId = resolved.entidadeId;

      let whereByVinculo: any = {};

      if (vinculo === "clube") {
        const rels = await prisma.relacaoTreinamento.findMany({
          where: { clubeId: entidadeId, ativo: true },
          select: { atletaId: true },
        });
        const idsRelacao = rels.map(r => r.atletaId).filter(Boolean);

        if (!idsRelacao.length) return res.json({ atletas: [] });

        whereByVinculo = { id: { in: idsRelacao } };
      } else if (vinculo === "escolinha") {
        const rels = await prisma.relacaoTreinamento.findMany({
          where: { escolinhaId: entidadeId, ativo: true },
          select: { atletaId: true },
        });
        const idsRelacao = rels.map(r => r.atletaId).filter(Boolean);

        whereByVinculo = {
          OR: [
            { escolinhaId: entidadeId },   
            { id: { in: idsRelacao } },    
          ],
        };
      } else {
        whereByVinculo = { relacoesTreinamento: { some: { professorId: entidadeId, ativo: true } } };
      }

      const atletas = await prisma.atleta.findMany({
        where: whereByVinculo,
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          foto: true,
          posicao: true,
          categoria: true,
          usuario: { select: { nome: true } },
          pontuacao: { select: { pontuacaoTotal: true } },
        },
      });

      const payload = atletas
        .map((a) => ({
          id: a.id,
          usuarioId: a.usuarioId,
          nome: a.nome || a.usuario?.nome || "—",
          foto: a.foto,
          posicao: a.posicao || null,
          categoria: pickMainCategoria(a.categoria) || null,
          pontuacao: a.pontuacao?.pontuacaoTotal ?? 0,
        }))
        .sort((a, b) => (b.pontuacao ?? 0) - (a.pontuacao ?? 0));

      return res.json({ atletas: payload });
    } catch (e: any) {
      console.error("[gerenciarAtletas.ranking]", e);
      return res.status(500).json({ message: e?.message || "Erro ao obter ranking" });
    }
  },

  detalhesAtleta: async (req: Request, res: Response) => {
    try {
      const usuarioId = String(req.params.usuarioId || "");
      if (!usuarioId) return res.status(400).json({ message: "usuarioId obrigatório" });

      const atleta = await prisma.atleta.findUnique({
        where: { usuarioId },
        select: { id: true, nome: true, foto: true },
      });
      if (!atleta) return res.status(404).json({ message: "Atleta não encontrado" });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [treinosMes, desafiosMes, ultTreinos, ultDesafios] = await Promise.all([
        prisma.submissaoTreino.count({
          where: { atletaId: atleta.id, aprovado: true, criadoEm: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
        prisma.submissaoDesafio.count({
          where: { atletaId: atleta.id, aprovado: true, createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
        prisma.submissaoTreino.findMany({
          where: { atletaId: atleta.id },
          select: {
            id: true,
            criadoEm: true,
            aprovado: true,
            pontuacaoSnapshot: true,
            treinoTituloSnapshot: true,
            treinoAgendado: { select: { titulo: true } },
          },
          orderBy: { criadoEm: "desc" },
          take: 5,
        }),
        prisma.submissaoDesafio.findMany({
          where: { atletaId: atleta.id },
          include: {
            desafio: { select: { titulo: true, pontuacao: true } },
            submissaoEmGrupo: {
              select: { pontosGanhos: true, dataEnvio: true },
              orderBy: { dataEnvio: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

      const totalTreinosMes = treinosMes + desafiosMes;
      const concluidosMes = treinosMes;
      const desafiosFeitosMes = desafiosMes;

      return res.json({
        atleta: { id: atleta.id, nome: atleta.nome, foto: atleta.foto },
        mes: {
          totalTreinosMes,
          concluidosMes,
          desafiosFeitosMes,
        },
        ultimasSubmissoes: {
          treinos: ultTreinos.map((t) => ({
            id: t.id,
            tipo: "treino" as const,
            criadoEm: t.criadoEm,
            aprovado: t.aprovado ?? null,
            pontos: t.pontuacaoSnapshot ?? null,
            titulo: t.treinoTituloSnapshot || t.treinoAgendado?.titulo || "Treino",
          })),
          desafios: ultDesafios.map((d) => {
            const pontosGrupo = d.submissaoEmGrupo?.[0]?.pontosGanhos ?? null;
            const pontosBase = d.desafio?.pontuacao ?? null;
            const pontosEfetivos = d.aprovado ? (pontosGrupo ?? pontosBase ?? null) : null;
            return {
              id: d.id,
              tipo: "desafio" as const,
              criadoEm: d.createdAt,
              aprovado: d.aprovado ?? null,
              titulo: d.desafio?.titulo || "Desafio",
              pontos: pontosEfetivos,
            };
          }),
        },
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.detalhesAtleta]", e);
      return res.status(500).json({ message: e?.message || "Erro ao obter detalhes do atleta" });
    }
  },

  submissoesAtleta: async (req: Request, res: Response) => {
    try {
      const usuarioId = String(req.params.usuarioId || "");
      if (!usuarioId) return res.status(400).json({ message: "usuarioId obrigatório" });

      const atleta = await prisma.atleta.findUnique({ where: { usuarioId }, select: { id: true } });
      if (!atleta) return res.status(404).json({ message: "Atleta não encontrado" });

      const { period = "all", type = "all", limit = "20" } = req.query as Record<string, string>;
      const take = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);

      let dateFilterTreino: any = undefined;
      let dateFilterDesafio: any = undefined;
      if (period === "month") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        dateFilterTreino = { gte: startOfMonth, lt: startOfNextMonth };
        dateFilterDesafio = { gte: startOfMonth, lt: startOfNextMonth };
        }

      const doTreinos = type === "all" || type === "treinos";
      const doDesafios = type === "all" || type === "desafios";

      const [treinos, desafios] = await Promise.all([
        doTreinos
          ? prisma.submissaoTreino.findMany({
              where: { atletaId: atleta.id, ...(dateFilterTreino ? { criadoEm: dateFilterTreino } : {}) },
              select: {
                id: true,
                criadoEm: true,
                aprovado: true,
                pontuacaoSnapshot: true,
                treinoTituloSnapshot: true,
                treinoAgendado: { select: { titulo: true } },
              },
              orderBy: { criadoEm: "desc" },
              take,
            })
          : Promise.resolve([] as any[]),
        doDesafios
          ? prisma.submissaoDesafio.findMany({
              where: { atletaId: atleta.id, ...(dateFilterDesafio ? { createdAt: dateFilterDesafio } : {}) },
              include: {
                desafio: { select: { titulo: true, pontuacao: true } },
                submissaoEmGrupo: {
                  select: { pontosGanhos: true, dataEnvio: true },
                  orderBy: { dataEnvio: "desc" },
                  take: 1,
                },
              },
              orderBy: { createdAt: "desc" },
              take,
            })
          : Promise.resolve([] as any[]),
      ]);

      type Row =
        | { id: string; tipo: "treino"; data: Date; aprovado: boolean | null; titulo: string; pontos?: number | null }
        | { id: string; tipo: "desafio"; data: Date; aprovado: boolean | null; titulo: string; pontos?: number | null };

      const rows: Row[] = [
        ...treinos.map((t) => ({
          id: t.id,
          tipo: "treino" as const,
          data: t.criadoEm,
          aprovado: t.aprovado ?? null,
          titulo: t.treinoTituloSnapshot || t.treinoAgendado?.titulo || "Treino",
          pontos: t.pontuacaoSnapshot ?? null,
        })),
        ...desafios.map((d) => {
          const pontosGrupo = d.submissaoEmGrupo?.[0]?.pontosGanhos ?? null;
          const pontosBase = d.desafio?.pontuacao ?? null;
          const pontosEfetivos = d.aprovado ? (pontosGrupo ?? pontosBase ?? null) : null;
          return {
            id: d.id,
            tipo: "desafio" as const,
            data: d.createdAt as Date,
            aprovado: d.aprovado ?? null,
            titulo: d.desafio?.titulo || "Desafio",
            pontos: pontosEfetivos,
          };
        }),
      ].sort((a, b) => b.data.getTime() - a.data.getTime());

      return res.json({ total: rows.length, items: rows.slice(0, take) });
    } catch (e: any) {
      console.error("[gerenciarAtletas.submissoesAtleta]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar submissões" });
    }
  },

  getAvaliacaoSubmissaoTreino: async (req: Request, res: Response) => {
    try {
      const submissaoTreinoId = String(req.params.submissaoTreinoId || "").trim();
      if (!submissaoTreinoId) return res.status(400).json({ message: "submissaoTreinoId obrigatório" });

      const submissao = await prisma.submissaoTreino.findUnique({
        where: { id: submissaoTreinoId },
        select: { id: true, atletaId: true, treinoAgendadoId: true },
      });
      if (!submissao) return res.status(404).json({ message: "Submissão de treino não encontrada" });

      const avaliacao = await prisma.avaliacaoTreino.findFirst({
        where: { submissaoTreinoId },
        include: {
          comentarios: { orderBy: { ordem: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        submissaoTreinoId,
        avaliacao: avaliacao
          ? {
              id: avaliacao.id,
              atletaId: avaliacao.atletaId,
              treinoAgendadoId: avaliacao.treinoAgendadoId,
              autorTipo: avaliacao.autorTipo,
              autorId: avaliacao.autorId,
              autorUsuarioId: avaliacao.autorUsuarioId ?? null,
              nota: avaliacao.nota,
              concluiu: avaliacao.concluiu,
              teveDificuldade: avaliacao.teveDificuldade,
              dificuldadeMotivo: avaliacao.dificuldadeMotivo ?? null,
              motivoNaoConcluiu: avaliacao.motivoNaoConcluiu ?? null,
              createdAt: avaliacao.createdAt,
              updatedAt: avaliacao.updatedAt,
              comentarios: avaliacao.comentarios.map((c) => ({
                id: c.id,
                texto: c.texto,
                ordem: c.ordem,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              })),
            }
          : null,
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.getAvaliacaoSubmissaoTreino]", e);
      return res.status(500).json({ message: e?.message || "Erro ao buscar avaliação" });
    }
  },

  upsertAvaliacaoSubmissaoTreino: async (req: Request, res: Response) => {
    try {
      const submissaoTreinoId = String(req.params.submissaoTreinoId || "").trim();
      if (!submissaoTreinoId) return res.status(400).json({ message: "submissaoTreinoId obrigatório" });

      const {
        autorTipo,
        autorId,
        nota,
        concluiu,
        teveDificuldade,
        dificuldadeMotivo,
        motivoNaoConcluiu,
        comentarios,
      } = (req.body || {}) as {
        autorTipo: AvaliacaoAutorTipo;
        autorId: string;
        nota?: number;
        concluiu?: boolean;
        teveDificuldade?: boolean;
        dificuldadeMotivo?: string | null;
        motivoNaoConcluiu?: string | null;
        comentarios?: { texto: string; ordem?: number }[];
      };

      if (!autorTipo || !["Professor", "Clube", "Escolinha"].includes(String(autorTipo))) {
        return res.status(400).json({ message: "autorTipo inválido" });
      }
      if (!autorId) return res.status(400).json({ message: "autorId obrigatório" });

      const submissao = await prisma.submissaoTreino.findUnique({
        where: { id: submissaoTreinoId },
        select: { id: true, atletaId: true, treinoAgendadoId: true },
      });
      if (!submissao) return res.status(404).json({ message: "Submissão de treino não encontrada" });

      const autorUsuarioId = (req as any).userId ? String((req as any).userId) : null;

      const result = await prisma.$transaction(async (tx) => {
        const avaliacao = await tx.avaliacaoTreino.upsert({
          where: {
            submissaoTreinoId_autorTipo_autorId: {
              submissaoTreinoId,
              autorTipo,
              autorId,
            },
          },
          create: {
            submissaoTreinoId,
            atletaId: submissao.atletaId,
            treinoAgendadoId: submissao.treinoAgendadoId,
            autorTipo,
            autorId,
            autorUsuarioId: autorUsuarioId || undefined,
            nota: typeof nota === "number" ? Math.max(0, Math.min(5, Math.floor(nota))) : 0,
            concluiu: typeof concluiu === "boolean" ? concluiu : true,
            teveDificuldade: typeof teveDificuldade === "boolean" ? teveDificuldade : false,
            dificuldadeMotivo: dificuldadeMotivo ?? undefined,
            motivoNaoConcluiu: motivoNaoConcluiu ?? undefined,
          },
          update: {
            autorUsuarioId: autorUsuarioId || undefined,
            nota: typeof nota === "number" ? Math.max(0, Math.min(5, Math.floor(nota))) : undefined,
            concluiu: typeof concluiu === "boolean" ? concluiu : undefined,
            teveDificuldade: typeof teveDificuldade === "boolean" ? teveDificuldade : undefined,
            dificuldadeMotivo: dificuldadeMotivo ?? undefined,
            motivoNaoConcluiu: motivoNaoConcluiu ?? undefined,
          },
        });

        if (Array.isArray(comentarios)) {
          await tx.avaliacaoTreinoComentario.deleteMany({ where: { avaliacaoTreinoId: avaliacao.id } });

          const rows = comentarios
            .map((c, idx) => ({
              texto: String(c?.texto || "").trim(),
              ordem: typeof c?.ordem === "number" ? c.ordem : idx,
            }))
            .filter((c) => c.texto.length > 0);

          if (rows.length) {
            await tx.avaliacaoTreinoComentario.createMany({
              data: rows.map((r) => ({ avaliacaoTreinoId: avaliacao.id, texto: r.texto, ordem: r.ordem })),
            });
          }
        }

        const full = await tx.avaliacaoTreino.findUnique({
          where: { id: avaliacao.id },
          include: { comentarios: { orderBy: { ordem: "asc" } } },
        });

        return full!;
      });

      return res.json({
        ok: true,
        avaliacao: {
          id: result.id,
          submissaoTreinoId: result.submissaoTreinoId,
          atletaId: result.atletaId,
          treinoAgendadoId: result.treinoAgendadoId,
          autorTipo: result.autorTipo,
          autorId: result.autorId,
          nota: result.nota,
          concluiu: result.concluiu,
          teveDificuldade: result.teveDificuldade,
          dificuldadeMotivo: result.dificuldadeMotivo ?? null,
          motivoNaoConcluiu: result.motivoNaoConcluiu ?? null,
          comentarios: result.comentarios.map((c) => ({ id: c.id, texto: c.texto, ordem: c.ordem })),
        },
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.upsertAvaliacaoSubmissaoTreino]", e);
      return res.status(500).json({ message: e?.message || "Erro ao salvar avaliação" });
    }
  },

  addComentarioAvaliacaoSubmissaoTreino: async (req: Request, res: Response) => {
    try {
      const submissaoTreinoId = String(req.params.submissaoTreinoId || "").trim();
      const texto = String(req.body?.texto || "").trim();
      const ordemBody = req.body?.ordem;

      if (!submissaoTreinoId) return res.status(400).json({ message: "submissaoTreinoId obrigatório" });
      if (!texto) return res.status(400).json({ message: "texto obrigatório" });

      const avaliacao = await prisma.avaliacaoTreino.findFirst({
        where: { submissaoTreinoId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (!avaliacao) return res.status(404).json({ message: "Ainda não existe avaliação para esta submissão" });

      const ordem =
        typeof ordemBody === "number"
          ? ordemBody
          : await prisma.avaliacaoTreinoComentario.count({ where: { avaliacaoTreinoId: avaliacao.id } });

      const c = await prisma.avaliacaoTreinoComentario.create({
        data: { avaliacaoTreinoId: avaliacao.id, texto, ordem },
      });

      return res.json({ ok: true, comentario: { id: c.id, texto: c.texto, ordem: c.ordem, createdAt: c.createdAt } });
    } catch (e: any) {
      console.error("[gerenciarAtletas.addComentarioAvaliacaoSubmissaoTreino]", e);
      return res.status(500).json({ message: e?.message || "Erro ao adicionar comentário" });
    }
  },

  updateComentarioAvaliacaoSubmissaoTreino: async (req: Request, res: Response) => {
    try {
      const submissaoTreinoId = String(req.params.submissaoTreinoId || "").trim();
      const comentarioId = String(req.params.comentarioId || "").trim();
      const texto = String(req.body?.texto || "").trim();

      if (!submissaoTreinoId) return res.status(400).json({ message: "submissaoTreinoId obrigatório" });
      if (!comentarioId) return res.status(400).json({ message: "comentarioId obrigatório" });
      if (!texto) return res.status(400).json({ message: "texto obrigatório" });

      const avaliacao = await prisma.avaliacaoTreino.findFirst({
        where: { submissaoTreinoId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (!avaliacao) return res.status(404).json({ message: "Avaliação não encontrada" });

      const existente = await prisma.avaliacaoTreinoComentario.findFirst({
        where: { id: comentarioId, avaliacaoTreinoId: avaliacao.id },
        select: { id: true },
      });
      if (!existente) return res.status(404).json({ message: "Comentário não encontrado" });

      const c = await prisma.avaliacaoTreinoComentario.update({
        where: { id: comentarioId },
        data: { texto },
      });

      return res.json({ ok: true, comentario: { id: c.id, texto: c.texto, ordem: c.ordem, updatedAt: c.updatedAt } });
    } catch (e: any) {
      console.error("[gerenciarAtletas.updateComentarioAvaliacaoSubmissaoTreino]", e);
      return res.status(500).json({ message: e?.message || "Erro ao editar comentário" });
    }
  },

  deleteComentarioAvaliacaoSubmissaoTreino: async (req: Request, res: Response) => {
    try {
      const submissaoTreinoId = String(req.params.submissaoTreinoId || "").trim();
      const comentarioId = String(req.params.comentarioId || "").trim();

      if (!submissaoTreinoId) return res.status(400).json({ message: "submissaoTreinoId obrigatório" });
      if (!comentarioId) return res.status(400).json({ message: "comentarioId obrigatório" });

      const avaliacao = await prisma.avaliacaoTreino.findFirst({
        where: { submissaoTreinoId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (!avaliacao) return res.status(404).json({ message: "Avaliação não encontrada" });

      const existente = await prisma.avaliacaoTreinoComentario.findFirst({
        where: { id: comentarioId, avaliacaoTreinoId: avaliacao.id },
        select: { id: true },
      });
      if (!existente) return res.status(404).json({ message: "Comentário não encontrado" });

      await prisma.avaliacaoTreinoComentario.delete({ where: { id: comentarioId } });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[gerenciarAtletas.deleteComentarioAvaliacaoSubmissaoTreino]", e);
      return res.status(500).json({ message: e?.message || "Erro ao remover comentário" });
    }
  },

  agendadosAtleta: async (req: Request, res: Response) => {
    try {
      const atletaId = String(req.params.atletaId || "").trim();
      if (!atletaId) return res.status(400).json({ message: "atletaId obrigatório" });

      const apenasFuturos = String(req.query.apenasFuturos || "") === "1";
      const monthISO = String(req.query.month || "").trim();

      let dateFilter: any = undefined;

      if (monthISO && /^\d{4}-\d{2}$/.test(monthISO)) {
        const [y, m] = monthISO.split("-").map(Number);
        const start = new Date(y, (m - 1), 1, 0, 0, 0, 0);
        const end = new Date(y, (m), 1, 0, 0, 0, 0);
        dateFilter = { gte: start, lt: end };
      }

      if (apenasFuturos) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        dateFilter = dateFilter
          ? { ...dateFilter, gte: today }
          : { gte: today };
      }

      const agendados = await prisma.treinoAgendado.findMany({
        where: { atletaId: atletaId },
        include: {
          treinoProgramado: { select: { id: true, nome: true, pontuacao: true } },
          submissaoTreinos: { // <- ajuste o nome conforme seu schema (pode ser "submissoes" etc.)
            orderBy: { criadoEm: "desc" },
            take: 1,
            select: { id: true, aprovado: true },
          },
        },
        orderBy: { dataTreino: "asc" },
      });

      const items = agendados.map((t) => {
          const lastSub = t.submissaoTreinos?.[0];
          const aprovado = lastSub?.aprovado === true;

          const concluido =
            aprovado ||
            String(t.execucaoStatus || "").toUpperCase() === "COMPLETED" ||
            String(t.status || "").toUpperCase() === "CONCLUIDO";

          return {
            id: t.id,
            titulo: t.titulo ?? t.treinoProgramado?.nome ?? "Treino",
            dataTreino: t.dataTreino,
            treinoProgramadoId: t.treinoProgramadoId,
            treinoProgramado: t.treinoProgramado ? { id: t.treinoProgramado.id, nome: t.treinoProgramado.nome } : null,

            // ✅ isso aqui é o que vai deixar verde no front:
            meuStatus: concluido ? "COMPLETED" : "PENDENTE",

            // (opcional) manda também os campos reais:
            status: t.status,
            execucaoStatus: t.execucaoStatus,

            // ✅ sem precisar ter "submissaoTreinoId" no schema, você envia no payload:
            submissaoFeita: !!lastSub,
            submissaoTreinoId: lastSub?.id ?? null,
            aprovado: lastSub?.aprovado ?? null,
          };
        });
      return res.json({ items });
    } catch (e: any) {
      console.error("[gerenciarAtletas.agendadosAtleta]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar agendados do atleta" });
    }
  },
};