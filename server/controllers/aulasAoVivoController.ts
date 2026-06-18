// server/controllers/aulasAoVivoController
import type { Request, Response } from "express";
import {
  IvsClient,
  CreateChannelCommand,
  CreateStreamKeyCommand,
} from "@aws-sdk/client-ivs";
import {
  S3Client,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { prisma } from "../lib/prisma.js";
import { criarNotificacaoEEnviarPush } from "./notificacoesController.js";
import { NotificacaoTipo } from "@prisma/client";

type AuthRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    usuarioId?: string;
    tipo?: string;
  };
};

function getAuthUserId(req: AuthRequest) {
  return String(
    req.user?.id ||
      req.user?.userId ||
      req.user?.usuarioId ||
      ""
  ).trim();
}

function getAwsRegion() {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

function parseOptionalDate(value: any) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "INVALID_DATE";
  }

  return date;
}

function validarDatasAulaAoVivo(params: {
  dataInicio: Date;
  dataFim?: Date | null;
  inscricaoInicio?: Date | null;
  inscricaoFim?: Date | null;
}) {
  const { dataInicio, dataFim, inscricaoInicio, inscricaoFim } = params;

  if (dataFim && dataFim <= dataInicio) {
    return "Data final precisa ser maior que a data de início.";
  }

  if (inscricaoInicio && inscricaoInicio <= new Date()) {
    return "Início das inscrições não pode estar no passado.";
  }

  if (inscricaoFim && inscricaoFim <= new Date()) {
    return "Fim das inscrições não pode estar no passado.";
  }

  if (inscricaoInicio && inscricaoFim && inscricaoFim <= inscricaoInicio) {
    return "Fim das inscrições precisa ser depois do início das inscrições.";
  }

  if (inscricaoFim && dataInicio <= inscricaoFim) {
    return "A data da live precisa ser depois do fim das inscrições.";
  }

  if (inscricaoInicio && !inscricaoFim) {
    return "Informe também o fim das inscrições.";
  }

  if (!inscricaoInicio && inscricaoFim) {
    return "Informe também o início das inscrições.";
  }

  return "";
}

function getIvsClient() {
  return new IvsClient({
    region: getAwsRegion(),
  });
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

async function getAulaComOwner(aulaId: string) {
  return prisma.aulaAoVivo.findUnique({
    where: { id: aulaId },
    include: {
      convidados: {
        orderBy: { ordem: "asc" },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              foto: true,
              tipo: true,
              nomeDeUsuario: true,
              email: true,
            },
          },
        },
      },
      convidadoUsuario: {
        select: {
          id: true,
          nome: true,
          foto: true,
          tipo: true,
          nomeDeUsuario: true,
          email: true,
        },
      },
      metodologia: {
        select: {
          id: true,
          titulo: true,
          capaUrl: true,
          criadorUsuarioId: true,
        },
      },
      metodologiaAvulsa: {
        select: {
          id: true,
          titulo: true,
          capaUrl: true,
          criadorUsuarioId: true,
        },
      },
      estrutura: {
        select: {
          id: true,
          titulo: true,
        },
      },
      estruturaAvulsa: {
        select: {
          id: true,
          titulo: true,
        },
      },
      item: {
        select: {
          id: true,
          titulo: true,
          tipo: true,
        },
      },
      itemAvulsa: {
        select: {
          id: true,
          titulo: true,
          tipo: true,
        },
      },
    },
  });
}

function isDonoDaAula(aula: any, userId: string) {
  if (!aula || !userId) return false;

  return (
    String(aula.criadorUsuarioId || "") === String(userId) ||
    String(aula.metodologia?.criadorUsuarioId || "") === String(userId) ||
    String(aula.metodologiaAvulsa?.criadorUsuarioId || "") === String(userId)
  );
}

async function getDestinatariosPushAulaAoVivo(aula: any) {
  const ids = new Set<string>();

  if (aula.criadorUsuarioId) {
    ids.add(String(aula.criadorUsuarioId));
  }

  if (aula.convidadoUsuarioId) {
    ids.add(String(aula.convidadoUsuarioId));
  }

  if (Array.isArray(aula.convidados)) {
    for (const convidado of aula.convidados) {
      if (convidado?.usuarioId) ids.add(String(convidado.usuarioId));
      if (convidado?.usuario?.id) ids.add(String(convidado.usuario.id));
    }
  }

  if (aula.metodologiaId) {
    const assinantes = await prisma.metodologiaAssinante.findMany({
      where: {
        metodologiaId: aula.metodologiaId,
        status: "ATIVA",
      },
      select: { usuarioId: true },
    });

    for (const a of assinantes) {
      if (a.usuarioId) ids.add(String(a.usuarioId));
    }
  }

  if (aula.metodologiaAvulsaId) {
    const assinantes = await prisma.metodologiaAssinante.findMany({
      where: {
        metodologiaAvulsaId: aula.metodologiaAvulsaId,
        status: "ATIVA",
      },
      select: { usuarioId: true },
    });

    for (const a of assinantes) {
      if (a.usuarioId) ids.add(String(a.usuarioId));
    }
  }

  return Array.from(ids);
}

