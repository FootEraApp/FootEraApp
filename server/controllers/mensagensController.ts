import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";
import fs from "fs/promises";
import path from "path";
import { getDailyUsage } from "../services/usage.js";
import { audit } from "../services/audit.js"; 
import { recomputeAndEmitBadge, criarNotificacaoEEnviarPush } from "./notificacoesController.js";
import { NotificacaoTipo } from "@prisma/client";

const ADS_CAP_PER_DAY = 5;
const AD_EVERY_N = 10;

function readPrivacidade(raw: any) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    permitirMensagens: c.permitirMensagens !== false, 
  };
}

function readNotificacoes(raw: any) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    notifMensagens: c.notifMensagens !== false, 
  };
}

async function isProUser(userId: string) {
  const assinatura = await prisma.assinatura.findFirst({
    where: { usuarioId: userId },
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

  if (!assinatura) return false;

  const status = String(assinatura.status || "").toUpperCase();
  const plano = String(assinatura.plano || "").toUpperCase();

  if (!assinatura.ativo) return false;
  if (status === "BLOQUEADA" || status === "CANCELADA" || status === "SEM_ASSINATURA") {
    return false;
  }

  if (status === "ATIVA") return true;

  if (status === "TRIAL") {
    if (assinatura.trialEndsAt) {
      return new Date() <= new Date(assinatura.trialEndsAt);
    }
    return true;
  }

  return plano.includes("PRO");
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

export async function getUnreadByUser(req: any, res: Response) {
  try {
    const userId = req.userId as string;
    const buckets = await prisma.mensagem.groupBy({
      by: ["deId"],
      where: { paraId: userId, lida: false },
      _count: { _all: true },
    });

    const out = buckets.map(b => ({ userId: b.deId, count: b._count._all }));
    res.json(out);
  } catch (e) {
    console.error("getUnreadByUser error:", e);
    res.status(500).json({ error: "Erro ao calcular não lidas." });
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

    await recomputeAndEmitBadge(userId);
    res.sendStatus(204);
  } catch (e) {
    console.error("markReadFromUser error:", e);
    res.status(500).json({ error: "Erro ao marcar mensagens como lidas." });
  }
}

export async function enviarMensagem(req: AuthenticatedRequest, res: Response) {
  try {
    const { tipo, conteudo, paraId, clientMsgId } = req.body as {
      tipo: "NORMAL" | "POST" | "DESAFIO" | "USUARIO" | "CARD";
      conteudo: string;
      paraId: string;
      clientMsgId?: string;
    };

    const deId = req.userId!;
    const remetente = await prisma.usuario.findUnique({
      where: { id: deId },
      select: { id: true, tipo: true },
    });

    const destinatario = await prisma.usuario.findUnique({
      where: { id: paraId },
      select: { id: true, tipo: true, configuracoesPrivacidade: true, configuracoesNotificacoes: true },
    });

    if (!destinatario) {
      return res.status(404).json({
        error: "Destinatário não encontrado.",
      });
    }

    const destPriv = readPrivacidade(
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

    if (remetente?.tipo === "Olheiro" && destinatario?.tipo === "Atleta") {
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
          meta: { deId, paraId, tipoMensagem: tipo },
        });

        return res.status(403).json({
          error: "Contato indisponível. É necessário consentimento do responsável.",
        });
      }
    }

    let conteudoFinal = conteudo;
    if (tipo === "CARD" && typeof conteudo === "string" && conteudo.startsWith("data:image/")) {
      conteudoFinal = await salvarDataUrlComoPng(conteudo, "cards");
    }

    const saved = await prisma.mensagem.create({
      data: {
        tipo,
        conteudo: conteudoFinal,
        paraId,
        deId: deId,
      },
    });

    const destNotif = readNotificacoes((destinatario as any).configuracoesNotificacoes);

    if (destNotif.notifMensagens) {
      try {
        await criarNotificacaoEEnviarPush({
          usuarioId: paraId,
          actorId: deId,
          tipo: NotificacaoTipo.MENSAGEM,
          titulo: "Nova mensagem",
          mensagem: "Você recebeu uma nova mensagem.",
          link: `/mensagens?otherId=${deId}`,
        });
      } catch (e) {
        console.warn("[enviarMensagem] falha ao criar notificacao/push:", e);
      }
    }

    const payload = { ...saved, clientMsgId, pending: false };

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
        readPrivacidade(
          destinatario
            .configuracoesPrivacidade
        );

      const {
        cursor,
        limit = 20,
      } = req.query;

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
          orderBy: {
            criadaEm: "desc",
          },
          take: Number(limit),

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

export async function listarContatosRelacionados(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        atleta: true,
        professor: true,
        clube: true,
        escolinha: true,
      },
    });

    if (!usuario) {
      return res.json([]);
    }

    type ContatoLite = { id: string; nome: string; foto: string | null };
    const contatos = new Map<string, ContatoLite>();

    const pushUsuario = (u?: { id: string; nome: string | null; foto: string | null }) => {
      if (!u) return;
      if (contatos.has(u.id)) return;
      contatos.set(u.id, {
        id: u.id,
        nome: u.nome ?? "Usuário FootEra",
        foto: u.foto ?? null,
      });
    };

    if (usuario.atleta) {
      const rels = await prisma.relacaoTreinamento.findMany({
        where: { atletaId: usuario.atleta.id },
        include: {
          professor: { include: { usuario: true } },
          clube: { include: { usuario: true } },
          escolinha: { include: { usuario: true } },
        },
      });

      for (const r of rels) {
        if (r.professor?.usuario) pushUsuario(r.professor.usuario as any);
        if (r.clube?.usuario) pushUsuario(r.clube.usuario as any);
        if (r.escolinha?.usuario) pushUsuario(r.escolinha.usuario as any);
      }
    }

    if (usuario.professor) {
      const rels = await prisma.relacaoTreinamento.findMany({
        where: { professorId: usuario.professor.id },
        include: {
          atleta: { include: { usuario: true } },
          clube: { include: { usuario: true } },
          escolinha: { include: { usuario: true } },
        },
      });

      for (const r of rels) {
        if (r.atleta?.usuario) pushUsuario(r.atleta.usuario as any);
        if (r.clube?.usuario) pushUsuario(r.clube.usuario as any);
        if (r.escolinha?.usuario) pushUsuario(r.escolinha.usuario as any);
      }
    }

    if (usuario.clube) {
      const rels = await prisma.relacaoTreinamento.findMany({
        where: { clubeId: usuario.clube.id },
        include: {
          atleta: { include: { usuario: true } },
          professor: { include: { usuario: true } },
        },
      });

      for (const r of rels) {
        if (r.atleta?.usuario) pushUsuario(r.atleta.usuario as any);
        if (r.professor?.usuario) pushUsuario(r.professor.usuario as any);
      }
    }

    if (usuario.escolinha) {
      const rels = await prisma.relacaoTreinamento.findMany({
        where: { escolinhaId: usuario.escolinha.id },
        include: {
          atleta: { include: { usuario: true } },
          professor: { include: { usuario: true } },
        },
      });

      for (const r of rels) {
        if (r.atleta?.usuario) pushUsuario(r.atleta.usuario as any);
        if (r.professor?.usuario) pushUsuario(r.professor.usuario as any);
      }
    }

    return res.json(Array.from(contatos.values()));
  } catch (err) {
    console.error("listarContatosRelacionados error:", err);
    return res.status(500).json({ error: "Erro ao carregar contatos relacionados." });
  }
}

