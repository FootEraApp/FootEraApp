import { Request, Response, NextFunction } from "express";
import { EventoStatus } from "@prisma/client";
import dayjs from "dayjs";
import jwt from "jsonwebtoken";
import { getIO } from "../socket.js";
import { prisma } from "../prisma.js";
import {
  resolveUserContext,
} from "../services/planResolver.js";

import {
  canPermission,
} from "../services/permissions.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const EVENTO_TIPO_LABEL: Record<string, string> = {
  PENEIRA: "Peneira",
  EVENTO: "Evento",
  TORNEIO: "Torneio",
  COPA: "Copa",
  LIGA: "Liga",
  AMISTOSO: "Amistoso",
  TREINO_ABERTO: "Treino aberto",
  CAMP: "Camp",
  CLINICA: "Clínica",
  SHOWCASE: "Showcase",
  WORKSHOP: "Workshop",
  PALESTRA: "Palestra",
  AULA_AO_VIVO: "Aula ao vivo",
  WEBINAR: "Webinar",
  LIVE: "Live",
};

function mapEventoTipoLabel(tipo?: string | null): string {
  if (!tipo) return "Evento";
  const upper = String(tipo).toUpperCase();
  return EVENTO_TIPO_LABEL[upper] ?? "Evento";
}

function syncEventos(opts: { clubeId?: string | null; escolinhaId?: string | null }) {
  const io = getIO?.();
  if (!io) return;
  io.to("public:eventos").emit("eventos:sync", { scope: "public" });

  if (opts.clubeId) io.to(`clube:${opts.clubeId}`).emit("eventos:sync", { scope: "clube", id: opts.clubeId });
  if (opts.escolinhaId) io.to(`escolinha:${opts.escolinhaId}`).emit("eventos:sync", { scope: "escolinha", id: opts.escolinhaId });
}

export async function auth(
  req: any,
  res: Response,
  next: NextFunction,
) {
  try {
    const h =
      req.headers.authorization || "";

    const [scheme, token] =
      h.split(" ");

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        error: "Não autorizado",
      });
    }

    const payload: any =
      jwt.verify(
        token,
        JWT_SECRET,
      );

    const userId =
      String(payload.id);

    const contexto =
      await resolveUserContext(
        userId,
      );

    const tipo =
      normalizarTipo(
        contexto.tipo,
      );

    const tipoUsuarioId =
      contexto.tipoUsuarioId ??
      undefined;

    req.user = {
      id: userId,

      role:
        payload.role,

      tipo,

      tipoUsuarioId,

      isAdmin:
        contexto.isAdmin === true,
    };

    req.userId =
      userId;

    return next();
  } catch (e) {
    console.error(
      "Erro no auth eventos:",
      e,
    );

    return res.status(401).json({
      error: "Token inválido",
    });
  }
}

export async function ehDonoDoClubeOuAdmin(
  req: any,
  res: Response,
  next: NextFunction,
) {
  const clubeId =
    String(
      req.params.clubeId ||
        "",
    ).trim();

  const userId =
    String(
      req.user?.id ||
        "",
    ).trim();

  if (!userId) {
    return res
      .status(401)
      .json({
        error:
          "Não autenticado.",
      });
  }

  const isAdmin =
    await canPermission(
      userId,
      "VER_ADMIN",
    );

  if (isAdmin) {
    return next();
  }

  const podeGerenciar =
    await canPermission(
      userId,
      "GERENCIAR_ORGANIZACAO",
    );

  if (!podeGerenciar) {
    return res
      .status(403)
      .json({
        error:
          "Sem permissão.",
      });
  }

  const clube =
    await prisma.clube.findFirst({
      where: {
        id: clubeId,
        usuarioId: userId,
      },

      select: {
        id: true,
      },
    });

  if (clube) {
    return next();
  }

  return res
    .status(403)
    .json({
      error:
        "Sem permissão.",
    });
}

export async function ehDonoDaEscolinhaOuAdmin(
  req: any,
  res: Response,
  next: NextFunction,
) {
  const userId =
    String(
      req.user?.id ||
        "",
    ).trim();

  const escolinhaId =
    String(
      req.params.escolinhaId ||
        req.params.escolaId ||
        "",
    ).trim();

  if (!userId) {
    return res
      .status(401)
      .json({
        error:
          "Não autenticado.",
      });
  }

  const isAdmin =
    await canPermission(
      userId,
      "VER_ADMIN",
    );

  if (isAdmin) {
    return next();
  }

  const podeGerenciar =
    await canPermission(
      userId,
      "GERENCIAR_ORGANIZACAO",
    );

  if (!podeGerenciar) {
    return res
      .status(403)
      .json({
        error:
          "Você não tem permissão para gerenciar esta escolinha.",
      });
  }

  const escolinha =
    await prisma.escolinha.findFirst({
      where: {
        id: escolinhaId,
        usuarioId: userId,
      },

      select: {
        id: true,
      },
    });

  if (escolinha) {
    return next();
  }

  return res
    .status(403)
    .json({
      error:
        "Você não tem permissão para gerenciar esta escolinha.",
    });
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d.toDate() : null;
}

