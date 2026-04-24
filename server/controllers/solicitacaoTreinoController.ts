import { Response, Request } from "express";
import { prisma } from "../prisma.js";
import { resolveClubeId, resolveEscolinhaId } from "../services/formadores.service.js";
import { NotificacaoTipo } from "@prisma/client";
import { recomputeAndEmitBadge } from "./notificacoesController.js";

const getBase = (req: Request) =>
  process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;

const absFoto = (req: Request, f?: string | null) =>
  f
    ? (/^(https?:|data:|blob:)/i.test(f)
        ? f
        : `${getBase(req)}${f.startsWith("/") ? f : `/${f}`}`)
    : null;

async function autoVincularAtleta(
  atletaUsuarioId: string,
  outroUsuarioId: string
) {
  const [uAtleta, uOutro] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: atletaUsuarioId }, select: { id: true, tipo: true } }),
    prisma.usuario.findUnique({ where: { id: outroUsuarioId },  select: { id: true, tipo: true } }),
  ]);
  if (!uAtleta || !uOutro || uAtleta.tipo !== "Atleta") return;

  const atleta = await prisma.atleta.findUnique({ where: { usuarioId: uAtleta.id }, select: { id: true } });
  if (!atleta) return;

  if (uOutro.tipo === "Clube") {
    const clubeId = await resolveClubeId(uOutro.id);
    if (!clubeId) return;

    await prisma.$transaction(async (tx) => {
      await tx.atleta.update({ where: { id: atleta.id }, data: { clubeId } });

      const existe = await tx.relacaoTreinamento.findFirst({ where: { atletaId: atleta.id, clubeId } });
      if (!existe) {
        await tx.relacaoTreinamento.deleteMany({ where: { atletaId: atleta.id, clubeId: { not: clubeId } } });
        await tx.relacaoTreinamento.create({ data: { atletaId: atleta.id, clubeId } });
      }

      const jaTem = await tx.vinculoFormacao.findFirst({
        where: { atletaId: atleta.id, origem: "Clube", origemId: clubeId },
      });
      if (!jaTem) {
        await tx.vinculoFormacao.create({
          data: { atletaId: atleta.id, origem: "Clube", origemId: clubeId },
        });
      }
    });
  } else if (uOutro.tipo === "Escolinha") {
    const escolinhaId = await resolveEscolinhaId(uOutro.id);
    if (!escolinhaId) return;

    await prisma.$transaction(async (tx) => {
      await tx.atleta.update({ where: { id: atleta.id }, data: { escolinhaId } });

      const existe = await tx.relacaoTreinamento.findFirst({ where: { atletaId: atleta.id, escolinhaId } });
      if (!existe) {
        await tx.relacaoTreinamento.deleteMany({ where: { atletaId: atleta.id, escolinhaId: { not: escolinhaId } } });
        await tx.relacaoTreinamento.create({ data: { atletaId: atleta.id, escolinhaId } });
      }

      const jaTem = await tx.vinculoFormacao.findFirst({
        where: { atletaId: atleta.id, origem: "Escolinha", origemId: escolinhaId },
      });
      if (!jaTem) {
        await tx.vinculoFormacao.create({
          data: { atletaId: atleta.id, origem: "Escolinha", origemId: escolinhaId },
        });
      }
    });
  }
}

