import { Request, Response } from "express";
import { PrismaClient, PosicaoCampo } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

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

export async function escalaPorTurma(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    const turmaId = String(req.query.turmaId || "");
    if (!userId) return res.status(401).json({ error: "Não autenticado" });
    if (!turmaId) return res.status(400).json({ error: "turmaId obrigatório" });

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

function extrairAtletasDaEscala(escala: any): string[] {
  if (!escala || typeof escala !== "object") return [];
  const set = new Set<string>();

  for (const val of Object.values(escala)) {
    if (!val) continue;
    if (typeof val === "string") {
      set.add(val);
    } else if (typeof val === "object" && val !== null) {
      const id = (val as any).atletaId ?? (val as any).id ?? null;
      if (id) set.add(String(id));
    }
  }

  return Array.from(set);
}

async function getEscalaCore(elencoId: string, res: Response) {
  try {
    const elenco = await prisma.elenco.findUnique({
      where: { id: elencoId },
      select: {
        id: true,
        nome: true,
        maxJogadores: true,
        escala: true,
        formacao: true,
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
      escala,
      formacao,
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
    const fromQuery = (req.query.tipoUsuarioId ?? "") as string;
    const fromParams =
      (req.params.escolinhaId as string | undefined) ||
      (req.params.clubeId as string | undefined) ||
      (req.params.professorId as string | undefined);

    const tipoUsuarioId = String(fromQuery || fromParams || "").trim();
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
      escala,
      turmaId,
      formacao, 
      tipoUsuario,
      tipoUsuarioId,
    } = req.body;

    const tipo = (tipoUsuario ?? "").toString().toLowerCase();
    const donoId =
      typeof tipoUsuarioId === "string" && tipoUsuarioId.trim()
        ? tipoUsuarioId.trim()
        : null;

    const owner: {
      professorId?: string | null;
      clubeId?: string | null;
      escolinhaId?: string | null;
    } = {};

    if (donoId) {
      if (tipo === "professor") owner.professorId = donoId;
      else if (tipo === "clube") owner.clubeId = donoId;
      else if (tipo === "escolinha") owner.escolinhaId = donoId;
    }

    const escalaUsada = escala && typeof escala === "object" ? escala : null;
    const atletasFromEscala = extrairAtletasDaEscala(escalaUsada);

    if (atletasFromEscala.length !== 11) {
      return res.status(400).json({
        error: "Elenco precisa ter exatamente 11 jogadores escalados.",
        detalhe: { recebidos: atletasFromEscala.length },
      });
    }

    const elenco = await prisma.elenco.create({
      data: {
        nome,
        professorId: professorId ?? owner.professorId ?? null,
        clubeId: clubeId ?? owner.clubeId ?? null,
        escolinhaId: escolinhaId ?? owner.escolinhaId ?? null,
        atletasIds: atletasFromEscala,
        escala: escalaUsada ?? null,
        formacao: formacao ?? null,
        maxJogadores: 11, 
        turmaId: turmaId ?? null,
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
      escala,
      maxJogadores,
      turmaId,
      formacao,
      tipoUsuario,
      tipoUsuarioId,
    } = req.body;

    const tipo = (tipoUsuario ?? "").toString().toLowerCase();
    const donoId =
      typeof tipoUsuarioId === "string" && tipoUsuarioId.trim()
        ? tipoUsuarioId.trim()
        : null;

    const owner: {
      professorId?: string | null;
      clubeId?: string | null;
      escolinhaId?: string | null;
    } = {};

    if (donoId) {
      if (tipo === "professor") owner.professorId = donoId;
      else if (tipo === "clube") owner.clubeId = donoId;
      else if (tipo === "escolinha") owner.escolinhaId = donoId;
    }

    const escalaUsada = escala && typeof escala === "object" ? escala : null;
    const atletasFromEscala = extrairAtletasDaEscala(escalaUsada);

    if (atletasFromEscala.length !== 11) {
      return res.status(400).json({
        error: "Elenco precisa ter exatamente 11 jogadores escalados.",
        detalhe: { recebidos: atletasFromEscala.length },
      });
    }

    const elenco = await prisma.elenco.update({
      where: { id },
      data: {
        nome,
        professorId: professorId ?? owner.professorId ?? null,
        clubeId: clubeId ?? owner.clubeId ?? null,
        escolinhaId: escolinhaId ?? owner.escolinhaId ?? null,
        atletasIds: atletasFromEscala,
        escala: escalaUsada ?? null,
        formacao: formacao ?? null,
        maxJogadores: 11, 
        turmaId: turmaId ?? null,
      },
    });

    return res.json(elenco);
  } catch (err) {
    console.error("Erro ao atualizar elenco:", err);
    return res.status(500).json({ error: "Erro ao atualizar elenco" });
  }
}

export const atletasVinculados = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let professorId: string | undefined =
      (typeof req.query.professorId === "string" && req.query.professorId.trim()) ||
      (typeof req.query.tipoUsuarioId === "string" && req.query.tipoUsuarioId.trim()) ||
      undefined;

    const usuarioIdQ =
      typeof req.query.usuarioId === "string" ? req.query.usuarioId.trim() : undefined;

    if (!professorId && usuarioIdQ) {
      const prof = await prisma.professor.findFirst({
        where: { usuarioId: usuarioIdQ },
        select: { id: true },
      });
      professorId = prof?.id;
    }

    if (!professorId) {
      res.json([]);
      return;
    }
    const pid: string = professorId;
    const incluirPontuacao = String(req.query.incluirPontuacao ?? "") === "1";

    const rows = await prisma.relacaoTreinamento.findMany({
      where: { professorId: pid, atletaId: { not: null } },
      select: {
        atleta: {
          select: {
            id: true,
            usuarioId: true,
            posicao: true,
            idade: true,
            categoria: true,
            usuario: { select: { nome: true, foto: true } },
            ...(incluirPontuacao
              ? { pontuacao: { select: { pontuacaoTotal: true } } }
              : {}),
          },
        },
      },
    });

    const lista = rows
      .map((r: (typeof rows)[number]) => r.atleta)
      .filter((a): a is NonNullable<(typeof rows)[number]["atleta"]> => Boolean(a))
      .map((a) => ({
        id: a.id,
        usuarioId: a.usuarioId,
        atletaId: a.id,
        nome: a.usuario?.nome ?? "Atleta",
        foto: a.usuario?.foto ?? null,
        posicao: a.posicao ?? null,
        idade: a.idade ?? null,
        categoria: Array.isArray(a.categoria) && a.categoria.length ? a.categoria[0] : null,
        pontuacao: (a as any).pontuacao?.pontuacaoTotal ?? null,
      }));

    res.json(lista);
  } catch (e) {
    console.error("GET /elencos/atletas-vinculados erro:", e);
    res.status(500).json({ error: "Falha ao buscar atletas vinculados" });
  }
};

export async function listarAtletasVinculados(req: Request, res: Response) {
  try {
    const tipoUsuarioId = String(req.query.tipoUsuarioId || "");
    const turmaId = req.query.turmaId ? String(req.query.turmaId) : undefined;

    if (!tipoUsuarioId) {
      return res.status(400).json({ error: "tipoUsuarioId obrigatório" });
    }

    const whereBase: Prisma.AtletaWhereInput = {
      OR: [
        { relacoesTreinamento: { some: { professorId: tipoUsuarioId } } },
        { clubeId: tipoUsuarioId },
        { escolinhaId: tipoUsuarioId },
      ],
    };

    if (turmaId) {
      const membros = await prisma.turmaUsuario.findMany({
        where: { turmaId },
        select: { usuarioId: true },
      });
      const usuarioIds = membros.map((m) => m.usuarioId);

      whereBase.usuarioId = { in: usuarioIds.length ? usuarioIds : ["__none__"] };
    }

    const atletas = await prisma.atleta.findMany({
      where: whereBase,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        foto: true,
        idade: true,
        posicao: true,
      },
      orderBy: { nome: "asc" },
    });

    return res.json(atletas);
  } catch (e) {
    console.error("[listarAtletasVinculados]", e);
    return res.status(500).json({ error: "Erro ao listar atletas vinculados" });
  }
}