function validarDatasEventoPayload(params: {
  dataEvento: Date | null;
  inscricaoInicio: Date | null;
  inscricaoFim: Date | null;
}) {
  const now = new Date();

  const { dataEvento, inscricaoInicio, inscricaoFim } = params;

  if (!dataEvento) {
    return "Data do evento é obrigatória.";
  }

  if (dataEvento.getTime() <= now.getTime()) {
    return "A data do evento não pode estar no passado.";
  }

  if (dataEvento.getFullYear() > 2050) {
    return "Ano inválido. O ano máximo permitido é 2050.";
  }

  if (inscricaoInicio) {
    if (inscricaoInicio.getTime() <= now.getTime()) {
      return "Início das inscrições não pode estar no passado.";
    }

    if (inscricaoInicio.getFullYear() > 2050) {
      return "Ano inválido no início das inscrições. O máximo permitido é 2050.";
    }
  }

  if (inscricaoFim) {
    if (inscricaoFim.getTime() <= now.getTime()) {
      return "Fim das inscrições não pode estar no passado.";
    }

    if (inscricaoFim.getFullYear() > 2050) {
      return "Ano inválido no fim das inscrições. O máximo permitido é 2050.";
    }
  }

  if (inscricaoInicio && inscricaoFim && inscricaoFim.getTime() <= inscricaoInicio.getTime()) {
    return "Fim das inscrições precisa ser depois do início das inscrições.";
  }

  if (inscricaoFim && dataEvento.getTime() <= inscricaoFim.getTime()) {
    return "A data do evento precisa ser depois do fim das inscrições.";
  }

  if (inscricaoInicio && !inscricaoFim) {
    return "Informe também o fim das inscrições.";
  }

  if (!inscricaoInicio && inscricaoFim) {
    return "Informe também o início das inscrições.";
  }

  return "";
}

export async function listarPublicos(
  req: Request & {
    user?: any;
    userId?: string;
  },
  res: Response
) {
  try {
    const creatorUsuarioId =
      String(
        req.query.creatorUsuarioId ||
        ""
      ).trim();

    const agora =
      new Date();

    const where: any = {
      status:
        "ABERTO",

      dataEvento: {
        gte:
          agora,
      },
    };

    if (
      creatorUsuarioId
    ) {
      where.creatorUsuarioId =
        creatorUsuarioId;
    }

    const eventos =
      await prisma.evento.findMany({
        where,

        include: {
          clube: true,
          escolinha: true,

          inscricoes: {
            select: {
              usuarioId:
                true,

              status:
                true,
            },
          },
        },

        orderBy: {
          dataEvento:
            "asc",
        },
      });

    const userId =
      String(
        req.userId ||
          req.user?.id ||
          ""
      ).trim();

    const mapped =
      eventos.map(
        (ev) => {
          const {
            inscricoes,
            ...eventoPublico
          } = ev;

          const inscricoesAtivas =
            inscricoes.filter(
              (inscricao) =>
                inscricao.status !==
                "CANCELADA"
            );

          const totalInscritos =
            inscricoesAtivas.length;

          const vagasDisponiveis =
            ev.vagas == null
              ? null
              : Math.max(
                  0,
                  ev.vagas -
                    totalInscritos
                );

          const inscrito =
            Boolean(
              userId &&
                inscricoesAtivas.some(
                  (
                    inscricao
                  ) =>
                    inscricao.usuarioId ===
                    userId
                )
            );

          return {
            ...eventoPublico,

            tipoLabel:
              mapEventoTipoLabel(
                ev.tipo
              ),

            totalInscritos,

            vagasDisponiveis,

            inscrito,
          };
        }
      );

    return res.json(
      mapped
    );
  } catch (error) {
    console.error(
      "Erro listando eventos públicos",
      error
    );

    return res.status(500).json({
      message:
        "Erro interno",
    });
  }
}

export async function listarDoClube(req: Request, res: Response) {
  const { clubeId } = req.params;
  const { status, tipo } = req.query as { status?: string; tipo?: string };

  const where: any = { clubeId };
  if (status) where.status = status as any;
  if (tipo) where.tipo = tipo as any;

  const eventos = await prisma.evento.findMany({
    where,
    orderBy: { dataEvento: "asc" }, 
  });

  const items = eventos.map((ev) => ({
    ...ev,
    tipoLabel: mapEventoTipoLabel(ev.tipo),
  }));

  res.json(items);
}