function sanitizeAulaForResponse(aula: any, isOwner: boolean) {
  if (!aula) return null;

  return {
    ...aula,
    metodologiaId: aula.metodologiaId || aula.metodologia?.id || null,
    metodologiaAvulsaId: aula.metodologiaAvulsaId || aula.metodologiaAvulsa?.id || null,
    estruturaId: aula.estruturaId || aula.estrutura?.id || null,
    estruturaAvulsaId: aula.estruturaAvulsaId || aula.estruturaAvulsa?.id || null,
    itemId: aula.itemId || aula.item?.id || null,
    itemAvulsaId: aula.itemAvulsaId || aula.itemAvulsa?.id || null,
    streamKey: isOwner ? aula.streamKey : undefined,
  };
}

const LIVE_ONLINE_WINDOW_SECONDS = 30;

async function calcularMetricasPresencaAula(aulaId: string, status?: string | null) {
  const desde = new Date(Date.now() - LIVE_ONLINE_WINDOW_SECONDS * 1000);

  const totalOnline =
    status === "AO_VIVO"
      ? await prisma.aulaAoVivoPresenca.count({
          where: {
            aulaAoVivoId: aulaId,
            entrouAoVivo: true,
            ultimoPingEm: {
              gte: desde,
            },
          },
        })
      : 0;

  const totalParticipantes = await prisma.aulaAoVivoPresenca.count({
    where: {
      aulaAoVivoId: aulaId,
      entrouAoVivo: true,
    },
  });

  return {
    totalOnline,
    totalParticipantes,
  };
}

async function registrarPresencaInterna(aulaId: string, usuarioId: string) {
  const aula = await prisma.aulaAoVivo.findUnique({
    where: { id: aulaId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!aula) {
    throw new Error("Aula ao vivo não encontrada.");
  }

  const agora = new Date();

  if (aula.status === "AO_VIVO") {
    await prisma.aulaAoVivoPresenca.upsert({
      where: {
        aulaAoVivoId_usuarioId: {
          aulaAoVivoId: aulaId,
          usuarioId,
        },
      },
      create: {
        aulaAoVivoId: aulaId,
        usuarioId,
        entrouEm: agora,
        ultimoPingEm: agora,
        saiuEm: null,
        entrouAoVivo: true,
      },
      update: {
        ultimoPingEm: agora,
        saiuEm: null,
        entrouAoVivo: true,
      },
    });
  }

  const metricas = await calcularMetricasPresencaAula(aulaId, aula.status);

  await prisma.aulaAoVivo.update({
    where: { id: aulaId },
    data: {
      totalParticipantes: metricas.totalParticipantes,
    },
  });

  return metricas;
}

export async function getAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    const owner = isDonoDaAula(aula, userId);

    const metricas = await calcularMetricasPresencaAula(aula.id, aula.status);

    return res.json({
      item: {
        ...sanitizeAulaForResponse(aula, owner),
        totalOnline: metricas.totalOnline,
        totalParticipantes: metricas.totalParticipantes,
      },
      isOwner: owner,
    });
  } catch (error) {
    console.error("Erro em getAulaAoVivo:", error);
    return res.status(500).json({
      message: "Erro ao carregar aula ao vivo.",
    });
  }
}

