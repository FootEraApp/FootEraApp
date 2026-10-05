import type { Response } from "express";
import type { Periodicidade } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { sendError } from "../utils/httpError.js";
import {
  listarActiveContexts,
  type ActiveContext,
} from "../services/activeContext.js";


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

function getContextoAssinaturaData(
  contexto: ActiveContext
) {
  if (
    contexto.kind ===
    "ORGANIZATION"
  ) {
    return {
      contextoKey:
        contexto.key,

      contextoKind:
        "ORGANIZATION",

      contextoTipo:
        contexto.organizationType
          ? String(
              contexto.organizationType
            )
          : null,

      contextoPerfilId:
        null,

      contextoOrganizacaoId:
        contexto.organizationId ??
        null,

      contextoLegacyOrganizationId:
        contexto
          .legacyOrganizationId ??
        null,
    };
  }

  return {
    contextoKey:
      contexto.key,

    contextoKind:
      "PERSONAL",

    contextoTipo:
      String(
        contexto.role ??
        contexto.tipoUsuario
      ),

    contextoPerfilId:
      contexto.profileId ??
      contexto.tipoUsuarioId ??
      null,

    contextoOrganizacaoId:
      null,

    contextoLegacyOrganizationId:
      null,
  };
}

async function resolverContextoAdmin(
  usuarioId: string,
  contextoKeyRaw: unknown
) {
  const contextoKey =
    String(
      contextoKeyRaw ?? ""
    ).trim();

  if (!contextoKey) {
    const err: any =
      new Error(
        "contextoKey é obrigatório."
      );

    err.status = 400;
    err.statusCode = 400;
    err.code =
      "CONTEXT_KEY_REQUIRED";

    throw err;
  }

  const contextos =
    await listarActiveContexts(
      usuarioId
    );

  const contexto =
    contextos.find(
      (item) =>
        item.key ===
        contextoKey
    );

  if (!contexto) {
    const err: any =
      new Error(
        "O contexto informado não pertence ao usuário."
      );

    err.status = 404;
    err.statusCode = 404;
    err.code =
      "CONTEXT_NOT_FOUND";

    throw err;
  }

  return contexto;
}

async function resolverPlanoAdmin(
  tipoRaw:
    string | null | undefined,
  planoRaw: string
) {
  const plano =
    normPlano(planoRaw);

  if (
    plano === "FREE"
  ) {
    return "FREE";
  }

  const tipo =
    normTipo(
      tipoRaw
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
    contextoKey:
      a.contextoKey ?? null,
    contextoKind:
      a.contextoKind ?? null,
    contextoTipo:
      a.contextoTipo ?? null,
    contextoPerfilId:
      a.contextoPerfilId ?? null,
    contextoOrganizacaoId:
      a.contextoOrganizacaoId ?? null,
    contextoLegacyOrganizationId:
      a.contextoLegacyOrganizationId ?? null,
  };
}

export async function getByUsuario(req: AuthenticatedRequest, res: Response) {
  try {
    const { usuarioId } = req.params;

    const [
      list,
      contextos,
    ] =
      await Promise.all([
        (prisma as any)
          .assinatura
          .findMany({
            where: {
              usuarioId,
            },

            orderBy: {
              startsAt:
                "desc",
            },
          }),

        listarActiveContexts(
          usuarioId
        ),
      ]);

    return res.json({
      items:
        list.map(toDTO),

      contextos:
        contextos.map(
          (contexto) => ({
            key:
              contexto.key,

            kind:
              contexto.kind,

            label:
              contexto.label,

            tipo:
              contexto.kind ===
              "ORGANIZATION"
                ? contexto
                    .organizationType
                : (
                    contexto.role ??
                    contexto.tipoUsuario
                  ),
          })
        ),
    });
  } catch (e: any) {
    console.error("erro getByUsuario:", e);
    sendError(res, e, "Erro ao buscar assinaturas");
  }
}

