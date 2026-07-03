import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { getIO } from "../socket.js";
import { prisma } from "../prisma.js";
import { sendError } from "../utils/httpError.js";
import webpush from "web-push";
import { NotificacaoTipo } from "@prisma/client";
import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type SendResponse } from "firebase-admin/messaging";

async function getNotifPrefs(userId: string) {
  const u = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { configuracoesNotificacoes: true },
  });

  const raw: any = u?.configuracoesNotificacoes || {};
  return {
    notifMensagens: raw.notifMensagens ?? true,
    notifTreinos: raw.notifTreinos ?? true,
    notifEventos: raw.notifEventos ?? true,
    notifMarketing: raw.notifMarketing ?? false,
  };
}

let webPushConfigured = false;
let firebaseConfigured = false;

function configurarFirebaseAdmin() {
  if (firebaseConfigured || getApps().length > 0) {
    firebaseConfigured = true;
    return true;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let serviceAccount: any = null;

    if (serviceAccountJson) {
      serviceAccount = JSON.parse(serviceAccountJson);
    } else if (serviceAccountPath) {
      const candidatePaths = path.isAbsolute(serviceAccountPath)
        ? [serviceAccountPath]
        : [
            path.resolve(process.cwd(), serviceAccountPath),
            path.resolve(process.cwd(), "server", serviceAccountPath),
          ];

      const absolutePath = candidatePaths.find((p) => fs.existsSync(p));

      if (!absolutePath) {
        console.warn("[fcm] arquivo de service account não encontrado:", {
          serviceAccountPath,
          candidatePaths,
          cwd: process.cwd(),
        });
        return false;
      }

      const raw = fs.readFileSync(absolutePath, "utf-8");
      serviceAccount = JSON.parse(raw);
    } else {
      console.warn(
        "[fcm] FIREBASE_SERVICE_ACCOUNT_PATH ou FIREBASE_SERVICE_ACCOUNT_JSON não configurado."
      );
      return false;
    }

    initializeApp({
      credential: cert(serviceAccount),
    });

    firebaseConfigured = true;
    return true;
  } catch (e: any) {
    console.warn("[fcm] erro ao configurar Firebase Admin:", e?.message);
    return false;
  }
}

function configurarWebPush() {
  if (webPushConfigured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:footeraapp@gmail.com";

  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas.");
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  webPushConfigured = true;
}

function categoriaHabilitadaPorPreferencia(
  params:
    | string
    | null
    | undefined
    | {
        tipo?: string | null;
        titulo?: string | null;
        mensagem?: string | null;
        link?: string | null;
      },
  prefs: any
) {
  const texto =
    typeof params === "string" || params == null
      ? String(params || "").toLowerCase()
      : [
          params.tipo,
          params.titulo,
          params.mensagem,
          params.link,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

  if (
    texto.includes("mensagem") ||
    texto.includes("mensagens") ||
    texto.includes("chat")
  ) {
    return prefs.notifMensagens;
  }

  if (
    texto.includes("treino") ||
    texto.includes("treinos") ||
    texto.includes("treinar") ||
    texto.includes("solicitacao") ||
    texto.includes("solicitação") ||
    texto.includes("vínculo") ||
    texto.includes("vinculo")
  ) {
    return prefs.notifTreinos;
  }

  if (
    texto.includes("evento") ||
    texto.includes("eventos") ||
    texto.includes("aula") ||
    texto.includes("live") ||
    texto.includes("ao vivo") ||
    texto.includes("learning")
  ) {
    return prefs.notifEventos;
  }

  if (
    texto.includes("marketing") ||
    texto.includes("market") ||
    texto.includes("promo") ||
    texto.includes("novidade")
  ) {
    return prefs.notifMarketing;
  }

  return true;
}

export async function enviarPushParaUsuario(params: {
  usuarioId: string;
  titulo: string;
  mensagem: string;
  link?: string | null;
  tipo?: string | null;
  notificacaoId?: string | null;
}) {
  configurarWebPush();

  if (!webPushConfigured) {
    console.warn("[push] não enviado: webPush não configurado", {
      usuarioId: params.usuarioId,
      tipo: params.tipo,
    });
    return;
  }

  const prefs = await getNotifPrefs(params.usuarioId);

  if (
    !categoriaHabilitadaPorPreferencia(
      {
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        link: params.link,
      },
      prefs
    )
  ) {
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { usuarioId: params.usuarioId },
  });

  if (!subscriptions.length) {
    console.log("[push] não enviado: usuário sem dispositivo cadastrado", {
      usuarioId: params.usuarioId,
      tipo: params.tipo,
    });
    return;
  }

  const payload = JSON.stringify({
    title: params.titulo || "FootEra",
    body: params.mensagem || "Você tem uma nova notificação.",
    url: params.link || "/notificacoes",
    link: params.link || "/notificacoes",
    tipo: params.tipo || "NOTIFICACAO",
    tag: params.tipo || "footera",
    notificacaoId: params.notificacaoId || null,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );

      } catch (e: any) {
        const statusCode = Number(e?.statusCode || e?.status || 0);

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({
            where: { endpoint: sub.endpoint },
          });

          console.warn("[push] subscription inválida removida", {
            usuarioId: params.usuarioId,
            statusCode,
          });
        } else {
          console.warn("[push] erro ao enviar push:", {
            usuarioId: params.usuarioId,
            statusCode,
            message: e?.message,
            body: e?.body,
          });
        }
      }
    })
  );
}

