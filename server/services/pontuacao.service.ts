import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export type PontuacaoPerfil = {
  performance: number;
  disciplina: number;
  responsabilidade: number;
  historico: Array<{
    tipo: "Treino" | "Desafio";
    status: string;
    data: string;
    duracao?: string;
    titulo: string;
    pontos: number;
  }>;
  videos: string[];
};

export async function calcularPontuacaoPorUsuarioId(usuarioId: string): Promise<PontuacaoPerfil> {
  const atleta = await prisma.atleta.findFirst({
    where: { usuarioId },
    select: { id: true },
  });

  if (!atleta) {
    return { performance: 0, disciplina: 0, responsabilidade: 0, historico: [], videos: [] };
  }

  const atletaId = atleta.id;

  const [subsTreino, subsDesafio] = await Promise.all([
    prisma.submissaoTreino.findMany({
      where: { atletaId, aprovado: true as any },
      include: {
        treinoAgendado: { include: { treinoProgramado: true } },
      },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.submissaoDesafio.findMany({
      where: { atletaId, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" as any },
    }),
  ]);

  const pontosTreinos = subsTreino.reduce((acc, s: any) => {
    const p =
      s?.pontosCreditados ??
      s?.pontuacaoSnapshot ??
      s?.treinoAgendado?.treinoProgramado?.pontuacao ??
      0;
    return acc + (Number(p) || 0);
  }, 0);

  const pontosDesafios = subsDesafio.reduce((acc, s: any) => {
    const p = s?.desafio?.pontuacao ?? s?.desafio?.pontos ?? 0;
    return acc + (Number(p) || 0);
  }, 0);

  const performance = pontosTreinos + pontosDesafios;
  const disciplina = subsTreino.length * 2;
  const responsabilidade = subsDesafio.length * 2;

  const historicoTreinos = subsTreino.map((s: any) => {
    const dur =
      s?.duracaoMinutos ??
      s?.treinoAgendado?.treinoProgramado?.duracao ??
      0;
    const pts =
      s?.pontosCreditados ??
      s?.pontuacaoSnapshot ??
      s?.treinoAgendado?.treinoProgramado?.pontuacao ??
      0;

    return {
      tipo: "Treino" as const,
      status: s.aprovado ? "Concluído" : "Pendente",
      data: new Date(s.criadoEm ?? s.dataCriacao ?? Date.now()).toLocaleDateString("pt-BR"),
      duracao: dur ? `${dur} min` : undefined,
      titulo: s?.treinoAgendado?.treinoProgramado?.nome ?? s?.treinoAgendado?.titulo ?? "Treino",
      pontos: Number(pts) || 0,
    };
  });

  const historicoDesafios = subsDesafio.map((s: any) => ({
    tipo: "Desafio" as const,
    status: "Concluído",
    data: new Date(s.createdAt ?? s.criadoEm ?? Date.now()).toLocaleDateString("pt-BR"),
    duracao: undefined,
    titulo: s?.desafio?.titulo ?? "Desafio",
    pontos: s?.desafio?.pontos ?? s?.desafio?.pontuacao ?? 0,
  }));

  const historico = [...historicoTreinos, ...historicoDesafios]
    .sort((a, b) => (a.data > b.data ? -1 : 1))
    .slice(0, 20);

  const postagensVideo = await prisma.postagem.findMany({
    where: {
      usuarioId,
      OR: [{ videoUrl: { not: null } }],
    },
    select: { videoUrl: true },
    orderBy: { dataCriacao: "desc" },
    take: 30,
  });

  const videos = postagensVideo.flatMap((p) => (p.videoUrl ? [p.videoUrl] : []));

  return { performance, disciplina, responsabilidade, historico, videos };
}

export async function atualizarCachePontuacao(usuarioId: string) {
  const atleta = await prisma.atleta.findFirst({ where: { usuarioId }, select: { id: true } });
  if (!atleta) return;

  const data = await calcularPontuacaoPorUsuarioId(usuarioId);
  await prisma.pontuacaoAtleta.upsert({
    where: { atletaId: atleta.id },
    update: {
      pontuacaoTotal: data.performance,
      pontuacaoPerformance: data.performance,
      pontuacaoDisciplina: data.disciplina,
      pontuacaoResponsabilidade: data.responsabilidade,
      ultimaAtualizacao: new Date(),
    },
    create: {
      atletaId: atleta.id,
      pontuacaoTotal: data.performance,
      pontuacaoPerformance: data.performance,
      pontuacaoDisciplina: data.disciplina,
      pontuacaoResponsabilidade: data.responsabilidade,
    },
  });
}