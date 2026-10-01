import type { Response } from "express";
import { StatusSessaoTreinoTurma, TipoMidia, TipoOrganizacao, TipoUsuario } from "@prisma/client";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  canPermission,
} from "../services/permissions.js";

type EscopoSessao = {
  usuarioId: string;

  isAdmin: boolean;

  professorId:
    string | null;

  clubeId:
    string | null;

  escolinhaId:
    string | null;
};

async function resolverEscopoSessao(
  req: AuthenticatedRequest
): Promise<EscopoSessao> {
  const usuarioId =
    String(
      req.userId ??
      (req as any).user?.id ??
      (req as any).authUser?.id ??
      ""
    ).trim();

  if (!usuarioId) {
    const err: any =
      new Error(
        "Usuário não autenticado."
      );

    err.status = 401;

    throw err;
  }

  const isAdmin =
    await canPermission(
      usuarioId,
      "VER_ADMIN"
    );

  if (isAdmin) {
    return {
      usuarioId,
      isAdmin: true,

      professorId:
        null,

      clubeId:
        null,

      escolinhaId:
        null,
    };
  }

  const contexto =
    await getActiveContext(
      usuarioId
    );

  if (!contexto) {
    const err: any =
      new Error(
        "Nenhum contexto ativo válido."
      );

    err.status = 403;

    throw err;
  }

  const podeCriarTreino =
    await canPermission(
      usuarioId,
      "CRIAR_TREINO"
    );

  if (!podeCriarTreino) {
    const err: any =
      new Error(
        "O contexto ativo não pode controlar sessões de treino."
      );

    err.status = 403;

    throw err;
  }

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
    return {
      usuarioId,
      isAdmin: false,

      professorId:
        String(
          contexto.tipoUsuarioId
        ),

      clubeId:
        null,

      escolinhaId:
        null,
    };
  }

  /*
   * Contexto de organização.
   */
  if (
    contexto.kind ===
      "ORGANIZATION" &&
    contexto
      .legacyOrganizationId
  ) {
    if (
      contexto.organizationType ===
      TipoOrganizacao.CLUBE
    ) {
      return {
        usuarioId,
        isAdmin: false,

        professorId:
          null,

        clubeId:
          String(
            contexto
              .legacyOrganizationId
          ),

        escolinhaId:
          null,
      };
    }

    if (
      contexto.organizationType ===
      TipoOrganizacao.ESCOLA
    ) {
      return {
        usuarioId,
        isAdmin: false,

        professorId:
          null,

        clubeId:
          null,

        escolinhaId:
          String(
            contexto
              .legacyOrganizationId
          ),
      };
    }
  }

  const err: any =
    new Error(
      "O contexto ativo não pode controlar sessões de turma."
    );

  err.status = 403;

  throw err;
}

async function assertInstrutor(
  req: AuthenticatedRequest
) {
  return resolverEscopoSessao(
    req
  );
}

async function turmaPertenceAoEscopo(
  escopo: EscopoSessao,
  turmaId: string
) {
  if (escopo.isAdmin) {
    return true;
  }

  const turma =
    await prisma.turma.findUnique({
      where: {
        id:
          turmaId,
      },

      select: {
        id: true,

        clubeId:
          true,

        escolinhaId:
          true,

        professores: {
          select: {
            professorId:
              true,
          },
        },
      },
    });

  if (!turma) {
    return false;
  }

  if (
    escopo.clubeId
  ) {
    return (
      turma.clubeId ===
      escopo.clubeId
    );
  }

  if (
    escopo.escolinhaId
  ) {
    return (
      turma.escolinhaId ===
      escopo.escolinhaId
    );
  }

  if (
    escopo.professorId
  ) {
    return turma.professores.some(
      (item) =>
        item.professorId ===
        escopo.professorId
    );
  }

  return false;
}

async function treinoPertenceAoEscopo(
  escopo: EscopoSessao,
  treinoId: string
) {
  if (escopo.isAdmin) {
    return true;
  }

  const treino =
    await prisma
      .treinoProgramado
      .findUnique({
        where: {
          id:
            treinoId,
        },

        select: {
          id: true,

          professorId:
            true,

          clubeId:
            true,

          escolinhaId:
            true,

          professores: {
            select: {
              professorId:
                true,
            },
          },
        },
      });

  if (!treino) {
    return false;
  }

  if (
    escopo.clubeId
  ) {
    return (
      treino.clubeId ===
      escopo.clubeId
    );
  }

  if (
    escopo.escolinhaId
  ) {
    return (
      treino.escolinhaId ===
      escopo.escolinhaId
    );
  }

  if (
    escopo.professorId
  ) {
    return (
      treino.professorId ===
        escopo.professorId ||
      treino.professores.some(
        (item) =>
          item.professorId ===
          escopo.professorId
      )
    );
  }

  return false;
}