export async function getBroadcastConfig(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    if (!isDonoDaAula(aula, userId)) {
      return res.status(403).json({
        message: "Apenas o dono da metodologia pode acessar a configuração da transmissão.",
      });
    }

    if (aula.status === "FINALIZADA" || aula.status === "CANCELADA") {
      return res.status(400).json({
        message: "Essa aula já foi finalizada ou cancelada.",
      });
    }

    if (aula.ivsIngestEndpoint && aula.streamKey && aula.urlStream) {
      return res.json({
        item: {
          ingestEndpoint: aula.ivsIngestEndpoint,
          streamKey: aula.streamKey,
          playbackUrl: aula.urlStream,
          channelArn: aula.ivsChannelArn,
          streamKeyArn: aula.ivsStreamKeyArn,
        },
      });
    }

    const ivs = getIvsClient();

    const channelName = `footera-aula-${aula.id}`.slice(0, 128);

    const recordingConfigurationArn =
      aula.gravacaoAtiva &&
      process.env.IVS_RECORDING_ENABLED === "true" &&
      process.env.IVS_RECORDING_CONFIGURATION_ARN
        ? process.env.IVS_RECORDING_CONFIGURATION_ARN
        : undefined;

    const command = new CreateChannelCommand({
      name: channelName,
      type: "STANDARD",
      latencyMode: "LOW",
      authorized: false,
      recordingConfigurationArn,
      tags: {
        app: "footera",
        aulaAoVivoId: aula.id,
        gravacaoAtiva: String(!!recordingConfigurationArn),
      },
    });

    const result = await ivs.send(command);

    const channel = result.channel;

    if (!channel?.arn || !channel?.ingestEndpoint || !channel?.playbackUrl) {
      return res.status(500).json({
        message: "A AWS IVS não retornou todos os dados necessários do canal.",
      });
    }

    let streamKey = result.streamKey;

    if (!streamKey?.value) {
      const streamKeyResult = await ivs.send(
        new CreateStreamKeyCommand({
          channelArn: channel.arn,
        })
      );

      streamKey = streamKeyResult.streamKey;
    }

    if (!streamKey?.value) {
      return res.status(500).json({
        message: "A AWS IVS não retornou a stream key da transmissão.",
      });
    }

    const updated = await prisma.aulaAoVivo.update({
      where: { id: aula.id },
      data: {
        provedorStream: "AWS_IVS",
        ivsChannelArn: channel.arn || null,
        ivsStreamKeyArn: streamKey.arn || null,
        ivsIngestEndpoint: channel.ingestEndpoint,
        streamKey: streamKey.value,
        urlStream: channel.playbackUrl,

        ivsRecordingConfigurationArn: recordingConfigurationArn || null,
        ivsRecordingS3Prefix: recordingConfigurationArn
          ? `ivs/v1/886789338729/`
          : null,
        ivsRecordingStatus: recordingConfigurationArn ? "CONFIGURADA" : null,
      },
    });

    return res.json({
      item: {
        ingestEndpoint: updated.ivsIngestEndpoint,
        streamKey: updated.streamKey,
        playbackUrl: updated.urlStream,
        channelArn: updated.ivsChannelArn,
        streamKeyArn: updated.ivsStreamKeyArn,
        recordingConfigurationArn: updated.ivsRecordingConfigurationArn,
        recordingStatus: updated.ivsRecordingStatus,
      },
    });
  } catch (error: any) {
    console.error("Erro em getBroadcastConfig:", error);

    return res.status(500).json({
      message:
        error?.message ||
        "Erro ao preparar configuração da transmissão IVS.",
    });
  }
}

