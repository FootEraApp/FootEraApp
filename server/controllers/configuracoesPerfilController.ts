import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcryptjs";
import { AuthProvider } from "@prisma/client";

function getUserId(req: Request): string | null {
  const r: any = req;
  return r.userId || r.user?.id || r.usuarioId || null;
}

export async function getPrivacidade(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesPrivacidade: true },
    });

    const raw: any =
      u?.configuracoesPrivacidade && typeof u.configuracoesPrivacidade === "object"
        ? u.configuracoesPrivacidade
        : {};

    return res.json({
      perfilVisivel: raw.perfilVisivel ?? true,
      permitirMensagens: raw.permitirMensagens ?? true,
      mostrarEmail: raw.mostrarEmail ?? false,
      mostrarOnline: raw.mostrarOnline ?? true,
    });
  } catch (err) {
    console.error("getPrivacidade erro:", err);
    return res.status(500).json({ message: "Erro ao carregar privacidade." });
  }
}

export async function patchPrivacidade(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { perfilVisivel, permitirMensagens, mostrarEmail, mostrarOnline } = (req.body || {}) as any;
    const next = {
      perfilVisivel: typeof perfilVisivel === "boolean" ? perfilVisivel : undefined,
      permitirMensagens: typeof permitirMensagens === "boolean" ? permitirMensagens : undefined,
      mostrarEmail: typeof mostrarEmail === "boolean" ? mostrarEmail : undefined,
      mostrarOnline: typeof mostrarOnline === "boolean" ? mostrarOnline : undefined,
    };

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesPrivacidade: true },
    });

    const current: any =
      u?.configuracoesPrivacidade && typeof u.configuracoesPrivacidade === "object"
        ? u.configuracoesPrivacidade
        : {};

    const merged = {
      ...current,
      ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)),
    };

    await prisma.usuario.update({
      where: { id: userId },
      data: { configuracoesPrivacidade: merged as any },
    });

    return res.json({
      perfilVisivel: merged.perfilVisivel ?? true,
      permitirMensagens: merged.permitirMensagens ?? true,
      mostrarEmail: merged.mostrarEmail ?? false,
      mostrarOnline: merged.mostrarOnline ?? true,
    });
  } catch (err) {
    console.error("patchPrivacidade erro:", err);
    return res.status(500).json({ message: "Erro ao salvar privacidade." });
  }
}

export async function getNotificacoes(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesNotificacoes: true },
    });

    const raw: any = u?.configuracoesNotificacoes || {};
    return res.json({
      notifMensagens: raw.notifMensagens ?? true,
      notifTreinos: raw.notifTreinos ?? true,
      notifEventos: raw.notifEventos ?? true,
      notifMarketing: raw.notifMarketing ?? false,
    });
  } catch (err) {
    console.error("getNotificacoes erro:", err);
    return res.status(500).json({ message: "Erro ao carregar notificações." });
  }
}

export async function patchNotificacoes(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { notifMensagens, notifTreinos, notifEventos, notifMarketing } = (req.body || {}) as any;

    const next = {
      notifMensagens: typeof notifMensagens === "boolean" ? notifMensagens : undefined,
      notifTreinos: typeof notifTreinos === "boolean" ? notifTreinos : undefined,
      notifEventos: typeof notifEventos === "boolean" ? notifEventos : undefined,
      notifMarketing: typeof notifMarketing === "boolean" ? notifMarketing : undefined,
    };

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesNotificacoes: true },
    });

    const current: any = u?.configuracoesNotificacoes || {};
    const merged = {
      ...current,
      ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)),
    };

    await prisma.usuario.update({
      where: { id: userId },
      data: { configuracoesNotificacoes: merged as any },
    });

    return res.json({
      notifMensagens: merged.notifMensagens ?? true,
      notifTreinos: merged.notifTreinos ?? true,
      notifEventos: merged.notifEventos ?? true,
      notifMarketing: merged.notifMarketing ?? false,
    });
  } catch (err) {
    console.error("patchNotificacoes erro:", err);
    return res.status(500).json({ message: "Erro ao salvar notificações." });
  }
}

export async function trocarSenha(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { senhaAtual, senhaNova } = (req.body || {}) as {
      senhaAtual?: string;
      senhaNova?: string;
    };

    if (!senhaAtual || !senhaNova || senhaNova.length < 8) {
      return res.status(400).json({ message: "Informe senhaAtual e senhaNova (mín 8 chars)." });
    }

    if (senhaAtual === senhaNova) {
      return res.status(400).json({ message: "A senha nova não pode ser igual à senha atual." });
    }
    
    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { senhaHash: true, tokenVersion: true },
    });

    if (!u) return res.status(404).json({ message: "Usuário não encontrado." });

    const ok = await bcrypt.compare(senhaAtual, u.senhaHash);
    if (!ok) return res.status(400).json({ message: "Senha atual inválida." });

    const novoHash = await bcrypt.hash(senhaNova, 10);

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        senhaHash: novoHash,
        tokenVersion: (u.tokenVersion ?? 0) + 1,
        lastLogoutAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    return res.json({ ok: true, message: "Senha alterada com sucesso." });
  } catch (err) {
    console.error("trocarSenha erro:", err);
    return res.status(500).json({ message: "Erro ao trocar senha." });
  }
}

export async function encerrarSessoes(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    const now = new Date();

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        tokenVersion: (u?.tokenVersion ?? 0) + 1,
        lastLogoutAt: now,                        
        lastSeenAt: now,                          
      },
    });

    return res.json({ ok: true, message: "Sessões encerradas. Faça login novamente." });
  } catch (err) {
    console.error("encerrarSessoes erro:", err);
    return res.status(500).json({ message: "Erro ao encerrar sessões." });
  }
}

export async function getGoogleStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        googleSub: true,
        googleEmail: true,
        googlePicture: true,
        googleLinkedAt: true,
        authProvider: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    return res.json({
      linked: !!usuario.googleSub,
      googleEmail: usuario.googleEmail ?? null,
      googlePicture: usuario.googlePicture ?? null,
      googleLinkedAt: usuario.googleLinkedAt ?? null,
      authProvider: usuario.authProvider,
    });
  } catch (err) {
    console.error("getGoogleStatus erro:", err);
    return res.status(500).json({ message: "Erro ao carregar status do Google." });
  }
}

export async function unlinkGoogle(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        googleSub: true,
        authProvider: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    if (!usuario.googleSub) {
      return res.status(400).json({ message: "Sua conta não está vinculada ao Google." });
    }

    // segurança: não deixar conta ficar sem forma de login
    // no seu caso, como senhaHash é obrigatório no schema, tudo bem permitir desvincular.
    const novoProvider =
      usuario.authProvider === AuthProvider.LOCAL_GOOGLE
        ? AuthProvider.LOCAL
        : AuthProvider.LOCAL;

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        googleSub: null,
        googleEmail: null,
        googlePicture: null,
        googleLinkedAt: null,
        authProvider: novoProvider,
      },
    });

    return res.json({
      ok: true,
      message: "Conta Google desvinculada com sucesso.",
    });
  } catch (err) {
    console.error("unlinkGoogle erro:", err);
    return res.status(500).json({ message: "Erro ao desvincular conta Google." });
  }
}