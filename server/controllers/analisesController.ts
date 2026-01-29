import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function endExclusiveOfDay(d: Date) {
  // início do próximo dia (exclusivo)
  return addDays(startOfDay(d), 1);
}

function assertAdmin(req: Request) {
  const me: any = (req as any).me;
  const isSuperAdmin = (req as any).isSuperAdmin === true;

  if (!me?.id || !isSuperAdmin) {
    const err: any = new Error("Acesso restrito ao administrador.");
    err.status = 403;
    throw err;
  }
}

function parseISODateLocal(v?: string, fallback?: Date) {
  if (!v) return fallback ?? new Date();

  // aceita YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d); // LOCAL (00:00 local)
  }

  // fallback (se vier ISO completo)
  const dt = new Date(v);
  return isNaN(+dt) ? (fallback ?? new Date()) : dt;
}

function monthBounds(isoYYYYMM: string) {
  const [y, m] = isoYYYYMM.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

export async function overview(req: Request, res: Response) {
  try {
    assertAdmin(req);

    const to = parseISODateLocal(String(req.query.to) || undefined, new Date());

    // Janela "até o fim do dia selecionado" (exclusivo no dia seguinte)
    const end = endExclusiveOfDay(to);

    // Rolling windows a partir de "end"
    const from30 = addDays(end, -30);
    const from7  = addDays(end, -7);
    const from24h = new Date(end);
    from24h.setHours(from24h.getHours() - 24);

    const [dau, wau, mau, novos30] = await Promise.all([
      prisma.loginEvent.findMany({
        where: { createdAt: { gte: from24h, lt: end } },
        select: { usuarioId: true },
        distinct: ["usuarioId"],
      }).then(r => r.length),

      prisma.loginEvent.findMany({
        where: { createdAt: { gte: from7, lt: end } },
        select: { usuarioId: true },
        distinct: ["usuarioId"],
      }).then(r => r.length),

      prisma.loginEvent.findMany({
        where: { createdAt: { gte: from30, lt: end } },
        select: { usuarioId: true },
        distinct: ["usuarioId"],
      }).then(r => r.length),

      prisma.usuario.count({ where: { dataCriacao: { gte: from30, lt: end } } }),
    ]);

    const stickiness = mau ? +(wau / mau).toFixed(3) : 0;

    return res.json({
      DAU: dau,
      WAU: wau,
      MAU: mau,
      stickiness,
      novos30d: novos30,
      range: { from: from30.toISOString(), to: end.toISOString() },
    });
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro no overview");
  }
}

export async function activeUsersSeries(req: Request, res: Response) {
  try {
    assertAdmin(req);

    const fromIn = parseISODateLocal(String(req.query.from) || undefined, addDays(new Date(), -30));
    const toIn   = parseISODateLocal(String(req.query.to) || undefined, new Date());
    const from = startOfDay(fromIn);
    const to = endExclusiveOfDay(toIn);

    const gran = String(req.query.granularity || "day")
      .replace("daily", "day")
      .replace("weekly", "week")
      .replace("monthly", "month");

    const rows = await prisma.$queryRawUnsafe<{ bucket: Date; active: number }[]>(`
      SELECT date_trunc('${gran}', "createdAt") AS bucket,
             COUNT(DISTINCT "usuarioId")::int   AS active
      FROM "LoginEvent"
      WHERE "createdAt" >= $1 AND "createdAt" < $2
      GROUP BY bucket
      ORDER BY bucket
    `, from, to);

    return res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro na série de ativos");
  }
}

export async function engagementSummary(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const from = parseISODateLocal(String(req.query.from) || undefined, addDays(startOfDay(new Date()), -30));
    const to = parseISODateLocal(String(req.query.to) || undefined, startOfDay(new Date()));

    const [posts, comments, likes, msgs, subTreino, subDesafio, treinosAgendados, treinosRealizados] = await Promise.all([
      prisma.postagem.count({ where: { dataCriacao: { gte: from, lt: to } } }),
      prisma.comentario.count({ where: { dataCriacao: { gte: from, lt: to } } }),
      prisma.curtida.count({ where: { createdAt:   { gte: from, lt: to } } }),
      prisma.mensagem.count({ where: { criadaEm:   { gte: from, lt: to } } }),
      prisma.submissaoTreino.count({ where: { criadoEm:{ gte: from, lt: to } } }),
      prisma.submissaoDesafio.count({ where:{ createdAt:{ gte: from, lt: to } } }),
      prisma.treinoAgendado.count({ where: { dataTreino: { gte: from, lt: to } } }),
      prisma.treinoRealizado.count({ where: { createdAt: { gte: from, lt: to } } })
    ]);

    res.json({ posts, comments, likes, messages: msgs, subTreino, subDesafio, treinosAgendados, treinosRealizados });
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro no resumo de engajamento");
  }
}