export async function listarDaEscolinha(req: Request, res: Response) {
  try {
    const escolinhaId = String(
      (req.params as any).escolinhaId || (req.params as any).escolaId || ""
    ).trim();

    if (!escolinhaId) {
      return res.status(400).json({ error: "escolinhaId é obrigatório" });
    }

    const eventos = await prisma.evento.findMany({
      where: { escolinhaId },
      orderBy: { dataEvento: "asc" }, 
    });

    return res.json(eventos);
  } catch (e) {
    console.error("Erro listarDaEscolinha:", e);
    return res
      .status(500)
      .json({ error: "Erro ao listar eventos da escolinha" });
  }
}

export async function criar(req: any, res: Response) {
  try {
    const { clubeId, escolaId, escolinhaId } = req.params as any;

    const ownerClubeId = clubeId || null;
    const ownerEscolinhaId = escolinhaId || escolaId || null;

    if (!ownerClubeId && !ownerEscolinhaId) {
      return res
        .status(400)
        .json({ error: "clubeId ou escolinhaId é obrigatório na rota" });
    }

    const {
      titulo,
      tipo,
      status,
      dataEvento,
      inscricaoInicio,
      inscricaoFim,
      descricao,
      cidade,
      estado,
      pais,
      endereco,
      local,
      vagas,
      valorInscricao,
      linkInscricao,
      requisitos,
    } = req.body;

    const dataEventoDia = parseDate(dataEvento);
    const inscricaoInicioDate = parseDate(inscricaoInicio);
    const inscricaoFimDate = parseDate(inscricaoFim);

    const erroDatas = validarDatasEventoPayload({
      dataEvento: dataEventoDia,
      inscricaoInicio: inscricaoInicioDate,
      inscricaoFim: inscricaoFimDate,
    });

    if (erroDatas) {
      return res.status(400).json({ error: erroDatas });
    }

    if (!dataEventoDia) {
      return res.status(400).json({ error: "Data do evento é obrigatória." });
    }

    const dataEventoValida: Date = dataEventoDia;

    let requisitosArr: string[] = [];
    if (Array.isArray(requisitos)) {
      requisitosArr = requisitos.map((r: any) => String(r).trim()).filter(Boolean);
    } else if (typeof requisitos === "string" && requisitos.trim()) {
      requisitosArr = requisitos.split(",").map((r: string) => r.trim()).filter(Boolean);
    }

    const evento = await prisma.evento.create({
      data: {
        ...(ownerClubeId ? { clubeId: ownerClubeId } : {}),
        ...(ownerEscolinhaId ? { escolinhaId: ownerEscolinhaId } : {}),
        titulo: String(titulo),
        tipo: (tipo as any) || "EVENTO",
        status: (status as any) || "ABERTO",
        dataEvento: dataEventoDia,
        inscricaoInicio: inscricaoInicioDate || null,
        inscricaoFim: inscricaoFimDate || null,
        descricao: descricao || null,
        cidade: cidade || null,
        estado: estado || null,
        pais: pais || null,
        endereco: endereco || local || null,
        local: local || null,
        vagas: vagas != null && vagas !== "" ? Number(vagas) : null,
        valorInscricao:
          valorInscricao != null && valorInscricao !== ""
            ? String(valorInscricao)
            : null,
        linkInscricao: linkInscricao || null,
        requisitos: requisitosArr,
      },
    });

    syncEventos({ clubeId: ownerClubeId, escolinhaId: ownerEscolinhaId });

    return res.status(201).json(evento);
  } catch (e) {
    console.error("Erro ao criar evento:", e);
    return res.status(500).json({ error: "Erro ao criar evento" });
  }
}

