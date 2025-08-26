import { Request, Response } from "express";
import { PrismaClient, TipoMensagem } from "@prisma/client";

const prisma = new PrismaClient();
type AuthedRequest = Request & { userId?: string };

async function creditarPontosPerformance(atletaId: string, pontos: number) {
  if (pontos <= 0) return;

  await prisma.pontuacaoAtleta.upsert({
    where: { atletaId },
    create: {
      atletaId,
      pontuacaoTotal: pontos,
      pontuacaoPerformance: pontos,
    },
    update: {
      pontuacaoTotal: { increment: pontos },
      pontuacaoPerformance: { increment: pontos },
      ultimaAtualizacao: new Date(),
    },
  });

  await prisma.estatisticaAtleta.upsert({
    where: { atletaId },
    create: { atletaId, totalDesafios: 1, totalPontos: pontos },
    update: { totalDesafios: { increment: 1 }, totalPontos: { increment: pontos } },
  });
}

export async function assignDesafioAoGrupo(req: AuthedRequest, res: Response) {
  try {
    const { grupoId } = req.params;
    const { desafioOficialId, prazo } = req.body;
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "unauthorized" });

    const membro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId: userId } },
    });
    if (!membro) return res.status(403).json({ message: "Você não está neste grupo" });

    const desafio = await prisma.desafioOficial.findUnique({
      where: { id: desafioOficialId },
    });
    if (!desafio) return res.status(404).json({ message: "Desafio não encontrado" });

    const pontosSnapshot = desafio.pontuacao ?? 0;

    const assignment = await prisma.desafioEmGrupo.create({
      data: {
        grupoId,
        desafioOficialId,
        criadoPorId: userId,
        dataExpiracao: prazo ? new Date(prazo) : desafio.prazoSubmissao ?? null,
        pontosSnapshot,
        bonus: pontosSnapshot * 2,
      },
      include: { desafioOficial: true },
    });

    const totalMembros = await prisma.membroGrupo.count({ where: { grupoId } });

    await prisma.mensagemGrupo.create({
      data: {
        grupoId,
        usuarioId: userId,
        tipo: TipoMensagem.GRUPO_DESAFIO,
        desafioEmGrupoId: assignment.id,
        conteudo: `Desafio: ${assignment.desafioOficial.titulo} • Prazo: ${
          assignment.dataExpiracao
            ? assignment.dataExpiracao.toISOString().slice(0, 10)
            : "sem prazo"
        } • Pontos: ${pontosSnapshot} • Enviaram: 0/${totalMembros}`,
        conteudoJson: {
          titulo: assignment.desafioOficial.titulo,
          prazo: assignment.dataExpiracao,
          pontos: pontosSnapshot,
          enviados: 0,
          total: totalMembros,
          linkSubmissao: `/desafio-grupo/${assignment.id}/submeter`,
        } as any,
      },
    });

    res.json(assignment);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Falha ao criar desafio em grupo" });
  }
}

