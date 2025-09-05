import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { inferirTipoTreino } from "server/utils/inferirTipoTreino.js";

/* 
PERFORMANCE = soma dos pontuacao que você vê no Histórico, treinos + desafios realizados,
DISCIPLINA = nº de treinos × 2,
RESPONSABILIDADE = nº de desafios × 2.
*/

const prisma = new PrismaClient();

type AuthedReq = Request & { user?: { id?: string } };

const pickNumber = (...vals: any[]): number => {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const m = v.match(/-?\d+(?:\.\d+)?/);
      if (m) {
        const n = Number(m[0]);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return 0;
}

const normaliza = (s?: string | null) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const sumFromObject = (obj: any, scored = false): number => {
  if (!obj || typeof obj !== "object") return 0;
  const reKey = /(ponto|pontu|score|valor|total|xp|bonus)/i;
  let sum = 0;

  if (Array.isArray(obj)) {
    for (const v of obj) sum += sumFromObject(v, scored);
    return sum;
  }

  for (const [k, v] of Object.entries(obj)) {
    const allow = scored || reKey.test(k);
    if (typeof v === "number" && Number.isFinite(v) && allow) {
      sum += v;
    } else if (typeof v === "string" && allow) {
      const m = v.match(/-?\d+(?:\.\d+)?/);
      if (m) sum += Number(m[0]) || 0;
    } else if (v && typeof v === "object") {
      sum += sumFromObject(v, allow);    
    }
  }

  return sum;
};

export const getPontuacaoAtleta = async (req: Request, res: Response) => {
  const atletaId = req.params.atletaId;

  const atleta = await prisma.atleta.findUnique({ where: { id: atletaId } });
  if (!atleta) return res.status(404).json({ message: "Atleta não encontrado." });

  let pontuacao = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId } });

  if (!pontuacao) {
    pontuacao = await prisma.pontuacaoAtleta.create({ data: { atletaId } });
  }

  return res.json(pontuacao);
};

export const atualizarPontuacaoAtleta = async (req: Request, res: Response) => {
  const atletaId = req.params.atletaId;
  const {
    pontuacaoTotal,
    pontuacaoPerformance,
    pontuacaoDisciplina,
    pontuacaoResponsabilidade
  } = req.body;

  const pontuacao = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId } });
  if (!pontuacao) {
    return res.status(404).json({ message: "Pontuação não encontrada para este atleta." });
  }

  await prisma.pontuacaoAtleta.update({
    where: { atletaId },
    data: {
      pontuacaoTotal,
      pontuacaoPerformance,
      pontuacaoDisciplina,
      pontuacaoResponsabilidade,
      ultimaAtualizacao: new Date(),
    }
  });

  return res.status(204).end();
};

export const getRanking = async (req: Request, res: Response) => {
  try {
    const ranking = await prisma.pontuacaoAtleta.findMany({
      include: { atleta: true },
      orderBy: { pontuacaoTotal: "desc" }
    });
    res.json(ranking);
  } catch (err) {
    console.error("Erro ao buscar ranking:", err);
    res.status(500).json({ message: "Erro interno." });
  }
};