export async function criarNotificacaoEEnviarPush(params: {
  usuarioId: string;
  titulo: string;
  mensagem: string;
  tipo?: string | null;
  link?: string | null;
  actorId?: string | null;
}) {
  const not = await prisma.notificacao.create({
    data: {
      usuarioId: params.usuarioId,
      titulo: params.titulo,
      mensagem: params.mensagem,
      tipo: params.tipo || "NOTIFICACAO",
      link: params.link || "/notificacoes",
      actorId: params.actorId || null,
      lida: false,
    } as any,
  });

  await recomputeAndEmitBadge(params.usuarioId);

  await enviarPushParaUsuario({
    usuarioId: params.usuarioId,
    titulo: params.titulo,
    mensagem: params.mensagem,
    tipo: params.tipo,
    link: params.link,
    notificacaoId: not.id,
  });

  await enviarPushNativoParaUsuario({
    usuarioId: params.usuarioId,
    titulo: params.titulo,
    mensagem: params.mensagem,
    tipo: params.tipo,
    link: params.link,
    notificacaoId: not.id,
  });

  return not;
}

export async function listarMinhasNotificacoes(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const rows = await prisma.notificacao.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: {
          select: {
            id: true,
            nomeDeUsuario: true,
            nome: true,
            foto: true,
          },
        },
      },
    });

    const prefs = await getNotifPrefs(userId);
    const filtered = rows.filter((n: any) =>
      categoriaHabilitadaPorPreferencia(
        {
          tipo: n.tipo ?? n.categoria ?? n.kind,
          titulo: n.titulo,
          mensagem: n.mensagem,
          link: n.link,
        },
        prefs
      )
    );

    return res.json({ items: filtered });
  } catch (e) {
    console.error("[listarMinhasNotificacoes]", e);
    return res.status(500).json({ error: "Erro ao listar notificações" });
  }
}

export async function getBadge(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const prefs = await getNotifPrefs(userId);
    const [pendSolic, unreadMsgs, notificacoesRows] = await Promise.all([
      prisma.solicitacaoTreino.count({
        where: {
          destinatarioId: userId,
          OR: [
            { status: null },
            {
              status: {
                in: [
                  "Pendente",
                  "pendente",
                  "Aguardando",
                  "aguardando",
                  "Pending",
                  "pending",
                ],
              },
            },
          ],
        },
      }),
      prisma.mensagem.count({ where: { paraId: userId, lida: false } }),
      prisma.notificacao.findMany({
        where: { usuarioId: userId, lida: false },
        select: {
          tipo: true,
          titulo: true,
          mensagem: true,
          link: true,
        },
      }),
    ]);

    const totalNotifs = notificacoesRows.filter((n: any) =>
      categoriaHabilitadaPorPreferencia(
        {
          tipo: n.tipo,
          titulo: n.titulo,
          mensagem: n.mensagem,
          link: n.link,
        },
        prefs
      )
    ).length;
        const solicitacoesCount = prefs.notifTreinos ? pendSolic : 0;
        const mensagensCount = prefs.notifMensagens ? unreadMsgs : 0;
        const notificacoesCount = totalNotifs;
        const totalNotificacoes = notificacoesCount + solicitacoesCount;

        return res.json({
          totalNotificacoes,
          notificacoes: notificacoesCount,
          solicitacoes: solicitacoesCount,
          total: totalNotificacoes,
          mensagens: mensagensCount,
        });

      } catch (e) {
        console.error("getBadge error:", e);
        return res.json({
          totalNotificacoes: 0,
          notificacoes: 0,
          solicitacoes: 0,
          total: 0,
          mensagens: 0,
        });
      }
    }