export async function obter(
  req: Request & {
    user?: any;
    userId?: string;
  },
  res: Response
) {
  try {
    const id =
      String(
        req.params.id || ""
      ).trim();

    const usuarioId =
      String(
        req.userId ||
          req.user?.id ||
          ""
      ).trim();

    const ev =
      await prisma.evento.findUnique({
        where: {
          id,
        },

        include: {
          clube: {
            select: {
              id: true,
              nome: true,
              logo: true,
              usuarioId: true,

              usuario: {
                select: {
                  nomeDeUsuario:
                    true,
                },
              },
            },
          },

          escolinha: {
            select: {
              id: true,
              nome: true,
              logo: true,
              usuarioId: true,

              usuario: {
                select: {
                  nomeDeUsuario:
                    true,
                },
              },
            },
          },

          federacao: {
            select: {
              id: true,
              nome: true,
              logo: true,
              usuarioId: true,

              usuario: {
                select: {
                  nomeDeUsuario:
                    true,
                },
              },
            },
          },

          marca: {
            select: {
              id: true,
              nome: true,
              logo: true,
              usuarioId: true,

              usuario: {
                select: {
                  nomeDeUsuario:
                    true,
                },
              },
            },
          },

          inscricoes: {
            select: {
              usuarioId: true,
              status: true,
            },
          },
        },
      });

    if (!ev) {
      return res.status(404).json({
        error:
          "Evento não encontrado",
      });
    }

    const creator =
      ev.creatorUsuarioId
        ? await prisma.usuario.findUnique({
            where: {
              id:
                ev.creatorUsuarioId,
            },

            select: {
              id: true,
              nome: true,
              foto: true,
              nomeDeUsuario:
                true,
            },
          })
        : null;

    const inscricoesAtivas =
      ev.inscricoes.filter(
        (item) =>
          item.status !==
          "CANCELADA"
      );

    const minhaInscricao =
      usuarioId
        ? ev.inscricoes.find(
            (item) =>
              item.usuarioId ===
                usuarioId &&
              item.status !==
                "CANCELADA"
          )
        : undefined;

    const totalInscritos =
      inscricoesAtivas.length;

    const vagasDisponiveis =
      ev.vagas == null
        ? null
        : Math.max(
            0,
            ev.vagas -
              totalInscritos
          );

    const podeGerenciar =
      Boolean(
        usuarioId &&
          (
            ev.creatorUsuarioId ===
              usuarioId ||

            ev.clube?.usuarioId ===
              usuarioId ||

            ev.escolinha
              ?.usuarioId ===
              usuarioId ||

            ev.federacao
              ?.usuarioId ===
              usuarioId ||

            ev.marca?.usuarioId ===
              usuarioId ||

            req.user?.isAdmin ===
              true ||

            String(
              req.user?.tipo || ""
            ).toLowerCase() ===
              "admin"
          )
      );

    const organizador =
      ev.clube
        ? {
            tipo: "Clube",
            id: ev.clube.id,
            nome: ev.clube.nome,
            logo: ev.clube.logo,
            nomeDeUsuario:
              ev.clube.usuario
                ?.nomeDeUsuario ??
              null,
          }
        : ev.escolinha
        ? {
            tipo: "Escolinha",
            id:
              ev.escolinha.id,
            nome:
              ev.escolinha.nome,
            logo:
              ev.escolinha.logo,
            nomeDeUsuario:
              ev.escolinha
                .usuario
                ?.nomeDeUsuario ??
              null,
          }
        : ev.federacao
        ? {
            tipo: "Federacao",
            id:
              ev.federacao.id,
            nome:
              ev.federacao.nome,
            logo:
              ev.federacao.logo,
            nomeDeUsuario:
              ev.federacao
                .usuario
                ?.nomeDeUsuario ??
              null,
          }
        : ev.marca
        ? {
            tipo: "Marca",
            id: ev.marca.id,
            nome: ev.marca.nome,
            logo: ev.marca.logo,
            nomeDeUsuario:
              ev.marca.usuario
                ?.nomeDeUsuario ??
              null,
          }
        : creator
        ? {
            tipo:
              ev.creatorTipo ||
              "Creator",

            id:
              creator.id,

            nome:
              creator.nome,

            logo:
              creator.foto,

            nomeDeUsuario:
              creator.nomeDeUsuario,
          }
        : null;

    const agora =
      new Date();

    const inscricoesAbertas =
      ev.status === "ABERTO" &&
      ev.dataEvento > agora &&
      (
        !ev.inscricaoInicio ||
        agora >=
          ev.inscricaoInicio
      ) &&
      (
        !ev.inscricaoFim ||
        agora <=
          ev.inscricaoFim
      );

    const {
      inscricoes,
      ...eventoPublico
    } = ev;

    return res.json({
      ...eventoPublico,

      tipoLabel:
        mapEventoTipoLabel(
          ev.tipo
        ),

      organizador,

      totalInscritos,
      vagasDisponiveis,

      inscrito:
        Boolean(
          minhaInscricao
        ),

      inscricaoStatus:
        minhaInscricao?.status ??
        null,

      inscricoesAbertas,
      podeGerenciar,
    });
  } catch (error) {
    console.error(
      "Erro ao obter evento:",
      error
    );

    return res.status(500).json({
      error:
        "Não foi possível carregar o evento.",
    });
  }
}

