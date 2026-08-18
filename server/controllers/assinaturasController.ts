import type { Response } from "express";
import type { Periodicidade } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { sendError } from "../utils/httpError.js";

function assertAdmin(req: AuthenticatedRequest) {
  const u: any = req.user || {};
  const tipo = String(u.tipo || u.tipoUsuario || "").toLowerCase();
  const isAdmin =
    (!!u.id && tipo === "admin") ||
    u.isAdmin === true ||
    String(u.role || "").toLowerCase() === "admin";

  if (!isAdmin) {
    const err: any = new Error("Acesso restrito ao administrador.");
    err.status = 403;
    throw err;
  }
}

function normPlano(p: string) {
  return String(p || "").trim().toUpperCase();
}

function normTipo(tipoRaw: string | null | undefined) {
  return String(tipoRaw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isTipoLearningEspecial(
  tipoRaw:
    | string
    | null
    | undefined
) {
  const tipo =
    normTipo(tipoRaw);

  return (
    tipo === "marca" ||
    tipo === "federacao" ||
    tipo === "learning"
  );
}

async function resolverPlanoAdmin(
  usuarioId: string,
  planoRaw: string
) {
  const plano =
    normPlano(planoRaw);

  if (
    plano === "FREE"
  ) {
    return "FREE";
  }

  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },

      select: {
        tipo: true,
      },
    });

  const tipo =
    normTipo(
      usuario?.tipo as
        | string
        | null
        | undefined
    );

  if (
    isTipoLearningEspecial(
      tipo
    )
  ) {
    if (
      plano === "LEARNING" ||
      plano === "LEARNING_3"
    ) {
      return "LEARNING_3";
    }

    const err: any =
      new Error(
        "Usuários do tipo Learning, Marca ou Federação podem receber somente o plano Learning."
      );

    err.status = 403;
    err.statusCode = 403;
    err.code =
      "PLAN_NOT_ALLOWED_FOR_USER_TYPE";

    throw err;
  }

  if (
    plano === "LEARNING_3"
  ) {
    const err: any =
      new Error(
        "O plano LEARNING_3 é exclusivo para Learning, Marca e Federação."
      );

    err.status = 403;
    err.statusCode = 403;
    err.code =
      "PLAN_NOT_ALLOWED_FOR_USER_TYPE";

    throw err;
  }

  if (
    plano === "PRO"
  ) {
    if (
      tipo === "atleta"
    ) {
      return "ATLETA_PRO";
    }

    if (
      tipo === "professor"
    ) {
      return "PROFESSOR_PRO";
    }

    if (
      tipo === "clube" ||
      tipo === "escolinha" ||
      tipo === "escola"
    ) {
      return "ORGANIZACOES_PRO";
    }

    if (
      tipo === "olheiro"
    ) {
      return "OLHEIRO_PRO";
    }
  }

  if (
    plano === "LEARNING"
  ) {
    if (
      tipo === "atleta"
    ) {
      return "ATLETA_LEARNING_1";
    }

    if (
      tipo === "professor"
    ) {
      return "PROFESSOR_LEARNING_1";
    }

    if (
      tipo === "clube" ||
      tipo === "escolinha" ||
      tipo === "escola"
    ) {
      return "ORGANIZACOES_LEARNING_3";
    }
  }

  return plano;
}

function addMonths(d: Date, months: number) {
  const dt = new Date(d.getTime());
  dt.setMonth(dt.getMonth() + months);
  return dt;
}

function toDTO(a: any) {
  if (!a) return null;
  return {
    id: a.id,
    usuarioId: a.usuarioId,
    plano: a.plano,
    periodicidade: a.periodicidade ?? null,
    status: a.status ?? null,
    startsAt: a.startsAt?.toISOString?.() ?? a.startsAt,
    renovaEm: a.renovaEm?.toISOString?.() ?? a.renovaEm ?? null,
    trialStartsAt: a.trialStartsAt?.toISOString?.() ?? a.trialStartsAt ?? null,
    trialEndsAt: a.trialEndsAt?.toISOString?.() ?? a.trialEndsAt ?? null,
    canceledAt: a.canceledAt ? (a.canceledAt?.toISOString?.() ?? a.canceledAt) : null,
    ativo: !!a.ativo,
  };
}

export async function getByUsuario(req: AuthenticatedRequest, res: Response) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;

    const list = await (prisma as any).assinatura.findMany({
      where: { usuarioId },
      orderBy: { startsAt: "desc" },
    });

    res.json({ items: list.map(toDTO) });
  } catch (e: any) {
    console.error("erro getByUsuario:", e);
    sendError(res, e, "Erro ao buscar assinaturas");
  }
}