export async function recomputeAndEmitBadge(userId: string) {
  const prefs = await getNotifPrefs(userId);
  const [pendSolic, unreadMsgs, notificacoesRows] = await Promise.all([
    prisma.solicitacaoTreino.count({
      where: {
        destinatarioId: userId,
        OR: [
          { status: null },
          { status: { in: ["Pendente","pendente","Aguardando","aguardando","Pending","pending"] } },
        ],
      },
    }),
    prisma.mensagem.count({ where: { paraId: userId, lida: false } }),
    prisma.notificacao.findMany({
      where: { usuarioId: userId, lida: false },
      select: {
        tipo: true,
        titulo: true,
        mensagem: true,
        link: true,
      },
    }),
  ]);

  const totalNotifs = notificacoesRows.filter((n: any) =>
    categoriaHabilitadaPorPreferencia(
      {
        tipo: n.tipo,
        titulo: n.titulo,
        mensagem: n.mensagem,
        link: n.link,
      },
      prefs
    )
  ).length;

  const solicitacoesCount = prefs.notifTreinos ? pendSolic : 0;
  const mensagensCount = prefs.notifMensagens ? unreadMsgs : 0;

  getIO()?.to(userId).emit("badge:update", {
    totalNotificacoes: totalNotifs + solicitacoesCount,
    notificacoes: totalNotifs,
    solicitacoes: solicitacoesCount,
    mensagens: mensagensCount,
  });
}

export async function deletarNotificacao(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const del = await prisma.notificacao.deleteMany({
      where: { id, usuarioId: userId },
    });

    if (!del.count) {
      await recomputeAndEmitBadge(userId);
      return res.status(404).json({ error: "Notificação não encontrada" });
    }

    await recomputeAndEmitBadge(userId);

    return res.json({ ok: true });
  } catch (e) {
    console.error("[deletarNotificacao]", e);
    return res.status(500).json({ error: "Erro ao deletar notificação" });
  }
}

export async function deletarNotificacoesEmLote(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : [];

    const ids = idsRaw
      .map((id: any) => String(id || "").trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: "Nenhuma notificação selecionada." });
    }

    const del = await prisma.notificacao.deleteMany({
      where: {
        usuarioId: userId,
        id: { in: ids },
      },
    });

    await recomputeAndEmitBadge(userId);

    return res.json({
      ok: true,
      deleted: del.count,
    });
  } catch (e) {
    console.error("[deletarNotificacoesEmLote]", e);
    return res.status(500).json({ error: "Erro ao deletar notificações." });
  }
}

export async function marcarTodasComoLidas(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    await prisma.notificacao.updateMany({
      where: { usuarioId: userId, lida: false },
      data: { lida: true },
    });

    await recomputeAndEmitBadge(userId);

    return res.json({ ok: true });
  } catch (e) {
    console.error("[marcarTodasComoLidas]", e);
    return res.status(500).json({ error: "Erro ao marcar notificações como lidas." });
  }
}

export async function getPushPublicKey(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY || "";

    if (!publicKey) {
      return res.status(500).json({
        message: "VAPID_PUBLIC_KEY não configurada no servidor.",
      });
    }

    return res.json({ publicKey });
  } catch (e: any) {
    return sendError(res, e, "Erro ao carregar chave pública de push.");
  }
}

export async function salvarPushSubscription(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = req.userId;
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const subscription = req.body?.subscription || req.body;
    const endpoint = String(subscription?.endpoint || "").trim();
    const p256dh = String(subscription?.keys?.p256dh || "").trim();
    const auth = String(subscription?.keys?.auth || "").trim();

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({
        message: "Subscription inválida.",
      });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        usuarioId,
        endpoint,
        p256dh,
        auth,
        userAgent: String(req.body?.userAgent || req.headers["user-agent"] || ""),
        platform: String(req.body?.platform || ""),
      },
      update: {
        usuarioId,
        p256dh,
        auth,
        userAgent: String(req.body?.userAgent || req.headers["user-agent"] || ""),
        platform: String(req.body?.platform || ""),
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    return sendError(res, e, "Erro ao salvar dispositivo para push.");
  }
}

export async function removerPushSubscription(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = req.userId;
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const endpoint = String(req.body?.endpoint || "").trim();

    if (!endpoint) {
      return res.status(400).json({
        message: "Endpoint inválido.",
      });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        usuarioId,
        endpoint,
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    return sendError(res, e, "Erro ao remover dispositivo de push.");
  }
}

export async function testarPushAtual(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.userId;

    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const totalSubscriptions = await prisma.pushSubscription.count({
      where: { usuarioId },
    });

    const totalNativeTokens = await prisma.pushDeviceToken.count({
      where: {
        usuarioId,
        ativo: true,
      } as any,
    });

    const totalDispositivos = totalSubscriptions + totalNativeTokens;

    const not = await criarNotificacaoEEnviarPush({
      usuarioId,
      tipo: NotificacaoTipo.GENERICA,
      titulo: "Teste de notificação FootEra",
      mensagem:
        "Se você recebeu isso, as notificações push estão funcionando neste dispositivo.",
      link: "/notificacoes",
    });

    return res.json({
      ok: true,
      message: "Notificação de teste criada/enviada.",
      notificacaoId: not.id,
      pushSubscriptions: totalSubscriptions,
      nativePushTokens: totalNativeTokens,
      totalDispositivos,
      aviso:
        totalDispositivos > 0
          ? "Existe dispositivo cadastrado para push."
          : "Nenhum dispositivo push cadastrado para este usuário. A notificação interna foi criada, mas o push do sistema pode não aparecer.",
    });
  } catch (e: any) {
    console.error("[testarPushAtual]", e);

    return res.status(500).json({
      ok: false,
      message: "Erro ao testar push.",
    });
  }
}

