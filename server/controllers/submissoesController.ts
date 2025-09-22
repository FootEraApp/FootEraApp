import { Request, Response } from "express";
import { PrismaClient, TipoMidia } from "@prisma/client";
import { aplicarEstatisticasPosSubmissao } from "./submissoes/utilsEstatistica.js";
import { inferirTipoTreino } from "../utils/inferirTipoTreino.js";
import { recomputePontuacaoAtleta } from "server/services/recomputePontuacao.js";
import { atualizarCachePontuacao } from "server/services/pontuacao.service.js";

const prisma = new PrismaClient();

/**
 * Resolve o usuarioId para registrar AtividadeRecente quando só temos atletaId.
 */
async function resolveUsuarioIdForActivity(reqUserId: string | undefined, atletaId: string) {
  if (typeof reqUserId === "string" && reqUserId.length > 0) return reqUserId;
  const atleta = await prisma.atleta.findUnique({
    where: { id: atletaId },
    select: { usuarioId: true },
  });
  return atleta?.usuarioId || null;
}

/**
 * POST /api/submissoes/treino  (com upload)
 * - mantém a mesma assinatura de body/arquivo usada na rota antiga
 * - cria SubmissaoTreino + Midia + AtividadeRecente
 * - se vier aprovado=true, aplica estatísticas e atualiza cache de pontuação
 */
export async function criarSubmissaoTreinoUpload(req: Request, res: Response) {
  try {
    const { observacao, treinoAgendadoId, atletaId, aprovado, duracaoMinutos } = req.body as {
      observacao?: string;
      treinoAgendadoId: string;
      atletaId: string;
      aprovado?: boolean | string;
      duracaoMinutos?: number | string;
    };
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!treinoAgendadoId || !atletaId || !file) {
      return res.status(400).json({ error: "Dados obrigatórios ausentes." });
    }

    const assetUrl = `/uploads/${file.filename}`;
    const isVideo = file.mimetype?.startsWith("video");

    const midia = {
      url: assetUrl,
      tipo: isVideo ? TipoMidia.Video : TipoMidia.Imagem,
      dataEnvio: new Date(),
      descricao: "",
      titulo: "",
    };

    const usuarioIdForActivity = await resolveUsuarioIdForActivity((req as any).userId, atletaId);

    const created = await prisma.submissaoTreino.create({
      data: {
        treinoAgendadoId,
        atletaId,
        observacao,
        usuarioId: typeof (req as any).userId === "string" ? (req as any).userId : undefined,
        duracaoMinutos: duracaoMinutos ? Number(duracaoMinutos) : undefined,
        aprovado: String(aprovado) === "true", // opcional: aprova já no post
        midias: { create: [midia] },
      },
      select: { id: true, aprovado: true },
    });

    if (usuarioIdForActivity) {
      // feed
      await prisma.atividadeRecente.create({
        data: { usuarioId: usuarioIdForActivity, tipo: "treino", imagemUrl: assetUrl },
      }).catch(() => {});
    }

    // Atualiza “perfilTipoTreino” com base no treino agendado
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
      // normaliza acentos -> enum
      const v = tipoStr.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      const map: Record<string, any> = {
        fisico: "Fisico",
        tecnico: "Tecnico",
        tatico: "Tatico",
        mental: "Mental",
      };
      const enumVal = map[v];
      if (enumVal) {
        await prisma.atleta.update({
          where: { id: atletaId },
          data: { perfilTipoTreino: enumVal, perfilTipoTreinoAtualizadoEm: new Date() },
        });
      }
    }

    // Se aprovado, aplica estatísticas e atualiza cache de pontuação
    if (created.aprovado) {
      await aplicarEstatisticasPosSubmissao(
        created.id,
        atletaId,
        treinoAgendadoId,
        duracaoMinutos ? Number(duracaoMinutos) : undefined
      ).catch(() => {});
      const atleta = await prisma.atleta.findUnique({ where: { id: atletaId }, select: { usuarioId: true } });
      if (atleta?.usuarioId) atualizarCachePontuacao(atleta.usuarioId).catch(() => {});
    }

    return res.status(201).json({ ok: true, id: created.id });
  } catch (error) {
    console.error("Erro ao salvar submissão de treino:", error);
    return res.status(500).json({ error: "Erro ao salvar submissão de treino" });
  }
}

/**
 * POST /api/submissoes/desafio  (com upload OU videoUrl no body)
 * - alinha com o desafiosController.criarSubmissaoDesafio:
 *   * valida desafio/atleta
 *   * cria com aprovado: true
 *   * chama recomputePontuacaoAtleta(atletaId)
 * - também registra Midia + AtividadeRecente quando vier arquivo
 */
export async function criarSubmissaoDesafioUpload(req: Request, res: Response) {
  try {
    const { desafioId, atletaId, observacao, videoUrl: rawVideoUrl } = req.body as {
      desafioId: string;
      atletaId: string;
      observacao?: string;
      videoUrl?: string;
    };
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!desafioId || !atletaId) {
      return res.status(400).json({ message: "Dados obrigatórios ausentes." });
    }

    const desafio = await prisma.desafioOficial.findUnique({ where: { id: desafioId } });
    if (!desafio) return res.status(400).json({ message: "Desafio inválido ou não encontrado." });

    const atleta = await prisma.atleta.findUnique({ where: { id: atletaId } });
    if (!atleta) return res.status(400).json({ message: "Atleta inválido ou não encontrado." });

    // url do upload (se houver) OU videoUrl vindo no body
    const uploadedUrl = file ? `/uploads/${file.filename}` : undefined;
    const finalVideoUrl = (uploadedUrl ?? (rawVideoUrl && String(rawVideoUrl).trim())) || null;

    if (!finalVideoUrl) {
      return res.status(400).json({ message: "Envie um vídeo (arquivo ou videoUrl)." });
    }

    const isVideo = file ? file.mimetype?.startsWith("video") : true; // assume URL externa é vídeo

    const created = await prisma.submissaoDesafio.create({
      data: {
        atletaId,
        desafioId,
        videoUrl: finalVideoUrl, // <— agora é sempre string
        observacao,
        aprovado: true,
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
      await prisma.atividadeRecente.create({
        data: { usuarioId: usuarioIdForActivity, tipo: "desafio", imagemUrl: uploadedUrl },
      }).catch(() => {});
    }

    await recomputePontuacaoAtleta(atletaId).catch(() => {});
    return res.status(201).json({ ok: true, id: created.id });
  } catch (error) {
    console.error("Erro ao criar submissão de desafio:", error);
    res.status(500).json({ message: "Erro ao criar submissão." });
  }
}