export async function participarEvento(
  req: any,
  res: Response
) {
  try {
    const eventoId =
      String(
        req.params.id || ""
      ).trim();

    const usuarioId =
      String(
        req.userId ||
          req.user?.id ||
          ""
      ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        code: "AUTH_REQUIRED",
        message:
          "Entre na FootEra para participar deste evento.",
      });
    }

    const [evento, atleta] =
      await Promise.all([
        prisma.evento.findUnique({
          where: {
            id: eventoId,
          },
        }),

        prisma.atleta.findUnique({
          where: {
            usuarioId,
          },

          select: {
            id: true,
          },
        }),
      ]);

    if (!evento) {
      return res.status(404).json({
        message:
          "Evento não encontrado.",
      });
    }

    if (!atleta) {
      return res.status(403).json({
        code: "ATLETA_REQUIRED",
        message:
          "Você precisa possuir um perfil de Atleta para participar deste evento.",
      });
    }

    const agora =
      new Date();

    if (
      evento.status !==
        "ABERTO" ||
      evento.dataEvento <=
        agora
    ) {
      return res.status(409).json({
        message:
          "Este evento não está disponível para inscrições.",
      });
    }

    if (
      evento.inscricaoInicio &&
      agora <
        evento.inscricaoInicio
    ) {
      return res.status(409).json({
        message:
          "As inscrições ainda não começaram.",
      });
    }

    if (
      evento.inscricaoFim &&
      agora >
        evento.inscricaoFim
    ) {
      return res.status(409).json({
        message:
          "As inscrições já foram encerradas.",
      });
    }

    const existente =
      await prisma.inscricaoEvento.findUnique({
        where: {
          eventoId_usuarioId: {
            eventoId,
            usuarioId,
          },
        },
      });

    if (
      existente &&
      existente.status !==
        "CANCELADA"
    ) {
      return res.json({
        ok: true,
        inscrito: true,
        status:
          existente.status,
      });
    }

    const total =
      await prisma.inscricaoEvento.count({
        where: {
          eventoId,

          status: {
            not:
              "CANCELADA",
          },
        },
      });

    if (
      evento.vagas != null &&
      total >= evento.vagas
    ) {
      return res.status(409).json({
        code: "EVENT_FULL",
        message:
          "As vagas deste evento estão esgotadas.",
      });
    }

    if (
      evento.linkInscricao
    ) {
      return res.json({
        ok: true,
        external: true,
        linkInscricao:
          evento.linkInscricao,
      });
    }

    const valor =
      Number(
        evento.valorInscricao ??
          0
      );

    if (
      Number.isFinite(valor) &&
      valor > 0
    ) {
      return res.status(402).json({
        code:
          "PAYMENT_REQUIRED",

        message:
          "Este evento possui inscrição paga.",

        eventoId,
        valor,
      });
    }

    const inscricao =
      await prisma.inscricaoEvento.upsert({
        where: {
          eventoId_usuarioId: {
            eventoId,
            usuarioId,
          },
        },

        create: {
          eventoId,
          usuarioId,
          status:
            "CONFIRMADA",
        },

        update: {
          status:
            "CONFIRMADA",
        },
      });

    const totalInscritos =
      await prisma.inscricaoEvento.count({
        where: {
          eventoId,

          status: {
            not:
              "CANCELADA",
          },
        },
      });

    return res.status(201).json({
      ok: true,
      inscrito: true,

      status:
        inscricao.status,

      totalInscritos,

      vagasDisponiveis:
        evento.vagas == null
          ? null
          : Math.max(
              0,
              evento.vagas -
                totalInscritos
            ),
    });
  } catch (error) {
    console.error(
      "participarEvento:",
      error
    );

    return res.status(500).json({
      message:
        "Não foi possível realizar a inscrição.",
    });
  }
}

function mapEventoToAgendaItem(ev: any) {
  return {
    id: ev.id,
    tipo: (ev.tipo as any) || "EVENTO",
    tipoLabel: mapEventoTipoLabel(ev.tipo),
    titulo: ev.titulo,
    inicio: ev.dataEvento,
    fim: null,
    origem: "EVENTO" as const,
  };
}