export async function getPushStatusAtual(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.userId;

    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    const endpoint = String(req.query.endpoint || "").trim();

    const totalWeb = await prisma.pushSubscription.count({
      where: {
        usuarioId,
        ...(endpoint ? { endpoint } : {}),
      },
    });

    const totalNative = await prisma.pushDeviceToken.count({
      where: {
        usuarioId,
        ativo: true,
      } as any,
    });

    const totalDispositivos = totalWeb + totalNative;

    return res.json({
      ok: true,
      endpointInformado: !!endpoint,
      deviceSaved: totalDispositivos > 0,
      total: totalWeb,
      pushSubscriptions: totalWeb,
      nativePushTokens: totalNative,
      totalDispositivos,
    });
  } catch (e: any) {
    console.error("[getPushStatusAtual]", e);

    return res.status(500).json({
      ok: false,
      message: "Erro ao verificar status do dispositivo push.",
    });
  }
}

export async function salvarPushNativeToken(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.userId;
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado." });

    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "android").trim();

    if (!token) {
      return res.status(400).json({ message: "Token FCM inválido." });
    }

    await prisma.pushDeviceToken.upsert({
      where: { token },
      create: {
        usuarioId,
        token,
        platform,
        ativo: true,
        userAgent: String(req.headers["user-agent"] || ""),
      } as any,
      update: {
        usuarioId,
        platform,
        ativo: true,
        userAgent: String(req.headers["user-agent"] || ""),
      } as any,
    });

    const totalNativeTokens = await prisma.pushDeviceToken.count({
      where: {
        usuarioId,
        ativo: true,
      } as any,
    });

    console.log("[fcm] token nativo salvo", {
      usuarioId,
      platform,
      totalNativeTokens,
      tokenStart: token.slice(0, 16),
    });

    return res.json({
      ok: true,
      nativePushTokens: totalNativeTokens,
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao salvar token FCM.");
  }
}

export async function removerPushNativeToken(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = req.userId;
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado." });

    const token = String(req.body?.token || "").trim();

    if (!token) {
      return res.status(400).json({ message: "Token FCM inválido." });
    }

    await prisma.pushDeviceToken.updateMany({
      where: { usuarioId, token },
      data: { ativo: false } as any,
    });

    return res.json({ ok: true });
  } catch (e: any) {
    return sendError(res, e, "Erro ao remover token FCM.");
  }
}

async function enviarPushNativoParaUsuario(params: {
  usuarioId: string;
  titulo: string;
  mensagem: string;
  link?: string | null;
  tipo?: string | null;
  notificacaoId?: string | null;
}) {
  if (!configurarFirebaseAdmin()) return;

  const prefs = await getNotifPrefs(params.usuarioId);

  if (
    !categoriaHabilitadaPorPreferencia(
      {
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        link: params.link,
      },
      prefs
    )
  ) {
    return;
  }

  const devices = await prisma.pushDeviceToken.findMany({
    where: {
      usuarioId: params.usuarioId,
      ativo: true,
    } as any,
  });

  const tokens = devices.map((d: any) => d.token).filter(Boolean);

  if (!tokens.length) {
    console.log("[fcm] usuário sem token nativo cadastrado", {
      usuarioId: params.usuarioId,
      tipo: params.tipo,
    });
    return;
  }

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: params.titulo || "FootEra",
      body: params.mensagem || "Você tem uma nova notificação.",
    },
    data: {
      url: params.link || "/notificacoes",
      link: params.link || "/notificacoes",
      tipo: params.tipo || "NOTIFICACAO",
      notificacaoId: params.notificacaoId || "",
    },
    android: {
      priority: "high",
      notification: {
        channelId: "footera_default",
      },
    },
  });

  console.log("[fcm] envio concluído", {
    usuarioId: params.usuarioId,
    tipo: params.tipo,
    totalTokens: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
  });

  await Promise.all(
    response.responses.map(async (r: SendResponse, index: number) => {
      if (r.success) return;

      const code = r.error?.code || "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        await prisma.pushDeviceToken.updateMany({
          where: { token: tokens[index] } as any,
          data: { ativo: false } as any,
        });
      }

      console.warn("[fcm] falha ao enviar token:", {
        token: tokens[index],
        code,
        message: r.error?.message,
      });
    })
  );
}