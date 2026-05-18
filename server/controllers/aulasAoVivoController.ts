// server/controllers/aulasAoVivoController
import type { Request, Response } from "express";
import {
  IvsClient,
  CreateChannelCommand,
  CreateStreamKeyCommand,
} from "@aws-sdk/client-ivs";

import { prisma } from "../lib/prisma.js";

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

function getIvsClient() {
  return new IvsClient({
    region: getAwsRegion(),
  });
}

async function getAulaComOwner(aulaId: string) {
  return prisma.aulaAoVivo.findUnique({
    where: { id: aulaId },
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

function sanitizeAulaForResponse(aula: any, isOwner: boolean) {
  if (!aula) return null;

  return {
    ...aula,
    // Nunca manda streamKey na rota pública de detalhe.
    // A streamKey só sai pelo endpoint /broadcast-config e só para o dono.
    streamKey: isOwner ? aula.streamKey : undefined,
  };
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

    return res.json({
      item: sanitizeAulaForResponse(aula, owner),
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

    const command = new CreateChannelCommand({
      name: channelName,
      type: "STANDARD",
      latencyMode: "LOW",
      authorized: false,
      recordingConfigurationArn:
        process.env.IVS_RECORDING_CONFIGURATION_ARN || undefined,
      tags: {
        app: "footera",
        aulaAoVivoId: aula.id,
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
      },
    });

    return res.json({
      item: {
        ingestEndpoint: updated.ivsIngestEndpoint,
        streamKey: updated.streamKey,
        playbackUrl: updated.urlStream,
        channelArn: updated.ivsChannelArn,
        streamKeyArn: updated.ivsStreamKeyArn,
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

    return res.json({
      message: "Live iniciada com sucesso.",
      item: sanitizeAulaForResponse(updated, true),
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

    return res.json({
      message: "Live finalizada com sucesso.",
      item: sanitizeAulaForResponse(updated, true),
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