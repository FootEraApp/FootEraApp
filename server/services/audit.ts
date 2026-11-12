import { prisma } from "../prisma.js";
import type { Request } from 'express';

export async function audit(req: Request, p: {
  acao: string;
  entidade?: string;
  entidadeId?: string;
  descricao?: string;
  meta?: any;
}) {
  // @ts-ignore
  const usuarioId = req.user?.id || (req as any).userId;
  if (!usuarioId) return;

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  const ua = req.headers['user-agent'] || '';

  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao: p.acao,
        entidade: p.entidade ?? null,
        entidadeId: p.entidadeId ?? null,
        descricao: p.descricao ?? null,
        ip,
        userAgent: String(ua),
        meta: p.meta ?? undefined,
      },
    });
  } catch (e) {
    console.warn('audit error', e);
  }
}

export async function auditFinanceiroObrigatorio(
  req: Request,
  dados: {
    acao: string;
    entidadeId: string;
    descricao: string;
    meta?: Record<string, string | number | boolean | null>;
  }
): Promise<void> {
  const usuarioId =
    (req as Request & {
      user?: { id?: string };
      userId?: string;
    }).user?.id ??
    (req as Request & { userId?: string }).userId;

  if (!usuarioId) {
    throw new Error("BILLING_AUDITORIA_OPERADOR_AUSENTE");
  }

  const ip = req.ip ?? "";

  const userAgent =
    String(req.headers["user-agent"] ?? "");

  await prisma.logAuditoria.create({
    data: {
      usuarioId,
      acao: dados.acao,
      entidade: "Pagamento",
      entidadeId: dados.entidadeId,
      descricao: dados.descricao,
      ip,
      userAgent,
      meta: dados.meta ?? undefined,
    },
  });
}