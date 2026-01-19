import type { Response } from "express";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest, AuthUser } from "../middlewares/auth.js";


function assertAdmin(req: AuthenticatedRequest) {
  const u: AuthUser | undefined = req.authUser;

  if (!u) {
    const err: any = new Error("Usuário não autenticado.");
    err.status = 401;
    throw err;
  }

  const tipoStr = String(u.tipo || "").toLowerCase();
  const isAdmin = u.isAdmin === true || tipoStr === "admin";

  if (!isAdmin) {
    const err: any = new Error("Apenas administradores podem acessar esta rota.");
    err.status = 403;
    throw err;
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.authUser;

    if (!user?.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const { tipo, mensagem } = (req.body || {}) as {
      tipo?: string;
      mensagem?: string;
    };

    const tipoTrim = String(tipo || "").trim().toLowerCase();
    const msgTrim = String(mensagem || "").trim();

    if (!msgTrim) {
      return res
        .status(400)
        .json({ message: "Mensagem de feedback não pode estar vazia." });
    }

    const tipoValido =
      tipoTrim === "sugestao" || tipoTrim === "bug" || tipoTrim === "outro";

    const feedback = await prisma.feedback.create({
      data: {
        usuarioId: user.id,
        tipo: tipoValido ? tipoTrim : "outro",
        mensagem: msgTrim,
      },
    });

    return res.status(201).json(feedback);
  } catch (err: any) {
    console.error("Erro ao criar feedback:", err);
    const status = err?.status || 500;
    return res
      .status(status)
      .json({ message: err?.message || "Erro ao enviar feedback." });
  }
}

export async function listMine(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.authUser;

    if (!user?.id) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const feedbacks = await prisma.feedback.findMany({
      where: { usuarioId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return res.json(feedbacks);
  } catch (err: any) {
    console.error("Erro ao listar feedbacks do usuário:", err);
    return res
      .status(500)
      .json({ message: "Erro ao carregar seus feedbacks." });
  }
}

export async function listAll(req: AuthenticatedRequest, res: Response) {
  try {
    assertAdmin(req);

    const { tipo, from, to } = req.query;
    const where: any = {};

    if (typeof tipo === "string" && tipo.trim()) {
      where.tipo = tipo.trim().toLowerCase();
    }

    if (typeof from === "string" && from.trim()) {
      const d = new Date(from.trim());
      if (!where.createdAt) where.createdAt = {};
      where.createdAt.gte = d;
    }

    if (typeof to === "string" && to.trim()) {
      const d = new Date(to.trim() + "T23:59:59.999Z");
      if (!where.createdAt) where.createdAt = {};
      where.createdAt.lte = d;
    }

    const feedbacks = await prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        usuario: {
          select: {
            id: true,
            nomeDeUsuario: true,
            nome: true,
            email: true,
            tipo: true,
          },
        },
      },
    });

    return res.json(feedbacks);
  } catch (err: any) {
    console.error("Erro ao listar feedbacks (admin):", err);
    const status = err?.status || 500;
    return res
      .status(status)
      .json({ message: err?.message || "Erro ao carregar feedbacks." });
  }
}

export async function marcarComoLido(req: AuthenticatedRequest, res: Response) {
  try {
    assertAdmin(req);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID do feedback é obrigatório." });
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        lidoEm: new Date(),
      },
    });

    return res.json(feedback);
  } catch (err: any) {
    console.error("Erro ao marcar feedback como lido:", err);

    if (err?.code === "P2025") {
      return res.status(404).json({ message: "Feedback não encontrado." });
    }

    const status = err?.status || 500;
    return res
      .status(status)
      .json({ message: err?.message || "Erro ao atualizar feedback." });
  }
}