async function podeGerenciarSessao(
  params: {
    escopo:
      EscopoSessao;

    sessaoId:
      string;
  }
) {
  const {
    escopo,
    sessaoId,
  } = params;

  if (
    escopo.isAdmin
  ) {
    return true;
  }

  const sessao =
    await prisma
      .sessaoTreinoTurma
      .findUnique({
        where: {
          id:
            sessaoId,
        },

        select: {
          id:
            true,

          turmaId:
            true,
        },
      });

  if (!sessao) {
    return false;
  }

  return turmaPertenceAoEscopo(
    escopo,
    sessao.turmaId
  );
}

function getTodayRangeBRT() {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

  const y = br.getFullYear();
  const m = br.getMonth();
  const d = br.getDate();

  const start = new Date(`${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00-03:00`);
  const end = new Date(`${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T23:59:59.999-03:00`);

  return { start, end };
}

function parseDateInput(raw?: any): Date | null {
  if (!raw) return null;

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  const s = String(raw).trim();
  if (!s) return null;

  const mLocal = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mLocal) {
    const [, Y, M, D, h, mi, sec] = mLocal;
    return new Date(`${Y}-${M}-${D}T${h}:${mi}:${sec || "00"}-03:00`);
  }

  const mDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDate) {
    const [, Y, M, D] = mDate;
    return new Date(`${Y}-${M}-${D}T00:00:00-03:00`);
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function criarSessao(req: AuthenticatedRequest, res: Response) {
  try {
    const escopo =
      await assertInstrutor(
        req
      );

    const usuarioId =
      escopo.usuarioId;

    const { treinoProgramadoId, turmaId, dataISO, dataHoraISO } = req.body as {
      treinoProgramadoId: string;
      turmaId: string;
      dataISO?: string;
      dataHoraISO?: string;
    };

    const raw = (dataHoraISO || dataISO || "").trim();
    if (!raw) {
      return res.status(400).json({ error: "dataHoraISO (ou dataISO) é obrigatório." });
    }

    const dataBR = parseDateInput(raw);
    if (!dataBR) {
      return res.status(400).json({ error: "dataHoraISO/dataISO inválida." });
    }

    if (isNaN(dataBR.getTime())) {
      return res.status(400).json({ error: "dataHoraISO/dataISO inválida." });
    }
    const turma =
      await prisma.turma.findUnique({
        where: {
          id:
            turmaId,
        },
      });

    if (!turma) {
      return res.status(404).json({
        error:
          "Turma não encontrada.",
      });
    }

    const turmaPermitida =
      await turmaPertenceAoEscopo(
        escopo,
        turmaId
      );

    if (!turmaPermitida) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_MISMATCH",

        error:
          "Esta turma não pertence ao contexto ativo.",
      });
    }

    const treino = await prisma.treinoProgramado.findUnique({
      where: { id: treinoProgramadoId },
      select: {
        id: true,
        nome: true, 
        professorId: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

    if (!treino) {
      return res.status(404).json({ error: "Treino programado não encontrado." });
    }

    const tituloTreino = String(treino.nome ?? "Treino");

    const treinoPermitido =
      await treinoPertenceAoEscopo(
        escopo,
        treinoProgramadoId
      );

    if (!treinoPermitido) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_MISMATCH",

        error:
          "Este treino não pertence ao contexto ativo.",
      });
    }

    const treinoExercicios = await prisma.treinoProgramadoExercicio.findMany({
      where: { treinoProgramadoId },
      select: {
        ordem: true,
        repeticoes: true,
        series: true,
        duracao: true,
        descanso: true,
        exercicioId: true,
        exercicioTemporarioId: true,
        exercicioPersonalizadoId: true,
      },
    });

    const sessaoId = await prisma.$transaction(async (tx) => {
    const sessao = await tx.sessaoTreinoTurma.create({
      data: { treinoProgramadoId, turmaId, criadorId: usuarioId, data: dataBR },
    });

    const dadosExercicios = treinoExercicios.map((e, idx) => ({
      sessaoId: sessao.id,
      exercicioId: e.exercicioId ?? null,
      exercicioTemporarioId: e.exercicioTemporarioId ?? null,
      exercicioPersonalizadoId: e.exercicioPersonalizadoId ?? null, 
      ordem: e.ordem ?? idx + 1,
      concluido: false,
    }));

    if (dadosExercicios.length) {
      await tx.sessaoTreinoTurmaExercicio.createMany({ data: dadosExercicios });
    }

    const turmaComMembros = await tx.turma.findUnique({
      where: { id: turmaId },
      select: {
        id: true,
        membros: {
          select: {
            usuario: {
              select: {
                atleta: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    const atletaIds = (turmaComMembros?.membros ?? [])
      .map((m) => m.usuario?.atleta?.id)
      .filter((id): id is string => Boolean(id))
      .map(String);

    const atletaIdsUnicos = Array.from(new Set(atletaIds));

    if (atletaIdsUnicos.length) {
      await tx.treinoAgendado.createMany({
        data: atletaIdsUnicos.map((atletaId) => ({
          titulo: tituloTreino,
          dataTreino: dataBR,
          dataExpiracao: null,
          atletaId,
          treinoProgramadoId,
          turmaId,
        })),
        skipDuplicates: true,
      });
    }

    return sessao.id;
  });

    const sessaoCompleta = await prisma.sessaoTreinoTurma.findUnique({
      where: { id: sessaoId },
      include: {
        turma: true,
        treino: {
          select: {
            id: true,
            nome: true,
            pontuacao: true,
            duracao: true,
            exercicios: {
              select: {
                id: true,
                exercicioId: true,
                exercicioTemporarioId: true,
                exercicioPersonalizadoId: true,
                ordem: true,
                repeticoes: true,
                duracao:true,
                descanso: true,
                series: true,
                exercicio: {
                  select: {
                    id: true,
                    nome: true,
                    objetivo: true,
                    videoDemonstrativoUrl: true,
                  },
                },
                exercicioTemporario: {
                  select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
                },
                exercicioPersonalizado: { 
                  select: {
                    id: true,
                    nome: true,
                    descricao: true,
                    videoDemonstrativoUrl: true,
                    videoPosterUrl: true,
                  },
                },
              },
              orderBy: { ordem: "asc" },
            },
          },
        },
        exercicios: {
          select: {
            id: true,
            exercicioId: true,
            exercicioTemporarioId: true,
            exercicioPersonalizadoId: true, 
            ordem: true,
            concluido: true,
            concluidoEm: true,
            exercicio: {
              select: {
                id: true,
                nome: true,
                objetivo: true,
                videoDemonstrativoUrl: true,
              },
            },
            exercicioTemporario: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
            },
            exercicioPersonalizado: { 
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
              },
            },
          },
          orderBy: { ordem: "asc" },
        },
      },
    });

    return res.status(201).json(sessaoCompleta);
  } catch (err: any) {
    console.error("Erro criarSessao", err);
    return res.status(err.status || 500).json({
      error: err.message || "Erro ao criar sessão de treino para turma.",
    });
  }
}

export async function listarSessoesInstrutor(req: AuthenticatedRequest, res: Response) {
  try {
    const escopo =
      await assertInstrutor(
        req
      );

    const usuarioId =
      escopo.usuarioId;

    if (!usuarioId) return res.status(401).json({ error: "Usuário não autenticado." });

    const onlyToday = String(req.query.onlyToday || "") === "1";
    const { start: inicio, end: fim } = getTodayRangeBRT();

    let whereBase: any = {};

    if (onlyToday) {
      whereBase.data = { gte: inicio, lte: fim };
    }

    if (
      escopo.isAdmin
    ) {
      // Admin:
      // mantém somente os filtros
      // de data existentes.
    } else if (
      escopo.professorId
    ) {
      whereBase.turma = {
        professores: {
          some: {
            professorId:
              escopo.professorId,
          },
        },
      };
    } else if (
      escopo.clubeId
    ) {
      whereBase.turma = {
        clubeId:
          escopo.clubeId,
      };
    } else if (
      escopo.escolinhaId
    ) {
      whereBase.turma = {
        escolinhaId:
          escopo.escolinhaId,
      };
    }

    const sessoes = await prisma.sessaoTreinoTurma.findMany({
      where: whereBase,
      include: {
        turma: {
          select: {
            id: true,
            nome: true,
            categoria: true,
            clubeId: true,
            escolinhaId: true,
            professores: {
              select: {
                professorId: true,
                professor: {
                  select: {
                    id: true,
                    usuario: { select: { nome: true } },
                  },
                },
              },
            },
          },
        },
        treino: {
          select: {
            id: true,
            nome: true,
            pontuacao: true,
            duracao: true,
            clubeId: true,
            escolinhaId: true,
            professorId: true,
            exercicios: {
              select: {
                id: true,
                exercicioId: true,
                exercicioTemporarioId: true,
                exercicioPersonalizadoId: true, 
                ordem: true,
                repeticoes: true,
                series: true,
                duracao: true,
                descanso: true,
                exercicio: {
                  select: {
                    id: true,
                    nome: true,
                    objetivo: true,
                    videoDemonstrativoUrl: true,
                  },
                },
                exercicioTemporario: {
                  select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
                },
                exercicioPersonalizado: { 
                  select: {
                    id: true,
                    nome: true,
                    descricao: true,
                    videoDemonstrativoUrl: true,
                    videoPosterUrl: true,
                  },
                },
              },
              orderBy: { ordem: "asc" },
            },
          },
        },
        exercicios: {
          select: {
            id: true,
            exercicioId: true,
            exercicioTemporarioId: true,
            exercicioPersonalizadoId: true, 
            ordem: true,
            concluido: true,
            concluidoEm: true,
            exercicio: {
              select: {
                id: true,
                nome: true,
                objetivo: true,
                videoDemonstrativoUrl: true,
              },
            },
            exercicioTemporario: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
            },
            exercicioPersonalizado: { 
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
                videoPosterUrl: true,
              },
            },
          },
          orderBy: { ordem: "asc" },
        },
        presencas: {
          select: {
            id: true,
            atletaId: true,
            presente: true,
            atleta: {
              select: {
                id: true,
                usuario: { select: { nome: true } },
              },
            },
          },
        },
      },
      orderBy: { data: "asc" },
    });

    const enriquecidas = sessoes.map((sessao: any) => {
      const mapaExecucao = new Map<
        string,
        {
          repeticoes: string | null;
          series: number | null;
          duracao: string | null;
          descanso: string | null;
        }
      >();

      if (sessao.treino && Array.isArray(sessao.treino.exercicios)) {
        sessao.treino.exercicios.forEach((tpe: any) => {
          const key =
            tpe.exercicioId ? `E:${String(tpe.exercicioId)}`
            : tpe.exercicioTemporarioId ? `T:${String(tpe.exercicioTemporarioId)}`
            : tpe.exercicioPersonalizadoId ? `P:${String(tpe.exercicioPersonalizadoId)}`
            : "";

          if (!key) return;

          mapaExecucao.set(key, {
            repeticoes: tpe.repeticoes != null ? String(tpe.repeticoes) : null,
            series:
              tpe.series === null || tpe.series === undefined
                ? null
                : Number(tpe.series),
            duracao: tpe.duracao != null ? String(tpe.duracao) : null,
            descanso: tpe.descanso != null ? String(tpe.descanso) : null,
          });
        });
      }

      const exerciciosComDados = (Array.isArray(sessao.exercicios) ? sessao.exercicios : []).map((se: any) => {
        const key =
          se.exercicioId ? `E:${String(se.exercicioId)}`
          : se.exercicioTemporarioId ? `T:${String(se.exercicioTemporarioId)}`
          : se.exercicioPersonalizadoId ? `P:${String(se.exercicioPersonalizadoId)}`
          : "";

        const dadosExecucao = key ? mapaExecucao.get(key) : null;

        const video =
          se.exercicio?.videoDemonstrativoUrl ??
          se.exercicioTemporario?.videoDemonstrativoUrl ??
          se.exercicioPersonalizado?.videoDemonstrativoUrl ??
          null;

        const nome =
          se.exercicio?.nome ??
          se.exercicioTemporario?.nome ??
          se.exercicioPersonalizado?.nome ??
          null;

        const detalhes =
          se.exercicio?.objetivo ??
          se.exercicioTemporario?.descricao ??
          se.exercicioPersonalizado?.descricao ??
          null;

        const poster =
          se.exercicioPersonalizado?.videoPosterUrl ?? null;

        return {
          ...se,
          nome,
          detalhes,
          repeticoes: dadosExecucao?.repeticoes ?? null,
          series: dadosExecucao?.series ?? null,
          duracao: dadosExecucao?.duracao ?? null,
          descanso: dadosExecucao?.descanso ?? null,
          videoDemonstrativoUrl: video,
          videoPosterUrl: poster,
        };
      });

      return { ...sessao, exercicios: exerciciosComDados };
    });

    const nomesTemporariosSemVideo = new Set<string>();

    for (const sessao of enriquecidas as any[]) {
      for (const se of sessao.exercicios ?? []) {
        const nomeTmp = se.exercicioTemporario?.nome;
        const jaTemVideo =
          se.exercicioTemporario?.videoDemonstrativoUrl ||
          se.exercicio?.videoDemonstrativoUrl ||
          se.videoDemonstrativoUrl;

        if (nomeTmp && !jaTemVideo) {
          nomesTemporariosSemVideo.add(String(nomeTmp).trim());
        }
      }
    }

    if (nomesTemporariosSemVideo.size) {
      const nomes = Array.from(nomesTemporariosSemVideo);

      const exerciciosBase = await prisma.exercicio.findMany({
        where: {
          nome: { in: nomes, mode: "insensitive" },
          NOT: [{ videoDemonstrativoUrl: null }, { videoDemonstrativoUrl: "" }],
        },
        select: { nome: true, videoDemonstrativoUrl: true },
      });

      const mapaVideoPorNome = new Map<string, string>();
      exerciciosBase.forEach((e) => {
        if (e.videoDemonstrativoUrl) {
          mapaVideoPorNome.set(String(e.nome).trim().toLowerCase(), String(e.videoDemonstrativoUrl));
        }
      });

      for (const sessao of enriquecidas as any[]) {
        sessao.exercicios = (sessao.exercicios ?? []).map((se: any) => {
          const nomeTmp = se.exercicioTemporario?.nome;
          const temVideo =
            se.videoDemonstrativoUrl ||
            se.exercicio?.videoDemonstrativoUrl ||
            se.exercicioTemporario?.videoDemonstrativoUrl;

          if (!temVideo && nomeTmp) {
            const v = mapaVideoPorNome.get(String(nomeTmp).trim().toLowerCase());
            if (v) {
              return { ...se, videoDemonstrativoUrl: v };
            }
          }
          return se;
        });
      }
    }

    const final = (enriquecidas as any[]).map((s) => {
    const presentesNomes =
      (s.presencas ?? [])
        .filter((p: any) => p.presente)
        .map((p: any) => p.atleta?.usuario?.nome)
        .filter(Boolean)
        .map(String);

    const professoresNomes =
      (s.turma?.professores ?? [])
        .map((tp: any) => tp.professor?.usuario?.nome)
        .filter(Boolean)
        .map(String);

    return {
      ...s,
      presentesNomes,
      professoresNomes,
    };
  });

  return res.json(final);

  } catch (err: any) {
    console.error("Erro listarSessoesInstrutor:", err?.message, err?.code, err);
    return res.status(err.status || 500).json({
      error: err.message || "Erro ao listar sessões",
    });
  }
}

export async function iniciarSessao(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { id } = req.params;
    const presentesRaw = (req.body as any)?.presentes;
    const presentes: string[] = Array.isArray(presentesRaw)
      ? presentesRaw.map((x: any) => String(x))
      : [];

    if (!Array.isArray(presentesRaw)) {
      return res.status(400).json({
        error: "Campo 'presentes' é obrigatório e deve ser um array de atletaId.",
      });
    }

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      include: {
        turma: {
          include: {
            membros: {
              include: {
                usuario: {
                  include: {
                    atleta: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sessao)
      return res.status(404).json({ error: "Sessão não encontrada." });

    if (
      sessao.status === StatusSessaoTreinoTurma.FINALIZADO ||
      sessao.status === StatusSessaoTreinoTurma.CANCELADO
    ) {
      return res.status(400).json({ error: "Sessão já foi encerrada." });
    }

    if (sessao.status === StatusSessaoTreinoTurma.EM_ANDAMENTO) {
      return res.status(400).json({ error: "Sessão já está em andamento." });
    }

    const escopo =
      await assertInstrutor(
        req
      );

    const ok =
      await podeGerenciarSessao({
        escopo,

        sessaoId:
          String(id),
      });

    if (!ok) {
      return res.status(403).json({
        error: "Você não pode alterar uma sessão fora do seu escopo.",
      });
    }

    const atletasTurma =
      sessao.turma.membros
        .map((m) => m.usuario.atleta)
        .filter((a): a is NonNullable<typeof a> => !!a) || [];

    const presentesSet = new Set(presentes);
    const presencasData = atletasTurma.map((at) => ({
      atletaId: at.id,
      presente: presentesSet.has(at.id),
    }));

    await prisma.presencaSessaoTreino.deleteMany({
      where: { sessaoId: id },
    });

    await prisma.presencaSessaoTreino.createMany({
      data: presencasData.map((p) => ({
        sessaoId: id,
        atletaId: p.atletaId,
        presente: p.presente,
      })),
    });

    const atualizada = await prisma.sessaoTreinoTurma.update({
      where: { id },
      data: {
        status: StatusSessaoTreinoTurma.EM_ANDAMENTO,
        startedAt: new Date(),
      },
      include: {
        presencas: true,
      },
    });

    res.json(atualizada);
  } catch (err: any) {
    console.error("Erro iniciarSessao", err);
    res
      .status(err.status || 500)
      .json({ error: err.message || "Erro ao iniciar sessão" });
  }
}

export async function remarcarSessao(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { id } = req.params;
    const { novaDataISO, novaDataHoraISO } = req.body as {
      novaDataISO?: string;
      novaDataHoraISO?: string;
    };

    if (!novaDataISO && !novaDataHoraISO) {
      return res.status(400).json({
        error: "Campo 'novaDataHoraISO' (ou 'novaDataISO') é obrigatório.",
      });
    }

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
    });

    if (!sessao) {
      return res.status(404).json({ error: "Sessão não encontrada." });
    }

    const escopo =
      await assertInstrutor(
        req
      );

    const ok =
      await podeGerenciarSessao({
        escopo,

        sessaoId:
          String(id),
      });

    if (!ok) {
      return res.status(403).json({
        error: "Você não pode remarcar uma sessão fora do seu escopo.",
      });
    }

    const raw = String(novaDataHoraISO || novaDataISO || "").trim();
    if (!raw) {
      return res.status(400).json({ error: "Campo 'novaDataHoraISO' (ou 'novaDataISO') é obrigatório." });
    }

    const novaData = parseDateInput(raw);
    if (!novaData) {
      return res.status(400).json({ error: "novaDataHoraISO/novaDataISO inválida." });
    }

    const atualizada = await prisma.$transaction(async (tx) => {
      const sessaoAtualizada = await tx.sessaoTreinoTurma.update({
        where: { id },
        data: {
          data: novaData,
          status: StatusSessaoTreinoTurma.AGENDADO,
          startedAt: null,
          finishedAt: null,
        },
      });

      await tx.treinoAgendado.updateMany({
        where: {
          treinoProgramadoId: sessao.treinoProgramadoId,
          turmaId: sessao.turmaId,
          dataTreino: sessao.data,
        },
        data: { dataTreino: novaData },
      });

      return sessaoAtualizada;
    });

    return res.json(atualizada);
  } catch (err: any) {
    console.error("Erro remarcarSessao", err);
    res
      .status(err.status || 500)
      .json({ error: err.message || "Erro ao remarcar sessão" });
  }
}

export async function atualizarProgresso(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { exerciciosConcluidosIds } = req.body as { exerciciosConcluidosIds: string[] };

    if (!Array.isArray(exerciciosConcluidosIds)) {
      return res.status(400).json({ error: "Campo 'exerciciosConcluidosIds' deve ser um array de IDs." });
    }

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      include: { exercicios: true },
    });

    if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });

    const escopo =
      await assertInstrutor(
        req
      );

    const ok =
      await podeGerenciarSessao({
        escopo,

        sessaoId:
          String(id),
      });

    if (!ok) {
      return res.status(403).json({
        error: "Você não pode alterar uma sessão fora do seu escopo.",
      });
    }

    const concluidoSet = new Set(exerciciosConcluidosIds);
    const updates = sessao.exercicios.map((ex) =>
      prisma.sessaoTreinoTurmaExercicio.update({
        where: { id: ex.id },
        data: {
          concluido: concluidoSet.has(ex.id),
          concluidoEm: concluidoSet.has(ex.id) ? new Date() : null,
        },
      }),
    );

    await Promise.all(updates);

    const atualizada = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      include: { exercicios: true },
    });

    return res.json(atualizada);
  } catch (err: any) {
    console.error("Erro atualizarProgresso", err);
    return res.status(err.status || 500).json({ error: err.message || "Erro ao atualizar progresso" });
  }
}

