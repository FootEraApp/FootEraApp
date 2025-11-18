import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

const prisma = new PrismaClient();

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