export async function loginsSummary(req: Request, res: Response) {
  try {
    assertAdmin(req);

    const fromStr = String(req.query.from || "").trim();
    const toStr = String(req.query.to || "").trim();
    if (!fromStr || !toStr) return res.status(400).send("Informe from=YYYY-MM-DD&to=YYYY-MM-DD");

    const start = startOfDay(new Date(fromStr));
    const end = new Date(toStr);
    end.setHours(23, 59, 59, 999);

    const [total, uniqueUsers] = await Promise.all([
      prisma.loginEvent.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.loginEvent.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { usuarioId: true },
        distinct: ["usuarioId"],
      }),
    ]);

    return res.json({
      totalLogins: total,
      uniqueUsers: uniqueUsers.length,
    });
  } catch (e: any) {
    return res.status(e.status || 500).send(e.message || "Erro no resumo de logins");
  }
}

export async function engagementSeries(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const metric = String(req.query.metric || "posts");
    const gran = String(req.query.granularity || "daily")
      .replace("daily", "day").replace("weekly","week").replace("monthly","month");
    const from = parseISODateLocal(String(req.query.from) || undefined, addDays(startOfDay(new Date()), -30));
    const to = parseISODateLocal(String(req.query.to) || undefined, startOfDay(new Date()));

    const cfg: Record<string, { table: string; col: string; }> = {
      posts: { table: `"Postagem"`, col: `"dataCriacao"` },
      comments: { table: `"Comentario"`, col: `"dataCriacao"` },
      likes: { table: `"Curtida"`, col: `"createdAt"` },
      messages: { table: `"Mensagem"`, col: `"criadaEm"` },
      subm_treino: { table: `"SubmissaoTreino"`, col: `"criadoEm"` },
      subm_desafio: { table: `"SubmissaoDesafio"`, col: `"createdAt"` },
      treinos_agendados: { table: `"TreinoAgendado"`, col: `"dataTreino"` },
    };
    const c = cfg[metric];
    if (!c) return res.status(400).send("Métrica inválida.");

    const rows = await prisma.$queryRawUnsafe<{ bucket: Date; value: number }[]>(`
      SELECT date_trunc('${gran}', ${c.col}) AS bucket,
             COUNT(*)::int AS value
      FROM ${c.table}
      WHERE ${c.col} IS NOT NULL AND ${c.col} >= $1 AND ${c.col} < $2
      GROUP BY bucket ORDER BY bucket
    `, from, to);

    res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro na série de engajamento");
  }
}

export async function convEscolinha(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const from = parseISODateLocal(String(req.query.from) || undefined, addDays(startOfDay(new Date()), -60));
    const to = parseISODateLocal(String(req.query.to) || undefined, startOfDay(new Date()));

    const rows = await prisma.$queryRaw<{ bucket: Date; novosVinculos: number }[]>`
      SELECT date_trunc('week', "criadoEm") AS bucket,
             COUNT(*)::int AS "novosVinculos"
      FROM "RelacaoTreinamento"
      WHERE "escolinhaId" IS NOT NULL
        AND "criadoEm" >= ${from} AND "criadoEm" < ${to}
      GROUP BY bucket ORDER BY bucket;
    `;
    res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro na conversão via escolinha");
  }
}

export async function convClube(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const from = parseISODateLocal(String(req.query.from) || undefined, addDays(startOfDay(new Date()), -60));
    const to = parseISODateLocal(String(req.query.to) || undefined, startOfDay(new Date()));

    const rows = await prisma.$queryRaw<{ bucket: Date; novosVinculos: number }[]>`
      SELECT date_trunc('week', "criadoEm") AS bucket,
             COUNT(*)::int AS "novosVinculos"
      FROM "RelacaoTreinamento"
      WHERE "clubeId" IS NOT NULL
        AND "criadoEm" >= ${from} AND "criadoEm" < ${to}
      GROUP BY bucket ORDER BY bucket;
    `;
    res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro na conversão via clube");
  }
}

export async function invitesSummary(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const from = parseISODateLocal(String(req.query.from) || undefined, addDays(startOfDay(new Date()), -60));
    const to = parseISODateLocal(String(req.query.to) || undefined, startOfDay(new Date()));

    const rows = await prisma.$queryRaw<{ status: string | null; total: number }[]>`
      SELECT COALESCE(status, 'indefinido') AS status, COUNT(*)::int AS total
      FROM "SolicitacaoVinculo"
      WHERE "criadoEm" >= ${from} AND "criadoEm" < ${to}
      GROUP BY status ORDER BY status;
    `;
    res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro no resumo de convites");
  }
}

