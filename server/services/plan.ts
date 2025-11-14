// server/services/plan.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export type Plan = 'Free' | 'Pro' | string;

export async function getUserPlan(userId: string): Promise<Plan> {
  const a = await prisma.assinatura.findUnique({
    where: { usuarioId: userId },
    select: { ativo: true, canceledAt: true, plano: true },
  });
  if (a?.ativo && (!a.canceledAt || a.canceledAt > new Date())) {
    return (a.plano as Plan) || 'Pro';
  }
  return 'Free';
}

// chaves e limites
const INF = Number.POSITIVE_INFINITY;
export const LIMITS: Record<Plan, Record<string, number>> = {
  Free: {
    treinos_semana: 3,
    desafios_mes: 2,
    perfis_vistos_dia: 20,
    treinos_salvos_total: 5,
    planos_ativos_total: 5,
    templates_total: 10,
    listas_salvas_total: 2,
  },
  Pro: {
    treinos_semana: INF,
    desafios_mes: INF,
    perfis_vistos_dia: 200,
    treinos_salvos_total: INF,
    planos_ativos_total: 1000,
    templates_total: 500,
    listas_salvas_total: INF,
  },
};

export function planLimitFor(plan: Plan, key: string): number {
  const p = LIMITS[plan] ?? LIMITS['Free'];
  return p[key] ?? INF;
}

// capability gate (ex.: agendamento_lote)
export function ensureCapability(req: any, res: any, capability: 'agendamento_lote') {
  const plan: Plan = req.user?.plan || 'Free';
  const allowed =
    capability === 'agendamento_lote'
      ? plan !== 'Free' // só acima do Free
      : true;

  if (!allowed) {
    return res.status(403).json({
      code: 'UPGRADE_REQUIRED',
      message: 'Recurso disponível apenas em planos superiores.',
    });
  }
}
