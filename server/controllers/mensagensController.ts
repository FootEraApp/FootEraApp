import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";
import {
  CHAT_AUDIO_MAX_MS,
  gravarChatAudio,
  removerChatAudio,
} from "../services/chatAudioStorage.js";
import fs from "fs/promises";
import path from "path";
import { getDailyUsage } from "../services/usage.js";
import { audit } from "../services/audit.js";
import { recomputeAndEmitBadge, criarNotificacaoEEnviarPush } from "./notificacoesController.js";
import { NotificacaoTipo, TipoOrganizacao, TipoUsuario } from "@prisma/client";
import {
  readPrivacyConfig,
} from "../utils/privacy.js";
import {
  getActiveContext,
  type ActiveContext
} from "../services/activeContext.js";
import {
  hasRole,
} from "../services/roles.js";
import {
  verificarDuracaoRealChatAudio,
} from "../services/chatAudioDuracaoService.js";
import {
  contarMensagensNaoLidas,
} from "../services/mensagensNaoLidasService.js";

async function registrarAudioOrfao(
  audioKey: string,
  origem: string
): Promise<void> {
  try {
    await prisma.exclusaoAudioMensagemPendente.upsert({
      where: {
        audioKey,
      },
      create: {
        audioKey,
        ultimoErro: origem,
      },
      update: {
        ultimoErro: origem,
      },
    });
  } catch (erro) {
    console.error(
      "[chat-audio] FALHA_CRITICA_REGISTRO_ORFAO",
      { audioKey, origem, erro }
    );
  }
}

const ADS_CAP_PER_DAY = 5;
const AD_EVERY_N = 10;

function readNotificacoes(raw: any) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    notifMensagens: c.notifMensagens !== false,
  };
}

function getMensagemContextSnapshot(
  contexto:
    ActiveContext |
    null |
    undefined
) {
  if (!contexto) {
    return null;
  }

  return {
    key:
      contexto.key,

    kind:
      contexto.kind,

    tipoUsuario:
      String(
        contexto.tipoUsuario
      ),

    role:
      contexto.role
        ? String(
            contexto.role
          )
        : null,

    profileId:
      contexto.profileId ??
      contexto.tipoUsuarioId ??
      null,

    organizationId:
      contexto.organizationId ??
      null,

    organizationType:
      contexto.organizationType
        ? String(
            contexto.organizationType
          )
        : null,

    organizationRole:
      contexto.organizationRole
        ? String(
            contexto.organizationRole
          )
        : null,

    legacyOrganizationId:
      contexto
        .legacyOrganizationId ??
      null,
  };
}

async function isProUser(
  userId: string
) {
  const contexto =
    await getActiveContext(
      userId
    );

  if (!contexto) {
    return false;
  }

  const assinatura =
    await prisma.assinatura.findFirst({
      where: {
        usuarioId:
          userId,

        contextoKey:
          contexto.key,
      },

      orderBy: [
        { ativo: "desc" },
        { renovaEm: "desc" },
        { startsAt: "desc" },
      ],

      select: {
        ativo: true,
        plano: true,
        status: true,
        trialEndsAt: true,
      },
    });

  if (!assinatura) {
    return false;
  }

  const status =
    String(
      assinatura.status || ""
    ).toUpperCase();

  const plano =
    String(
      assinatura.plano || ""
    ).toUpperCase();

  if (!assinatura.ativo) {
    return false;
  }

  if (
    status === "BLOQUEADA" ||
    status === "CANCELADA" ||
    status === "SEM_ASSINATURA"
  ) {
    return false;
  }

  if (status === "ATIVA") {
    return true;
  }

  if (status === "TRIAL") {
    if (
      assinatura.trialEndsAt
    ) {
      return (
        new Date() <=
        new Date(
          assinatura.trialEndsAt
        )
      );
    }

    return true;
  }

  return plano.includes(
    "PRO"
  );
}

async function getAdsConfigForUser(userId?: string) {
  if (!userId) {
    return {
      adsEnabled: false,
      adEveryN: null,
      adsRemainingToday: 0,
    };
  }

  const pro = await isProUser(userId);
  if (pro) {
    return {
      adsEnabled: false,
      adEveryN: null,
      adsRemainingToday: 0,
    };
  }

  const usedToday = await getDailyUsage(userId, "ads_impressions_day");
  const remaining = Math.max(0, ADS_CAP_PER_DAY - usedToday);

  return {
    adsEnabled: remaining > 0,
    adEveryN: AD_EVERY_N,
    adsRemainingToday: remaining,
  };
}

async function salvarDataUrlComoPng(dataUrl: string, sub = "cards") {
  const [meta, b64] = dataUrl.split(",");
  if (!meta?.startsWith("data:image/")) throw new Error("formato inválido");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const dir = path.join(process.cwd(), "uploads", sub);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(b64, "base64"));
  return `/uploads/${sub}/${filename}`;
}

function isMinor(birth: Date | string | null | undefined): boolean {
  if (!birth) return false;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age < 18;
}