export async function atualizarAulaAoVivoAvulsa(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({ message: "Aula ao vivo não encontrada." });
    }

    if (!isDonoDaAula(aula, userId)) {
      return res.status(403).json({ message: "Sem permissão para editar esta aula." });
    }

    if (aula.metodologiaId || aula.metodologiaAvulsaId || aula.itemId || aula.itemAvulsaId) {
      return res.status(400).json({
        message:
          "Esta aula pertence a uma metodologia. Edite pelo editor do Learning.",
      });
    }

    const {
      titulo,
      descricao,
      dataInicio,
      dataFim,
      inscricaoInicio,
      inscricaoFim,
      chatAtivo,
      gravacaoAtiva,
      replayDisponivel,
      convidados,
      precoAcesso,
      acessoPago,
    } = req.body || {};

    const inicio = dataInicio ? new Date(dataInicio) : null;

    if (!inicio || Number.isNaN(inicio.getTime())) {
      return res.status(400).json({ message: "Data de início inválida." });
    }

    if (inicio <= new Date()) {
      return res.status(400).json({ message: "Data de início não pode estar no passado." });
    }

    const fim = dataFim ? new Date(dataFim) : null;
    const inicioInscricao = parseOptionalDate(inscricaoInicio);
    const fimInscricao = parseOptionalDate(inscricaoFim);

    if (inicioInscricao === "INVALID_DATE") {
      return res.status(400).json({ message: "Início das inscrições inválido." });
    }

    if (fimInscricao === "INVALID_DATE") {
      return res.status(400).json({ message: "Fim das inscrições inválido." });
    }

    const erroDatas = validarDatasAulaAoVivo({
      dataInicio: inicio,
      dataFim: fim,
      inscricaoInicio: inicioInscricao,
      inscricaoFim: fimInscricao,
    });

    if (erroDatas) {
      return res.status(400).json({ message: erroDatas });
    }

    if (fim && Number.isNaN(fim.getTime())) {
      return res.status(400).json({ message: "Data final inválida." });
    }

    if (fim && fim <= inicio) {
      return res.status(400).json({
        message: "Data final precisa ser maior que a data de início.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const aulaAtualizada = await tx.aulaAoVivo.update({
        where: { id },
        data: {
          titulo: String(titulo || "").trim() || aula.titulo,
          descricao:
            descricao === undefined
              ? aula.descricao
              : String(descricao || "").trim() || null,
          dataInicio: inicio,
          dataFim: fim,
          inscricaoInicio: inicioInscricao,
          inscricaoFim: fimInscricao,
          chatAtivo: chatAtivo !== false,
          gravacaoAtiva: gravacaoAtiva !== false,
          replayDisponivel: replayDisponivel === true,
          convidadoUsuarioId: convidados?.[0]?.usuarioId || null,
          convidadoNome: convidados?.[0]?.nome || null,
          convidadoDescricao: convidados?.[0]?.descricao || null,
          precoAcesso:
            precoAcesso !== undefined && precoAcesso !== null && precoAcesso !== ""
              ? Number(precoAcesso)
              : null,
          acessoPago:
            acessoPago === true ||
            acessoPago === "true" ||
            Number(precoAcesso || 0) > 0,
        },
      });

            if (aula.itemId) {
        await tx.metodologiaEstruturaItem.update({
          where: { id: aula.itemId },
          data: {
            titulo: String(titulo || "").trim() || aula.titulo,
            descricao:
              descricao === undefined
                ? aula.descricao
                : String(descricao || "").trim() || null,
            duracaoMin: null,
            thumbUrl: aula.thumbUrl || null,
          },
        });
      }

      if (aula.itemAvulsaId) {
        await tx.metodologiaAvulsaEstruturaItem.update({
          where: { id: aula.itemAvulsaId },
          data: {
            titulo: String(titulo || "").trim() || aula.titulo,
            descricao:
              descricao === undefined
                ? aula.descricao
                : String(descricao || "").trim() || null,
            duracaoMin: null,
            thumbUrl: aula.thumbUrl || null,
          },
        });
      }

      await tx.aulaAoVivoConvidado.deleteMany({
        where: { aulaAoVivoId: id },
      });

      const convidadosNormalizados = Array.isArray(convidados)
        ? convidados
            .map((c: any, index: number) => ({
              aulaAoVivoId: id,
              usuarioId: c.usuarioId ? String(c.usuarioId) : null,
              nome: c.nome ? String(c.nome).trim() : null,
              descricao: c.descricao ? String(c.descricao).trim() : null,
              ordem: index + 1,
            }))
            .filter((c: any) => c.usuarioId || c.nome)
        : [];

      if (convidadosNormalizados.length) {
        await tx.aulaAoVivoConvidado.createMany({
          data: convidadosNormalizados,
        });
      }

      return aulaAtualizada;
    });

    return res.json({ item: updated });
  } catch (error: any) {
    console.error("Erro em atualizarAulaAoVivoAvulsa:", error);
    return res.status(500).json({
      message: error?.message || "Erro ao atualizar aula ao vivo.",
    });
  }
}

export async function deletarAulaAoVivoAvulsa(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({ message: "Aula ao vivo não encontrada." });
    }

    if (!isDonoDaAula(aula, userId)) {
      return res.status(403).json({ message: "Sem permissão para apagar esta aula." });
    }

    if (aula.status === "AO_VIVO") {
      return res.status(400).json({
        message: "Finalize a transmissão antes de apagar esta aula.",
      });
    }

    await prisma.aulaAoVivo.delete({
      where: { id },
    });

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Erro em deletarAulaAoVivoAvulsa:", error);
    return res.status(500).json({
      message: error?.message || "Erro ao apagar aula ao vivo.",
    });
  }
}

