// controllers/elencoController.ts
import { Request, Response } from "express";
import { PrismaClient, PosicaoCampo } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

/* ============================================================================
   Helpers antigos mantidos (usados em listarElencosMinha / escalaPorTurma)
============================================================================ */

async function montarRespostaElencos(donoId: string, turmaId?: string) {
  const whereBase: any = {
    OR: [{ clubeId: donoId }, { escolinhaId: donoId }, { professorId: donoId }],
  };
  if (turmaId) whereBase.turmaId = turmaId;

  const elencos = await prisma.elenco.findMany({
    where: whereBase,
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const ids = elencos.map((e) => e.id);
  const atletasPorElenco = ids.length
    ? await prisma.atletaElenco.findMany({
        where: { elencoId: { in: ids } },
        select: { elencoId: true, atletaId: true },
      })
    : [];

  const bucket = new Map<string, string[]>();
  ids.forEach((id) => bucket.set(id, []));
  for (const r of atletasPorElenco) bucket.get(r.elencoId)?.push(r.atletaId);

  return elencos.map((e) => ({
    id: e.id,
    nome: e.nome ?? "Elenco",
    atletasIds: bucket.get(e.id) ?? [],
  }));
}

// GET /api/treinos/elencos?tipoUsuarioId=...&turmaId=...
export async function listarElencosMinha(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const turmaId = req.query.turmaId ? String(req.query.turmaId) : undefined;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    ]);

    const donoId = clube?.id || escolinha?.id || professor?.id;
    if (!donoId) return res.json([]);

    // se veio turmaId, valide que essa turma pertence ao dono
    if (turmaId) {
      const turma = await prisma.turma.findUnique({
        where: { id: turmaId },
        select: { id: true, clubeId: true, escolinhaId: true, professorId: true },
      });
      if (!turma) return res.status(404).json({ error: "Turma não encontrada" });

      const ligado =
        turma.clubeId === donoId || turma.escolinhaId === donoId || turma.professorId === donoId;
      if (!ligado) return res.status(403).json({ error: "Sem permissão nesta turma" });
    }

    const data = await montarRespostaElencos(donoId, turmaId);
    return res.json(data);
  } catch (e) {
    console.error("[listarElencosMinha] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar elencos." });
  }
}

// GET /api/treinos/elencos/escala-por-turma?turmaId=...
export async function escalaPorTurma(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const turmaId = String(req.query.turmaId || "");
    if (!userId) return res.status(401).json({ error: "Não autenticado" });
    if (!turmaId) return res.status(400).json({ error: "turmaId obrigatório" });

    // autoriza somente professor/clube/escolinha donos da turma
    const [clube, escolinha, professor] = await Promise.all([
      prisma.clube.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.escolinha.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
      prisma.professor.findFirst({ where: { usuarioId: userId }, select: { id: true } }),
    ]);
    const donoId = clube?.id || escolinha?.id || professor?.id || null;

    const turma = await prisma.turma.findUnique({
      where: { id: turmaId },
      select: { id: true, clubeId: true, escolinhaId: true, professorId: true, nome: true },
    });
    if (!turma) return res.status(404).json({ error: "Turma não encontrada" });
    if (
      !donoId ||
      (turma.clubeId !== donoId &&
        turma.escolinhaId !== donoId &&
        turma.professorId !== donoId)
    ) {
      return res.status(403).json({ error: "Sem permissão nesta turma" });
    }

    const elenco = await prisma.elenco.findFirst({
      where: { turmaId },
      select: { id: true, nome: true, maxJogadores: true, escala: true },
    });

    if (!elenco) return res.json(null);

    const escala = (elenco.escala as Record<string, string | null>) || {};
    const atletasIds = Object.values(escala).filter(Boolean) as string[];

    const atletas = atletasIds.length
      ? await prisma.atleta.findMany({
          where: { id: { in: atletasIds } },
          select: { id: true, usuarioId: true, nome: true, foto: true, idade: true, posicao: true },
        })
      : [];

    const byId = new Map(atletas.map((a) => [a.id, a]));
    const escalaEnriquecida: any = {};
    Object.entries(escala).forEach(([pos, atletaId]) => {
      const a = atletaId ? byId.get(atletaId) : null;
      escalaEnriquecida[pos] = a
        ? {
            atletaId: a.id,
            usuarioId: a.usuarioId,
            nome: a.nome,
            foto: a.foto,
            idade: a.idade,
            posicao: a.posicao,
          }
        : null;
    });

    return res.json({
      id: elenco.id,
      nome: elenco.nome ?? turma.nome ?? "Elenco",
      maxJogadores: elenco.maxJogadores ?? 11,
      escala: escalaEnriquecida,
    });
  } catch (e) {
    console.error("[escalaPorTurma] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar escala." });
  }
}

/* ============================================================================
   🔄 Funções abaixo copiadas / sincronizadas com treinosController
   (getEscalaCore, getEscalaPorElencoId, getEscalaPorDono,
    listarElencos, criarElenco, atualizarElenco)
============================================================================ */

