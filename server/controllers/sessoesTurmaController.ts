import type { Response } from "express";
import { PrismaClient, StatusSessaoTreinoTurma } from "@prisma/client";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

function assertInstrutor(req: AuthenticatedRequest) {
  const u: any = req.authUser || (req as any).user || {};

  const tipoRaw =
    typeof u.tipo === "string"
      ? u.tipo.toLowerCase()
      : String(u.tipo || "").toLowerCase();

  const isInstrutor =
    ["professor", "clube", "escolinha"].includes(tipoRaw) || u.isAdmin === true;

  if (!isInstrutor) {
    const err: any = new Error(
      "Apenas professor / clube / escolinha podem controlar sessões de turma.",
    );
    err.status = 403;
    throw err;
  }
}

export async function criarSessao(req: AuthenticatedRequest, res: Response) {
  try {
    assertInstrutor(req);

    const u: any = req.authUser || (req as any).user;
    const usuarioId = String(u.id || "");

    const { treinoProgramadoId, turmaId, dataISO } = req.body as {
      treinoProgramadoId: string;
      turmaId: string;
      dataISO: string;
    };

    if (!treinoProgramadoId || !turmaId || !dataISO) {
      return res.status(400).json({
        error: "treinoProgramadoId, turmaId e dataISO são obrigatórios.",
      });
    }

    const apenasData = dataISO.slice(0, 10);
    const dataBR = new Date(`${apenasData}T00:00:00-03:00`);
    if (isNaN(dataBR.getTime())) {
      return res.status(400).json({ error: "dataISO inválida." });
    }

    const [professor, clube, escolinha] = await Promise.all([
      prisma.professor.findUnique({ where: { usuarioId } }),
      prisma.clube.findUnique({ where: { usuarioId } }),
      prisma.escolinha.findUnique({ where: { usuarioId } }),
    ]);

    const donoProfessorId = professor?.id ?? null;
    const donoClubeId = clube?.id ?? null;
    const donoEscolinhaId = escolinha?.id ?? null;

    const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
    if (!turma) return res.status(404).json({ error: "Turma não encontrada." });

    const turmaPertenceAoDono =
      (donoProfessorId && turma.professorId === donoProfessorId) ||
      (donoClubeId && turma.clubeId === donoClubeId) ||
      (donoEscolinhaId && turma.escolinhaId === donoEscolinhaId);

    if (!turmaPertenceAoDono) {
      return res.status(403).json({
        error: "Você não pode agendar sessão para uma turma que não é sua.",
      });
    }

    const treino = await prisma.treinoProgramado.findUnique({
      where: { id: treinoProgramadoId },
      select: {
        id: true,
        professorId: true,
        clubeId: true,
        escolinhaId: true,
      },
    });

    if (!treino) {
      return res.status(404).json({ error: "Treino programado não encontrado." });
    }

    const treinoPertenceAoDono =
      (donoProfessorId && treino.professorId === donoProfessorId) ||
      (donoClubeId && treino.clubeId === donoClubeId) ||
      (donoEscolinhaId && treino.escolinhaId === donoEscolinhaId);

    if (!treinoPertenceAoDono) {
      return res.status(403).json({
        error: "Você não pode agendar sessão com um treino que não é seu.",
      });
    }

    const treinoExercicios = await prisma.treinoProgramadoExercicio.findMany({
      where: { treinoProgramadoId },
      select: {
        exercicioId: true,
        exercicioTemporarioId: true,
        ordem: true,
        repeticoes: true,
      },
      orderBy: { ordem: "asc" },
    });

    const sessaoId = await prisma.$transaction(async (tx) => {
    const sessao = await tx.sessaoTreinoTurma.create({
      data: { treinoProgramadoId, turmaId, criadorId: usuarioId, data: dataBR },
    });

    const dadosExercicios = treinoExercicios.map((e, idx) => ({
      sessaoId: sessao.id,
      exercicioId: e.exercicioId ?? null,
      exercicioTemporarioId: e.exercicioTemporarioId ?? null,
      ordem: e.ordem ?? idx + 1,
      concluido: false,
    }));

    if (dadosExercicios.length) {
      await tx.sessaoTreinoTurmaExercicio.createMany({ data: dadosExercicios });
    }

    return sessao.id;
  });

    // ✅ devolve completo (inclui temporários também)
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
                ordem: true,
                repeticoes: true,
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
            ordem: true,
            concluido: true,
            concluidoEm: true,
            exercicio: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
              },
            },
            exercicioTemporario: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
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
    assertInstrutor(req);

    const u: any = req.authUser || (req as any).user || {};
    const usuarioId = String(u.id || "");
    if (!usuarioId) return res.status(401).json({ error: "Usuário não autenticado." });

    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);

    const sessoes = await prisma.sessaoTreinoTurma.findMany({
      where: {
        criadorId: usuarioId,
        data: { gte: inicio, lte: fim },
      },
      include: {
        turma: true,
        treino: {
          select: {
            id: true,
            nome: true,
            pontuacao: true,
            duracao: true,
            exercicios: {
              // ✅ aqui é TreinoProgramadoExercicio (NÃO tem concluido/concluidoEm)
              select: {
                id: true,
                exercicioId: true,
                exercicioTemporarioId: true,
                ordem: true,
                repeticoes: true,
                exercicio: {
                  select: {
                    id: true,
                    nome: true,
                    descricao: true,
                    videoDemonstrativoUrl: true,
                  },
                },
                exercicioTemporario: {
                  select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
                },
              },
              orderBy: { ordem: "asc" },
            },
          },
        },
        exercicios: {
          // ✅ aqui é SessaoTreinoTurmaExercicio
          select: {
            id: true,
            exercicioId: true,
            exercicioTemporarioId: true,
            ordem: true,
            concluido: true,
            concluidoEm: true,
            exercicio: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                videoDemonstrativoUrl: true,
              },
            },
            exercicioTemporario: {
              select: { id: true, nome: true, descricao: true, videoDemonstrativoUrl: true },
            },
          },
          orderBy: { ordem: "asc" },
        },
      },
      orderBy: { data: "asc" },
    });

    // 🔥 merge de reps (funciona para normal e temporário)
    const enriquecidas = sessoes.map((sessao: any) => {
      const mapaReps = new Map<string, string | null>();

      if (sessao.treino && Array.isArray(sessao.treino.exercicios)) {
        sessao.treino.exercicios.forEach((tpe: any) => {
          const key =
            tpe.exercicioId
              ? `E:${String(tpe.exercicioId)}`
              : tpe.exercicioTemporarioId
                ? `T:${String(tpe.exercicioTemporarioId)}`
                : "";

          if (!key) return;
          mapaReps.set(key, tpe.repeticoes != null ? String(tpe.repeticoes) : null);
        });
      }

      const exerciciosComReps = (Array.isArray(sessao.exercicios) ? sessao.exercicios : []).map((se: any) => {
        const key =
          se.exercicioId ? `E:${String(se.exercicioId)}`
          : se.exercicioTemporarioId ? `T:${String(se.exercicioTemporarioId)}`
          : "";

        const video =
          se.exercicio?.videoDemonstrativoUrl ??
          se.exercicioTemporario?.videoDemonstrativoUrl ??
          null;

        return {
          ...se,
          repeticoes: (key && mapaReps.get(key)) ?? null,
          videoDemonstrativoUrl: video, // ✅ pronto pro front
        };
      });

      return { ...sessao, exercicios: exerciciosComReps };
    });

    // ✅ fallback: se temporário não tem videoDemonstrativoUrl, tenta achar pelo nome em Exercicio
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

  // injeta vídeo no payload (sem precisar atualizar o banco)
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

    return res.json(enriquecidas);
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
    assertInstrutor(req);
    const { id } = req.params;
    const { presentes } = req.body as { presentes: string[] };

    if (!Array.isArray(presentes)) {
      return res.status(400).json({
        error:
          "Campo 'presentes' é obrigatório e deve ser um array de atletaId.",
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

    const u: any = req.authUser || req.user;
    const usuarioId = u.id as string;

    if (sessao.criadorId !== usuarioId && !u.isAdmin) {
      return res.status(403).json({
        error: "Você não pode alterar uma sessão criada por outro usuário.",
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
    assertInstrutor(req);

    const { id } = req.params;
    const { novaDataISO } = req.body as { novaDataISO?: string };

    if (!novaDataISO) {
      return res
        .status(400)
        .json({ error: "Campo 'novaDataISO' é obrigatório." });
    }

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
    });

    if (!sessao) {
      return res.status(404).json({ error: "Sessão não encontrada." });
    }

    const u: any = req.authUser || req.user;
    const usuarioId = u.id as string;

    if (sessao.criadorId !== usuarioId && !u.isAdmin) {
      return res.status(403).json({
        error: "Você não pode remarcar uma sessão criada por outro usuário.",
      });
    }

    // 👇 aqui entra o trecho que você mandou
    const apenasData = novaDataISO.slice(0, 10);
    const novaData = new Date(`${apenasData}T00:00:00-03:00`);

    const atualizada = await prisma.sessaoTreinoTurma.update({
      where: { id },
      data: {
        data: novaData,       // campo certo do schema
        status: StatusSessaoTreinoTurma.AGENDADO,   // volta para agendado
        startedAt: null,
        finishedAt: null,
      },
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
    assertInstrutor(req);
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

    const u: any = req.authUser || req.user;
    const usuarioId = u.id as string;

    if (sessao.criadorId !== usuarioId && !u.isAdmin) {
      return res.status(403).json({ error: "Você não pode alterar uma sessão criada por outro usuário." });
    }

    const concluidoSet = new Set(exerciciosConcluidosIds);

    const updates = sessao.exercicios.map((ex) =>
      prisma.sessaoTreinoTurmaExercicio.update({
        where: { id: ex.id },
        data: {
          // ✅ compara pelo ID da tabela de sessão
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
    assertInstrutor(req);
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

    const u: any = req.authUser || req.user;
    const usuarioId = u.id as string;

    if (sessao.criadorId !== usuarioId && !u.isAdmin) {
      return res.status(403).json({
        error: "Você não pode alterar uma sessão criada por outro usuário.",
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

    if (minutosReal > minutosBase + 5) {
      penalidadeAtraso = true;
      minutosConsiderados = Math.max(1, Math.round(minutosBase / 2));
      console.log("[SessaoTurma] Penalidade atraso aplicada", {
        sessaoId: sessao.id,
        minutosReal,
        minutosBase,
        minutosConsiderados,
      });
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
            usuarioId: p.atleta.usuarioId!,
            tipo: "TREINO_TURMA",
            imagemUrl: null,
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
    assertInstrutor(req);

    const { id } = req.params;
    const u: any = req.authUser || req.user;
    const usuarioId = u.id as string;

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

    // 🔒 segurança: só quem criou (ou admin) pode excluir
    if (sessao.criadorId !== usuarioId && !u.isAdmin) {
      return res.status(403).json({
        error: "Você não pode excluir uma sessão criada por outro usuário.",
      });
    }

    // 🧹 limpar dependências primeiro
    await prisma.presencaSessaoTreino.deleteMany({
      where: { sessaoId: id },
    });

    await prisma.sessaoTreinoTurmaExercicio.deleteMany({
      where: { sessaoId: id },
    });

    // 🗑️ excluir a sessão
    await prisma.sessaoTreinoTurma.delete({
      where: { id },
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
    assertInstrutor(req);

    const { id } = req.params;
    const u: any = req.authUser || (req as any).user || {};
    const usuarioId = String(u.id || "");

    const sessao = await prisma.sessaoTreinoTurma.findUnique({
      where: { id },
      include: {
        treino: { select: { id: true, nome: true, pontuacao: true, duracao: true } },
        turma: { select: { id: true, nome: true, professorId: true, clubeId: true, escolinhaId: true } },
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

    // 🔒 segurança: só criador (ou admin) pode ver
    if (sessao.criadorId !== usuarioId && !u.isAdmin) {
      return res.status(403).json({ error: "Você não pode acessar uma sessão criada por outro usuário." });
    }

    // ✅ devolve presentes (e também todos, se você quiser usar depois)
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
      alunos,      // todos
      presentes,   // só os presentes
    });
  } catch (err: any) {
    console.error("Erro obterSessao", err);
    return res.status(err.status || 500).json({ error: err.message || "Erro ao obter sessão" });
  }
}