export async function iniciarAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;
    const { playbackUrl, urlStream } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    if (!isDonoDaAula(aula, userId)) {
      return res.status(403).json({
        message: "Apenas o dono da metodologia pode iniciar essa live.",
      });
    }

    if (aula.status === "FINALIZADA" || aula.status === "CANCELADA") {
      return res.status(400).json({
        message: "Essa aula já foi finalizada ou cancelada.",
      });
    }

    const updated = await prisma.aulaAoVivo.update({
      where: { id },
      data: {
        status: "AO_VIVO",
        iniciouEm: aula.iniciouEm || new Date(),
        chatAtivo: aula.chatAtivo,
        provedorStream: "AWS_IVS",
        urlStream: playbackUrl || urlStream || aula.urlStream || null,
      },
      include: {
        metodologia: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            criadorUsuarioId: true,
          },
        },
        metodologiaAvulsa: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            criadorUsuarioId: true,
          },
        },
      },
    });

    await prisma.aulaAoVivoMensagem.create({
      data: {
        aulaAoVivoId: id,
        usuarioId: userId,
        tipo: "SISTEMA",
        mensagem: "A transmissão foi iniciada.",
      },
    });

    try {
      const tituloAula =
        updated.titulo ||
        updated.metodologia?.titulo ||
        updated.metodologiaAvulsa?.titulo ||
        "Aula ao vivo";

      const aulaCompleta = await getAulaComOwner(id);
      const destinatarios = await getDestinatariosPushAulaAoVivo(
        aulaCompleta || updated
      );

      await Promise.allSettled(
        destinatarios
          .filter((uid) => uid && uid !== userId)
          .map((uid) =>
            criarNotificacaoEEnviarPush({
              usuarioId: uid,
              actorId: userId,
              tipo: NotificacaoTipo.EVENTO,
              titulo: "Aula ao vivo começou",
              mensagem: `${tituloAula} está ao vivo agora.`,
              link: `/learning/live?aulaId=${id}`,
            })
          )
      );
    } catch (e) {
      console.warn("[iniciarAulaAoVivo] falha ao enviar push:", e);
    }

    const metricas = await registrarPresencaInterna(id, userId);

    return res.json({
      message: "Live iniciada com sucesso.",
      item: {
        ...sanitizeAulaForResponse(updated, true),
        totalOnline: metricas.totalOnline,
        totalParticipantes: metricas.totalParticipantes,
      },
    });
  } catch (error) {
    console.error("Erro em iniciarAulaAoVivo:", error);

    return res.status(500).json({
      message: "Erro ao iniciar live.",
    });
  }
}

export async function finalizarAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    if (!isDonoDaAula(aula, userId)) {
      return res.status(403).json({
        message: "Apenas o dono da metodologia pode finalizar essa live.",
      });
    }

    const agora = new Date();

    const updated = await prisma.aulaAoVivo.update({
      where: { id },
      data: {
        status: "FINALIZADA",
        finalizouEm: agora,
        dataFim: aula.dataFim || agora,
        chatAtivo: false,
        replayDisponivel: false,
      },
      include: {
        metodologia: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            criadorUsuarioId: true,
          },
        },
        metodologiaAvulsa: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            criadorUsuarioId: true,
          },
        },
      },
    });

    await prisma.aulaAoVivoMensagem.create({
      data: {
        aulaAoVivoId: id,
        usuarioId: userId,
        tipo: "SISTEMA",
        mensagem: "A transmissão foi finalizada.",
      },
    });

    await prisma.aulaAoVivoPresenca.updateMany({
      where: {
        aulaAoVivoId: id,
        saiuEm: null,
      },
      data: {
        saiuEm: new Date(),
      },
    });

    const metricas = await calcularMetricasPresencaAula(id, "FINALIZADA");

    return res.json({
      message: "Live finalizada com sucesso.",
      item: {
        ...sanitizeAulaForResponse(updated, true),
        totalOnline: 0,
        totalParticipantes: metricas.totalParticipantes,
      },
    });
  } catch (error) {
    console.error("Erro em finalizarAulaAoVivo:", error);

    return res.status(500).json({
      message: "Erro ao finalizar live.",
    });
  }
}

export async function cancelarAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    if (!isDonoDaAula(aula, userId)) {
      return res.status(403).json({
        message: "Apenas o dono da metodologia pode cancelar essa live.",
      });
    }

    if (aula.status === "AO_VIVO") {
      return res.status(400).json({
        message: "Finalize a live antes de cancelar.",
      });
    }

    const updated = await prisma.aulaAoVivo.update({
      where: { id },
      data: {
        status: "CANCELADA",
        cancelouEm: new Date(),
        chatAtivo: false,
      },
    });

    return res.json({
      message: "Live cancelada com sucesso.",
      item: sanitizeAulaForResponse(updated, true),
    });
  } catch (error) {
    console.error("Erro em cancelarAulaAoVivo:", error);

    return res.status(500).json({
      message: "Erro ao cancelar live.",
    });
  }
}