export async function pontuacaoDoPerfil(req: AuthedReq, res: Response) {
  try {
    const usuarioIdParam = req.params.usuarioId || undefined;
    const usuarioId = usuarioIdParam || req.user?.id;
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!atleta) {
      return res.json({ performance: 0, disciplina: 0, responsabilidade: 0, historico: [] });
    }

const agendados = await prisma.treinoAgendado.findMany({
  where: { atletaId: atleta.id },
  include: {
    treinoProgramado: {
      include: {
        exercicios: { select: { id: true } },
      },
    },
    submissaoTreinos: {
      select: { id: true, criadoEm: true, pontuacaoSnapshot: true },
      orderBy: { criadoEm: "asc" },
    },
  },
  orderBy: { dataTreino: "desc" },
});

const treinosConcluidos = agendados.filter(a => a.submissaoTreinos.length > 0);

const categorias: Record<string, number> = { "Físico": 0, "Técnico": 0, "Tático": 0, "Mental": 0 };

for (const a of treinosConcluidos) {
  const tipo = inferirTipoTreino({
    nome: a.treinoProgramado?.nome,
    tipoTreino: (a.treinoProgramado as any)?.tipoTreino ?? null,
    categorias: (a.treinoProgramado as any)?.categoria ?? null,
  });

  if (tipo) {
    const label =
      tipo === "Técnico" ? "Técnico" :
      tipo === "Tático"  ? "Tático"  :
      tipo === "Físico"  ? "Físico"  :
      "Mental";

    categorias[label] = (categorias[label] ?? 0) + 1;
  }
}

const pontosTreino = (a: typeof treinosConcluidos[number]): number => {
  const sub = a.submissaoTreinos[0];     
  const tp  = a.treinoProgramado as any;

  const bySnapshot = sub?.pontuacaoSnapshot ?? 0;

  const byDeclared = pickNumber(
    tp?.pontuacao, tp?.pontos, tp?.valor, tp?.score, tp?.totalPontos, tp?.recompensa,
    tp?.pontuacao?.total, tp?.pontuacao?.valor, tp?.pontuacao?.pontos
  );

  const byScan = Math.max(sumFromObject(tp?.pontuacao), sumFromObject(tp));
  const byExCount = (tp?.exercicios?.length ?? 0) || 1;

  const final = Math.max(bySnapshot, byDeclared, byScan, byExCount);

  console.log("[PONTOS] Treino:", {
    titulo: a.titulo ?? tp?.nome ?? "Treino",
    snapshot: bySnapshot,
    declarado: byDeclared,
    scan: byScan,
    exCount: byExCount,
    final
  });

  return final;
};

const desafiosConcluidos = await prisma.submissaoDesafio.findMany({
  where: { atletaId: atleta.id, aprovado: true },
  include: { desafio: true },
  orderBy: { createdAt: "desc" },
});

const pontosDesafio = (s: typeof desafiosConcluidos[number]): number => {
  const d: any = s.desafio;
  const byDeclared = pickNumber(
    d?.pontuacao, d?.pontos, d?.valor, d?.score, d?.totalPontos, d?.recompensa
  );
  const byScan = Math.max(sumFromObject(d?.pontuacao), sumFromObject(d));
  const final = Math.max(byDeclared, byScan, 1); 
  
  console.log("[PONTOS] Desafio:", {
    titulo: d?.titulo ?? "Desafio",
    declarado: byDeclared,
    scan: byScan,
    final
  });

  return final;
};

const historico: any[] = [];

for (const a of treinosConcluidos) {
  const envio = a.submissaoTreinos[0]?.criadoEm ?? a.dataTreino;
  historico.push({
    tipo: "Treino",
    status: "Concluído",
    titulo: a.titulo ?? a.treinoProgramado?.nome ?? "Treino",
    data: envio,
    duracao: a.treinoProgramado?.duracao ?? null,
    pontuacao: pontosTreino(a),
  });
}

for (const s of desafiosConcluidos) {
  historico.push({
    tipo: "Desafio",
    status: "Concluído",
    titulo: s.desafio?.titulo ?? s.desafio?.titulo ?? "Desafio",
    data: s.createdAt,           
    pontuacao: pontosDesafio(s),
  });
}

const performance      = historico.reduce((acc, h) => acc + (Number(h.pontuacao) || 0), 0);
const disciplina       = historico.filter(h => /treino/i.test(h.tipo)).length * 2;
const responsabilidade = historico.filter(h => /desafio/i.test(h.tipo)).length * 2;

return res.json({ performance, disciplina, responsabilidade, historico, categorias });

} catch (e) {
    console.error("pontuacaoDoPerfil:", e);
    return res.status(500).json({ message: "Erro ao calcular pontuação" });
  }
}