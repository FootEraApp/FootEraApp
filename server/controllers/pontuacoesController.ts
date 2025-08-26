import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { inferirTipoTreino } from "server/utils/inferirTipoTreino.js";

const prisma = new PrismaClient();

type AuthedReq = Request & { user?: { id?: string } };

/* 
PERFORMANCE = soma dos pontuacao que você vê no Histórico,
DISCIPLINA = nº de treinos × 2,
RESPONSABILIDADE = nº de desafios × 2.
*/
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
    const categorias: Record<string, number> = { "Físico": 0, "Técnico": 0, "Tático": 0, "Mental": 0 };
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
          select: { id: true, criadoEm: true },
          orderBy: { criadoEm: "asc" },
        },
      },
      orderBy: { dataTreino: "desc" },
    });

    const concluidos = agendados.filter(a => a.submissaoTreinos.length > 0);
    const performance = concluidos.reduce((acc, a) => {
      const qtdEx = a.treinoProgramado?.exercicios?.length ?? 0;
      return acc + (qtdEx > 0 ? qtdEx : 1);
    }, 0);
    const dias = new Set<string>();
    for (const a of concluidos) {
      const tipo = inferirTipoTreino ({
        nome: a.treinoProgramado?.nome,
        tipoTreino: (a.treinoProgramado as any)?.tipoTreino ?? null,
        categorias: (a.treinoProgramado as any)?.categoria ?? null,
      });
      
      if (tipo) {
      const label =
          tipo === "Técnico" ? "Tecnico" :
          tipo === "Tático"  ? "Tatico"  : tipo;
        categorias[label] = (categorias[label] ?? 0) + 1;
      }

      const envio = a.submissaoTreinos[0]?.criadoEm;
      if (envio) {
        const d = new Date(envio);
        dias.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
      }
    }
    const disciplina = dias.size;

    const responsabilidade = concluidos.reduce((acc, a) => {
      const envio = a.submissaoTreinos[0]?.criadoEm;
      const prazo = a.dataExpiracao ?? a.dataTreino;
      if (!envio || !prazo) return acc;
      return new Date(envio) <= new Date(prazo) ? acc + 1 : acc;
    }, 0);

    const historico = concluidos.map(a => {
      const envio = a.submissaoTreinos[0]?.criadoEm ?? a.dataTreino;
      return {
        tipo: "Treino Concluído",
        titulo: a.titulo ?? a.treinoProgramado?.nome ?? "Treino",
        data: envio,
        duracaoMin: a.treinoProgramado?.duracao ?? null,
        pontos: (a.treinoProgramado?.exercicios?.length ?? 0) || 1,
      };
    });

    return res.json({ performance, disciplina, responsabilidade, historico, categorias});
  } catch (e) {
    console.error("pontuacaoDoPerfil:", e);
    return res.status(500).json({ message: "Erro ao calcular pontuação" });
  }
}