export async function submeterDesafioGrupo(req: AuthedRequest, res: Response) {
  try {
    const { desafioEmGrupoId, desafioId, videoUrl, observacao } = req.body as {
      desafioEmGrupoId: string;
      desafioId: string;
      videoUrl: string;
      observacao?: string;
    };
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "unauthorized" });

    const assignment = await prisma.desafioEmGrupo.findUnique({
      where: { id: desafioEmGrupoId },
      include: { desafioOficial: true },
    });
    if (!assignment) return res.status(404).json({ message: "Assignment não encontrado" });

    const membro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId: assignment.grupoId, usuarioId: userId } },
    });
    if (!membro) return res.status(403).json({ message: "Você não está neste grupo" });

    const ja = await prisma.submissaoDesafioEmGrupo.findUnique({
      where: { desafioEmGrupoId_usuarioId: { desafioEmGrupoId, usuarioId: userId } },
    });
    if (ja) return res.status(409).json({ message: "Você já enviou este desafio" });

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { atleta: true },
    });
    const atletaId = usuario?.atleta?.id;
    if (!atletaId) return res.status(400).json({ message: "Somente atletas podem submeter" });

    const sub = await prisma.submissaoDesafio.create({
      data: {
        atletaId,
        desafioId,
        videoUrl,
        usuarioId: userId,
        observacao,
      },
    });

    const dentroPrazo = assignment.dataExpiracao
      ? new Date() <= assignment.dataExpiracao
      : true;

    const pontos = assignment.pontosSnapshot ?? assignment.desafioOficial.pontuacao ?? 0;
    const subGrupo = await prisma.submissaoDesafioEmGrupo.create({
      data: {
        submissaoDesafioId: sub.id,
        desafioEmGrupoId,
        usuarioId: userId,
        dentroDoPrazo: dentroPrazo,
        pontosGanhos: pontos,
      },
    });

    await creditarPontosPerformance(atletaId, pontos);

    const totalMembros = await prisma.membroGrupo.count({
      where: { grupoId: assignment.grupoId },
    });
    const enviadosNoPrazo = await prisma.submissaoDesafioEmGrupo.count({
      where: { desafioEmGrupoId, dentroDoPrazo: true },
    });

    await prisma.mensagemGrupo.create({
      data: {
        grupoId: assignment.grupoId,
        usuarioId: userId,
        tipo: TipoMensagem.GRUPO_DESAFIO,
        desafioEmGrupoId,
        conteudo: `Atualização: "${assignment.desafioOficial.titulo}" — ${enviadosNoPrazo}/${totalMembros} no prazo.`,
        conteudoJson: {
          titulo: assignment.desafioOficial.titulo,
          enviados: enviadosNoPrazo,
          total: totalMembros,
          linkSubmissao: `/desafio-grupo/${assignment.id}/submeter`,
        } as any,
      },
    });

    if (!assignment.bonusDado && totalMembros > 0 && enviadosNoPrazo >= totalMembros) {
      const membros = await prisma.membroGrupo.findMany({
        where: { grupoId: assignment.grupoId },
        include: { usuario: { include: { atleta: true } } },
      });
      const bonus = assignment.bonus ?? pontos;

      for (const m of membros) {
        const aId = m.usuario.atleta?.id;
        if (aId) await creditarPontosPerformance(aId, bonus);
      }

      await prisma.desafioEmGrupo.update({
        where: { id: desafioEmGrupoId },
        data: { bonusDado: true },
      });

      await prisma.mensagemGrupo.create({
        data: {
          grupoId: assignment.grupoId,
          usuarioId: userId,
          tipo: TipoMensagem.GRUPO_DESAFIO_BONUS,
          desafioEmGrupoId,
          conteudo: `BÔNUS liberado! Todos enviaram "${assignment.desafioOficial.titulo}" no prazo. +${bonus} pts para cada um.`,
          conteudoJson: { titulo: assignment.desafioOficial.titulo, bonus } as any,
        },
      });
    }

    res.json({ ok: true, submissao: subGrupo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Falha ao submeter desafio do grupo" });
  }
}

export async function getDesafioEmGrupo(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const d = await prisma.desafioEmGrupo.findUnique({
      where: { id },
      include: { desafioOficial: true },
    });
    if (!d) return res.status(404).json({ message: "não encontrado" });
    const enviados = await prisma.submissaoDesafioEmGrupo.count({
      where: { desafioEmGrupoId: id },
    });
    const total = await prisma.membroGrupo.count({ where: { grupoId: d.grupoId } });

    res.json({
      id: d.id,
      grupoId: d.grupoId,
      titulo: d.desafioOficial.titulo,
      pontos: d.pontosSnapshot ?? d.desafioOficial.pontuacao ?? 0,
      prazo: d.dataExpiracao,
      enviados,
      total,
      desafioId: d.desafioOficialId,
    });
  } catch (e) {
    res.status(500).json({ message: "erro" });
  }
}
