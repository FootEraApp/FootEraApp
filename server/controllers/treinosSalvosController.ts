import type { Request, Response } from "express";
import { PrismaClient, Categoria, Nivel, TipoTreino } from "@prisma/client";

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
  try {
    const {
      titulo, descricao, nivel, tipoTreino, categoria, duracao, dicas,
      conteudo, publico, parceiro, naoExpira,
      tipoUsuario, tipoUsuarioId, criadoPorUsuarioId,
    } = req.body || {};

    // valida dono
    const owner = ownerWhere(tipoUsuario, tipoUsuarioId);
    const ownerKeys = Object.keys(owner);
    if (ownerKeys.length !== 1) {
      return res.status(400).json({ message: "Informe exatamente um dono: professorId OU escolinhaId OU clubeId (via tipoUsuario + tipoUsuarioId)." });
    }

    // limita 5 por dono (ativos e não expirados)
    const ativosCount = await prisma.treinoSalvo.count({
      where: {
        ...owner,
        OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
      },
    });
    if (!publico && ativosCount >= MAX_SLOTS) {
      return res.status(400).json({ message: `Limite de ${MAX_SLOTS} treinos salvos atingido para este dono.` });
    }

    if (!titulo || !conteudo?.exercicios || !Array.isArray(conteudo.exercicios) || conteudo.exercicios.length === 0) {
      return res.status(400).json({ message: "Título e pelo menos 1 exercício são obrigatórios." });
    }

    // expiração padrão de 30 dias para não públicos
    const expiraEm = publico || naoExpira ? null : addDays(new Date(), TTL_DIAS);

    const created = await prisma.treinoSalvo.create({
      data: {
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
        criadoPorUsuarioId: criadoPorUsuarioId ?? null,
        ...owner,
      },
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error("criarTreinoSalvo", err);
    res.status(500).json({ message: "Erro ao criar treino salvo", error: String(err?.message || err) });
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
          // nunca expiram por padrão, mas se vierem com expiração, filtra também
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

    // registra professor distinto
    try {
      await prisma.treinoSalvoReuso.create({
        data: { treinoSalvoId: id, professorId },
      });
    } catch {
      // se já existe (unique), ignoramos
    }

    const totalProfessores = await prisma.treinoSalvoReuso.count({
      where: { treinoSalvoId: id },
    });

    const updateData: any = {
      reutilizacoesProfessores: totalProfessores,
    };

    // renova TTL se não for “naoExpira”
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