export async function listarSolicitacoesMinhas(req: Request, res: Response) {
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Não autenticado." });

  try {
    const rows = await prisma.solicitacaoTreino.findMany({
      where: { remetenteId: me },             
      include: {
        destinatario: {
          select: { id: true, nomeDeUsuario: true, nome: true, foto: true },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const payload = rows.map((s) => ({
      id: s.id,
      status: s.status,
      criadaEm: s.criadoEm,
      destinatarioId: s.destinatarioId,
      destinatario: {
        id: s.destinatario.id,
        nomeDeUsuario: s.destinatario.nomeDeUsuario,
        nome: s.destinatario.nome,
        foto: absFoto(req, s.destinatario.foto),   
      },
    }));

    return res.json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Falha ao listar solicitações" });
  }
}

export async function listarSolicitacoesRecebidas(req: Request, res: Response) {
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Usuário não autenticado." });

  try {
    const rows = await prisma.solicitacaoTreino.findMany({
      where: { destinatarioId: me, status: { in: ["pendente", "ativa"] } }, 
      include: {
        remetente: {
          select: { id: true, nomeDeUsuario: true, nome: true, foto: true },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const payload = rows.map((s) => ({
      id: s.id,
      status: s.status,               
      criadaEm: s.criadoEm,
      remetenteId: s.remetenteId,
      remetente: {
        id: s.remetente.id,
        nomeDeUsuario: s.remetente.nomeDeUsuario,
        nome: s.remetente.nome,
        foto: absFoto(req, s.remetente.foto),
      },
    }));

    return res.json(payload);
  } catch (error) {
    console.error("Erro ao listar solicitações recebidas:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function criarSolicitacao(req: Request, res: Response) {
  try {
    const remetenteId: string | undefined = (req as any).user?.id || (req as any).userId;
    const { destinatarioId } = (req.body ?? {}) as { destinatarioId?: string };

    if (!remetenteId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    if (!destinatarioId) {
      return res.status(400).json({ message: "destinatarioId é obrigatório" });
    }

    if (remetenteId === destinatarioId) {
      return res.status(400).json({ message: "Não é permitido enviar para si mesmo." });
    }

    const usuarioDestino = await prisma.usuario.findUnique({
      where: { id: destinatarioId },
      select: { id: true, tipo: true },
    });

    if (!usuarioDestino) {
      return res.status(400).json({
        message: "destinatarioId inválido. Envie o id do Usuario, não o id da entidade.",
      });
    }

    const usuarioOrigem = await prisma.usuario.findUnique({
      where: { id: remetenteId },
      select: { id: true, tipo: true },
    });

    if (!usuarioOrigem || !usuarioDestino) {
      return res.status(404).json({
        message: "Usuário de origem ou destino não encontrado.",
      });
    }

    const tipoOrigem = usuarioOrigem.tipo;
    const tipoDestino = usuarioDestino.tipo;

    const ehAtletaComPermitido =
      (tipoOrigem === "Atleta" && ["Professor", "Clube", "Escolinha"].includes(tipoDestino)) ||
      (tipoDestino === "Atleta" && ["Professor", "Clube", "Escolinha"].includes(tipoOrigem));

    const ehProfessorComClube =
      (tipoOrigem === "Professor" && tipoDestino === "Clube") ||
      (tipoOrigem === "Clube" && tipoDestino === "Professor");

    const ehProfessorComEscolinha =
      (tipoOrigem === "Professor" && tipoDestino === "Escolinha") ||
      (tipoOrigem === "Escolinha" && tipoDestino === "Professor");

    const ehProfessorComProfessor =
      tipoOrigem === "Professor" && tipoDestino === "Professor";

    if (
      !ehAtletaComPermitido &&
      !ehProfessorComClube &&
      !ehProfessorComEscolinha &&
      !ehProfessorComProfessor
    ) {
      return res.status(400).json({
        message:
          "Essa solicitação não é permitida. Apenas atleta com professor/clube/escolinha e professor com clube/escolinha/professor podem treinar juntos.",
      });
    }

    if (
      (tipoOrigem === "Clube" && tipoDestino === "Escolinha") ||
      (tipoOrigem === "Escolinha" && tipoDestino === "Clube")
    ) {
      return res.status(400).json({
        message:
          "Clube e escolinha não podem treinar juntos. Apenas professor pode se vincular com clube ou escolinha, e atleta pode se vincular com todos eles.",
      });
    }

    if (tipoOrigem === "Professor" && tipoDestino === "Professor") {
      const [a, b] =
        remetenteId < destinatarioId
          ? [remetenteId, destinatarioId]
          : [destinatarioId, remetenteId];

      const existe = await prisma.professorParceiro.findFirst({
        where: {
          professorA: { usuarioId: a },
          professorB: { usuarioId: b },
        },
      });

      if (existe) {
        return res.status(409).json({
          message: "Vocês já possuem vínculo entre professores.",
        });
      }
    }

    if (ehProfessorComClube) {
      const professorUsuarioId =
        tipoOrigem === "Professor" ? remetenteId : destinatarioId;
      const clubeUsuarioId =
        tipoOrigem === "Clube" ? remetenteId : destinatarioId;

      const [professor, clube] = await Promise.all([
        prisma.professor.findUnique({
          where: { usuarioId: professorUsuarioId },
          select: { id: true },
        }),
        prisma.clube.findUnique({
          where: { usuarioId: clubeUsuarioId },
          select: { id: true },
        }),
      ]);

      if (professor?.id && clube?.id) {
        const existe = await prisma.professorClube.findUnique({
          where: {
            professorId_clubeId: {
              professorId: professor.id,
              clubeId: clube.id,
            },
          },
        });

        if (existe) {
          return res.status(409).json({
            message: "Vocês já possuem vínculo entre professor e clube.",
          });
        }
      }
    }

    if (ehProfessorComEscolinha) {
      const professorUsuarioId =
        tipoOrigem === "Professor" ? remetenteId : destinatarioId;
      const escolinhaUsuarioId =
        tipoOrigem === "Escolinha" ? remetenteId : destinatarioId;

      const [professor, escolinha] = await Promise.all([
        prisma.professor.findUnique({
          where: { usuarioId: professorUsuarioId },
          select: { id: true },
        }),
        prisma.escolinha.findUnique({
          where: { usuarioId: escolinhaUsuarioId },
          select: { id: true },
        }),
      ]);

      if (professor?.id && escolinha?.id) {
        const existe = await prisma.professorEscolinha.findUnique({
          where: {
            professorId_escolinhaId: {
              professorId: professor.id,
              escolinhaId: escolinha.id,
            },
          },
        });

        if (existe) {
          return res.status(409).json({
            message: "Vocês já possuem vínculo entre professor e escolinha.",
          });
        }
      }
    }

    const rel = await prisma.relacaoTreinamento.findFirst({
      where: {
        OR: [
          { atleta: { usuarioId: remetenteId }, professor: { usuarioId: destinatarioId } },
          { atleta: { usuarioId: destinatarioId }, professor: { usuarioId: remetenteId } },
          { atleta: { usuarioId: remetenteId }, clube: { usuarioId: destinatarioId } },
          { atleta: { usuarioId: destinatarioId }, clube: { usuarioId: remetenteId } },
          { atleta: { usuarioId: remetenteId }, escolinha: { usuarioId: destinatarioId } },
          { atleta: { usuarioId: destinatarioId }, escolinha: { usuarioId: remetenteId } },
        ],
      },
    });

    if (rel) {
      return res.status(409).json({
        message: "Vocês já possuem vínculo de treinamento.",
        jaVinculados: true,
      });
    }

    const existente = await prisma.solicitacaoTreino.findFirst({
      where: {
        status: { in: ["pendente", "ativa"] },
        OR: [
          { remetenteId, destinatarioId },
          { remetenteId: destinatarioId, destinatarioId: remetenteId },
        ],
      },
    });

    if (existente) {
      return res.status(200).json({ ...existente, ok: true });
    }

    const row = await prisma.solicitacaoTreino.create({
      data: { remetenteId, destinatarioId, status: "pendente" },
    });

    await prisma.notificacao.create({
      data: {
        usuarioId: destinatarioId,
        actorId: remetenteId,
        tipo: NotificacaoTipo.GENERICA,
        titulo: "Solicitação de treino",
        mensagem: "quer treinar junto com você",
        link: "/notificacoes",
        lida: false,
      },
    });

    await recomputeAndEmitBadge(destinatarioId);
    return res.status(201).json({ ...row, ok: true });
  } catch (error) {
    console.error("Erro ao criar solicitação:", error);
    return res.status(500).json({ error: "Erro ao criar solicitação." });
  }
}

async function acharPendente(
  userId: string,
  outroUsuarioId: string
) {
  if (!userId || !outroUsuarioId) return null;
  return prisma.solicitacaoTreino.findFirst({
    where: {
      status: { in: ["pendente", "ativa"] },
      OR: [
        { remetenteId: userId,        destinatarioId: outroUsuarioId },
        { remetenteId: outroUsuarioId, destinatarioId: userId },
      ],
    },
    orderBy: { criadoEm: "desc" },
  });
}

async function cancelarPorSolicitacaoId(
  solicitacaoId: string,
  userId?: string,
): Promise<boolean> {
  if (!solicitacaoId) return false;

  const s = await prisma.solicitacaoTreino.findUnique({ where: { id: solicitacaoId } });

  if (!s) return false;
  if (userId && s.remetenteId !== userId && s.destinatarioId !== userId) return false;

  try {
    await prisma.solicitacaoTreino.delete({ where: { id: solicitacaoId } });
  } catch {
    await prisma.solicitacaoTreino.update({
      where: { id: solicitacaoId },
      data: { status: "cancelada" as any },
    });
  }
  return true;
}

export async function cancelarSolicitacao(req: Request, res: Response) {
  try {
    const userId: string | undefined = (req as any).user?.id || (req as any).userId;

    const solicitacaoId  = (req.params as any).id
                        || (req.body?.id ?? req.query?.id) || null;
    const destinatarioId = (req.params as any).destinatarioId
                        || (req.body?.destinatarioId ?? req.query?.destinatarioId) || null;

    if (solicitacaoId) {
      await cancelarPorSolicitacaoId(String(solicitacaoId), userId);
      return res.sendStatus(204);
    }

    if (userId && destinatarioId) {
      const pend = await acharPendente(userId, String(destinatarioId));
      if (!pend) return res.sendStatus(204);
      await cancelarPorSolicitacaoId(pend.id, userId);
      return res.sendStatus(204);
    }

    return res.status(400).json({ error: "Informe id ou destinatarioId" });
  } catch (e) {
    console.error("cancelarSolicitacao", e);
    return res.status(500).json({ error: "Falha ao cancelar solicitação" });
  }
}

export async function aceitarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const destinatarioId: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!destinatarioId) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!solicitacao || solicitacao.destinatarioId !== destinatarioId) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    const [remetente, destinatario] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: solicitacao.remetenteId },
        select: { id: true, tipo: true },
      }),
      prisma.usuario.findUnique({
        where: { id: solicitacao.destinatarioId },
        select: { id: true, tipo: true },
      }),
    ]);

    if (!remetente || !destinatario) {
      return res.status(404).json({ error: "Usuário da solicitação não encontrado." });
    }

    async function getIdsByTipo(usuarioId: string, tipo?: string) {
      switch (tipo) {
        case "Professor": {
          const r = await prisma.professor.findUnique({ where: { usuarioId } });
          return { professorId: r?.id };
        }
        case "Atleta": {
          const r = await prisma.atleta.findUnique({ where: { usuarioId } });
          return { atletaId: r?.id };
        }
        case "Escolinha": {
          const r = await prisma.escolinha.findUnique({ where: { usuarioId } });
          return { escolinhaId: r?.id };
        }
        case "Clube": {
          const r = await prisma.clube.findUnique({ where: { usuarioId } });
          return { clubeId: r?.id };
        }
        default:
          return {};
      }
    }

    const idsRem = await getIdsByTipo(remetente.id, remetente.tipo);
    const idsDes = await getIdsByTipo(destinatario.id, destinatario.tipo);

    const ids = {
      professorId: idsRem.professorId || idsDes.professorId,
      atletaId: idsRem.atletaId || idsDes.atletaId,
      escolinhaId: idsRem.escolinhaId || idsDes.escolinhaId,
      clubeId: idsRem.clubeId || idsDes.clubeId,
    };

    const tipos = [remetente.tipo, destinatario.tipo].sort();

    if (
      (tipos.includes("Clube") && tipos.includes("Escolinha")) ||
      (tipos[0] === "Clube" && tipos[1] === "Clube") ||
      (tipos[0] === "Escolinha" && tipos[1] === "Escolinha")
    ) {
      return res.status(400).json({
        error:
          "Essa combinação não pode treinar junto. Clube e escolinha não podem treinar juntos, clube com clube não pode e escolinha com escolinha não pode.",
      });
    }

    // 2) Professor + Escolinha -> ProfessorEscolinha
    if (!ids.atletaId && ids.professorId && ids.escolinhaId && !ids.clubeId) {
      const existe = await prisma.professorEscolinha.findUnique({
        where: {
          professorId_escolinhaId: {
            professorId: ids.professorId,
            escolinhaId: ids.escolinhaId,
          },
        },
      });

      if (!existe) {
        await prisma.professorEscolinha.create({
          data: {
            professorId: ids.professorId,
            escolinhaId: ids.escolinhaId,
          },
        });
      }

      await prisma.solicitacaoTreino.delete({ where: { id } });

      return res.json({
        ok: true,
        message: existe
          ? "Vínculo professor/escolinha já existia. Solicitação removida."
          : "Solicitação aceita com sucesso.",
      });
    }

    // 3) Professor + Clube -> ProfessorClube
    if (!ids.atletaId && ids.professorId && ids.clubeId && !ids.escolinhaId) {
      const existe = await prisma.professorClube.findUnique({
        where: {
          professorId_clubeId: {
            professorId: ids.professorId,
            clubeId: ids.clubeId,
          },
        },
      });

      if (!existe) {
        await prisma.professorClube.create({
          data: {
            professorId: ids.professorId,
            clubeId: ids.clubeId,
          },
        });
      }

      await prisma.solicitacaoTreino.delete({ where: { id } });

      return res.json({
        ok: true,
        message: existe
          ? "Vínculo professor/clube já existia. Solicitação removida."
          : "Solicitação aceita com sucesso.",
      });
    }

    // 4) Professor + Professor -> ProfessorProfessor
    if (!ids.atletaId && ids.professorId && !ids.clubeId && !ids.escolinhaId) {
      const idsProf = [idsRem.professorId, idsDes.professorId].filter(
        (id): id is string => Boolean(id)
      );

      if (idsProf.length === 2) {
        const [professorAId, professorBId] =
          idsProf[0] < idsProf[1]
            ? [idsProf[0], idsProf[1]]
            : [idsProf[1], idsProf[0]];

        const existe = await prisma.professorParceiro.findFirst({
          where: {
            professorAId,
            professorBId,
          },
        });

        if (!existe) {
          await prisma.professorParceiro.create({
            data: {
              professorAId,
              professorBId,
            },
          });
        }

        await prisma.solicitacaoTreino.delete({ where: { id } });

        return res.json({
          ok: true,
          message: existe
            ? "Vínculo entre professores já existia. Solicitação removida."
            : "Solicitação aceita com sucesso.",
        });
      }
    }

    // 4) Atleta + exatamente um responsável -> RelacaoTreinamento
    const owners = [ids.professorId, ids.clubeId, ids.escolinhaId].filter(Boolean);

    if (!ids.atletaId || owners.length !== 1) {
      return res.status(400).json({
        error:
          "Solicitação inválida. Para criar relação de treino, deve existir 1 atleta e exatamente 1 responsável (professor, clube ou escolinha).",
      });
    }

    const relacaoShape = {
      atletaId: ids.atletaId,
      professorId: ids.professorId ?? null,
      clubeId: ids.clubeId ?? null,
      escolinhaId: ids.escolinhaId ?? null,
    };

    const existente = await prisma.relacaoTreinamento.findFirst({
      where: {
        ...relacaoShape,
        encerradoEm: null,
      },
    });

    if (!existente) {
      await prisma.relacaoTreinamento.create({
        data: relacaoShape,
      });
    }

    await prisma.solicitacaoTreino.delete({ where: { id } });

    await prisma.notificacao.create({
      data: {
        usuarioId: solicitacao.remetenteId,
        actorId: solicitacao.destinatarioId,
        tipo: NotificacaoTipo.GENERICA,
        titulo: "Vínculo aceito",
        mensagem: "Sua solicitação de treino foi aceita.",
        link: `/perfil/${solicitacao.destinatarioId}`,
        lida: false,
      },
    });

    await recomputeAndEmitBadge(solicitacao.remetenteId);

    return res.json({
      ok: true,
      message: existente
        ? "Relação já existia. Solicitação removida."
        : "Solicitação aceita com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao aceitar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function recusarSolicitacao(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const me: string | undefined = (req as any).user?.id || (req as any).userId;
  if (!me) return res.status(401).json({ error: "Não autenticado." });

  try {
    const solicitacao = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!solicitacao || solicitacao.destinatarioId !== me) {
      return res.status(404).json({ error: "Solicitação não encontrada" });
    }

    await prisma.solicitacaoTreino.delete({ where: { id } });

    await prisma.notificacao.create({
      data: {
        usuarioId: solicitacao.remetenteId,
        actorId: me,
        tipo: NotificacaoTipo.GENERICA,
        titulo: "Vínculo recusado",
        mensagem: "Sua solicitação de treino foi recusada.",
        link: `/perfil/${me}`,
        lida: false,
      },
    });

    await recomputeAndEmitBadge(solicitacao.remetenteId);

    return res.json({ message: "Solicitação recusada com sucesso." });
  } catch (error) {
    console.error("Erro ao recusar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function verificarVinculoTreino(req: Request, res: Response) {
  try {
    const me: string | undefined = (req as any).user?.id || (req as any).userId;
    if (!me) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const usuarioAlvoId =
      (req.query.usuarioAlvoId as string) ||
      (req.query.alvoId as string) ||
      (req.query.usuarioId as string);

    if (!usuarioAlvoId) {
      return res
        .status(400)
        .json({ error: "Informe usuarioAlvoId na query string." });
    }

    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: [me, usuarioAlvoId] } },
      select: { id: true, tipo: true },
    });

    const uMe = usuarios.find((u) => u.id === me);
    const uAlvo = usuarios.find((u) => u.id === usuarioAlvoId);

    if (!uMe || !uAlvo) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    async function getIdsByTipo(
      usuarioId: string,
      tipo?: string
    ): Promise<{
      atletaId?: string;
      professorId?: string;
      clubeId?: string;
      escolinhaId?: string;
    }> {
      switch (tipo) {
        case "Professor": {
          const r = await prisma.professor.findUnique({
            where: { usuarioId },
          });
          return { professorId: r?.id };
        }
        case "Atleta": {
          const r = await prisma.atleta.findUnique({
            where: { usuarioId },
          });
          return { atletaId: r?.id };
        }
        case "Escolinha": {
          const r = await prisma.escolinha.findUnique({
            where: { usuarioId },
          });
          return { escolinhaId: r?.id };
        }
        case "Clube": {
          const r = await prisma.clube.findUnique({
            where: { usuarioId },
          });
          return { clubeId: r?.id };
        }
        default:
          return {};
      }
    }

    const idsMe = await getIdsByTipo(uMe.id, uMe.tipo);
    const idsAlvo = await getIdsByTipo(uAlvo.id, uAlvo.tipo);
    const tipos = [uMe.tipo, uAlvo.tipo].sort();

    // 1) Professor + Professor
    if (tipos[0] === "Professor" && tipos[1] === "Professor") {
      const idsProf = [idsMe.professorId, idsAlvo.professorId].filter(
        (id): id is string => Boolean(id)
      );

      if (idsProf.length !== 2) {
        return res.json({
          vinculo: false,
          relacaoId: null,
          relacao: null,
          motivo: "Professores não encontrados",
        });
      }

      const [professorAId, professorBId] =
        idsProf[0] < idsProf[1]
          ? [idsProf[0], idsProf[1]]
          : [idsProf[1], idsProf[0]];

      const relacao = await prisma.professorParceiro.findFirst({
        where: { professorAId, professorBId },
      });

      return res.json({
        vinculo: !!relacao,
        relacaoId: relacao?.id ?? null,
        relacao,
      });
    }

    // 2) Professor + Clube
    if (
      (uMe.tipo === "Professor" && uAlvo.tipo === "Clube") ||
      (uMe.tipo === "Clube" && uAlvo.tipo === "Professor")
    ) {
      const professorId = idsMe.professorId || idsAlvo.professorId;
      const clubeId = idsMe.clubeId || idsAlvo.clubeId;

      if (!professorId || !clubeId) {
        return res.json({
          vinculo: false,
          relacaoId: null,
          relacao: null,
          motivo: "Professor ou clube não encontrado",
        });
      }

      const relacao = await prisma.professorClube.findUnique({
        where: {
          professorId_clubeId: { professorId, clubeId },
        },
      });

      return res.json({
        vinculo: !!relacao,
        relacaoId: relacao?.id ?? null,
        relacao,
      });
    }

    // 3) Professor + Escolinha
    if (
      (uMe.tipo === "Professor" && uAlvo.tipo === "Escolinha") ||
      (uMe.tipo === "Escolinha" && uAlvo.tipo === "Professor")
    ) {
      const professorId = idsMe.professorId || idsAlvo.professorId;
      const escolinhaId = idsMe.escolinhaId || idsAlvo.escolinhaId;

      if (!professorId || !escolinhaId) {
        return res.json({
          vinculo: false,
          relacaoId: null,
          relacao: null,
          motivo: "Professor ou escolinha não encontrado",
        });
      }

      const relacao = await prisma.professorEscolinha.findUnique({
        where: {
          professorId_escolinhaId: { professorId, escolinhaId },
        },
      });

      return res.json({
        vinculo: !!relacao,
        relacaoId: relacao?.id ?? null,
        relacao,
      });
    }

    // 4) Casos com atleta -> RelacaoTreinamento
    const atletaId = idsMe.atletaId || idsAlvo.atletaId;
    const professorId = idsMe.professorId || idsAlvo.professorId;
    const clubeId = idsMe.clubeId || idsAlvo.clubeId;
    const escolinhaId = idsMe.escolinhaId || idsAlvo.escolinhaId;

    if (!atletaId) {
      return res.json({
        vinculo: false,
        relacaoId: null,
        relacao: null,
        motivo: "Sem atleta envolvido",
      });
    }

    if (!professorId && !clubeId && !escolinhaId) {
      return res.json({
        vinculo: false,
        relacaoId: null,
        relacao: null,
        motivo: "Sem professor/clube/escolinha envolvido",
      });
    }

    const where: any = {
      atletaId,
      encerradoEm: null,
    };
    if (professorId) where.professorId = professorId;
    if (clubeId) where.clubeId = clubeId;
    if (escolinhaId) where.escolinhaId = escolinhaId;

    const relacao = await prisma.relacaoTreinamento.findFirst({ where });

    return res.json({
      vinculo: !!relacao,
      relacaoId: relacao?.id ?? null,
      relacao,
    });
  } catch (e) {
    console.error("verificarVinculoTreino erro:", e);
    return res.status(500).json({ error: "Erro ao verificar vínculo." });
  }
}

export async function desvincularTreino(req: Request, res: Response) {
  try {
    const me: string | undefined = (req as any).user?.id || (req as any).userId;
    const { usuarioAlvoId } = req.body ?? {};

    if (!me) return res.status(401).json({ message: "Não autenticado." });
    if (!usuarioAlvoId) return res.status(400).json({ message: "usuarioAlvoId é obrigatório." });

    await prisma.relacaoTreinamento.deleteMany({
      where: {
        OR: [
          { atleta: { usuarioId: me }, professor: { usuarioId: usuarioAlvoId } },
          { atleta: { usuarioId: usuarioAlvoId }, professor: { usuarioId: me } },
          { atleta: { usuarioId: me }, clube: { usuarioId: usuarioAlvoId } },
          { atleta: { usuarioId: usuarioAlvoId }, clube: { usuarioId: me } },
          { atleta: { usuarioId: me }, escolinha: { usuarioId: usuarioAlvoId } },
          { atleta: { usuarioId: usuarioAlvoId }, escolinha: { usuarioId: me } },
        ],
      },
    });

    const [uMe, uAlvo] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: me }, select: { id: true, tipo: true } }),
      prisma.usuario.findUnique({ where: { id: usuarioAlvoId }, select: { id: true, tipo: true } }),
    ]);

    const professorMe = await prisma.professor.findUnique({ where: { usuarioId: me }, select: { id: true } });
    const professorAlvo = await prisma.professor.findUnique({ where: { usuarioId: usuarioAlvoId }, select: { id: true } });
    const clubeMe = await prisma.clube.findUnique({ where: { usuarioId: me }, select: { id: true } });
    const clubeAlvo = await prisma.clube.findUnique({ where: { usuarioId: usuarioAlvoId }, select: { id: true } });
    const escolinhaMe = await prisma.escolinha.findUnique({ where: { usuarioId: me }, select: { id: true } });
    const escolinhaAlvo = await prisma.escolinha.findUnique({ where: { usuarioId: usuarioAlvoId }, select: { id: true } });

    const professorId = professorMe?.id || professorAlvo?.id || null;
    const clubeId = clubeMe?.id || clubeAlvo?.id || null;
    const escolinhaId = escolinhaMe?.id || escolinhaAlvo?.id || null;

    if (professorId && clubeId) {
      await prisma.professorClube.deleteMany({
        where: { professorId, clubeId },
      });
    }

    if (professorId && escolinhaId) {
      await prisma.professorEscolinha.deleteMany({
        where: { professorId, escolinhaId },
      });
    }

    if (professorMe?.id && professorAlvo?.id) {
      const [professorAId, professorBId] =
        professorMe.id < professorAlvo.id
          ? [professorMe.id, professorAlvo.id]
          : [professorAlvo.id, professorMe.id];

      await prisma.professorParceiro.deleteMany({
        where: { professorAId, professorBId },
      });
    }

    await prisma.solicitacaoTreino.deleteMany({
      where: {
        OR: [
          { remetenteId: me, destinatarioId: usuarioAlvoId },
          { remetenteId: usuarioAlvoId, destinatarioId: me },
        ],
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("desvincularTreino", e);
    return res.status(500).json({ message: "Erro ao desvincular treino." });
  }
}