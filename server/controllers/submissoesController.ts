import { Request, Response } from "express";
import {
  TipoMidia,
  TipoTreino,
  StorageClass,
} from "@prisma/client";
import { aplicarEstatisticasPosSubmissao } from "./submissoes/utilsEstatistica.js";
import { inferirTipoTreino } from "../utils/inferirTipoTreino.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";
import { atualizarCachePontuacao } from "server/services/pontuacao.service.js";
import { requireUsage } from "server/lib/usage.js";
import { sendLimitInfo } from "server/lib/limitInfo.js";
import { UPGRADE_HINT_BY_CAP } from "server/lib/upgradeHints.js";
import {
  enforceFeatureLimit,
  type FeatureLimitError,
} from "server/utils/featureLimit.js";
import { AuthenticatedRequest } from "server/middlewares/auth.js";
import { logCapabilityDenied } from "server/services/observability.js";
import { prisma } from "../prisma.js";

async function resolveUsuarioIdForActivity(_: string | undefined, atletaId: string) {
  const atleta = await prisma.atleta.findUnique({
    where: { id: atletaId },
    select: { usuarioId: true },
  });
  return atleta?.usuarioId || null;
}

function toMinutos(tempoSeg: number | undefined) {
  if (tempoSeg == null) return undefined;
  return Math.max(1, Math.floor(tempoSeg / 60));
}