export async function updatePlano(req: AuthenticatedRequest, res: Response) {
  try {
     const { usuarioId } = req.params;
    const {
      plano,
      periodicidade,
      contextoKey,
    } = req.body || {};

    if (!plano) {
      return res.status(400).send("Informe o plano: FREE, PRO ou LEARNING.");
    }

    const contexto =
      await resolverContextoAdmin(
        usuarioId,
        contextoKey
      );

    const contextoAssinatura =
      getContextoAssinaturaData(
        contexto
      );

    const tipoContexto =
      contexto.kind ===
      "ORGANIZATION"
        ? (
            contexto.organizationType
              ? String(
                  contexto.organizationType
                )
              : null
          )
        : String(
            contexto.role ??
            contexto.tipoUsuario
          );

    const planoFinal = await resolverPlanoAdmin(tipoContexto, plano);
    const per: Periodicidade = (periodicidade as Periodicidade) || "Mensal";

    const now = new Date();
    const months = per === "Mensal" ? 1 : 12;
    const renovaEm = addMonths(now, months);

    await (prisma as any).assinatura.updateMany({
      where: {
        usuarioId,
        contextoKey:
          contextoAssinatura
            .contextoKey,
        ativo:
          true,
      },
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
        usuarioId_plano_contextoKey:
          {
            usuarioId,

            plano:
              planoFinal,

            contextoKey:
              contextoAssinatura
                .contextoKey,
          },
      },
      update: {
        ...contextoAssinatura,
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
        ...contextoAssinatura,
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
    const { usuarioId } = req.params;
    const {
      planoId,
      contextoKey,
    } = req.body || {};

    const contexto =
      await resolverContextoAdmin(
        usuarioId,
        contextoKey
      );

    const contextoAssinatura =
      getContextoAssinaturaData(
        contexto
      );
    const now = new Date();

    if (planoId) {
      const plano = normPlano(planoId);
      await (prisma as any).assinatura.updateMany({
        where: {
          usuarioId,
          contextoKey:
            contextoAssinatura
              .contextoKey,
          plano,
          ativo:
            true,
        },
        data: { ativo: false, canceledAt: now, status: "BLOQUEADA", bloqueadoEm: now } as any,
      });
      return res.json({ ok: true });
    }

    await (prisma as any).assinatura.updateMany({
      where: {
        usuarioId,
        contextoKey:
          contextoAssinatura
            .contextoKey,
        ativo:
          true,
      },
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
    const { usuarioId } = req.params;
    const {
      plano,
      periodicidade,
      contextoKey,
    } = req.body || {};
    if (!plano) return res.status(400).send("Informe o plano para reativar.");

    const contexto =
      await resolverContextoAdmin(
        usuarioId,
        contextoKey
      );

    const contextoAssinatura =
      getContextoAssinaturaData(
        contexto
      );

    const tipoContexto =
      contexto.kind ===
      "ORGANIZATION"
        ? (
            contexto.organizationType
              ? String(
                  contexto.organizationType
                )
              : null
          )
        : String(
            contexto.role ??
            contexto.tipoUsuario
          );
      
    const planoNorm =
      await resolverPlanoAdmin(
        tipoContexto,
        plano
      );
    if (planoNorm === "FREE") {
      return res.status(400).send("Plano FREE não precisa ser reativado.");
    }

    const per: Periodicidade = (periodicidade as Periodicidade) || "Mensal";

    const now = new Date();
    const months = per === "Mensal" ? 1 : 12;
    const renovaEm = addMonths(now, months);

    const out = await (prisma as any).assinatura.upsert({
      where: {
        usuarioId_plano_contextoKey:
          {
            usuarioId,

            plano:
              planoNorm,

            contextoKey:
              contextoAssinatura
                .contextoKey,
          },
      },
      update: {
        ...contextoAssinatura,
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
        ...contextoAssinatura,
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