import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcryptjs";

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
      // ✅ FALTAVA ISSO:
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
      // ✅ novo:
      mostrarOnline: typeof mostrarOnline === "boolean" ? mostrarOnline : undefined,
    };

    // merge com o que já existe
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
      // ✅ novo:
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

/** =========================
 *  SEGURANÇA: trocar senha
 *  PUT /seguranca/senha
 *  body: { senhaAtual, senhaNova }
 *  ========================= */
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

    // ✅ troca senha e derruba sessões antigas
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        senhaHash: novoHash,
        tokenVersion: (u.tokenVersion ?? 0) + 1,
      },
    });

    return res.json({ ok: true, message: "Senha alterada com sucesso." });
  } catch (err) {
    console.error("trocarSenha erro:", err);
    return res.status(500).json({ message: "Erro ao trocar senha." });
  }
}

/** =========================
 *  SEGURANÇA: encerrar sessões
 *  POST /seguranca/encerrar-sessoes
 *  incrementa tokenVersion -> invalida qualquer token antigo
 *  ========================= */
export async function encerrarSessoes(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    await prisma.usuario.update({
      where: { id: userId },
      data: { tokenVersion: (u?.tokenVersion ?? 0) + 1 },
    });

    return res.json({ ok: true, message: "Sessões encerradas. Faça login novamente." });
  } catch (err) {
    console.error("encerrarSessoes erro:", err);
    return res.status(500).json({ message: "Erro ao encerrar sessões." });
  }
}