export async function getUnreadByUser(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.sendStatus(401);
    }

    const buckets = await prisma.mensagem.groupBy({
      by: ["deId"],
      where: {
        paraId: userId,
        lida: false,
      },
      _count: {
        _all: true,
      },
    });

    const resultado = await Promise.all(
      buckets.map(async (bucket) => {
        const primeira = await prisma.mensagem.findFirst({
          where: {
            paraId: userId,
            deId: bucket.deId,
            lida: false,
          },
          orderBy: [
            { criadaEm: "asc" },
            { id: "asc" },
          ],
          select: {
            id: true,
          },
        });

        return {
          userId: bucket.deId,
          count: bucket._count._all,
          primeiraId: primeira?.id ?? null,
        };
      })
    );

    return res.json(resultado);
  } catch (erro) {
    console.error(
      "[mensagens] Erro ao contar DMs não lidas:",
      erro
    );

    return res.status(500).json({
      error: "Erro ao consultar mensagens não lidas.",
    });
  }
}

export async function getUnreadByGroup(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = req.userId;

    if (!usuarioId) {
      return res.sendStatus(401);
    }

    const participacoes =
      await prisma.membroGrupo.findMany({
        where: { usuarioId },
        select: {
          grupoId: true,
          ultimaLeituraEm: true,
        },
      });

    const resultado = await Promise.all(
      participacoes.map(async (membro) => {
        const where = {
          grupoId: membro.grupoId,
          usuarioId: { not: usuarioId },
          excluida: false,
          criadaEm: {
            gt: membro.ultimaLeituraEm,
          },
        };

        const [count, primeira] =
          await Promise.all([
            prisma.mensagemGrupo.count({ where }),
            prisma.mensagemGrupo.findFirst({
              where,
              orderBy: [
                { criadaEm: "asc" },
                { id: "asc" },
              ],
              select: { id: true },
            }),
          ]);

        return {
          grupoId: membro.grupoId,
          count,
          primeiraId: primeira?.id ?? null,
        };
      })
    );

    return res.json(resultado);
  } catch (erro) {
    console.error(
      "[mensagens] Erro ao listar não lidas por grupo:",
      erro
    );

    return res.status(500).json({
      error: "Erro ao consultar mensagens não lidas.",
    });
  }
}

export async function markReadFromUser(req: any, res: Response) {
  try {
    const userId = req.userId as string;
    const { otherId } = req.params as { otherId: string };

    await prisma.mensagem.updateMany({
      where: { paraId: userId, deId: otherId, lida: false },
      data: { lida: true },
    });

    await prisma.notificacao.updateMany({
      where: {
        usuarioId: userId,
        lida: false,
        OR: [
          {
            agrupamentoKey: `dm:${userId}:${otherId}`,
          },
          {
            agrupamentoKey: null,
            tipo: NotificacaoTipo.MENSAGEM,
            actorId: otherId,
          },
        ],
      },
      data: {
        lida: true,
      },
    });

    await recomputeAndEmitBadge(userId);
    res.sendStatus(204);
  } catch (e) {
    console.error("markReadFromUser error:", e);
    res.status(500).json({ error: "Erro ao marcar mensagens como lidas." });
  }
}

export async function markReadFromGroup(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = req.userId;
    const { grupoId } = req.params;

    if (!usuarioId) {
      return res.sendStatus(401);
    }

    const atualizado =
      await prisma.membroGrupo.updateMany({
        where: {
          grupoId,
          usuarioId,
        },
        data: {
          ultimaLeituraEm: new Date(),
        },
      });

    if (atualizado.count === 0) {
      return res.status(404).json({
        error: "Grupo não encontrado ou acesso negado.",
      });
    }

    await prisma.notificacao.updateMany({
      where: {
        usuarioId,
        agrupamentoKey: `grupo:${usuarioId}:${grupoId}`,
        lida: false,
      },
      data: {
        lida: true,
      },
    });

    await recomputeAndEmitBadge(usuarioId);

    return res.status(204).send();
  } catch (erro) {
    console.error(
      "[mensagens] Erro ao marcar grupo como lido:",
      erro
    );

    return res.status(500).json({
      error: "Erro ao marcar grupo como lido.",
    });
  }
}

