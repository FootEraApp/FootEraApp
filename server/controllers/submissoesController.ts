import { Request, Response } from "express";
import {
  PrismaClient,
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

const prisma = new PrismaClient();

async function resolveUsuarioIdForActivity(reqUserId: string | undefined, atletaId: string) {
  if (typeof reqUserId === "string" && reqUserId.length > 0) return reqUserId;
  const atleta = await prisma.atleta.findUnique({
    where: { id: atletaId },
    select: { usuarioId: true },
  });
  return atleta?.usuarioId || null;
}

async function atletaTemVinculo(atletaId: string) {
  const a = await prisma.atleta.findUnique({
    where: { id: atletaId },
    select: { id: true, clubeId: true, escolinhaId: true },
  });
  if (!a) return false;
  const relCount = await prisma.relacaoTreinamento.count({ where: { atletaId } });
  return !!(a.clubeId || a.escolinhaId || relCount > 0);
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
      atletaId,
      aprovado,
      duracaoMinutos,
      tempoSeg,
      repeticoes,
    } = req.body as {
      observacao?: string;
      treinoAgendadoId: string;
      atletaId: string;
      aprovado?: boolean | string;
      duracaoMinutos?: number | string;
      tempoSeg?: number | string;
      repeticoes?: number | string;
    };

    const file = (req as any).file as Express.Multer.File | undefined;

    if (!treinoAgendadoId || !atletaId) {
      return res
        .status(400)
        .json({ error: "Informe atletaId e treinoAgendadoId." });
    }
    if (!file) {
      return res
        .status(400)
        .json({ error: "Envie um arquivo de imagem/vídeo do treino." });
    }

    const temVinculo = await atletaTemVinculo(atletaId);
    const aprovadoNormalizado = temVinculo ? String(aprovado) === "true" : true;

    const assetUrl = `/uploads/${file.filename}`;
    const isVideo = !!file.mimetype?.startsWith("video");

    const midia = {
      url: assetUrl,
      tipo: isVideo ? TipoMidia.Video : TipoMidia.Imagem,
      dataEnvio: new Date(),
      descricao: "",
      titulo: "",
      storageClass: StorageClass.HOT,
    };

    const usuarioIdForActivity = await resolveUsuarioIdForActivity(
      (req as any).userId,
      atletaId
    );

    const tempoSegNum =
      tempoSeg != null
        ? Number(tempoSeg)
        : duracaoMinutos != null
        ? Math.round(Number(duracaoMinutos) * 60)
        : undefined;

    const repeticoesNum =
      repeticoes != null ? Number(repeticoes) : undefined;

    const created = await prisma.submissaoTreino.create({
      data: {
        treinoAgendadoId,
        atletaId,
        observacao,
        usuarioId:
          typeof (req as any).userId === "string"
            ? (req as any).userId
            : undefined,
        duracaoMinutos: duracaoMinutos
          ? Number(duracaoMinutos)
          : undefined,
        duracaoSegundos: tempoSegNum,
        aprovado: aprovadoNormalizado,
        pontuacaoSnapshot: temVinculo ? undefined : 0,
        pontosCreditados: temVinculo ? undefined : 0,
        repeticoes: repeticoesNum,
        midias: { create: [midia] },
      },
      // ⬇️ precisamos do criadoEm para calcular atraso
      select: { id: true, aprovado: true, criadoEm: true },
    });

    if (usuarioIdForActivity) {
      await prisma.atividadeRecente
        .create({
          data: {
            usuarioId: usuarioIdForActivity,
            tipo: "treino",
            imagemUrl: assetUrl,
          },
        })
        .catch(() => {});
    }

    // busca o treino agendado + treino programado pra saber duração e data
    const ag = await prisma.treinoAgendado.findUnique({
      where: { id: treinoAgendadoId },
      include: { treinoProgramado: true },
    });

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

    let penalidadeAtraso = false;
    let minutosConsiderados: number | undefined;

    if (created.aprovado) {
      // 🔽 minutos base: o que veio da submissão ou a duração do treino programado
      const minutosBase =
        duracaoMinutos != null
          ? Number(duracaoMinutos)
          : tempoSegNum != null
          ? Math.round(tempoSegNum / 60)
          : ag?.treinoProgramado?.duracao != null
          ? Number(ag.treinoProgramado.duracao)
          : undefined;

      minutosConsiderados = minutosBase;

      if (minutosBase && ag?.dataTreino && created.criadoEm) {
        const inicio =
          ag.dataTreino instanceof Date
            ? ag.dataTreino
            : new Date(ag.dataTreino as any);

        const fimPrevisto = new Date(
          inicio.getTime() + minutosBase * 60 * 1000
        );
        const limite = new Date(
          fimPrevisto.getTime() + 5 * 60 * 1000
        ); // +5min de tolerância

        const fimReal =
          created.criadoEm instanceof Date
            ? created.criadoEm
            : new Date(created.criadoEm as any);

        // ⏰ se finalizou DEPOIS do limite -> aplica penalidade
        if (fimReal > limite) {
          minutosConsiderados = Math.round(minutosBase / 2);
          penalidadeAtraso = true;
          console.log(
            "[SubmissaoTreino] Penalidade de atraso aplicada:",
            {
              submissaoId: created.id,
              atletaId,
              treinoAgendadoId,
              minutosBase,
              minutosConsiderados,
              inicio,
              fimPrevisto,
              limite,
              fimReal,
            }
          );
        }
      }

      await aplicarEstatisticasPosSubmissao(
        created.id,
        atletaId,
        treinoAgendadoId,
        minutosConsiderados
      ).catch(() => {});
      await recomputePontuacaoAtleta(atletaId).catch(() => {});

      const atleta = await prisma.atleta.findUnique({
        where: { id: atletaId },
        select: { usuarioId: true },
      });
      if (atleta?.usuarioId)
        atualizarCachePontuacao(atleta.usuarioId).catch(() => {});
    }

    return res.status(201).json({
      ok: true,
      id: created.id,
      autoAprovado: !temVinculo,
      temVinculo,
      penalidadeAtraso,
      minutosConsiderados: minutosConsiderados ?? null,
      mensagem: temVinculo
        ? penalidadeAtraso
          ? "Submissão enviada, mas o treino foi finalizado com atraso. Pontos e minutos reduzidos."
          : "Submissão enviada. Aguarde validação do responsável."
        : "Submissão aprovada automaticamente (sem pontuação) por ausência de vínculo.",
    });
  } catch (error) {
    console.error("Erro ao salvar submissão de treino:", error);
    return res
      .status(500)
      .json({ error: "Erro ao salvar submissão de treino." });
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
    if (!finalVideoUrl) {
      return res
        .status(400)
        .json({ message: "Envie um vídeo (arquivo ou videoUrl)." });
    }

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
        videoUrl: finalVideoUrl,
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

    const usuarioIdForActivity = await resolveUsuarioIdForActivity((req as any).userId, atletaId);
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
      select: { duracaoSegundos: true, repeticoes: true, aprovado: true, criadoEm: true },
    });

    return res.json(s);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao buscar submissão." });
  }
}