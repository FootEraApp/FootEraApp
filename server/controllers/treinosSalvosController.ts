import type { Request, Response } from "express";
import { PrismaClient, Categoria, Nivel, TipoTreino } from "@prisma/client";
import { requireUsage } from "server/lib/usage.js";
import { enforceTotalLimit } from "server/services/usage.js";

const prisma = new PrismaClient();
const MAX_SLOTS = 5;
const TTL_DIAS = 30;

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function ownerWhere(tipoUsuario?: string, tipoUsuarioId?: string) {
  if (!tipoUsuario || !tipoUsuarioId) return {};
  const t = String(tipoUsuario).toLowerCase();
  if (t === "professor") return { professorId: tipoUsuarioId };
  if (t === "clube")     return { clubeId: tipoUsuarioId };
  if (t === "escolinha" || t === "escola") return { escolinhaId: tipoUsuarioId };
  return {};
}

export const criarTreinoSalvo = async (req: Request, res: Response) => {
  await enforceTotalLimit(req, res, "treinos_salvos_total", async () => {
    const where = { criadoPorUsuarioId: (req as any).user!.id };
    return prisma.treinoSalvo.count({ where });
  });

  try {
    const user = (req as any).user as { id: string; tipo: string; plano?: string };

    if (user?.tipo === "Atleta" && user?.plano !== "PRO") {
      const ok = await requireUsage(req, res, "treinos_salvos_total");
      if (!ok) return;
    }

    const {
      titulo,
      descricao,
      nivel,
      tipoTreino,
      categoria,
      duracao,
      dicas,
      conteudo,
      publico,
      parceiro,
      naoExpira,
      tipoUsuario,
      tipoUsuarioId,
      criadoPorUsuarioId,
      treinoProgramadoId,
    } = req.body || {};

    const owner = ownerWhere(tipoUsuario, tipoUsuarioId);
    const ownerKeys = Object.keys(owner);
    if (ownerKeys.length !== 1) {
      return res.status(400).json({
        message:
          "Informe exatamente um dono: professorId OU escolinhaId OU clubeId (via tipoUsuario + tipoUsuarioId).",
      });
    }

    const ativosCount = await prisma.treinoSalvo.count({
      where: {
        ...owner,
        OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
      },
    });
    if (!publico && ativosCount >= MAX_SLOTS) {
      return res
        .status(400)
        .json({ message: `Limite de ${MAX_SLOTS} treinos salvos atingido para este dono.` });
    }

    if (
      !titulo ||
      !conteudo?.exercicios ||
      !Array.isArray(conteudo.exercicios) ||
      conteudo.exercicios.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Título e pelo menos 1 exercício são obrigatórios." });
    }

    const expiraEm = publico || naoExpira ? null : addDays(new Date(), TTL_DIAS);

    const effectiveTreinoProgramadoId =
      treinoProgramadoId ??
      `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const created = await prisma.treinoSalvo.create({
      data: {
        usuarioId: user.id,
        treinoProgramadoId: String(effectiveTreinoProgramadoId),

        titulo,
        descricao: descricao ?? null,
        nivel: nivel ?? null,
        tipoTreino: tipoTreino ?? null,
        categoria: Array.isArray(categoria) ? (categoria as Categoria[]) : [],
        duracao: duracao ?? null,
        dicas: Array.isArray(dicas) ? dicas : [],
        conteudo,
        publico: Boolean(publico),
        parceiro: Boolean(parceiro),
        naoExpira: Boolean(naoExpira),
        expiraEm,
        criadoPorUsuarioId: criadoPorUsuarioId ?? user.id,
        ...owner,
      },
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error("criarTreinoSalvo", err);
    res
      .status(500)
      .json({ message: "Erro ao criar treino salvo", error: String(err?.message || err) });
  }
};

export const listarTreinosSalvos = async (req: Request, res: Response) => {
  try {
    const { tipoUsuario, tipoUsuarioId, includePublic } = req.query as any;

    const owner = ownerWhere(tipoUsuario, tipoUsuarioId);

    const meus = await prisma.treinoSalvo.findMany({
      where: {
        ...owner,
        OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
      },
      orderBy: [{ atualizadoEm: "desc" }],
    });

    let publicos: any[] = [];
    if (String(includePublic) === "1") {
      publicos = await prisma.treinoSalvo.findMany({
        where: {
          publico: true,
          parceiro: true,
          OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
        },
        orderBy: [{ atualizadoEm: "desc" }],
        take: 50,
      });
    }

    res.json({
      meus,
      publicos,
    });
  } catch (err: any) {
    console.error("listarTreinosSalvos", err);
    res.status(500).json({ message: "Erro ao listar treinos salvos", error: String(err?.message || err) });
  }
};

export const reutilizarTreinoSalvo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { professorId } = req.body || {};

    if (!professorId) {
      return res.status(400).json({ message: "professorId é obrigatório para marcar reutilização." });
    }

    const treino = await prisma.treinoSalvo.findUnique({ where: { id } });
    if (!treino) return res.status(404).json({ message: "Treino salvo não encontrado." });

    try {
      await prisma.treinoSalvoReuso.create({
        data: { treinoSalvoId: id, professorId },
      });
    } catch {
    }

    const totalProfessores = await prisma.treinoSalvoReuso.count({
      where: { treinoSalvoId: id },
    });

    const updateData: any = {
      reutilizacoesProfessores: totalProfessores,
    };

    if (!treino.naoExpira) {
      updateData.expiraEm = addDays(new Date(), TTL_DIAS);
    }

    const updated = await prisma.treinoSalvo.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (err: any) {
    console.error("reutilizarTreinoSalvo", err);
    res.status(500).json({ message: "Erro ao marcar reutilização", error: String(err?.message || err) });
  }
};

export const deletarTreinoSalvo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.treinoSalvo.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("deletarTreinoSalvo", err);
    res.status(500).json({ message: "Erro ao apagar treino salvo", error: String(err?.message || err) });
  }
};

export const limparTreinosSalvosExpirados = async (_req: Request, res: Response) => {
  try {
    const del = await prisma.treinoSalvo.deleteMany({
      where: { expiraEm: { lte: new Date() } },
    });
    res.json({ removidos: del.count });
  } catch (err: any) {
    console.error("limparTreinosSalvosExpirados", err);
    res.status(500).json({ message: "Erro ao limpar expirados", error: String(err?.message || err) });
  }
};