export async function activityByUf(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const from = parseISODateLocal(String(req.query.from) || undefined, addDays(startOfDay(new Date()), -30));
    const to = parseISODateLocal(String(req.query.to) || undefined, startOfDay(new Date()));

    const rows = await prisma.$queryRaw<{ uf: string | null; ativos: number }[]>`
      SELECT u."estado" AS uf, COUNT(DISTINCT le."usuarioId")::int AS ativos
      FROM "LoginEvent" le
      JOIN "Usuario" u ON u.id = le."usuarioId"
      WHERE le."createdAt" >= ${from} AND le."createdAt" < ${to}
      GROUP BY u."estado" ORDER BY ativos DESC;
    `;
    res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro no heatmap por UF");
  }
}

export async function newUsersSeries(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const from = parseISODateLocal(String(req.query.from) || undefined, addDays(startOfDay(new Date()), -30));
    const to = parseISODateLocal(String(req.query.to) || undefined, startOfDay(new Date()));

    const rows = await prisma.$queryRaw<{ bucket: Date; novos: number }[]>`
      SELECT date_trunc('day', "dataCriacao") AS bucket,
             COUNT(*)::int AS novos
      FROM "Usuario"
      WHERE "dataCriacao" >= ${from} AND "dataCriacao" < ${to}
      GROUP BY bucket ORDER BY bucket;
    `;

    res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro na série de usuários novos");
  }
}

export async function activeByUserType(req: Request, res: Response) {
  try {
    assertAdmin(req);

    const fromIn = parseISODateLocal(String(req.query.from) || undefined, addDays(new Date(), -30));
    const toIn   = parseISODateLocal(String(req.query.to) || undefined, new Date());

    const from = startOfDay(fromIn);
    const to = endExclusiveOfDay(toIn);

    const rows = await prisma.$queryRaw<{ tipo: string; usuarios: number }[]>`
      SELECT u."tipo"::text AS tipo,
             COUNT(DISTINCT le."usuarioId")::int AS usuarios
      FROM "LoginEvent" le
      JOIN "Usuario" u ON u.id = le."usuarioId"
      WHERE le."createdAt" >= ${from} AND le."createdAt" < ${to}
      GROUP BY u."tipo"
      ORDER BY usuarios DESC;
    `;

    return res.json(rows);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro por tipo de usuário");
  }
}

export async function subscriptionsActive(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const on = String(req.query.on || "").trim(); 
    const { start, end } = on ? monthBounds(on) : monthBounds(new Date().toISOString().slice(0,7));

    const ativos = await prisma.assinatura.count({
      where: {
        startsAt: { lt: end },
        OR: [{ canceledAt: null }, { canceledAt: { gte: start } }],
        ativo: true,
      },
    });

    res.json({ month: on || new Date().toISOString().slice(0,7), ativos });
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro em contratos ativos");
  }
}

export async function subscriptionsChurn(req: Request, res: Response) {
  try {
    assertAdmin(req);
    const fromStr = String(req.query.from || "").trim();
    const toStr   = String(req.query.to   || "").trim(); 
    if (!fromStr || !toStr) return res.status(400).send("Informe from=YYYY-MM&to=YYYY-MM");

    const { start: from } = monthBounds(fromStr);
    const { end: to } = monthBounds(toStr);

    const months = await prisma.$queryRaw<{ m: Date }[]>`
      SELECT date_trunc('month', dd)::date AS m
      FROM generate_series(${from}::timestamp, ${to}::timestamp - interval '1 day', interval '1 month') dd;
    `;

    const out: Array<{ month: string; base: number; cancelados: number; novos: number; churnRate: number }> = [];
    for (const row of months) {
      const m = new Date(row.m);
      const yyyymm = `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,"0")}`;
      const { start: mStart, end: mEnd } = monthBounds(yyyymm);

      const [base, cancelados, novos] = await Promise.all([
        prisma.assinatura.count({
          where: {
            startsAt: { lt: mStart },
            OR: [{ canceledAt: null }, { canceledAt: { gte: mStart } }],
            ativo: true,
          },
        }),
        prisma.assinatura.count({ where: { canceledAt: { gte: mStart, lt: mEnd } } }),
        prisma.assinatura.count({ where: { startsAt: { gte: mStart, lt: mEnd } } }),
      ]);

      out.push({
        month: yyyymm,
        base,
        cancelados,
        novos,
        churnRate: base ? +(cancelados / base).toFixed(4) : 0,
      });
    }

    res.json(out);
  } catch (e: any) {
    res.status(e.status || 500).send(e.message || "Erro no churn de assinaturas");
  }
}