export async function criarSubmissaoTreinoUpload(
  req: AuthenticatedRequest,
  res: Response
) {
  if (req.user?.tipo === "Atleta" && req.user?.plano !== "PRO") {
    const ok = await requireUsage(req, res, "treinos_semana");
    if (!ok) return;
  }

  try {
    const {
      observacao,
      treinoAgendadoId,
      atletaId: atletaIdBody,
      duracaoMinutos,
      tempoSeg,
      repeticoes,
      metodologiaId,
      estruturaId,
      metodologiaItemId,
      origemTipo,
    } = req.body as {
      observacao?: string;
      treinoAgendadoId: string;
      atletaId?: string;
      duracaoMinutos?: number | string;
      tempoSeg?: number | string;
      repeticoes?: number | string;
      metodologiaId?: string;
      estruturaId?: string;
      metodologiaItemId?: string;
      origemTipo?: string;
    };

    const file = (req as any).file as Express.Multer.File | undefined;

    if (!treinoAgendadoId) {
      return res.status(400).json({ error: "Informe treinoAgendadoId." });
    }

    const ag = await prisma.treinoAgendado.findUnique({
      where: { id: treinoAgendadoId },
      include: { treinoProgramado: true, atleta: true },
    });

    if (!ag?.treinoProgramado) {
      return res.status(400).json({ error: "Treino inválido." });
    }

    const atletaId = atletaIdBody || ag.atletaId || null;

    const assetUrl = file ? `/uploads/${file.filename}` : null;
    const isVideo = !!file?.mimetype?.startsWith("video");

    const midia = file
      ? {
          url: assetUrl!,
          tipo: isVideo ? TipoMidia.Video : TipoMidia.Imagem,
          dataEnvio: new Date(),
          descricao: "",
          titulo: "",
          storageClass: StorageClass.HOT,
        }
      : null;

    const tempoSegNum =
      tempoSeg != null
        ? Number(tempoSeg)
        : duracaoMinutos != null
          ? Math.round(Number(duracaoMinutos) * 60)
          : undefined;

    const minutosProgramados =
      ag.treinoProgramado.duracao != null
        ? Number(ag.treinoProgramado.duracao)
        : undefined;

    const tempoRealSeg = tempoSegNum != null ? Number(tempoSegNum) : undefined;
    const minutosReais = toMinutos(tempoRealSeg);

    const duracaoMinutosFinal =
      tempoSegNum != null
        ? toMinutos(Number(tempoSegNum))
        : duracaoMinutos != null && String(duracaoMinutos).trim() !== ""
          ? Math.max(1, Number(duracaoMinutos))
          : undefined;

    let penalidadeAtraso = false;
    let minutosConsiderados: number | undefined =
      minutosReais ?? minutosProgramados ?? undefined;

    if (minutosConsiderados == null) minutosConsiderados = 1;

    if (
      minutosProgramados != null &&
      minutosReais != null &&
      minutosReais > minutosProgramados + 5
    ) {
      penalidadeAtraso = true;
      minutosConsiderados = Math.max(1, Math.round(minutosProgramados / 2));
    }

    const pontosBase = Number(ag.treinoProgramado.pontuacao ?? 0);
    const pontosConsiderados = penalidadeAtraso
      ? Math.floor(pontosBase / 2)
      : pontosBase;
    const repeticoesNum =
      repeticoes != null ? Number(repeticoes) : undefined;

    let isAvulsa = String(origemTipo || "").toUpperCase() === "AVULSA";

    if (!isAvulsa && metodologiaId && estruturaId && metodologiaItemId) {
      const itemAvulsa = await prisma.metodologiaAvulsaEstruturaItem.findFirst({
        where: {
          id: metodologiaItemId,
          estruturaId,
          estrutura: {
            metodologiaAvulsaId: metodologiaId,
          },
        },
        select: { id: true },
      });

      if (itemAvulsa) {
        isAvulsa = true;
      }
    }
    
    if (!atletaId) {
      if (metodologiaId && estruturaId && metodologiaItemId) {
        await (prisma as any).metodologiaItemSubmissao.create({
          data: isAvulsa
            ? {
                metodologiaId: null,
                metodologiaAvulsaId: metodologiaId,
                estruturaId: null,
                estruturaAvulsaId: estruturaId,
                itemId: null,
                itemAvulsaId: metodologiaItemId,
                usuarioId: req.user?.id || "",
                tipoItem: "TREINO",
                observacao: observacao || null,
                arquivoUrl: assetUrl,
                mimeType: file?.mimetype || null,
                status: "ENVIADA",
              }
            : {
                metodologiaId,
                metodologiaAvulsaId: null,
                estruturaId,
                estruturaAvulsaId: null,
                itemId: metodologiaItemId,
                itemAvulsaId: null,
                usuarioId: req.user?.id || "",
                tipoItem: "TREINO",
                observacao: observacao || null,
                arquivoUrl: assetUrl,
                mimeType: file?.mimetype || null,
                status: "ENVIADA",
              },
        });

        return res.status(201).json({
          ok: true,
          autoAprovado: true,
          pontosBase,
          pontosCreditados: 0,
          minutosConsiderados: minutosConsiderados ?? null,
          penalidadeAtraso,
          mensagem: "Submissão do treino da metodologia enviada com sucesso.",
        });
      }

      return res.status(400).json({
        error:
          "Este treino não possui atleta vinculado. Envie como treino de metodologia.",
      });
    }

    const usuarioIdForActivity = await resolveUsuarioIdForActivity(
      req.user?.id,
      atletaId
    );

    const existing = await prisma.submissaoTreino.findUnique({
      where: { atletaId_treinoAgendadoId: { atletaId, treinoAgendadoId } },
      select: { id: true },
    });

    const created = await prisma.submissaoTreino.upsert({
      where: { atletaId_treinoAgendadoId: { atletaId, treinoAgendadoId } },
      update: {
        observacao,
        usuarioId: usuarioIdForActivity ?? req.user?.id,
        duracaoMinutos: duracaoMinutosFinal,
        duracaoSegundos: tempoSegNum,
        aprovado: true,
        pontosCreditados: pontosConsiderados,
        pontuacaoSnapshot: pontosConsiderados,
        repeticoes: repeticoesNum,
        ...(midia ? { midias: { create: [midia] } } : {}),
        tipoTreinoSnapshot: ag.treinoProgramado.tipoTreino
      },
      create: {
        treinoAgendadoId,
        atletaId,
        observacao,
        usuarioId: usuarioIdForActivity ?? req.user?.id,
        duracaoMinutos: duracaoMinutosFinal,
        duracaoSegundos: tempoSegNum,
        aprovado: true,
        pontosCreditados: pontosConsiderados,
        pontuacaoSnapshot: pontosConsiderados,
        repeticoes: repeticoesNum,
        ...(midia ? { midias: { create: [midia] } } : {}),
        tipoTreinoSnapshot: ag.treinoProgramado.tipoTreino
      },
      select: { id: true, criadoEm: true },
    });

    await prisma.treinoAgendado.update({
      where: { id: treinoAgendadoId },
      data: {
        status: "CONCLUIDO",
        finishedAt: new Date(),
      },
    });

    const usuarioId = await resolveUsuarioIdForActivity(undefined, atletaId);

    if (usuarioId && !existing) {
      await prisma.atividadeRecente.create({
        data: {
          usuarioId,
          tipo: ag.treinoProgramado.tipoTreino
            ? `Treino ${ag.treinoProgramado.tipoTreino}`
            : "Treino",
          titulo: ag.treinoProgramado.nome || "Treino concluído",
          imagemUrl: ag.treinoProgramado.imagemUrl || assetUrl || null,
          link: `/submissao?treinoAgendadoId=${treinoAgendadoId}`,
          createdAt: new Date(),
        },
      });
    }

    await recomputePontuacaoAtleta(atletaId);

    const isFirst = !existing;
    if (isFirst) {
      await aplicarEstatisticasPosSubmissao(
        created.id,
        atletaId,
        treinoAgendadoId,
        minutosConsiderados
      ).catch(() => {});
    }

    const atleta = await prisma.atleta.findUnique({
      where: { id: atletaId },
      select: { usuarioId: true },
    });

    if (atleta?.usuarioId) {
      atualizarCachePontuacao(atleta.usuarioId).catch(() => {});
    }

    const tipoStr = inferirTipoTreino({
      nome: ag?.treinoProgramado?.nome ?? undefined,
      tipoTreino: ag?.treinoProgramado?.tipoTreino ?? null,
      categorias: ag?.treinoProgramado?.categoria ?? null,
    });

    if (tipoStr) {
      const v = tipoStr
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

      const map: Record<string, TipoTreino> = {
        fisico: "Fisico",
        tecnico: "Tecnico",
        tatico: "Tatico",
        mental: "Mental",
      };

      const enumVal = map[v];
      if (enumVal) {
        await prisma.atleta.update({
          where: { id: atletaId },
          data: {
            perfilTipoTreino: enumVal,
            perfilTipoTreinoAtualizadoEm: new Date(),
          },
        });
      }
    }

    if (metodologiaId && estruturaId && metodologiaItemId) {
      await (prisma as any).metodologiaItemSubmissao.create({
        data: isAvulsa
          ? {
              metodologiaId: null,
              metodologiaAvulsaId: metodologiaId,
              estruturaId: null,
              estruturaAvulsaId: estruturaId,
              itemId: null,
              itemAvulsaId: metodologiaItemId,
              usuarioId: req.user?.id || "",
              tipoItem: "TREINO",
              observacao: observacao || null,
              arquivoUrl: assetUrl,
              mimeType: file?.mimetype || null,
              status: "ENVIADA",
            }
          : {
              metodologiaId,
              metodologiaAvulsaId: null,
              estruturaId,
              estruturaAvulsaId: null,
              itemId: metodologiaItemId,
              itemAvulsaId: null,
              usuarioId: req.user?.id || "",
              tipoItem: "TREINO",
              observacao: observacao || null,
              arquivoUrl: assetUrl,
              mimeType: file?.mimetype || null,
              status: "ENVIADA",
            },
      }).catch(() => null);
    }

    return res.status(201).json({
      ok: true,
      id: created.id,
      penalidadeAtraso,
      minutosConsiderados: minutosConsiderados ?? null,
      pontosBase,
      pontosCreditados: pontosConsiderados,
      mensagem: penalidadeAtraso
        ? "Submissão aprovada. Pontos e minutos foram reduzidos pela metade por atraso."
        : "Submissão aprovada e pontuação creditada.",
    });
  } catch (error) {
    console.error("Erro ao salvar submissão de treino:", error);
    return res.status(500).json({ error: "Erro ao salvar submissão de treino." });
  }
}