async function getEscalaCore(elencoId: string, res: Response) {
  try {
    const elenco = await prisma.elenco.findUnique({
      where: { id: elencoId },
      select: {
        id: true,
        nome: true,
        maxJogadores: true,
        escala: true,
        formacao: true, // se não existir no schema, remova esta linha
      },
    });

    if (!elenco) {
      return res.json(null);
    }

    const escala =
      (elenco.escala as Record<string, string | null> | null) ?? null;

    const formacao =
      (elenco.formacao as { defesa: number; meio: number; atacantes: number } | null) ?? null;

    return res.json({
      id: elenco.id,
      nome: elenco.nome,
      maxJogadores: elenco.maxJogadores,
      escala,   // ex: { GOL: "uuidAtleta", LD: "uuidAtleta", ... }
      formacao, // ex: { defesa: 4, meio: 2, atacantes: 3 }
    });
  } catch (err) {
    console.error("Erro ao buscar escala do elenco:", err);
    return res.status(500).json({ error: "Erro ao buscar escala do elenco" });
  }
}

export async function getEscalaPorElencoId(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "id é obrigatório" });
  return getEscalaCore(id, res);
}

export async function getEscalaPorDono(req: Request, res: Response) {
  try {
    const raw = (req.query.tipoUsuarioId ?? "") as string;
    const tipoUsuarioId = String(raw).trim();
    if (!tipoUsuarioId) {
      return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });
    }

    const elenco = await prisma.elenco.findFirst({
      where: {
        ativo: true,
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elenco) return res.json(null);

    return getEscalaCore(elenco.id, res);
  } catch (err) {
    console.error("Erro ao buscar escala por dono:", err);
    return res.status(500).json({ error: "Erro ao buscar escala por dono" });
  }
}

export async function listarElencos(req: Request, res: Response) {
  try {
    const raw = (req.query.tipoUsuarioId ?? "") as string;
    const tipoUsuarioId = String(raw).trim();
    if (!tipoUsuarioId) return res.status(400).json({ error: "tipoUsuarioId é obrigatório" });

    const elencos = await prisma.elenco.findMany({
      where: {
        OR: [
          { professorId: tipoUsuarioId },
          { escolinhaId: tipoUsuarioId },
          { clubeId: tipoUsuarioId },
        ],
        ativo: true,
      },
      orderBy: { dataCriacao: "desc" },
    });

    if (!elencos.length) return res.json([]);

    const elencoIds = elencos.map((e) => e.id);
    const vinculos = await prisma.atletaElenco.findMany({
      where: { elencoId: { in: elencoIds } },
    });

    const porElenco = new Map<string, { atletaId: string; posicao: PosicaoCampo }[]>();
    for (const v of vinculos) {
      const arr = porElenco.get(v.elencoId) ?? [];
      arr.push({ atletaId: v.atletaId, posicao: v.posicao });
      porElenco.set(v.elencoId, arr);
    }

    const resposta = elencos.map((e) => ({ ...e, atletas: porElenco.get(e.id) ?? [] }));
    return res.json(resposta);
  } catch (err) {
    console.error("Erro ao listar elencos:", err);
    return res.status(500).json({ error: "Erro ao listar elencos" });
  }
}

export async function criarElenco(req: Request, res: Response) {
  try {
    const {
      nome,
      professorId,
      clubeId,
      escolinhaId,
      atletasIds,
      escala,
      maxJogadores,
      turmaId,
      formacao,          // vem do front (ex: "4-3-3" ou objeto)
      // pode ler, mas NÃO vamos colocar no data:
      tipoUsuario,
      tipoUsuarioId,
    } = req.body;

    // se quiser usar tipoUsuario/tipoUsuarioId pra validação, usa aqui
    // e depois ignora no create

    const elenco = await prisma.elenco.create({
      data: {
        nome,
        professorId: professorId ?? null,
        clubeId: clubeId ?? null,
        escolinhaId: escolinhaId ?? null,
        atletasIds: Array.isArray(atletasIds) ? atletasIds : [],
        escala: escala ?? null,
        formacao: formacao ?? null, // <- salva como JSON
        maxJogadores: maxJogadores ?? 11,
        turmaId: turmaId ?? null,
        // ativo, createdAt, updatedAt usam default
      },
    });

    return res.status(201).json(elenco);
  } catch (err) {
    console.error("Erro ao criar elenco:", err);
    return res.status(500).json({ error: "Erro ao criar elenco" });
  }
}

export async function atualizarElenco(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      nome,
      professorId,
      clubeId,
      escolinhaId,
      atletasIds,
      escala,
      maxJogadores,
      turmaId,
      formacao,          // vem do front
      // lidos mas não enviados pro Prisma:
      tipoUsuario,
      tipoUsuarioId,
    } = req.body;

    const elenco = await prisma.elenco.update({
      where: { id },
      data: {
        nome,
        professorId: professorId ?? null,
        clubeId: clubeId ?? null,
        escolinhaId: escolinhaId ?? null,
        atletasIds: Array.isArray(atletasIds) ? atletasIds : [],
        escala: escala ?? null,
        formacao: formacao ?? null,
        maxJogadores: maxJogadores ?? 11,
        turmaId: turmaId ?? null,
      },
    });

    return res.json(elenco);
  } catch (err) {
    console.error("Erro ao atualizar elenco:", err);
    return res.status(500).json({ error: "Erro ao atualizar elenco" });
  }
}