export async function minhaAgenda(req: any, res: Response) {
  try {
    const { alvoId, from, to } = req.query as {
      alvoId?: string;
      from?: string;
      to?: string;
    };

    const agora = new Date();
    const fromDate = parseDate(from) || agora;
    const toDate = parseDate(to) || null;

    const where: any = {
      dataEvento: {
        gte: fromDate,
      },
      status: EventoStatus.ABERTO,
    };

    if (toDate) {
      where.dataEvento.lte = toDate;
    }

    if (alvoId) {
      const clube = await prisma.clube.findUnique({
        where: { id: String(alvoId) },
        select: { id: true },
      });
      if (clube) {
        where.clubeId = clube.id;
      }
    } else if (req.user?.tipo === "clube" && req.user.tipoUsuarioId) {
      where.clubeId = String(req.user.tipoUsuarioId);
    }

    const tipo = String(req.user?.tipo || "").toLowerCase();
    const usuarioId = String(req.user?.id || "").trim();

    if (tipo === "atleta" && usuarioId) {
      const atleta = await prisma.atleta.findFirst({
        where: { usuarioId },
        select: { id: true },
      });

      if (!atleta?.id) return res.json([]);

      const eventoWhereAtleta:
        any = {
        status: "ABERTO",

        dataEvento: {
          gte:
            fromDate,
        },
      };

      if (toDate) {
        eventoWhereAtleta
          .dataEvento.lte =
          toDate;
      }

      if (alvoId) {
        const clube =
          await prisma.clube.findUnique({
            where: {
              id:
                String(alvoId),
            },

            select: {
              id: true,
            },
          });

        if (clube) {
          eventoWhereAtleta.clubeId =
            clube.id;
        }
      }

      const [
        convocacoes,
        inscricoes,
      ] = await Promise.all([
        prisma.eventoConvocado.findMany({
          where: {
            atletaId:
              atleta.id,

            evento: eventoWhereAtleta,
          },

          include: {
            evento: {
              select: {
                id: true,
                tipo: true,
                titulo: true,
                dataEvento: true,
              },
            },
          },

          orderBy: {
            evento: {
              dataEvento:
                "asc",
            },
          },

          take: 200,
        }),

        prisma.inscricaoEvento.findMany({
          where: {
            usuarioId,

            status: {
              not:
                "CANCELADA",
            },

            evento:
              eventoWhereAtleta,
          },

          include: {
            evento: {
              select: {
                id: true,
                tipo: true,
                titulo: true,
                dataEvento: true,
              },
            },
          },

          take: 200,
        }),
      ]);

      const mapa =
        new Map<
          string,
          {
            id: string;
            tipo: any;
            titulo: string;
            inicio: Date;
            fim: null;
          }
        >();

      for (
        const item of convocacoes
      ) {
        mapa.set(
          item.evento.id,
          {
            id:
              item.evento.id,

            tipo:
              item.evento.tipo ??
              "EVENTO",

            titulo:
              item.evento.titulo,

            inicio:
              item.evento.dataEvento,

            fim:
              null,
          }
        );
      }

      for (
        const item of inscricoes
      ) {
        mapa.set(
          item.evento.id,
          {
            id:
              item.evento.id,

            tipo:
              item.evento.tipo ??
              "EVENTO",

            titulo:
              item.evento.titulo,

            inicio:
              item.evento.dataEvento,

            fim:
              null,
          }
        );
      }

      const items =
        Array.from(
          mapa.values()
        ).sort(
          (a, b) =>
            new Date(
              a.inicio
            ).getTime() -
            new Date(
              b.inicio
            ).getTime()
        );

      return res.json(items);
    }

    const eventos = await prisma.evento.findMany({
      where,
      orderBy: { dataEvento: "asc" },
      take: 100,
    });

    const items = eventos.map(mapEventoToAgendaItem);
    return res.json(items);

  } catch (e) {
    console.error("Erro em eventos.minhaAgenda:", e);
    return res
      .status(500)
      .json({ error: "Erro ao carregar agenda de eventos" });
  }
}

export async function eventosDoAtleta(
  req: any,
  res: Response
) {
  try {
    const usuarioId =
      String(
        req.user?.id ||
        req.userId ||
        ""
      ).trim();

    if (!usuarioId) {
      return res.json([]);
    }

    const atleta =
      await prisma.atleta.findFirst({
        where: {
          usuarioId,
        },

        select: {
          id: true,
        },
      });

    if (!atleta?.id) {
      return res.json([]);
    }

    const agora =
      new Date();

    const [
      convocacoes,
      inscricoes,
    ] =
      await Promise.all([
        prisma.eventoConvocado.findMany({
          where: {
            atletaId:
              atleta.id,

            evento: {
              status:
                "ABERTO",

              dataEvento: {
                gte:
                  agora,
              },
            },
          },

          include: {
            evento: {
              select: {
                id: true,
                tipo: true,
                titulo: true,
                dataEvento:
                  true,
              },
            },
          },

          take: 200,
        }),

        prisma.inscricaoEvento.findMany({
          where: {
            usuarioId,

            status: {
              not:
                "CANCELADA",
            },

            evento: {
              status:
                "ABERTO",

              dataEvento: {
                gte:
                  agora,
              },
            },
          },

          include: {
            evento: {
              select: {
                id: true,
                tipo: true,
                titulo: true,
                dataEvento:
                  true,
              },
            },
          },

          take: 200,
        }),
      ]);

    const mapa =
      new Map<string, any>();

    for (
      const item of
      convocacoes
    ) {
      mapa.set(
        item.evento.id,
        {
          id:
            item.evento.id,

          tipo:
            item.evento.tipo ??
            "EVENTO",

          titulo:
            item.evento.titulo,

          inicio:
            item.evento
              .dataEvento,

          fim:
            null,
        }
      );
    }

    for (
      const item of
      inscricoes
    ) {
      mapa.set(
        item.evento.id,
        {
          id:
            item.evento.id,

          tipo:
            item.evento.tipo ??
            "EVENTO",

          titulo:
            item.evento.titulo,

          inicio:
            item.evento
              .dataEvento,

          fim:
            null,
        }
      );
    }

    const items =
      Array.from(
        mapa.values()
      ).sort(
        (a, b) =>
          new Date(
            a.inicio
          ).getTime() -
          new Date(
            b.inicio
          ).getTime()
      );

    return res.json(
      items
    );
  } catch (error) {
    console.error(
      "Erro em eventos.eventosDoAtleta:",
      error
    );

    return res.status(500).json({
      error:
        "Erro ao carregar eventos do atleta",
    });
  }
}

