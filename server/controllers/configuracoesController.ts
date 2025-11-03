// server/controllers/configuracoesController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const getConfiguracoes = async (req: Request, res: Response) => {
  try {
    let config = await prisma.configuracaoSistema.findFirst();

    if (!config) {
      config = await prisma.configuracaoSistema.create({
        data: {
          registrationEnabled: true,
          maintenanceMode: false,
          allowAthleteChallenges: true,
          allowProfileEditing: true,
          maxDailyPosts: 5,
        },
      });
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar configurações", err });
  }
};

export const atualizarConfiguracoes = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const config = await prisma.configuracaoSistema.findFirst();

    if (!config) return res.status(404).json({ message: "Configuração não encontrada" });

    const atualizada = await prisma.configuracaoSistema.update({
      where: { id: config.id },
      data,
    });

    res.json(atualizada);
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar configurações", err });
  }
};

function extractUserId(req: Request): string | null {
  const r: any = req;
  if (r.user?.id) return r.user.id;
  if (r.usuarioId) return r.usuarioId;
  if (r.usuario?.id) return r.usuario.id;
  if (r.auth?.id) return r.auth.id;
  if (r.userId) return r.userId;

  const raw = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  if (!raw) return null;
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  try {
    const payload: any = jwt.verify(token, process.env.JWT_SECRET || "");
    return payload?.id || payload?.sub || null;
  } catch {
    return null;
  }
}

export const excluirConta = async (req: Request, res: Response) => {
  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { confirm } = (req.body || {}) as { confirm?: string };
    const REQUIRED = "Excluir Conta Footera";
    if (!confirm || confirm.trim() !== REQUIRED) {
      return res.status(400).json({
        message: `Confirmação inválida. Digite exatamente "${REQUIRED}".`,
      });
    }

    // 1) Desvincular reposts que apontem para posts do usuário
    const posts = await prisma.postagem.findMany({
      where: { usuarioId: userId },
      select: { id: true },
    });
    const postIds = posts.map((p) => p.id);

    await prisma.$transaction(async (tx) => {
      if (postIds.length) {
        await tx.postagem.updateMany({
          where: { repostOfId: { in: postIds } },
          data: { repostOfId: null },
        });
      }
      // 2) Excluir usuário (demais “filhos” dependem do seu onDelete no schema)
      await tx.usuario.delete({ where: { id: userId } });
    });

    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === "P2003") {
      return res.status(409).json({
        message:
          "Não foi possível excluir a conta por vínculos pendentes. Ajuste onDelete/SetNull nas FKs ou apague dependências antes.",
        err: String(err?.meta?.field_name || err),
      });
    }
    console.error("excluirConta erro:", err);
    return res.status(500).json({ message: "Não foi possível excluir a conta.", err: String(err) });
  }
};