export async function criarSubmissaoDesafioUpload(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const user = req.user as any;

    const {
      desafioId,
      atletaId: atletaIdBody,
      observacao,
      videoUrl: rawVideoUrl,
      tempoMs,
      tempoSeg,
    } = req.body as {
      desafioId: string;
      atletaId?: string;
      observacao?: string;
      videoUrl?: string;
      tempoMs?: number | string;
      tempoSeg?: number | string;
      repeticoes?: number | string;
    };

    const file = (req as any).file as Express.Multer.File | undefined;

    const atletaId = atletaIdBody || (user?.tipoUsuarioId as string | undefined);
    const plano = user?.plano ?? "FREE";

    if (!desafioId || !atletaId) {
      return res
        .status(400)
        .json({ message: "Dados obrigatórios ausentes (desafioId/atletaId)." });
    }

    await enforceFeatureLimit({
      prisma,
      feature: "SUBMISSAO_DESAFIO",
      atletaId,
      plano,
    });

    const desafio = await prisma.desafioOficial.findUnique({ where: { id: desafioId } });
    if (!desafio) return res.status(400).json({ message: "Desafio inválido ou não encontrado." });

    const atleta = await prisma.atleta.findUnique({ where: { id: atletaId } });
    if (!atleta) return res.status(400).json({ message: "Atleta inválido ou não encontrado." });

    const tentativas = await prisma.submissaoDesafio.count({ where: { atletaId, desafioId } });
    if (tentativas >= 2) {
      return res.status(400).json({ message: "Limite de 2 tentativas atingido para este desafio." });
    }
    const tentativaNumero = Math.min(2, tentativas + 1);

    const uploadedUrl = file ? `/uploads/${file.filename}` : undefined;
    const finalVideoUrl =
      (uploadedUrl ?? (rawVideoUrl && String(rawVideoUrl).trim())) || null;

    const isVideo = file ? file.mimetype?.startsWith("video") : true;

    const tempoMsNum =
      tempoMs != null
        ? Number(tempoMs)
        : tempoSeg != null
        ? Math.round(Number(tempoSeg) * 1000)
        : undefined;

    const repeticoesNum = tentativaNumero;

    const created = await prisma.submissaoDesafio.create({
      data: {
        atletaId,
        desafioId,
        videoUrl: finalVideoUrl ?? "",
        observacao,
        aprovado: false,
        tempoMs: tempoMsNum,
        repeticoes: repeticoesNum,
        ...(uploadedUrl
          ? {
              midias: {
                create: [
                  {
                    url: uploadedUrl,
                    tipo: isVideo ? TipoMidia.Video : TipoMidia.Imagem,
                    dataEnvio: new Date(),
                    descricao: "",
                    titulo: "",
                    storageClass: StorageClass.HOT,
                  },
                ],
              },
            }
          : {}),
      },
      select: { id: true },
    });

    const usuarioIdForActivity = await resolveUsuarioIdForActivity(req.user?.id, atletaId);
    if (usuarioIdForActivity && uploadedUrl) {
      await prisma.atividadeRecente
        .create({
          data: { usuarioId: usuarioIdForActivity, tipo: "desafio", imagemUrl: uploadedUrl },
        })
        .catch(() => {});
    }
    return res.status(201).json({
      ok: true,
      id: created.id,
      tentativaNumero,
      tentativasRestantes: Math.max(0, 2 - tentativaNumero),
      mensagem: "Submissão enviada para validação. Aguarde aprovação.",
    });
      } catch (err: any) {
    if ((err as FeatureLimitError)?.code === "LIMIT_REACHED") {
      const fl = err as FeatureLimitError;
      logCapabilityDenied({
        req,
        capability: fl.capability,
        periodRef: fl.window,         
        remaining: fl.remaining,
        reason: "FEATURE_LIMIT",
      });

      const capability = fl.capability;
      const window = fl.window;
      const allowed = fl.allowed;
      const remaining = fl.remaining;
      const upgradeHint = UPGRADE_HINT_BY_CAP[capability];

      return sendLimitInfo(res, {
        capability,
        window,
        allowed,
        remaining,
        ...(upgradeHint ? { upgradeHint } : {}),
      });
    }
    console.error("Erro ao criar submissão de desafio:", err);
    return res.status(500).json({ message: "Erro ao criar submissão." });
  }
}