export async function finalizarSessao(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { id } = req.params;
    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      include: {
        treino: true,
        presencas: {
          include: {
            atleta: {
              select: {
                id: true,
                usuarioId: true,
              },
            },
          },
        },
      },
    });

    if (!sessao)
      return res.status(404).json({ error: "Sessão não encontrada." });

    const escopo =
      await assertInstrutor(
        req
      );

    const ok =
      await podeGerenciarSessao({
        escopo,

        sessaoId:
          String(id),
      });

    if (!ok) {
      return res.status(403).json({
        error: "Você não pode alterar uma sessão fora do seu escopo.",
      });
    }

    if (sessao.status !== StatusSessaoTreinoTurma.EM_ANDAMENTO && sessao.status !== StatusSessaoTreinoTurma.AGENDADO) {
      return res
        .status(400)
        .json({ error: "Sessão já foi finalizada ou cancelada." });
    }

    const agora = new Date();

    const inicio = sessao.startedAt ?? sessao.data;
    const diffMs = Math.max(0, agora.getTime() - inicio.getTime());
    const minutosReal = Math.max(1, Math.round(diffMs / 60000));

    const minutosBase =
      typeof sessao.treino.duracao === "number" && sessao.treino.duracao > 0
        ? sessao.treino.duracao
        : minutosReal;

    let penalidadeAtraso = false;
    let minutosConsiderados = minutosBase;

    if (minutosReal > minutosBase + 2) {
      penalidadeAtraso = true;
      minutosConsiderados = Math.max(1, Math.round(minutosBase / 2));
    }

    const pontosBase = sessao.treino.pontuacao ?? 0;
    const pontosAplicados = penalidadeAtraso
      ? Math.round(pontosBase / 2)
      : pontosBase;

    const presentes = sessao.presencas.filter(
      (p: any) => p.presente && p.atleta,
    );

    const updatesPontuacao = presentes.map((p: any) =>
      prisma.pontuacaoAtleta.upsert({
        where: { atletaId: p.atletaId },
        update: { pontuacaoTotal: { increment: pontosAplicados } },
        create: {
          atletaId: p.atletaId,
          pontuacaoTotal: pontosAplicados,
        },
      }),
    );

    const atividades = presentes
      .filter((p: any) => p.atleta?.usuarioId)
      .map((p: any) =>
        prisma.atividadeRecente.create({
          data: {
            usuarioId:
              p.atleta.usuarioId!,

            tipo: "TREINO_TURMA",

            titulo:
              sessao.treino?.nome ??
              "Treino em turma",

            imagemUrl:
              sessao.treino?.imagemUrl ??
              null,

            link: "/trainings",
          },
        }),
      );

    await Promise.all([...updatesPontuacao, ...atividades]);

    const finalizada = await prisma.sessaoTreinoTurma.update({
      where: { id },
      data: {
        status: StatusSessaoTreinoTurma.FINALIZADO,
        finishedAt: agora,
        duracaoMinutosReal: minutosReal,
        penalidadeAtraso,
      },
      include: {
        presencas: true,
      },
    });

    res.json({
      ...finalizada,
      minutosReal,
      minutosConsiderados,
      pontosAplicadosPorAtleta: pontosAplicados,
      penalidadeAtraso,
    });
  } catch (err: any) {
    console.error("Erro finalizarSessao", err);
    res
      .status(err.status || 500)
      .json({ error: err.message || "Erro ao finalizar sessão" });
  }
}