export async function registrarPresencaAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const aula = await prisma.aulaAoVivo.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    const metricas = await registrarPresencaInterna(id, userId);

    return res.json({
      ok: true,
      totalOnline: metricas.totalOnline,
      totalParticipantes: metricas.totalParticipantes,
    });
  } catch (error: any) {
    console.error("Erro em registrarPresencaAulaAoVivo:", error);

    return res.status(500).json({
      message: error?.message || "Erro ao registrar presença na live.",
    });
  }
}

export async function sairPresencaAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    await prisma.aulaAoVivoPresenca.updateMany({
      where: {
        aulaAoVivoId: id,
        usuarioId: userId,
      },
      data: {
        saiuEm: new Date(),
      },
    });

    const aula = await prisma.aulaAoVivo.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    const metricas = await calcularMetricasPresencaAula(id, aula?.status);

    return res.json({
      ok: true,
      totalOnline: metricas.totalOnline,
      totalParticipantes: metricas.totalParticipantes,
    });
  } catch (error: any) {
    console.error("Erro em sairPresencaAulaAoVivo:", error);

    return res.status(500).json({
      message: error?.message || "Erro ao sair da presença da live.",
    });
  }
}

export async function listarMensagensAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const aula = await prisma.aulaAoVivo.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    const mensagens = await prisma.aulaAoVivoMensagem.findMany({
      where: {
        aulaAoVivoId: id,
        deletada: false,
      },
      orderBy: {
        criadoEm: "asc",
      },
      take: 200,
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            foto: true,
            tipo: true,
          },
        },
      },
    });

    return res.json({
      items: mensagens,
    });
  } catch (error) {
    console.error("Erro em listarMensagensAulaAoVivo:", error);

    return res.status(500).json({
      message: "Erro ao carregar mensagens da live.",
    });
  }
}

export async function enviarMensagemAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;
    const { mensagem, tipo } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const texto = String(mensagem || "").trim();

    if (!texto) {
      return res.status(400).json({
        message: "Mensagem vazia.",
      });
    }

    if (texto.length > 500) {
      return res.status(400).json({
        message: "A mensagem não pode passar de 500 caracteres.",
      });
    }

    const aula = await prisma.aulaAoVivo.findUnique({
      where: { id },
      select: {
        id: true,
        chatAtivo: true,
        status: true,
      },
    });

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    if (!aula.chatAtivo) {
      return res.status(400).json({
        message: "O chat desta aula está desativado.",
      });
    }

    const novaMensagem = await prisma.aulaAoVivoMensagem.create({
      data: {
        aulaAoVivoId: id,
        usuarioId: userId,
        mensagem: texto,
        tipo: tipo === "ALERTA" ? "ALERTA" : tipo === "SISTEMA" ? "SISTEMA" : "TEXTO",
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            foto: true,
            tipo: true,
          },
        },
      },
    });

    await prisma.aulaAoVivo.update({
      where: { id },
      data: {
        totalMensagens: {
          increment: 1,
        },
      },
    });

    return res.status(201).json({
      message: "Mensagem enviada.",
      item: novaMensagem,
    });
  } catch (error) {
    console.error("Erro em enviarMensagemAulaAoVivo:", error);

    return res.status(500).json({
      message: "Erro ao enviar mensagem.",
    });
  }
}

export async function deletarMensagemAulaAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { id, mensagemId } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const aula = await getAulaComOwner(id);

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    const mensagem = await prisma.aulaAoVivoMensagem.findUnique({
      where: { id: mensagemId },
      select: {
        id: true,
        aulaAoVivoId: true,
        usuarioId: true,
      },
    });

    if (!mensagem || mensagem.aulaAoVivoId !== id) {
      return res.status(404).json({
        message: "Mensagem não encontrada.",
      });
    }

    const owner = isDonoDaAula(aula, userId);
    const autor = String(mensagem.usuarioId) === String(userId);

    if (!owner && !autor) {
      return res.status(403).json({
        message: "Você não tem permissão para remover essa mensagem.",
      });
    }

    const updated = await prisma.aulaAoVivoMensagem.update({
      where: { id: mensagemId },
      data: {
        deletada: true,
        deletadaEm: new Date(),
        deletadaPorId: userId,
      },
    });

    return res.json({
      message: "Mensagem removida.",
      item: updated,
    });
  } catch (error) {
    console.error("Erro em deletarMensagemAulaAoVivo:", error);

    return res.status(500).json({
      message: "Erro ao remover mensagem.",
    });
  }
}