export async function getUltimaSubmissaoTreino(req: Request, res: Response) {
  try {
    const { atletaId, treinoAgendadoId } = req.query as {
      atletaId?: string;
      treinoAgendadoId?: string;
    };
    if (!atletaId || !treinoAgendadoId) {
      return res.status(400).json({ message: "Informe atletaId e treinoAgendadoId." });
    }

    const s = await prisma.submissaoTreino.findFirst({
      where: { atletaId, treinoAgendadoId },
      orderBy: { criadoEm: "desc" },
      select: { duracaoSegundos: true, duracaoMinutos: true, repeticoes: true, aprovado: true, criadoEm: true },
    });
    return res.json(s);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao buscar submissão." });
  }
}

export async function criarSubmissaoTreinoSessaoUpload(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      sessaoId,
      observacao,
      pontos,     
      tempoSeg,  
      repeticoes,   
    } = req.body as {
      sessaoId?: string;
      observacao?: string;
      pontos?: number | string;
      tempoSeg?: number | string;
      repeticoes?: number | string;
    };

    const file = (req as any).file as Express.Multer.File | undefined;

    if (!sessaoId) return res.status(400).json({ error: "Informe sessaoId." });

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id: sessaoId },
      include: {
        turma: true,
        treino: true,   
        presencas: true, 
      },
    });

    if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });

    const presentesIds: string[] = Array.isArray((sessao as any).presencas)
      ? (sessao as any).presencas
          .filter((p: any) => p.presente !== false)
          .map((p: any) => String(p.atletaId))
          .filter(Boolean)
      : [];

    if (!presentesIds.length) {
      return res.status(400).json({ error: "Nenhum atleta presente encontrado para esta sessão." });
    }

    function startOfDay(d: Date) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    }
    function endOfDay(d: Date) {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    }

    const sessaoData = sessao.data instanceof Date ? sessao.data : new Date(sessao.data as any);

    const agendados = await prisma.treinoAgendado.findMany({
      where: {
        atletaId: { in: presentesIds },
        treinoProgramadoId: (sessao as any)?.treinoProgramadoId ?? (sessao as any)?.treino?.id,
        dataTreino: { gte: startOfDay(sessaoData), lte: endOfDay(sessaoData) },
      },
      select: { id: true, atletaId: true },
    });

    const agendadoByAtleta = new Map<string, string>();
      agendados.forEach((a) => {
        if (a.atletaId) {
          agendadoByAtleta.set(a.atletaId, a.id);
        }
    });

    const faltando = presentesIds.filter((id) => !agendadoByAtleta.get(id));
    if (faltando.length) {
      return res.status(400).json({
        error: "Alguns atletas presentes não possuem TreinoAgendado para este treino.",
        faltando,
      });
    }

    const pontosBase =
      Number(pontos ?? (sessao as any)?.treino?.pontuacao ?? 0) || 0;

    function parseTempoSeg(v: any): number | undefined {
      if (v == null) return undefined;
      const s = String(v).trim();
      if (!s) return undefined;

      if (/^\d+$/.test(s)) return Number(s);

      const m = s.match(/^(\d{1,3}):(\d{2})$/);
      if (m) return Number(m[1]) * 60 + Number(m[2]);

      return undefined;
    }

    const tempoSegNum = parseTempoSeg(tempoSeg);
    const repeticoesNum = repeticoes != null ? Number(repeticoes) : undefined;

    const minutosBase =
      (sessao as any)?.treino?.duracao != null
        ? Number((sessao as any).treino.duracao)
        : tempoSegNum != null
          ? Math.max(1, Math.round(tempoSegNum / 60))
          : undefined;

    let penalidadeAtraso = false;
    let pontosConsiderados = pontosBase;

    const minutosProgramados =
      (sessao as any)?.treino?.duracao != null ? Number((sessao as any).treino.duracao) : undefined;

    const tempoRealSegFromSessao =
      (sessao as any)?.duracaoMinutosReal != null
        ? Number((sessao as any).duracaoMinutosReal) * 60
        : (sessao as any)?.startedAt && (sessao as any)?.finishedAt
          ? Math.max(
              1,
              Math.round(
                (new Date((sessao as any).finishedAt).getTime() -
                  new Date((sessao as any).startedAt).getTime()) / 1000
              )
            )
          : undefined;

    const tempoRealSeg =
      tempoSegNum != null
        ? Number(tempoSegNum)
        : tempoRealSegFromSessao != null
          ? Number(tempoRealSegFromSessao)
          : undefined;

    const minutosReais = toMinutos(tempoRealSeg);

    let minutosConsiderados: number | undefined = minutosReais ?? minutosProgramados ?? undefined;

    if (minutosConsiderados == null) minutosConsiderados = 1;

    if (
      minutosProgramados != null &&
      minutosReais != null &&
      minutosReais > (minutosProgramados + 5)
    ) {
      penalidadeAtraso = true;
      pontosConsiderados = Math.floor(pontosBase / 2);
      minutosConsiderados = Math.max(1, Math.round(minutosProgramados / 2));
    }

    const assetUrl = file ? `/uploads/${file.filename}` : null;
    const isVideo = !!file?.mimetype?.startsWith("video");

    const midiaCreate = assetUrl
      ? {
          create: [
            {
              url: assetUrl,
              tipo: isVideo ? TipoMidia.Video : TipoMidia.Imagem,
              dataEnvio: new Date(),
              descricao: "",
              titulo: "",
              storageClass: StorageClass.HOT,
            },
          ],
        }
      : undefined;

    const existentes = await prisma.submissaoTreino.findMany({
      where: { treinoAgendadoId: { in: Array.from(agendadoByAtleta.values()) } },
      select: { atletaId: true, treinoAgendadoId: true },
    });

    const existedSet = new Set(existentes.map(e => `${e.atletaId}:${e.treinoAgendadoId}`));

    const criadas = await prisma.$transaction(
      presentesIds.map((atletaId) => {
        const treinoAgendadoId = agendadoByAtleta.get(atletaId)!;

        return prisma.submissaoTreino.upsert({
          where: {
            atletaId_treinoAgendadoId: { atletaId, treinoAgendadoId },
          },
          update: {
            observacao,
            aprovado: true,
            pontosCreditados: pontosConsiderados,
            pontuacaoSnapshot: pontosConsiderados,
            duracaoSegundos: tempoRealSeg ?? undefined,
            duracaoMinutos: minutosReais ?? undefined,
            repeticoes: repeticoesNum,
            ...(midiaCreate ? { midias: midiaCreate } : {}),
          },
          create: {
            atletaId,
            treinoAgendadoId,
            observacao,
            aprovado: true,
            pontosCreditados: pontosConsiderados,
            pontuacaoSnapshot: pontosConsiderados,
            duracaoSegundos: tempoRealSeg ?? undefined,
            duracaoMinutos: minutosReais ?? undefined,
            repeticoes: repeticoesNum,
            ...(midiaCreate ? { midias: midiaCreate } : {}),
          },
          select: { id: true, atletaId: true, treinoAgendadoId: true, criadoEm: true },
        });
      })
    );

    await Promise.allSettled(
      criadas.map(async (c) => {
        const key = `${c.atletaId}:${c.treinoAgendadoId}`;
        const isFirst = !existedSet.has(key);
        if (!isFirst) return;

        await aplicarEstatisticasPosSubmissao(
          c.id,
          c.atletaId,
          c.treinoAgendadoId,
          minutosConsiderados
        ).catch(() => {});

        await recomputePontuacaoAtleta(c.atletaId).catch(() => {});

        const atleta = await prisma.atleta.findUnique({
          where: { id: c.atletaId },
          select: { usuarioId: true },
        });

        if (atleta?.usuarioId) {
          await atualizarCachePontuacao(atleta.usuarioId).catch(() => {});
        }
      })
    );

    return res.status(201).json({
      ok: true,
      sessaoId,
      criadas: criadas.length,
      atletas: criadas.map((c) => ({ atletaId: c.atletaId, submissaoId: c.id })),
      assetUrl,
      pontosBase,
      pontosCreditados: pontosConsiderados,
      penalidadeAtraso,
      minutosBase: minutosBase ?? null,
      minutosConsiderados: minutosConsiderados ?? null,
      mensagem: penalidadeAtraso
        ? "Submissão aprovada. Pontos e minutos foram reduzidos pela metade por atraso."
        : "Submissão aprovada e pontuação creditada.",
      
    });
  } catch (error) {
    console.error("Erro ao salvar submissão de sessão:", error);
    return res.status(500).json({ error: "Erro ao salvar submissão da sessão." });
  }
}