export const listarMensagensGrupo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usuarioId = req.userId!;
    const { grupoId } = req.params as { grupoId: string };
    const { cursor, limit = 20 } = req.query as { cursor?: string; limit?: string };

    const ehMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId } },
    });
    if (!ehMembro) return res.status(403).json({ error: "Você não participa deste grupo." });

    const mensagens = await prisma.mensagemGrupo.findMany({
      where: { grupoId },
      orderBy: { criadaEm: "desc" },
      take: Number(limit ?? 20),
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

export async function getUnreadCount(req: any, res: Response) {
  const userId = req.userId;
  const count = await prisma.mensagem.count({
    where: { paraId: userId, lida: false },
  });
  res.json({ count });
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

    if (!conteudo?.trim()) return res.status(400).json({ error: "Conteúdo obrigatório." });

    const ehMembro = await prisma.membroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId, usuarioId } },
    });
    if (!ehMembro) return res.status(403).json({ error: "Você não participa deste grupo." });

    const nova = await prisma.mensagemGrupo.create({
      data: { grupoId, usuarioId, conteudo, tipo: "NORMAL" },
      include: { usuario: { select: { id: true, nome: true, foto: true } } },
    });

    const payload = { ...nova, clientMsgId, pending: false };

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

      await prisma.mensagem.delete({ where: { id } });

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

    const msgGrupo = await prisma.mensagemGrupo.findUnique({ where: { id } });
    if (msgGrupo) {
      if (msgGrupo.usuarioId !== userId) {
        return res.status(403).json({ error: "Sem permissão para apagar." });
      }

      await prisma.mensagemGrupo.delete({ where: { id } });

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
