import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import { canDetailed } from "../services/entitlements.js";
import {
  canPermission,
  type AppPermission,
} from "../services/permissions.js";
import {
  TipoUsuario,
} from "@prisma/client";
import {
  getActiveContext,
} from "../services/activeContext.js";

export function requireCapability(
  capability:
    | "agendamento:pessoal"
    | "agendamento:lote"
    | "templates:criar"
    | "desafios:por_mes"
    | "treinos:por_semana"
    | "perfil:olheiro:consultas_dia"
) {
  const map: Record<string, any> = {
    "agendamento:pessoal": "agendamento.pessoal",
    "agendamento:lote":    "agendamento.lote",
    "templates:criar":     "templates:criar",
    "desafios:por_mes":    "desafios.mes",
    "treinos:por_semana":  "treinos.semana",
    "perfil:olheiro:consultas_dia": "perfisPorDia",
  };

  const key = map[capability] ?? capability;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = (req as any).user || {};
    const result = canDetailed(user, key);
    if (result.ok) return next();
    return res.status(result.http).json({ error: result.reason, capability });
  };
}

export function requirePermission(
  permission: AppPermission,
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const userId =
      String(
        req.userId ??
          (req as any).user?.id ??
          (req as any).authUser?.id ??
          "",
      ).trim();

    if (!userId) {
      return res.status(401).json({
        error: "Não autenticado.",
        code: "UNAUTHENTICATED",
      });
    }

    const permitido =
      await canPermission(
        userId,
        permission,
      );

    if (!permitido) {
      return res.status(403).json({
        error: "Sem permissão.",
        code: "PERMISSION_DENIED",
        permission,
      });
    }

    return next();
  };
}

export function requireOrgSeat(
  getOrgId:
    (
      req: AuthenticatedRequest
    ) =>
      | string
      | null
      | undefined,
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const alvoId =
      String(
        getOrgId(req) ??
        "",
      ).trim();

    const usuarioId =
      String(
        req.userId ??
        (req as any).user?.id ??
        (req as any).authUser?.id ??
        "",
      ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        error:
          "Não autenticado",
      });
    }

    if (!alvoId) {
      return res.status(400).json({
        error:
          "orgId ausente",
      });
    }

    /*
     * Admin global não depende
     * do contexto selecionado.
     */
    const isAdmin =
      await canPermission(
        usuarioId,
        "VER_ADMIN",
      );

    if (isAdmin) {
      return next();
    }

    const contexto =
      await getActiveContext(
        usuarioId,
      );

    if (!contexto) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        error:
          "Nenhum contexto ativo válido.",
      });
    }

    const podeGerenciarTreino =
      await canPermission(
        usuarioId,
        "CRIAR_TREINO",
      );

    if (!podeGerenciarTreino) {
      return res.status(403).json({
        code:
          "PERMISSION_DENIED",

        error:
          "O contexto ativo não possui permissão para trabalhar com treinos.",
      });
    }

    const idsPermitidos =
      new Set<string>();

    /*
     * Professor pessoal.
     */
    if (
      contexto.kind ===
        "PERSONAL" &&
      contexto.tipoUsuario ===
        TipoUsuario.Professor &&
      contexto.tipoUsuarioId
    ) {
      idsPermitidos.add(
        String(
          contexto.tipoUsuarioId
        ),
      );
    }

    /*
     * Organização.
     *
     * Aceitamos tanto o ID da nova
     * Organizacao quanto o ID legado
     * de Clube/Escolinha.
     */
    if (
      contexto.kind ===
      "ORGANIZATION"
    ) {
      if (
        contexto.organizationId
      ) {
        idsPermitidos.add(
          String(
            contexto.organizationId
          ),
        );
      }

      if (
        contexto
          .legacyOrganizationId
      ) {
        idsPermitidos.add(
          String(
            contexto
              .legacyOrganizationId
          ),
        );
      }

      /*
       * Enquanto alguns endpoints antigos
       * ainda mandarem professorId no body,
       * permite o Professor daquele contexto.
       *
       * Na 105.2 os controllers deixarão
       * de depender desse ID vindo do cliente.
       */
      if (
        contexto.tipoUsuario ===
          TipoUsuario.Professor &&
        contexto.tipoUsuarioId
      ) {
        idsPermitidos.add(
          String(
            contexto.tipoUsuarioId
          ),
        );
      }
    }

    if (
      !idsPermitidos.has(
        alvoId,
      )
    ) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_MISMATCH",

        error:
          "O ID informado não pertence ao contexto ativo.",
      });
    }

    return next();
  };
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const userId =
    String(
      req.userId ??
        (req as any).user?.id ??
        (req as any).authUser?.id ??
        "",
    ).trim();

  if (!userId) {
    return res.status(401).json({
      message:
        "Não autenticado.",
    });
  }

  const permitido =
    await canPermission(
      userId,
      "VER_ADMIN",
    );

  if (!permitido) {
    return res.status(403).json({
      message:
        "Acesso restrito a administradores.",
    });
  }

  return next();
}