export async function listarMinhasAulasAoVivo(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const aulas = await prisma.aulaAoVivo.findMany({
      where: {
        OR: [
          { criadorUsuarioId: userId },
          {
            metodologia: {
              criadorUsuarioId: userId,
            },
          },
          {
            metodologiaAvulsa: {
              criadorUsuarioId: userId,
            },
          },
        ],
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          dataInicio: "asc",
        },
      ],
      include: {
        convidados: {
          orderBy: {
            ordem: "asc",
          },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeDeUsuario: true,
                email: true,
                foto: true,
                tipo: true,
              },
            },
          },
        },

        convidadoUsuario: {
          select: {
            id: true,
            nome: true,
            nomeDeUsuario: true,
            email: true,
            foto: true,
            tipo: true,
          },
        },

        metodologia: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
          },
        },

        metodologiaAvulsa: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
          },
        },
      },
    });

    return res.json({
      items: aulas,
    });
  } catch (error) {
    console.error("Erro em listarMinhasAulasAoVivo:", error);

    return res.status(500).json({
      message: "Erro ao listar suas aulas ao vivo.",
    });
  }
}

export async function criarAulaAoVivoAvulsa(req: AuthRequest, res: Response) {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const {
      titulo,
      descricao,
      dataInicio,
      dataFim,
      inscricaoInicio,
      inscricaoFim,
      chatAtivo,
      gravacaoAtiva,
      replayDisponivel,
      convidados,
      precoAcesso,
      acessoPago,
    } = req.body || {};

    const tituloTrim = String(titulo || "").trim();

    if (!tituloTrim) {
      return res.status(400).json({ message: "Título é obrigatório." });
    }

    const inicio = dataInicio ? new Date(dataInicio) : null;

    if (!inicio || Number.isNaN(inicio.getTime())) {
      return res.status(400).json({ message: "Data de início inválida." });
    }

    if (inicio <= new Date()) {
      return res.status(400).json({
        message: "Data de início não pode estar no passado.",
      });
    }

    const fim = dataFim ? new Date(dataFim) : null;

    const inicioInscricao = parseOptionalDate(inscricaoInicio);
    const fimInscricao = parseOptionalDate(inscricaoFim);

    if (inicioInscricao === "INVALID_DATE") {
      return res.status(400).json({ message: "Início das inscrições inválido." });
    }

    if (fimInscricao === "INVALID_DATE") {
      return res.status(400).json({ message: "Fim das inscrições inválido." });
    }

    const erroDatas = validarDatasAulaAoVivo({
      dataInicio: inicio,
      dataFim: fim,
      inscricaoInicio: inicioInscricao,
      inscricaoFim: fimInscricao,
    });

    if (erroDatas) {
      return res.status(400).json({ message: erroDatas });
    }

    if (fim && Number.isNaN(fim.getTime())) {
      return res.status(400).json({ message: "Data final inválida." });
    }

    if (fim && fim <= inicio) {
      return res.status(400).json({
        message: "Data final precisa ser maior que a data de início.",
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const aula = await tx.aulaAoVivo.create({
        data: {
          titulo: tituloTrim,
          descricao: String(descricao || "").trim() || null,
          dataInicio: inicio,
          dataFim: fim,
          inscricaoInicio: inicioInscricao,
          inscricaoFim: fimInscricao,
          status: "AGENDADA",
          chatAtivo: chatAtivo !== false,
          gravacaoAtiva: gravacaoAtiva !== false,
          replayDisponivel: replayDisponivel === true,
          criadorUsuarioId: userId,
          precoAcesso:
            precoAcesso !== undefined && precoAcesso !== null && precoAcesso !== ""
              ? Number(precoAcesso)
              : null,

          acessoPago:
            acessoPago === true ||
            acessoPago === "true" ||
            Number(precoAcesso || 0) > 0,

          convidadoUsuarioId: convidados?.[0]?.usuarioId || null,
          convidadoNome: convidados?.[0]?.nome || null,
          convidadoDescricao: convidados?.[0]?.descricao || null,
        },
      });

      const convidadosNormalizados = Array.isArray(convidados)
        ? convidados
            .map((c: any, index: number) => ({
              aulaAoVivoId: aula.id,
              usuarioId: c.usuarioId ? String(c.usuarioId) : null,
              nome: c.nome ? String(c.nome).trim() : null,
              descricao: c.descricao ? String(c.descricao).trim() : null,
              ordem: index + 1,
            }))
            .filter((c: any) => c.usuarioId || c.nome)
        : [];

      if (convidadosNormalizados.length) {
        await tx.aulaAoVivoConvidado.createMany({
          data: convidadosNormalizados,
        });
      }

      return aula;
    });

    return res.status(201).json({ item: created });
  } catch (error: any) {
    console.error("Erro em criarAulaAoVivoAvulsa:", error);
    return res.status(500).json({
      message: error?.message || "Erro ao criar aula ao vivo.",
    });
  }
}

