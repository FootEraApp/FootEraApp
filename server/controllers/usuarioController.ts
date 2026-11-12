// server/controllers/usuarioController
import {
  Request,
  Response,
} from "express";
import {
  TipoUsuario,
  StatusResponsavelAtleta,
} from "@prisma/client";
import {
  prisma,
} from "../prisma.js";
import {
  getActiveContext,
  listarActiveContexts,
} from "../services/activeContext.js";

export async function getPresenca(req: any, res: any) {
  const { id } = req.params;

  const u = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, lastSeenAt: true, lastLoginAt: true, lastLogoutAt: true, nome: true, tipo: true },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado." });

  const now = Date.now();
  const lastSeen = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
  const ONLINE_WINDOW_MS = 45_000;
  const isOnline = lastSeen && (now - lastSeen) <= ONLINE_WINDOW_MS;

  return res.json({
    usuarioId: u.id,
    isOnline,
    lastSeenAt: u.lastSeenAt,
    lastLoginAt: u.lastLoginAt,
    lastLogoutAt: u.lastLogoutAt,
  });
}

export const getUsuarioPorId = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        foto: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.json(usuario);
  } catch (error) {
    console.error("Erro ao buscar usuário por ID:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getUsuarioChallenges = async (req: Request, res: Response) => {
  const { id } = req.params; 
  try {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      select: { id: true }
    });
    if (!atleta) return res.json([]); 

    const submissoes = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true },
      include: { desafio: true },
      orderBy: { createdAt: "desc" }
    });

    const completed = submissoes.map(s => ({
      id: s.id,
      status: "completed",
      pointsEarned: s.desafio?.pontuacao ?? s.desafio?.pontuacao ?? 0,
      submittedAt: s.createdAt?.toISOString(),
      challenge: {
        id: s.desafio?.id || "",
        title: s.desafio?.titulo || "Desafio",
        category: s.desafio?.nivel || "Geral",
        ageGroup: s.desafio?.categoria || "Livre",
        pointsValue: s.desafio?.pontuacao ?? s.desafio?.pontuacao ?? 0,
        expiresAt: s.desafio?.prazoSubmissao ? new Date(s.desafio.prazoSubmissao).toISOString() : new Date(Date.now() + 7*864e5).toISOString()
      }
    }));

    const idsCompletos = new Set(submissoes.map(s => s.desafioId).filter(Boolean) as string[]);
    const abertos = await prisma.desafioOficial.findMany({
      where: { id: { notIn: Array.from(idsCompletos) } },
      take: 5,
      orderBy: { createdAt: "desc" }
    });

    const pending = abertos.map(d => ({
      id: `pending-${d.id}`,
      status: "pending",
      challenge: {
        id: d.id,
        title: d.titulo,
        category: d.nivel || "Geral",
        ageGroup: d.categoria || "Livre",
        pointsValue: d.pontuacao ?? d.pontuacao ?? 0,
        expiresAt: d.prazoSubmissao ? new Date(d.prazoSubmissao).toISOString() : new Date(Date.now() + 7*864e5).toISOString()
      }
    }));

    return res.json([...pending, ...completed]);
  } catch (error) {
    console.error("Erro ao buscar desafios do usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getUsuarioParceiro = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const authUserId =
      (req as any).user?.id ||
      (req as any).userId ||
      (req as any).usuarioId ||
      null;

    const authUserTipo =
      (req as any).user?.tipo ||
      (req as any).tipo ||
      null;

    const isAdmin = authUserTipo === "Admin" || authUserTipo === "ADMIN";

    if (!authUserId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    if (authUserId !== id && !isAdmin) {
      return res.status(403).json({ error: "Sem permissão para consultar este usuário" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        parceiro: true,
        parceiroInfo: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.json({
      id: usuario.id,
      parceiro: usuario.parceiro,
      parceiroInfo: usuario.parceiroInfo ?? null,
    });
  } catch (error) {
    console.error("Erro ao verificar parceiro:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getUsuarioAssinatura =
  async (
    req: Request,
    res: Response
  ) => {
    const { id } =
      req.params;

    try {
      const authUserId =
        (req as any).user?.id ||
        (req as any).userId ||
        (req as any).usuarioId ||
        null;

      const authUserTipo =
        (req as any).user?.tipo ||
        (req as any).tipo ||
        null;

      const isAdmin =
        authUserTipo ===
          "Admin" ||
        authUserTipo ===
          "ADMIN" ||
        authUserTipo ===
          "administrador" ||
        authUserTipo ===
          "ADMINISTRADOR";

      if (!authUserId) {
        return res
          .status(401)
          .json({
            error:
              "Não autenticado",
          });
      }

      const atletaIdQuery =
        String(
          req.query
            ?.atletaId ??
          ""
        ).trim();

      let usuarioAlvoId =
        String(id);

      let contexto:
        Awaited<
          ReturnType<
            typeof getActiveContext
          >
        > =
        null;

      let consultaComoResponsavel =
        false;

      /*
       * RESPONSÁVEL CONSULTANDO
       * A ASSINATURA DO ATLETA.
       */
      if (atletaIdQuery) {
        const contextoResponsavel =
          await getActiveContext(
            String(
              authUserId
            )
          );

        if (
          contextoResponsavel
            ?.kind !==
            "PERSONAL" ||
          contextoResponsavel
            .tipoUsuario !==
            TipoUsuario
              .Responsavel
        ) {
          return res
            .status(403)
            .json({
              code:
                "RESPONSAVEL_CONTEXT_REQUIRED",

              error:
                "Use o perfil de Responsável para consultar este atleta.",
            });
        }

        const vinculo =
          await prisma
            .responsavelAtleta
            .findUnique({
              where: {
                responsavelUsuarioId_atletaId:
                  {
                    responsavelUsuarioId:
                      String(
                        authUserId
                      ),

                    atletaId:
                      atletaIdQuery,
                  },
              },

              include: {
                atleta: {
                  select: {
                    id: true,

                    usuarioId:
                      true,
                  },
                },
              },
            });

        if (
          !vinculo ||
          vinculo.status !==
            StatusResponsavelAtleta
              .ATIVO ||
          vinculo
            .podeGerenciarTreinos !==
            true
        ) {
          return res
            .status(403)
            .json({
              code:
                "ATLETA_ACCESS_DENIED",

              error:
                "Você não possui permissão para consultar este atleta.",
            });
        }

        usuarioAlvoId =
          vinculo.atleta
            .usuarioId;

        /*
         * Não usamos o contexto
         * atualmente selecionado pela
         * criança.
         *
         * Queremos especificamente a
         * assinatura do papel Atleta.
         */
        const contextosAtleta =
          await listarActiveContexts(
            usuarioAlvoId
          );

        contexto =
          contextosAtleta.find(
            (item) =>
              item.kind ===
                "PERSONAL" &&
              item.tipoUsuario ===
                TipoUsuario.Atleta
          ) ??
          null;

        consultaComoResponsavel =
          true;
      } else {
        /*
         * FLUXO NORMAL:
         * usuário consulta a própria
         * assinatura ou Admin consulta.
         */
        if (
          authUserId !== id &&
          !isAdmin
        ) {
          return res
            .status(403)
            .json({
              error:
                "Sem permissão para consultar este usuário",
            });
        }

        contexto =
          await getActiveContext(
            id
          );
      }

      if (!contexto) {
        return res.json({
          hasAssinatura:
            false,

          isPro:
            false,

          reason:
            "NO_ACTIVE_CONTEXT",

          assinatura:
            null,
        });
      }

      const assinatura =
        await prisma
          .assinatura
          .findFirst({
            where: {
              usuarioId:
                usuarioAlvoId,

              contextoKey:
                contexto.key,
            },

            orderBy: [
              {
                ativo:
                  "desc",
              },

              {
                renovaEm:
                  "desc",
              },

              {
                startsAt:
                  "desc",
              },
            ],

            select: {
              id: true,
              usuarioId: true,
              plano: true,
              periodicidade:
                true,
              startsAt: true,
              renovaEm: true,
              canceledAt: true,
              ativo: true,
              status: true,

              trialStartsAt:
                true,

              trialEndsAt:
                true,

              bloqueadoEm:
                true,

              contextoKey:
                true,

              contextoKind:
                true,

              contextoTipo:
                true,

              contextoPerfilId:
                true,

              contextoOrganizacaoId:
                true,

              contextoLegacyOrganizationId:
                true,
            },
          });

      if (!assinatura) {
        return res.json({
          hasAssinatura:
            false,

          isPro:
            false,

          reason:
            "NO_SUBSCRIPTION",

          assinatura:
            null,
        });
      }

      const now =
        new Date();

      if (
        assinatura.bloqueadoEm
      ) {
        return res.json({
          hasAssinatura:
            true,

          isPro:
            false,

          reason:
            "BLOCKED",

          assinatura:
            consultaComoResponsavel
              ? null
              : assinatura,
        });
      }

      if (
        !assinatura.ativo
      ) {
        return res.json({
          hasAssinatura:
            true,

          isPro:
            false,

          reason:
            "INACTIVE",

          assinatura:
            consultaComoResponsavel
              ? null
              : assinatura,
        });
      }

      const renovaEmOk =
        Boolean(
          assinatura.renovaEm &&
          new Date(
            assinatura
              .renovaEm
          ) > now
        );

      const trialOk =
        assinatura.status ===
          "TRIAL" &&
        Boolean(
          (
            assinatura
              .trialEndsAt &&
            new Date(
              assinatura
                .trialEndsAt
            ) > now
          ) ||
          (
            !assinatura
              .trialEndsAt &&
            renovaEmOk
          )
        );

      const ativaOk =
        assinatura.status ===
          "ATIVA" &&
        renovaEmOk;

      const isPro =
        Boolean(
          ativaOk ||
          trialOk
        );

      return res.json({
        hasAssinatura:
          true,

        isPro,

        reason:
          isPro
            ? "OK"
            : "EXPIRED_OR_NOT_ACTIVE",

        /*
         * Evitamos devolver dados
         * financeiros completos da
         * criança quando a consulta
         * é feita pelo responsável.
         *
         * Para esta tela precisamos
         * apenas de isPro.
         */
        assinatura:
          consultaComoResponsavel
            ? null
            : assinatura,
      });
    } catch (error) {
      console.error(
        "Erro ao buscar assinatura do usuário:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Erro interno do servidor",
        });
    }
  };

export const buscarUsuarios = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 2) {
      return res.json({ items: [] });
    }

    const usuarios = await prisma.usuario.findMany({
      where: {
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { nomeDeUsuario: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        email: true,
        tipo: true,
        foto: true,
      },
      take: 10,
      orderBy: {
        nome: "asc",
      },
    });

    return res.json({
      items: usuarios,
    });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return res.status(500).json({
      message: "Erro interno ao buscar usuários.",
    });
  }
};