export async function excluirSessao(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { id } = req.params;

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      include: {
        exercicios: true,
        presencas: true,
      },
    });

    if (!sessao) {
      return res.status(404).json({ error: "Sessão não encontrada." });
    }

    const escopo =
      await assertInstrutor(
        req
      );

    const ok =
      await podeGerenciarSessao({
        escopo,

        sessaoId:
          String(id),
      });

    if (!ok) {
      return res.status(403).json({
        error: "Você não pode excluir uma sessão fora do seu escopo.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.treinoAgendado.deleteMany({
        where: {
          treinoProgramadoId: sessao.treinoProgramadoId,
          turmaId: sessao.turmaId,
          dataTreino: sessao.data,
        },
      });

      await tx.presencaSessaoTreino.deleteMany({
        where: { sessaoId: id },
      });

      await tx.sessaoTreinoTurmaExercicio.deleteMany({
        where: { sessaoId: id },
      });

      await tx.sessaoTreinoTurma.delete({
        where: { id },
      });
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Erro excluirSessao", err);
    res.status(err.status || 500).json({
      error: err.message || "Erro ao excluir sessão",
    });
  }
}

export async function obterSessao(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      include: {
        treino: { select: { id: true, nome: true, pontuacao: true, duracao: true } },
        turma: { select: { id: true, nome: true, clubeId: true, escolinhaId: true } },
        presencas: {
          include: {
            atleta: {
              select: {
                id: true,
                usuario: { select: { nome: true } },
              },
            },
          },
        },
      },
    });

    if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });

    const escopo =
      await assertInstrutor(
        req
      );

    const ok =
      await podeGerenciarSessao({
        escopo,

        sessaoId:
          String(id),
      });

    if (!ok) {
      return res.status(403).json({
        error: "Você não pode acessar uma sessão fora do seu escopo.",
      });
    }

    const alunos = (sessao.presencas || []).map((p: any) => ({
      atletaId: String(p.atletaId),
      presente: Boolean(p.presente),
      nome: p.atleta?.usuario?.nome ?? "Atleta",
    }));

    const presentes = alunos.filter((a) => a.presente);

    return res.json({
      id: sessao.id,
      status: sessao.status,
      treino: sessao.treino,
      turma: sessao.turma,
      alunos,     
      presentes,   
    });
  } catch (err: any) {
    console.error("Erro obterSessao", err);
    return res.status(err.status || 500).json({ error: err.message || "Erro ao obter sessão" });
  }
}