export async function enviarMensagem(req: AuthenticatedRequest, res: Response) {
  try {
    const { tipo, conteudo, paraId, clientMsgId } = req.body as {
      tipo:
        | "NORMAL"
        | "POST"
        | "DESAFIO"
        | "USUARIO"
        | "CARD"
        | "AUDIO";
      conteudo: string;
      paraId: string;
      clientMsgId?: string;
    };

    const deId = req.userId!;
    const destinatario = await prisma.usuario.findUnique({
      where: { id: paraId },
      select: { id: true, configuracoesPrivacidade: true, configuracoesNotificacoes: true },
    });

    if (!destinatario) {
      return res.status(404).json({
        error: "Destinatário não encontrado.",
      });
    }

    const contextoRemetente =
      req.authUser
        ?.activeContext ??
      await getActiveContext(
        deId
      );

    const contextoRemetenteSnapshot =
      getMensagemContextSnapshot(
        contextoRemetente
      );

    const papelRemetenteAtivo =
      contextoRemetente?.role ??
      contextoRemetente?.tipoUsuario ??
      null;

    const remetenteEhOlheiroAtivo =
      contextoRemetente?.kind ===
        "PERSONAL" &&
      papelRemetenteAtivo ===
        TipoUsuario.Olheiro;

    const destinatarioEhAtleta =
      await hasRole(
        paraId,
        TipoUsuario.Atleta
      );

    const destPriv = readPrivacyConfig(
      destinatario.configuracoesPrivacidade
    );

    if (
      !destPriv.permitirMensagens &&
      destinatario.id !== deId
    ) {
      return res.status(403).json({
        code: "DM_DISABLED",
        error:
          "Este usuário desativou mensagens diretas.",
      });
    }

    if (
      remetenteEhOlheiroAtivo &&
      destinatarioEhAtleta
    ) {
      const atleta: any = await prisma.atleta.findFirst({
        where: { usuarioId: destinatario.id },
      });

      const nascimento: Date | string | null =
        atleta?.dataNascimento ?? atleta?.nascimento ?? null;
      const consentido: boolean = !!atleta?.contatoOlheiroPermitido;
      const ehMenor = isMinor(nascimento);

      if (ehMenor && !consentido) {
        const atletaId = atleta?.id ?? null;

        await audit(req as any, {
          acao: "DM_OLHEIRO_BLOQUEADA",
          entidade: "Atleta",
          entidadeId: atletaId ?? destinatario.id,
          descricao: "Tentativa de contato de olheiro com atleta menor sem consentimento",
          meta: {
            deId,
            paraId,
            tipoMensagem:
              tipo,

            contextoKey:
              contextoRemetente
                ?.key ??
              null,

            contextoKind:
              contextoRemetente
                ?.kind ??
              null,

            contextoTipo:
              contextoRemetente
                ?.tipoUsuario ??
              null,

            contextoOrganizacaoId:
              contextoRemetente
                ?.organizationId ??
              null,
          },
        });

        return res.status(403).json({
          error: "Contato indisponível. É necessário consentimento do responsável.",
        });
      }
    }

    const arquivoAudio = (
      req as AuthenticatedRequest & {
        file?: Express.Multer.File;
      }
    ).file;

    const tiposPermitidos = [
      "NORMAL",
      "POST",
      "DESAFIO",
      "USUARIO",
      "CARD",
      "AUDIO",
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        code: "MESSAGE_TYPE_INVALID",
      });
    }

    if (
      (tipo === "AUDIO") !== Boolean(arquivoAudio)
    ) {
      return res.status(400).json({
        code: "CHAT_AUDIO_FILE_REQUIRED",
      });
    }

    const duracaoAudio = Number(
      req.body?.audioDuracaoMs
    );

    if (
      tipo === "AUDIO" &&
      (
        !Number.isFinite(duracaoAudio) ||
        duracaoAudio < 700 ||
        duracaoAudio > CHAT_AUDIO_MAX_MS
      )
    ) {
      return res.status(400).json({
        code: "CHAT_AUDIO_INVALID_DURATION",
      });
    }

    let audioSalvo:
      | Awaited<ReturnType<typeof gravarChatAudio>>
      | null = null;

    let duracaoRealAudio: number | null = null;

    if (tipo === "AUDIO" && arquivoAudio) {
      duracaoRealAudio =
        await verificarDuracaoRealChatAudio(
          arquivoAudio.buffer,
          arquivoAudio.mimetype
        );

      audioSalvo = await gravarChatAudio(
        "privadas",
        arquivoAudio.buffer,
        arquivoAudio.mimetype
      );
    }

    let conteudoFinal =
      tipo === "AUDIO"
        ? "🎤 Mensagem de voz"
        : conteudo;

    if (
      tipo === "CARD" &&
      typeof conteudo === "string" &&
      conteudo.startsWith("data:image/")
    ) {
      conteudoFinal = await salvarDataUrlComoPng(
        conteudo,
        "cards"
      );
    }

    let saved;

    try {
      saved = await prisma.mensagem.create({
        data: {
          tipo,
          conteudo: conteudoFinal,
          paraId,
          deId,

          audioKey: audioSalvo?.key ?? null,
          audioMime: audioSalvo?.mime ?? null,
          audioDuracaoMs: duracaoRealAudio,
          audioTamanhoBytes:
            audioSalvo?.bytes ?? null,
        },
      });
    } catch (erroBanco) {
      if (audioSalvo) {
        try {
          await removerChatAudio(audioSalvo.key);
        } catch (erroLimpeza) {
          console.error(
            "[chat-audio] ARQUIVO_ORFAO_UPLOAD",
            audioSalvo.key,
            erroLimpeza
          );
          await registrarAudioOrfao(
            audioSalvo.key,
            "FALHA_PERSISTENCIA_MENSAGEM_PRIVADA"
          );
        }
      }

      throw erroBanco;
    }

    const destNotif = readNotificacoes((destinatario as any).configuracoesNotificacoes);

    if (destNotif.notifMensagens) {
      try {
        const remetente = await prisma.usuario.findUnique({
          where: {
            id: deId,
          },
          select: {
            nome: true,
            nomeDeUsuario: true,
          },
        });

        const nomeRemetente =
          remetente?.nomeDeUsuario?.trim().replace(/^@/, "") ||
          remetente?.nome?.trim() ||
          "Alguém";

        await criarNotificacaoEEnviarPush({
          usuarioId: paraId,
          actorId: deId,
          tipo: NotificacaoTipo.MENSAGEM,
          titulo: `@${nomeRemetente} enviou mensagens`,
          mensagem: `Você tem novas mensagens de @${nomeRemetente}.`,
          link: `/mensagens?otherId=${deId}`,

          agrupamentoKey: `dm:${paraId}:${deId}`,
        });
      } catch (e) {
        console.warn("[enviarMensagem] falha ao criar notificacao/push:", e);
      }
    }

    const payload = {
      ...saved,

      clientMsgId,

      pending:
        false,

      contextoRemetente:
        contextoRemetenteSnapshot,
    };

    const io = getIO();
    if (io) {
      io.to(`u:${paraId}`).emit("novaMensagem", payload);
      io.to(`u:${deId}`).emit("novaMensagem", payload);
    }

    return res.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ error: msg });
  }
}