export async function updatePlano(req: AuthenticatedRequest, res: Response) {
  try {
    assertAdmin(req);

    const { usuarioId } = req.params;
    const { plano, periodicidade } = req.body || {};

    if (!plano) {
      return res.status(400).send("Informe o plano: FREE, PRO ou LEARNING.");
    }

    const planoFinal = await resolverPlanoAdmin(usuarioId, plano);
    const per: Periodicidade = (periodicidade as Periodicidade) || "Mensal";

    const now = new Date();
    const months = per === "Mensal" ? 1 : 12;
    const renovaEm = addMonths(now, months);

    await (prisma as any).assinatura.updateMany({
      where: { usuarioId, ativo: true },
      data: {
        ativo: false,
        canceledAt: now,
        status: "BLOQUEADA",
        bloqueadoEm: now,
      } as any,
    });

    if (planoFinal === "FREE") {
      return res.json({
        id: null,
        usuarioId,
        plano: "FREE",
        periodicidade: per,
        status: "FREE",
        startsAt: now.toISOString(),
        renovaEm: null,
        canceledAt: now.toISOString(),
        ativo: false,
      });
    }

    const updated = await (prisma as any).assinatura.upsert({
      where: {
        usuarioId_plano: {
          usuarioId,
          plano: planoFinal,
        },
      },
      update: {
        periodicidade: per,
        status: "ATIVA",
        ativo: true,
        startsAt: now,
        renovaEm,
        canceledAt: null,
        bloqueadoEm: null,
        trialStartsAt: null,
        trialEndsAt: null,
        lembreteEnviado: false,
      } as any,
      create: {
        usuarioId,
        plano: planoFinal,
        periodicidade: per,
        startsAt: now,
        renovaEm,
        ativo: true,
        status: "ATIVA",
        canceledAt: null,
        bloqueadoEm: null,
        lembreteEnviado: false,
      } as any,
    });

    res.json(toDTO(updated));
  } catch (e: any) {
    console.error("erro updatePlano:", e);
    sendError(res, e, "Erro ao atualizar assinatura");
  }
}

export async function cancelar(req: AuthenticatedRequest, res: Response) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const { planoId } = req.body || {};
    const now = new Date();

    if (planoId) {
      const plano = normPlano(planoId);
      await (prisma as any).assinatura.updateMany({
        where: { usuarioId, plano, ativo: true },
        data: { ativo: false, canceledAt: now, status: "BLOQUEADA", bloqueadoEm: now } as any,
      });
      return res.json({ ok: true });
    }

    await (prisma as any).assinatura.updateMany({
      where: { usuarioId, ativo: true },
      data: { ativo: false, canceledAt: now, status: "BLOQUEADA", bloqueadoEm: now } as any,
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("erro cancelar:", e);
    sendError(res, e, "Erro ao cancelar assinatura(s)");
  }
}

export async function reativar(req: AuthenticatedRequest, res: Response) {
  try {
    assertAdmin(req);
    const { usuarioId } = req.params;
    const { plano, periodicidade } = req.body || {};
    if (!plano) return res.status(400).send("Informe o plano para reativar.");

    const planoNorm = await resolverPlanoAdmin(usuarioId, plano);
    if (planoNorm === "FREE") {
      return res.status(400).send("Plano FREE não precisa ser reativado.");
    }

    const per: Periodicidade = (periodicidade as Periodicidade) || "Mensal";

    const now = new Date();
    const months = per === "Mensal" ? 1 : 12;
    const renovaEm = addMonths(now, months);

    const out = await (prisma as any).assinatura.upsert({
      where: { usuarioId_plano: { usuarioId, plano: planoNorm } },
      update: {
        ativo: true,
        canceledAt: null,
        bloqueadoEm: null,
        status: "ATIVA",
        periodicidade: per,
        startsAt: now,
        renovaEm,
        trialStartsAt: null,
        trialEndsAt: null,
      } as any,
      create: {
        usuarioId,
        plano: planoNorm,
        periodicidade: per,
        startsAt: now,
        renovaEm,
        ativo: true,
        canceledAt: null,
        status: "ATIVA",
        lembreteEnviado: false,
      } as any,
    });

    res.json(toDTO(out));
  } catch (e: any) {
    console.error("erro reativar:", e);
    sendError(res, e, "Erro ao reativar assinatura");
  }
}