function normalizarTipo(tipo?: string | null) {
  return String(tipo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function listarMeusEventosCreator(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const eventos = await prisma.evento.findMany({
      where: {
        creatorUsuarioId: usuarioId,
      },
      orderBy: { dataEvento: "asc" },
    });

    return res.json(
      eventos.map((ev) => ({
        ...ev,
        tipoLabel: mapEventoTipoLabel(ev.tipo),
      }))
    );
  } catch (e) {
    console.error("Erro listarMeusEventosCreator:", e);
    return res.status(500).json({ error: "Erro ao listar eventos do creator." });
  }
}

export async function criarEventoCreator(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();
    const tipoUsuario = normalizarTipo(req.user?.tipo);

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const podeCriar =
      await canPermission(
        usuarioId,
        "CRIAR_EVENTO",
      );

    if (!podeCriar) {
      return res.status(403).json({
        error: "Este tipo de usuário não pode criar eventos.",
      });
    }

    const {
      titulo,
      tipo,
      status,
      dataEvento,
      inscricaoInicio,
      inscricaoFim,
      descricao,
      cidade,
      estado,
      pais,
      endereco,
      local,
      vagas,
      valorInscricao,
      linkInscricao,
      requisitos,
    } = req.body;

    const dataEventoDia = parseDate(dataEvento);
    const inscricaoInicioDate = parseDate(inscricaoInicio);
    const inscricaoFimDate = parseDate(inscricaoFim);

    const erroDatas = validarDatasEventoPayload({
      dataEvento: dataEventoDia,
      inscricaoInicio: inscricaoInicioDate,
      inscricaoFim: inscricaoFimDate,
    });

    if (erroDatas) {
      return res.status(400).json({ error: erroDatas });
    }

    if (!dataEventoDia) {
      return res.status(400).json({ error: "Data do evento é obrigatória." });
    }

    const dataEventoValida: Date = dataEventoDia;
    const tituloNormalizado = String(titulo || "").trim();

    const eventoDuplicado = await prisma.evento.findFirst({
      where: {
        creatorUsuarioId: usuarioId,
        dataEvento: dataEventoValida,

        titulo: {
          equals: tituloNormalizado,
          mode: "insensitive",
        },

        status: {
          not: "CANCELADO",
        },
      },

      select: {
        id: true,
      },
    });

    if (eventoDuplicado) {
      return res.status(409).json({
        error:
          "Você já possui um evento com esse mesmo nome e horário.",
        code: "EVENTO_DUPLICADO",
        eventoId: eventoDuplicado.id,
      });
    }

    let requisitosArr: string[] = [];

    if (Array.isArray(requisitos)) {
      requisitosArr = requisitos.map((r: any) => String(r).trim()).filter(Boolean);
    } else if (typeof requisitos === "string" && requisitos.trim()) {
      requisitosArr = requisitos
        .split(",")
        .map((r: string) => r.trim())
        .filter(Boolean);
    }

    const data: any = {
      creatorUsuarioId: usuarioId,
      creatorTipo: tipoUsuario,

      titulo: tituloNormalizado,
      tipo: (tipo as any) || "EVENTO",
      status: (status as any) || "ABERTO",
      dataEvento: dataEventoValida,
      inscricaoInicio: inscricaoInicioDate || null,
      inscricaoFim: inscricaoFimDate || null,
      descricao: descricao || null,
      cidade: cidade || null,
      estado: estado || null,
      pais: pais || null,
      endereco: endereco || local || null,
      local: local || null,
      vagas: vagas != null && vagas !== "" ? Number(vagas) : null,
      valorInscricao:
        valorInscricao != null && valorInscricao !== ""
          ? String(valorInscricao)
          : null,
      linkInscricao: linkInscricao || null,
      requisitos: requisitosArr,
    };

    if (tipoUsuario === "clube" && req.user?.tipoUsuarioId) {
      data.clubeId = String(req.user.tipoUsuarioId);
    }

    if (
      (
        tipoUsuario === "escolinha" ||
        tipoUsuario === "escola"
      ) &&
      req.user?.tipoUsuarioId
    ) {
      data.escolinhaId =
        String(req.user.tipoUsuarioId);
    }

    if (tipoUsuario === "federacao" && req.user?.tipoUsuarioId) {
      data.federacaoId = String(req.user.tipoUsuarioId);
    }

    if (tipoUsuario === "marca" && req.user?.tipoUsuarioId) {
      data.marcaId = String(req.user.tipoUsuarioId);
    }

    const evento = await prisma.evento.create({ data });

    syncEventos({
      clubeId: data.clubeId || null,
      escolinhaId: data.escolinhaId || null,
    });

    return res.status(201).json({
      ...evento,
      tipoLabel: mapEventoTipoLabel(evento.tipo),
    });
  } catch (e) {
    console.error("Erro criarEventoCreator:", e);
    return res.status(500).json({ error: "Erro ao criar evento do creator." });
  }
}