function extrairChannelIdDoArn(channelArn?: string | null) {
  if (!channelArn) return null;

  const partes = channelArn.split("/");
  return partes[partes.length - 1] || null;
}

function montarUrlS3Publica(bucket: string, key: string) {
  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function extrairRecordingIdDoMasterKey(masterKey: string) {
  // ivs/v1/account/channel/2026/5/18/20/55/RECORDING_ID/media/hls/master.m3u8
  const partes = masterKey.split("/");
  const mediaIndex = partes.indexOf("media");

  if (mediaIndex <= 0) return null;

  return partes[mediaIndex - 1] || null;
}

export async function sincronizarReplayAulaAoVivo(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const aula = await prisma.aulaAoVivo.findUnique({
      where: { id },
    });

    if (!aula) {
      return res.status(404).json({
        message: "Aula ao vivo não encontrada.",
      });
    }

    if (!aula.ivsChannelArn) {
      return res.status(400).json({
        message: "Aula ainda não possui canal IVS.",
      });
    }

    if (aula.replayDisponivel && aula.videoGravadoUrl) {
      return res.json({
        message: "Replay já estava disponível.",
        item: aula,
        replay: {
          videoGravadoUrl: aula.videoGravadoUrl,
          thumbUrl: aula.thumbUrl,
        },
      });
    }

    const bucket = process.env.AWS_S3_BUCKET || process.env.IVS_RECORDING_S3_BUCKET;

    if (!bucket) {
      return res.status(500).json({
        message: "Bucket S3 não configurado. Configure AWS_S3_BUCKET ou IVS_RECORDING_S3_BUCKET.",
      });
    }

    const channelId = extrairChannelIdDoArn(aula.ivsChannelArn);

    if (!channelId) {
      return res.status(400).json({
        message: "Não foi possível identificar o channelId da aula.",
      });
    }

    const accountId = process.env.AWS_ACCOUNT_ID || "886789338729";

    const prefix = `ivs/v1/${accountId}/${channelId}/`;

    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      })
    );

    const objetos = result.Contents || [];

    const masters = objetos
      .filter((obj) => obj.Key?.endsWith("/media/hls/master.m3u8"))
      .sort((a, b) => {
        const timeA = a.LastModified?.getTime?.() || 0;
        const timeB = b.LastModified?.getTime?.() || 0;
        return timeB - timeA;
      });

    const master = masters[0];

    if (!master?.Key) {
      return res.status(202).json({
        processing: true,
        replayDisponivel: false,
        message:
          "Replay ainda não encontrado no S3. Aguarde alguns minutos e tente novamente.",
        prefix,
      });
    }

    const masterKey = master.Key;
    const recordingId = extrairRecordingIdDoMasterKey(masterKey);

    const playlist1080 = objetos.find((obj) =>
      obj.Key?.endsWith("/media/hls/1080p/playlist.m3u8")
    );

    const playlist1080p30 = objetos.find((obj) =>
      obj.Key?.endsWith("/media/hls/1080p30/playlist.m3u8")
    );

    const replayKeyPreferido =
      playlist1080?.Key ||
      playlist1080p30?.Key ||
      masterKey;

    const videoGravadoUrl = montarUrlS3Publica(bucket, replayKeyPreferido);

    const thumbnail = objetos
      .filter((obj) =>
        obj.Key?.includes("/media/thumbnails/") &&
        /\.(jpg|jpeg|png)$/i.test(obj.Key)
      )
      .sort((a, b) => {
        const timeA = a.LastModified?.getTime?.() || 0;
        const timeB = b.LastModified?.getTime?.() || 0;
        return timeB - timeA;
      })[0];

    const thumbUrl = thumbnail?.Key
      ? montarUrlS3Publica(bucket, thumbnail.Key)
      : aula.thumbUrl;

    const updated = await prisma.aulaAoVivo.update({
      where: { id: aula.id },
      data: {
        ivsRecordingId: recordingId || aula.ivsRecordingId,
        videoGravadoUrl,
        thumbUrl,
        replayDisponivel: true,
        ivsRecordingStatus: "DISPONIVEL",
      },
    });

    return res.json({
      message: "Replay sincronizado com sucesso.",
      item: updated,
      replay: {
        prefix,
        masterKey,
        replayKeyPreferido,
        videoGravadoUrl,
        recordingId,
        thumbUrl,
      },
    });
  } catch (error: any) {
    console.error("[AULA AO VIVO] Erro ao sincronizar replay:", error);

    return res.status(500).json({
      message: error?.message || "Erro ao sincronizar replay.",
    });
  }
}