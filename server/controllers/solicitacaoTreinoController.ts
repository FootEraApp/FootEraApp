// server/controllers/solicitacaoTreinoController
import { Response, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { resolveClubeId, resolveEscolinhaId } from "../services/formadores.service.js";

const prisma = new PrismaClient();

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

export const solicitacoesTreinoController = {
  aceitar: async (req: Request, res: Response) => {
    const { id } = req.params;
    const me = (req as any).user?.id || (req as any).userId;
    if (!me) return res.status(401).json({ message: "Não autenticado." });

    const s = await prisma.solicitacaoTreino.findUnique({ where: { id } });
    if (!s || s.destinatarioId !== me) return res.status(404).json({ message: "Solicitação não encontrada" });

    const [rem, des] = await prisma.usuario.findMany({
      where: { id: { in: [s.remetenteId, s.destinatarioId] } },
      select: { id: true, tipo: true },
    });

    const atletaUsuarioId = rem?.tipo === "Atleta" ? rem.id : des?.tipo === "Atleta" ? des!.id : null;
    const outroUsuarioId  = rem?.tipo !== "Atleta" ? rem.id : des?.id;

    if (atletaUsuarioId && outroUsuarioId) {
      await autoVincularAtleta(atletaUsuarioId, outroUsuarioId);
    }

    const updated = await prisma.solicitacaoTreino.update({ where: { id }, data: { status: "ativa" } });
    return res.json(updated);
  },
};

export async function criarSolicitacao(req: Request, res: Response) {
  const remetenteId: string | undefined = (req as any).user?.id || (req as any).userId;
  const { destinatarioId } = (req.body ?? {}) as { destinatarioId?: string };

  if (!remetenteId) return res.status(401).json({ message: "Não autenticado." });
  if (!destinatarioId) return res.status(400).json({ message: "destinatarioId é obrigatório" });
  if (remetenteId === destinatarioId) return res.status(400).json({ message: "Não é permitido enviar para si mesmo." });

  const existente = await prisma.solicitacaoTreino.findFirst({
    where: {
      status: { in: ["pendente", "ativa"] },
      OR: [
        { remetenteId, destinatarioId },
        { remetenteId: destinatarioId, destinatarioId: remetenteId },
      ],
    },
  });
  const row = existente ?? await prisma.solicitacaoTreino.create({
    data: { remetenteId, destinatarioId, status: "pendente" },
  });

  const pessoas = await prisma.usuario.findMany({
    where: { id: { in: [remetenteId, destinatarioId] } },
    select: { id: true, tipo: true },
  });
  const uRem = pessoas.find(p => p.id === remetenteId);
  const uDes = pessoas.find(p => p.id === destinatarioId);
  const temAtleta = [uRem?.tipo, uDes?.tipo].includes("Atleta");
  const temEntidade = [uRem?.tipo, uDes?.tipo].some(t => t === "Clube" || t === "Escolinha");

  if (temAtleta && temEntidade) {
    const atletaUsuarioId = (uRem?.tipo === "Atleta" ? uRem!.id : uDes!.id);
    const outroUsuarioId  = (uRem?.tipo === "Atleta" ? uDes!.id : uRem!.id);
    await autoVincularAtleta(atletaUsuarioId, outroUsuarioId);

    await prisma.solicitacaoTreino.update({ where: { id: row.id }, data: { status: "ativa" } });
  }

  return res.status(existente ? 200 : 201).json({ ...row, ok: true });
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

/** Cancela (deleta ou marca como cancelada) uma solicitação pelo ID. */
async function cancelarPorSolicitacaoId(
  solicitacaoId: string,
  userId?: string,
): Promise<boolean> {
  if (!solicitacaoId) return false;

  const s = await prisma.solicitacaoTreino.findUnique({ where: { id: solicitacaoId } });
  if (!s) return false;

  // opcional: garante que o usuário logado faz parte da solicitação
  if (userId && s.remetenteId !== userId && s.destinatarioId !== userId) return false;

  // deletar (ou marcar como cancelada caso não possa deletar)
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

/** Cancela por id OU por destinatarioId (idempotente). */
export async function cancelarSolicitacao(req: Request, res: Response) {
  try {
    const userId: string | undefined = (req as any).user?.id || (req as any).userId;

    // pode vir por url (/:id ou /:destinatarioId), query ou body
    const solicitacaoId  = (req.params as any).id
                        || (req.body?.id ?? req.query?.id) || null;
    const destinatarioId = (req.params as any).destinatarioId
                        || (req.body?.destinatarioId ?? req.query?.destinatarioId) || null;

    // 1) cancelar pelo ID da solicitação
    if (solicitacaoId) {
      await cancelarPorSolicitacaoId(String(solicitacaoId), userId);
      return res.sendStatus(204); // idempotente
    }

    // 2) cancelar por destinatário (procura pendente/ativa e cancela)
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
      prisma.usuario.findUnique({ where: { id: solicitacao.remetenteId }, select: { tipo: true } }),
      prisma.usuario.findUnique({ where: { id: solicitacao.destinatarioId }, select: { tipo: true } }),
    ]);

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

    const idsRem = await getIdsByTipo(solicitacao.remetenteId, remetente?.tipo);
    const idsDes = await getIdsByTipo(solicitacao.destinatarioId, destinatario?.tipo);
    const ids = { ...idsRem, ...idsDes } as {
      professorId?: string; escolinhaId?: string; clubeId?: string; atletaId?: string;
    };

    const casoAtletaDono =
      !!ids.atletaId && (ids.professorId || ids.clubeId || ids.escolinhaId);

    const casoProfEntidade =
      !ids.atletaId && !!ids.professorId && (ids.clubeId || ids.escolinhaId);

    if (!casoAtletaDono && !casoProfEntidade) {
      return res.status(400).json({ error: "Tipos de usuário inválidos para relação." });
    }

    const relacaoShape = {
      atletaId:     ids.atletaId ?? null,
      professorId:  ids.professorId ?? null,
      escolinhaId:  ids.escolinhaId ?? null,
      clubeId:      ids.clubeId ?? null,
    };

    const existente = await prisma.relacaoTreinamento.findFirst({
      where: relacaoShape,
    });

    if (!existente) {
      await prisma.relacaoTreinamento.create({ data: relacaoShape });
    }

    await prisma.solicitacaoTreino.delete({ where: { id } });

    return res.json({
      ok: true,
      message: existente ? "Relação já existia. Solicitação removida." : "Solicitação aceita com sucesso.",
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
    return res.json({ message: "Solicitação recusada com sucesso." });
  } catch (error) {
    console.error("Erro ao recusar solicitação:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}