export const buscarMensagens =
  async (req: any, res: Response) => {
    try {
      const me =
        req.userId as
          | string
          | undefined;

      const otherId = String(
        req.query.otherId ??
          req.query.paraId ??
          req.query.deId ??
          ""
      ).trim();

      if (!me || !otherId) {
        return res.status(400).json({
          error:
            "otherId é obrigatório",
        });
      }

      const destinatario =
        await prisma.usuario.findUnique({
          where: {
            id: otherId,
          },
          select: {
            configuracoesPrivacidade:
              true,
          },
        });

      if (!destinatario) {
        return res.status(404).json({
          error:
            "Usuário não encontrado.",
        });
      }

      const privDestinatario =
        readPrivacyConfig(
          destinatario
            .configuracoesPrivacidade
        );

      const {
        cursor,
        limit = 20,
      } = req.query;

      const limiteSolicitado = Number(limit);

      const limiteSeguro = Number.isFinite(limiteSolicitado)
        ? Math.min(200, Math.max(1, Math.floor(limiteSolicitado)))
        : 20;

      const startAt =
        typeof req.query.startAt === "string"
          ? req.query.startAt.trim()
          : "";

      const newerThan =
        typeof req.query.newerThan === "string"
          ? req.query.newerThan.trim()
          : "";

      if (startAt || newerThan) {
        const referenciaId = startAt || newerThan;

        const referencia = await prisma.mensagem.findFirst({
          where: {
            id: referenciaId,
            OR: [
              { deId: me, paraId: otherId },
              { deId: otherId, paraId: me },
            ],
          },
          select: {
            id: true,
            criadaEm: true,
          },
        });

        if (!referencia) {
          return res.status(404).json({
            code: "CHAT_CURSOR_NOT_FOUND",
            error: "Mensagem de referência não encontrada.",
          });
        }

        const mensagensJanela = await prisma.mensagem.findMany({
          where: {
            AND: [
              {
                OR: [
                  { deId: me, paraId: otherId },
                  { deId: otherId, paraId: me },
                ],
              },
              {
                OR: [
                  {
                    criadaEm: {
                      gt: referencia.criadaEm,
                    },
                  },
                  {
                    criadaEm: referencia.criadaEm,
                    id: startAt
                      ? { gte: referencia.id }
                      : { gt: referencia.id },
                  },
                ],
              },
            ],
          },
          orderBy: [
            { criadaEm: "asc" },
            { id: "asc" },
          ],
          take: limiteSeguro + 1,
        });

        return res.json({
          items: mensagensJanela.slice(0, limiteSeguro),
          hasMoreNewer: mensagensJanela.length > limiteSeguro,
          meta: {
            permitirMensagens:
              privDestinatario.permitirMensagens ||
              me === otherId,
          },
        });
      }

      const mensagens =
        await prisma.mensagem.findMany({
          where: {
            OR: [
              {
                deId: me,
                paraId: otherId,
              },
              {
                deId: otherId,
                paraId: me,
              },
            ],
          },
          orderBy: [
            { criadaEm: "desc" },
            { id: "desc" },
          ],
          take: limiteSeguro,

          ...(cursor
            ? {
                skip: 1,
                cursor: {
                  id: String(cursor),
                },
              }
            : {}),
        });

      const ads =
        await getAdsConfigForUser(
          me
        );

      return res.json({
        items: mensagens,

        meta: {
          adsEnabled:
            ads.adsEnabled,

          adEveryN:
            ads.adsEnabled
              ? ads.adEveryN
              : null,

          adsRemainingToday:
            ads.adsRemainingToday,

          permitirMensagens:
            privDestinatario
              .permitirMensagens ||
            me === otherId,
        },
      });
    } catch (e) {
      console.error(
        "buscarMensagens error:",
        e
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao buscar mensagens",
        });
    }
  };