export async function salvarVideosExecucaoSessao(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { id } = req.params; 
    const escopo =
      await assertInstrutor(
        req
      );

    const ok =
      await podeGerenciarSessao({
        escopo,

        sessaoId:
          String(id),
      });

    if (!ok) {
      return res.status(403).json({
        error: "Você não pode alterar uma sessão fora do seu escopo.",
      });
    }

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      select: {
        id: true,
        treinoProgramadoId: true,
        turmaId: true,
      },
    });

    if (!sessao) {
      return res.status(404).json({ error: "Sessão não encontrada." });
    }

    const { updates } = req.body as {
      updates?: Array<{
        exerciseRowId: string;
        kind: "catalogo" | "temporario" | "personalizado";
        entityId: string;
        existingUrl?: string | null;
        uploadedUrl: string;
        selectedUrl?: string | null;
        saveMode: "SESSION_ONLY" | "UPDATE_OFFICIAL";
        officialChoice?: "KEEP_OLD" | "USE_NEW" | null;
      }>;
    };

    if (!Array.isArray(updates) || !updates.length) {
      return res.status(400).json({ error: "Nenhuma atualização enviada." });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of updates) {
        if (!item.uploadedUrl) continue;

        let kind = item.kind;
        let entityId = item.entityId;

        if (item.exerciseRowId) {
          const row = await tx.sessaoTreinoTurmaExercicio.findUnique({
            where: { id: item.exerciseRowId },
            select: {
              exercicioId: true,
              exercicioTemporarioId: true,
              exercicioPersonalizadoId: true,
            },
          });

          if (row?.exercicioId) {
            kind = "catalogo";
            entityId = row.exercicioId;
          } else if (row?.exercicioTemporarioId) {
            kind = "temporario";
            entityId = row.exercicioTemporarioId;
          } else if (row?.exercicioPersonalizadoId) {
            kind = "personalizado";
            entityId = row.exercicioPersonalizadoId;
          }
        }

        if (!entityId) continue;

        const usuarioId =
         escopo.usuarioId;

        if (item.saveMode === "SESSION_ONLY") {
          await tx.midia.create({
            data: {
              titulo: `Execução do exercício ${item.exerciseRowId}`,
              tipo: TipoMidia.Video,
              url: item.uploadedUrl,
              dataEnvio: new Date(),
              descricao: JSON.stringify({
                origem: "sessao_turma_execucao_instrutor",
                sessaoId: id,
                treinoProgramadoId: sessao.treinoProgramadoId,
                turmaId: sessao.turmaId,
                exerciseRowId: item.exerciseRowId,
                kind: item.kind,
                entityId: item.entityId,
                criadoPorUsuarioId: usuarioId,
              }),
              storageClass: "HOT" as any,
            } as any,
          });

          continue;
        }

        if (item.saveMode === "UPDATE_OFFICIAL") {
          if (item.officialChoice === "KEEP_OLD") {
            continue;
          }

          if (item.officialChoice !== "USE_NEW") {
            continue;
          }

          if (kind === "catalogo") {
            const atual = await tx.exercicio.findUnique({
              where: { id: entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicio.update({
              where: { id: entityId },
              data: {
                videoDemonstrativoUrl: item.uploadedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.uploadedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }

            continue;
          }

          if (kind === "temporario") {
            const atual = await tx.exercicioTemporario.findUnique({
              where: { id: entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicioTemporario.update({
              where: { id: entityId },
              data: {
                videoDemonstrativoUrl: item.uploadedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.uploadedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }

            continue;
          }

          if (kind === "personalizado") {
            const atual = await tx.exercicioPersonalizado.findUnique({
              where: { id: entityId },
              select: { videoDemonstrativoUrl: true },
            });

            await tx.exercicioPersonalizado.update({
              where: { id: entityId },
              data: {
                videoDemonstrativoUrl: item.uploadedUrl,
              },
            });

            if (
              atual?.videoDemonstrativoUrl &&
              atual.videoDemonstrativoUrl !== item.uploadedUrl &&
              atual.videoDemonstrativoUrl.includes("amazonaws.com")
            ) {
              await deleteFromS3(atual.videoDemonstrativoUrl);
            }

            continue;
          }
        }
      }
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Erro salvarVideosExecucaoSessao", err);
    return res.status(err.status || 500).json({
      error: err.message || "Erro ao salvar vídeos da sessão.",
    });
  }
}