export async function getEventoCreatorById(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();
    const { id } = req.params;

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const evento = await prisma.evento.findFirst({
      where: {
        id: String(id),
        creatorUsuarioId: usuarioId,
      },
    });

    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado." });
    }

    return res.json({
      ...evento,
      tipoLabel: mapEventoTipoLabel(evento.tipo),
    });
  } catch (e) {
    console.error("Erro getEventoCreatorById:", e);
    return res.status(500).json({ error: "Erro ao buscar evento." });
  }
}

export async function atualizarEventoCreator(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();
    const tipoUsuario = normalizarTipo(req.user?.tipo);
    const { id } = req.params;

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const podeCriar =
      await canPermission(
        usuarioId,
        "CRIAR_EVENTO",
      );

    if (!podeCriar) {
      return res.status(403).json({
        error: "Este tipo de usuário não pode editar eventos.",
      });
    }

    const existente = await prisma.evento.findFirst({
      where: {
        id: String(id),
        creatorUsuarioId: usuarioId,
      },
    });

    if (!existente) {
      return res.status(404).json({ error: "Evento não encontrado." });
    }

    const {
      titulo,
      tipo,
      status,
      dataEvento,
      inscricaoInicio,
      inscricaoFim,
      descricao,
      cidade,
      estado,
      pais,
      endereco,
      local,
      vagas,
      valorInscricao,
      linkInscricao,
      requisitos,
    } = req.body;

    const dataEventoDia = parseDate(dataEvento);
    const inscricaoInicioDate = parseDate(inscricaoInicio);
    const inscricaoFimDate = parseDate(inscricaoFim);

    const erroDatas = validarDatasEventoPayload({
      dataEvento: dataEventoDia,
      inscricaoInicio: inscricaoInicioDate,
      inscricaoFim: inscricaoFimDate,
    });

    if (erroDatas) {
      return res.status(400).json({ error: erroDatas });
    }

    if (!dataEventoDia) {
      return res.status(400).json({ error: "Data do evento é obrigatória." });
    }

    const dataEventoValida: Date = dataEventoDia;
    const tituloNormalizado = String(titulo || "").trim();

    const eventoDuplicado = await prisma.evento.findFirst({
      where: {
        creatorUsuarioId: usuarioId,
        dataEvento: dataEventoValida,

        titulo: {
          equals: tituloNormalizado,
          mode: "insensitive",
        },

        status: {
          not: "CANCELADO",
        },

        id: {
          not: String(id),
        },
      },

      select: {
        id: true,
      },
    });

    if (eventoDuplicado) {
      return res.status(409).json({
        error:
          "Você já possui outro evento com esse mesmo nome e horário.",
        code: "EVENTO_DUPLICADO",
      });
    }

    let requisitosArr: string[] = [];

    if (Array.isArray(requisitos)) {
      requisitosArr = requisitos.map((r: any) => String(r).trim()).filter(Boolean);
    } else if (typeof requisitos === "string" && requisitos.trim()) {
      requisitosArr = requisitos
        .split(",")
        .map((r: string) => r.trim())
        .filter(Boolean);
    }

    const data: any = {
      titulo: String(titulo || "").trim(),
      tipo: (tipo as any) || existente.tipo || "EVENTO",
      status: (status as any) || existente.status || "ABERTO",
      dataEvento: dataEventoValida,
      inscricaoInicio: inscricaoInicioDate || null,
      inscricaoFim: inscricaoFimDate || null,
      descricao: descricao || null,
      cidade: cidade || null,
      estado: estado || null,
      pais: pais || null,
      endereco: endereco || local || null,
      local: local || null,
      vagas: vagas != null && vagas !== "" ? Number(vagas) : null,
      valorInscricao:
        valorInscricao != null && valorInscricao !== ""
          ? String(valorInscricao)
          : null,
      linkInscricao: linkInscricao || null,
      requisitos: requisitosArr,
    };

    const evento = await prisma.evento.update({
      where: { id: String(id) },
      data,
    });

    syncEventos({
      clubeId: evento.clubeId || null,
      escolinhaId: evento.escolinhaId || null,
    });

    return res.json({
      ...evento,
      tipoLabel: mapEventoTipoLabel(evento.tipo),
    });
  } catch (e) {
    console.error("Erro atualizarEventoCreator:", e);
    return res.status(500).json({ error: "Erro ao editar evento." });
  }
}

export async function deletarEventoCreator(req: any, res: Response) {
  try {
    const usuarioId = String(req.user?.id || "").trim();
    const { id } = req.params;

    if (!usuarioId) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const evento = await prisma.evento.findFirst({
      where: {
        id: String(id),
        creatorUsuarioId: usuarioId,
      },
    });

    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado." });
    }

    await prisma.evento.delete({
      where: { id: String(id) },
    });

    syncEventos({
      clubeId: evento.clubeId || null,
      escolinhaId: evento.escolinhaId || null,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("Erro deletarEventoCreator:", e);
    return res.status(500).json({ error: "Erro ao deletar evento." });
  }
}