export async function listarConversas(req: any, res: Response) {
  const me: string | undefined = req.user?.id || req.userId;
  if (!me) return res.status(401).json({ error: "Não autenticado." });

  const msgs = await prisma.mensagem.findMany({
    where: { OR: [{ deId: me }, { paraId: me }] },
    orderBy: { criadaEm: "desc" },
    select: { deId: true, paraId: true, criadaEm: true, conteudo: true, tipo: true },
  });

  const partnerIds = Array.from(
    new Set(msgs.map(m => (m.deId === me ? m.paraId : m.deId)))
  );

  if (partnerIds.length === 0) {
    const ads = await getAdsConfigForUser(me);
    return res.json({
      totalNaoLidas: 0,
      conversas: [],
      meta: {
        adsEnabled: ads.adsEnabled,
        adEveryN: ads.adsEnabled ? ads.adEveryN : null,
        adsRemainingToday: ads.adsRemainingToday,
      },
    });
  }

  const unread = await prisma.mensagem.groupBy({
    by: ["deId"],
    where: { paraId: me, lida: false },
    _count: { _all: true },
  });
  const unreadMap = Object.fromEntries(unread.map(r => [r.deId, r._count._all]));

  const users = await prisma.usuario.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, nome: true, nomeDeUsuario: true, foto: true },
  });

  const lastByPartner = new Map<
    string,
    { criadoEm: Date; conteudo: string | null; tipo: string | null }
  >();

  for (const m of msgs) {
    const pid = m.deId === me ? m.paraId : m.deId;
    if (!lastByPartner.has(pid)) {
      lastByPartner.set(pid, {
        criadoEm: m.criadaEm,
        conteudo: m.conteudo ?? null,
        tipo: (m as any).tipo ?? null,
      });
    }
  }

  const conversas = users
    .map(u => ({
      id: u.id,
      nome: u.nome || u.nomeDeUsuario,
      foto: u.foto,
      naoLidas: unreadMap[u.id] ?? 0,
      ultimaMensagemEm: lastByPartner.get(u.id)?.criadoEm ?? null,
      ultimaMensagem: lastByPartner.get(u.id)?.conteudo ?? null,
      ultimaMensagemTipo: lastByPartner.get(u.id)?.tipo ?? "NORMAL",
    }))
    .sort((a, b) => (b.ultimaMensagemEm?.getTime() ?? 0) - (a.ultimaMensagemEm?.getTime() ?? 0));

  const totalNaoLidas = unread.reduce((s, r) => s + r._count._all, 0);
  const ads = await getAdsConfigForUser(me);

  return res.json({
    totalNaoLidas,
    conversas,
    meta: {
      adsEnabled: ads.adsEnabled,
      adEveryN: ads.adsEnabled ? ads.adEveryN : null,
      adsRemainingToday: ads.adsRemainingToday,
    },
  });
}

export async function listarContatosRelacionados(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId =
      req.userId!;

    const contexto =
      await getActiveContext(
        userId
      );

    if (!contexto) {
      return res.json([]);
    }

    type ContatoLite = {
      id: string;
      nome: string;
      foto: string | null;
    };

    const contatos =
      new Map<
        string,
        ContatoLite
      >();

    const pushUsuario = (
      u?: {
        id: string;
        nome: string | null;
        foto: string | null;
      } | null
    ) => {
      if (!u) {
        return;
      }

      if (
        u.id === userId
      ) {
        return;
      }

      if (
        contatos.has(
          u.id
        )
      ) {
        return;
      }

      contatos.set(
        u.id,
        {
          id:
            u.id,

          nome:
            u.nome ??
            "Usuário FootEra",

          foto:
            u.foto ??
            null,
        }
      );
    };

    if (
      contexto.kind ===
        "PERSONAL" &&
      contexto.tipoUsuario ===
        TipoUsuario.Atleta &&
      contexto.tipoUsuarioId
    ) {
      const rels =
        await prisma
          .relacaoTreinamento
          .findMany({
            where: {
              atletaId:
                contexto.tipoUsuarioId,

              ativo:
                true,

              encerradoEm:
                null,
            },

            include: {
              professor: {
                include: {
                  usuario:
                    true,
                },
              },

              clube: {
                include: {
                  usuario:
                    true,
                },
              },

              escolinha: {
                include: {
                  usuario:
                    true,
                },
              },
            },
          });

      for (
        const r of rels
      ) {
        pushUsuario(
          r.professor
            ?.usuario as any
        );

        pushUsuario(
          r.clube
            ?.usuario as any
        );

        pushUsuario(
          r.escolinha
            ?.usuario as any
        );
      }
    }

    if (
      contexto.kind ===
        "PERSONAL" &&
      contexto.tipoUsuario ===
        TipoUsuario.Professor &&
      contexto.tipoUsuarioId
    ) {
      const rels =
        await prisma
          .relacaoTreinamento
          .findMany({
            where: {
              professorId:
                contexto.tipoUsuarioId,

              ativo:
                true,

              encerradoEm:
                null,
            },

            include: {
              atleta: {
                include: {
                  usuario:
                    true,
                },
              },

              clube: {
                include: {
                  usuario:
                    true,
                },
              },

              escolinha: {
                include: {
                  usuario:
                    true,
                },
              },
            },
          });

      const [
        clubesDoProfessor,
        escolinhasDoProfessor,
      ] =
        await Promise.all([
          prisma.professorClube.findMany({
            where: {
              professorId:
                contexto.tipoUsuarioId,
            },

            select: {
              clube: {
                select: {
                  usuario: {
                    select: {
                      id: true,
                      nome: true,
                      foto: true,
                    },
                  },
                },
              },
            },
          }),

          prisma.professorEscolinha.findMany({
            where: {
              professorId:
                contexto.tipoUsuarioId,
            },

            select: {
              escolinha: {
                select: {
                  usuario: {
                    select: {
                      id: true,
                      nome: true,
                      foto: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

      for (
        const vinculo of clubesDoProfessor
      ) {
        pushUsuario(
          vinculo.clube
            ?.usuario ?? null
        );
      }

      for (
        const vinculo of escolinhasDoProfessor
      ) {
        pushUsuario(
          vinculo.escolinha
            ?.usuario ?? null
        );
      }

      for (
        const r of rels
      ) {
        pushUsuario(
          r.atleta
            ?.usuario as any
        );

        pushUsuario(
          r.clube
            ?.usuario as any
        );

        pushUsuario(
          r.escolinha
            ?.usuario as any
        );
      }
    }

    if (
      contexto.kind ===
        "ORGANIZATION" &&
      contexto.organizationType ===
        TipoOrganizacao.CLUBE &&
      contexto.legacyOrganizationId
    ) {
      const rels =
        await prisma
          .relacaoTreinamento
          .findMany({
            where: {
              clubeId:
                contexto.legacyOrganizationId,

              ativo:
                true,

              encerradoEm:
                null,
            },

            include: {
              atleta: {
                include: {
                  usuario:
                    true,
                },
              },

              professor: {
                include: {
                  usuario:
                    true,
                },
              },
            },
          });

      const [
        atletasDiretos,
        professoresDiretos,
      ] =
        await Promise.all([
          prisma.atleta.findMany({
            where: {
              clubeId:
                contexto
                  .legacyOrganizationId,
            },

            select: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  foto: true,
                },
              },
            },
          }),

          prisma.professorClube.findMany({
            where: {
              clubeId:
                contexto
                  .legacyOrganizationId,
            },

            select: {
              professor: {
                select: {
                  usuario: {
                    select: {
                      id: true,
                      nome: true,
                      foto: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

      for (
        const atleta of atletasDiretos
      ) {
        pushUsuario(
          atleta.usuario
        );
      }

      for (
        const vinculo of professoresDiretos
      ) {
        pushUsuario(
          vinculo.professor
            ?.usuario ?? null
        );
      }

      for (
        const r of rels
      ) {
        pushUsuario(
          r.atleta
            ?.usuario as any
        );

        pushUsuario(
          r.professor
            ?.usuario as any
        );
      }
    }

    if (
      contexto.kind ===
        "ORGANIZATION" &&
      contexto.organizationType ===
        TipoOrganizacao.ESCOLA &&
      contexto.legacyOrganizationId
    ) {
      const rels =
        await prisma
          .relacaoTreinamento
          .findMany({
            where: {
              escolinhaId:
                contexto.legacyOrganizationId,

              ativo:
                true,

              encerradoEm:
                null,
            },

            include: {
              atleta: {
                include: {
                  usuario:
                    true,
                },
              },

              professor: {
                include: {
                  usuario:
                    true,
                },
              },
            },
          });

      const [
        atletasDiretos,
        professoresDiretos,
      ] =
        await Promise.all([
          prisma.atleta.findMany({
            where: {
              escolinhaId:
                contexto
                  .legacyOrganizationId,
            },

            select: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  foto: true,
                },
              },
            },
          }),

          prisma.professorEscolinha.findMany({
            where: {
              escolinhaId:
                contexto
                  .legacyOrganizationId,
            },

            select: {
              professor: {
                select: {
                  usuario: {
                    select: {
                      id: true,
                      nome: true,
                      foto: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

      for (
        const atleta of atletasDiretos
      ) {
        pushUsuario(
          atleta.usuario
        );
      }

      for (
        const vinculo of professoresDiretos
      ) {
        pushUsuario(
          vinculo.professor
            ?.usuario ?? null
        );
      }

      for (
        const r of rels
      ) {
        pushUsuario(
          r.atleta
            ?.usuario as any
        );

        pushUsuario(
          r.professor
            ?.usuario as any
        );
      }
    }

    return res.json(
      Array.from(
        contatos.values()
      )
    );
  } catch (err) {
    console.error(
      "listarContatosRelacionados error:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao carregar contatos relacionados.",
      });
  }
}

export const listarMensagensGrupo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usuarioId = req.userId!;
    const { grupoId } = req.params as { grupoId: string };
    const { cursor, limit = 20 } = req.query as { cursor?: string; limit?: string };

    const limiteSolicitado = Number(limit);

    const limiteSeguro =
      Number.isFinite(limiteSolicitado)
        ? Math.min(
            200,
            Math.max(1, Math.floor(limiteSolicitado))
          )
        : 20;

    const ehMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId } },
    });
    if (!ehMembro) return res.status(403).json({ error: "Você não participa deste grupo." });

    const startAt =
      typeof req.query.startAt === "string"
        ? req.query.startAt.trim()
        : "";

    const newerThan =
      typeof req.query.newerThan === "string"
        ? req.query.newerThan.trim()
        : "";

    if (startAt || newerThan) {
      const referenciaId = startAt || newerThan;

      const referencia = await prisma.mensagemGrupo.findFirst({
        where: {
          id: referenciaId,
          grupoId,
        },
        select: {
          id: true,
          criadaEm: true,
        },
      });

      if (!referencia) {
        return res.status(404).json({
          code: "CHAT_CURSOR_NOT_FOUND",
          error: "Mensagem de referência não encontrada.",
        });
      }

      const mensagensJanela =
        await prisma.mensagemGrupo.findMany({
          where: {
            grupoId,
            OR: [
              {
                criadaEm: {
                  gt: referencia.criadaEm,
                },
              },
              {
                criadaEm: referencia.criadaEm,
                id: startAt
                  ? { gte: referencia.id }
                  : { gt: referencia.id },
              },
            ],
          },
          orderBy: [
            { criadaEm: "asc" },
            { id: "asc" },
          ],
          take: limiteSeguro + 1,
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                foto: true,
              },
            },
          },
        });

      return res.json({
        items: mensagensJanela.slice(0, limiteSeguro),
        hasMoreNewer: mensagensJanela.length > limiteSeguro,
      });
    }

    const mensagens = await prisma.mensagemGrupo.findMany({
      where: { grupoId },
      orderBy: [
        { criadaEm: "desc" },
        { id: "desc" },
      ],
      take: limiteSeguro,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
    });

    res.json(mensagens);
  } catch (error) {
    console.error("Erro ao listar mensagens do grupo:", error);
    res.status(500).json({ error: "Erro ao listar mensagens do grupo" });
  }
};

export async function getUnreadCount(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Não autenticado",
      });
    }

    const contagem =
      await contarMensagensNaoLidas(userId);

    return res.json({
      count: contagem.total,
      privadas: contagem.privadas,
      grupos: contagem.grupos,
    });
  } catch (erro) {
    console.error(
      "[mensagens] Erro ao contar não lidas:",
      erro
    );

    return res.status(500).json({
      error: "Erro ao contar mensagens não lidas.",
    });
  }
}

export async function listUnread(req: any, res: Response) {
  const userId = req.userId;
  const rows = await prisma.mensagem.findMany({
    where: { paraId: userId, lida: false },
    select: { id: true },
  });
  res.json(rows);
}

export async function markAllRead(req: any, res: Response) {
  const userId = req.userId;
  await prisma.mensagem.updateMany({
    where: { paraId: userId, lida: false },
    data: { lida: true },
  });

  await recomputeAndEmitBadge(userId);
  res.sendStatus(204);
}

export const enviarMensagemGrupo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usuarioId = req.userId!;
    const { grupoId } = req.params as { grupoId: string };
    const { conteudo, clientMsgId } = req.body as { conteudo: string; clientMsgId?: string };

    const contextoRemetente =
      req.authUser
        ?.activeContext ??
      await getActiveContext(
        usuarioId
      );

    const contextoRemetenteSnapshot =
      getMensagemContextSnapshot(
        contextoRemetente
      );

    const arquivoAudio = (
      req as AuthenticatedRequest & {
        file?: Express.Multer.File;
      }
    ).file;

    const ehAudio = Boolean(arquivoAudio);

    if (!ehAudio && !conteudo?.trim()) {
      return res.status(400).json({
        error: "Conteúdo obrigatório.",
      });
    }

    const duracaoAudio = Number(
      req.body?.audioDuracaoMs
    );

    if (
      ehAudio &&
      (
        !Number.isFinite(duracaoAudio) ||
        duracaoAudio < 700 ||
        duracaoAudio > CHAT_AUDIO_MAX_MS
      )
    ) {
      return res.status(400).json({
        code: "CHAT_AUDIO_INVALID_DURATION",
      });
    }

    const ehMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId } },
    });
    if (!ehMembro) return res.status(403).json({ error: "Você não participa deste grupo." });

    const duracaoRealAudio =
      ehAudio && arquivoAudio
        ? await verificarDuracaoRealChatAudio(
            arquivoAudio.buffer,
            arquivoAudio.mimetype
          )
        : null;

    const audioSalvo =
      ehAudio && arquivoAudio
        ? await gravarChatAudio(
            "grupos",
            arquivoAudio.buffer,
            arquivoAudio.mimetype
          )
        : null;

    let nova;

    try {
      nova = await prisma.mensagemGrupo.create({
        data: {
          grupoId,
          usuarioId,
          conteudo: ehAudio
            ? "🎤 Mensagem de voz"
            : conteudo,
          tipo: ehAudio
            ? "AUDIO"
            : "NORMAL",

          audioKey: audioSalvo?.key ?? null,
          audioMime: audioSalvo?.mime ?? null,
          audioDuracaoMs: duracaoRealAudio,
          audioTamanhoBytes:
            audioSalvo?.bytes ?? null,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              foto: true,
            },
          },
        },
      });
    } catch (erroBanco) {
      if (audioSalvo) {
        try {
          await removerChatAudio(audioSalvo.key);
        } catch (erroLimpeza) {
          console.error(
            "[chat-audio] ARQUIVO_ORFAO_GRUPO",
            audioSalvo.key,
            erroLimpeza
          );
          await registrarAudioOrfao(
            audioSalvo.key,
            "FALHA_PERSISTENCIA_MENSAGEM_GRUPO"
          );
        }
      }

      throw erroBanco;
    }

    const payload = {
      ...nova,
      clientMsgId,
      pending:
        false,
      contextoRemetente:
        contextoRemetenteSnapshot,
    };

    try {
      const destinatarios = await prisma.membroGrupo.findMany({
        where: {
          grupoId,
          usuarioId: {
            not: usuarioId,
          },
        },
        select: {
          usuarioId: true,
        },
      });

      const grupoInfo = await prisma.grupo.findUnique({
        where: { id: grupoId },
        select: { nome: true },
      });

      const resultados = await Promise.allSettled(
        destinatarios.map(async ({ usuarioId: destinatarioId }) => {
          const nomeGrupo =
            grupoInfo?.nome?.trim() || "seu grupo";

          await criarNotificacaoEEnviarPush({
            usuarioId: destinatarioId,
            actorId: usuarioId,
            tipo: NotificacaoTipo.MENSAGEM_GRUPO,
            titulo: `Novas mensagens em ${nomeGrupo}`,
            mensagem: `Você tem novas mensagens no grupo ${nomeGrupo}.`,
            link: `/mensagens?grupoId=${grupoId}`,

            agrupamentoKey: `grupo:${destinatarioId}:${grupoId}`,
          });
        })
      );

      resultados.forEach((resultado) => {
        if (resultado.status === "rejected") {
          console.warn(
            "[chat-grupo] Falha ao notificar participante:",
            resultado.reason
          );
        }
      });
    } catch (erro) {
      console.warn(
        "[chat-grupo] Falha nas notificações:",
        erro
      );
    }

    const io = getIO();
    if (io) {
      io.to(`g:${grupoId}`).emit("novaMensagemGrupo", payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    console.error("Erro ao enviar mensagem ao grupo:", error);
    return res.status(500).json({ error: "Erro ao enviar mensagem ao grupo" });
  }
};

export async function deletarMensagem(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id || req.userId;
  const io = getIO();

  try {
    const msgPriv = await prisma.mensagem.findUnique({ where: { id } });
    if (msgPriv) {
      if (msgPriv.deId !== userId) {
        return res.status(403).json({ error: "Sem permissão para apagar." });
      }

      await prisma.$transaction(async (tx) => {
        if (msgPriv.audioKey) {
          await tx.exclusaoAudioMensagemPendente.upsert({
            where: {
              audioKey: msgPriv.audioKey,
            },
            create: {
              audioKey: msgPriv.audioKey,
            },
            update: {},
          });
        }

        await tx.mensagem.delete({
          where: { id },
        });
      });

      if (msgPriv.audioKey) {
        try {
          await removerChatAudio(msgPriv.audioKey);

          await prisma.exclusaoAudioMensagemPendente.deleteMany({
            where: {
              audioKey: msgPriv.audioKey,
            },
          });
        } catch (erro) {
          console.error(
            "[chat-audio] Exclusão privada pendente",
            erro
          );
        }
      }

      if (io) {
        io.to(
          `u:${msgPriv.deId}`
        ).emit(
          "mensagemDeletada",
          { id }
        );

        io.to(
          `u:${msgPriv.paraId}`
        ).emit(
          "mensagemDeletada",
          { id }
        );
      }

      return res.status(204).send();
    }

    const msgGrupo = await prisma.mensagemGrupo.findUnique({
      where: { id },
    });

    if (msgGrupo) {
      if (msgGrupo.usuarioId !== userId) {
        return res.status(403).json({
          error: "Sem permissão para apagar.",
        });
      }

      const membroAtual = await prisma.membroGrupo.findUnique({
        where: {
          grupoId_usuarioId: {
            grupoId: msgGrupo.grupoId,
            usuarioId: String(userId),
          },
        },
        select: {
          usuarioId: true,
        },
      });

      if (!membroAtual) {
        return res.status(403).json({
          error: "Você não participa mais deste grupo.",
        });
      }
      await prisma.$transaction(async (tx) => {
        if (msgGrupo.audioKey) {
          await tx.exclusaoAudioMensagemPendente.upsert({
            where: {
              audioKey: msgGrupo.audioKey,
            },
            create: {
              audioKey: msgGrupo.audioKey,
            },
            update: {},
          });
        }

        await tx.mensagemGrupo.delete({
          where: { id },
        });
      });

      if (msgGrupo.audioKey) {
        try {
          await removerChatAudio(msgGrupo.audioKey);

          await prisma.exclusaoAudioMensagemPendente.deleteMany({
            where: {
              audioKey: msgGrupo.audioKey,
            },
          });
        } catch (erro) {
          console.error(
            "[chat-audio] Exclusão de grupo pendente",
            erro
          );
        }
      }

      if (io) {
        io.to(
          `g:${msgGrupo.grupoId}`
        ).emit(
          "mensagemDeletada",
          { id }
        );
      }

      return res.status(204).send();
    }

    return res.status(404).json({ error: "Mensagem não encontrada." });
  } catch (err) {
    console.error("Erro ao deletar mensagem:", err);
    return res.status(500).json({ error: "Erro interno ao deletar mensagem." });
  }
}
