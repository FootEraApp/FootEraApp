import type { Request, Response } from "express";
import { Categoria } from "@prisma/client";
import { prisma } from "../prisma.js";

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
    const user = (req as any).user as
      | { id: string; tipo: string; plano?: string; plan?: string }
      | undefined;

    if (!user?.id) {
      return res.status(401).json({ message: "Usuário não autenticado para salvar treino." });
    }

    const tipoUser = String(user.tipo || "").toLowerCase();
    const planoUser = String((user as any).plano || (user as any).plan || "").toUpperCase();

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
      apagarTreinoSalvoId, 
    } = req.body || {};

    const owner = ownerWhere(tipoUsuario, tipoUsuarioId);
    const ownerKeys = Object.keys(owner);
    if (ownerKeys.length !== 1) {
      return res.status(400).json({
        message:
          "Informe exatamente um dono: professorId OU escolinhaId OU clubeId (via tipoUsuario + tipoUsuarioId).",
      });
    }

    if (
      !titulo ||
      !conteudo?.exercicios ||
      !Array.isArray(conteudo.exercicios) ||
      conteudo.exercicios.length === 0
    ) {
      return res.status(400).json({
        message: "Título e pelo menos 1 exercício são obrigatórios.",
      });
    }

    const expiraEm = publico || naoExpira ? null : addDays(new Date(), TTL_DIAS);

    const effectiveTreinoProgramadoId =
      treinoProgramadoId ??
      `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const created = await prisma.$transaction(async (tx) => {
      if (apagarTreinoSalvoId) {
        await tx.treinoSalvo.deleteMany({
          where: {
            id: String(apagarTreinoSalvoId),
            usuarioId: user.id,
            ...owner,
          },
        });
      }

      const ativos = await tx.treinoSalvo.findMany({
        where: {
          usuarioId: user.id,
          ...owner,
          OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
        },
        select: { id: true, treinoProgramadoId: true, createdAt: true, titulo: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const idsProgramados = Array.from(
        new Set(ativos.map((a) => String(a.treinoProgramadoId)).filter(Boolean))
      );

      const existentes = idsProgramados.length
        ? await tx.treinoProgramado.findMany({
            where: { id: { in: idsProgramados } },
            select: { id: true },
          })
        : [];

      const setExistentes = new Set(existentes.map((e) => e.id));
      const orfaos = ativos.filter((a) => !setExistentes.has(String(a.treinoProgramadoId)));
      if (orfaos.length) {
        await tx.treinoSalvo.deleteMany({
          where: { usuarioId: user.id, ...owner, id: { in: orfaos.map((o) => o.id) } },
        });
      }

      const ativosCount = ativos.length - orfaos.length;

      if (!publico && ativosCount >= MAX_SLOTS) {
        const validosOrdenados = ativos
          .filter((a) => setExistentes.has(String(a.treinoProgramadoId)))
          .slice(0, 50);

        (res as any).__limitPayload = {
          code: "LIMIT_TREINOS_SALVOS",
          message: `Você já possui ${MAX_SLOTS} treinos salvos. Escolha um para apagar.`,
          meus: validosOrdenados.map((t) => ({
            id: t.id,
            createdAt: t.createdAt,
            nome: t.titulo,
            treinoProgramadoId: t.treinoProgramadoId,
          })),
        };

        return null;
      }

      return tx.treinoSalvo.create({
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
    });

    if (!created) {
      return res.status(400).json(
        ((res as any).__limitPayload) || {
          code: "LIMIT_TREINOS_SALVOS",
          message: `Você já possui ${MAX_SLOTS} treinos salvos. Escolha um para apagar.`,
        }
      );
    }

    return res.status(201).json(created);
  } catch (err: any) {
    console.error("criarTreinoSalvo", err);
    return res.status(500).json({
      message: "Erro ao criar treino salvo",
      error: String(err?.message || err),
    });
  }
};

export const listarTreinosSalvos = async (req: Request, res: Response) => {
  try {
    const { tipoUsuario, tipoUsuarioId, includePublic } = req.query as any;

    const owner = ownerWhere(String(tipoUsuario || ""), String(tipoUsuarioId || ""));
    const user = (req as any).user;
    const userId = String(user?.id || "");
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const salvos = await prisma.treinoSalvo.findMany({
      where: {
        usuarioId: userId,
        ...owner,
        OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        treinoProgramadoId: true,
      },
      take: 50,
    });

    const idsProgramados = Array.from(
      new Set(salvos.map((s) => String(s.treinoProgramadoId)).filter(Boolean))
    );

    const programados = idsProgramados.length
      ? await prisma.treinoProgramado.findMany({
          where: { id: { in: idsProgramados } },
          select: { id: true, nome: true, createdAt: true },
        })
      : [];

    const mapNome = new Map(programados.map((p) => [p.id, p.nome]));
    const validos = salvos.filter((s) => mapNome.has(String(s.treinoProgramadoId)));
    const orfaos = salvos.filter((s) => !mapNome.has(String(s.treinoProgramadoId)));

    if (orfaos.length) {
      await prisma.treinoSalvo.deleteMany({
        where: {
          usuarioId: userId,
          ...owner,
          id: { in: orfaos.map((o) => o.id) },
        },
      });
    }

    const meus = validos.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      treinoProgramadoId: s.treinoProgramadoId,
      treinoProgramado: { nome: mapNome.get(String(s.treinoProgramadoId)) || "(Removido)" },
    }));

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

    return res.json({ meus, publicos });
  } catch (err: any) {
    console.error("listarTreinosSalvos", err);
    return res.status(500).json({
      message: "Erro ao listar treinos salvos",
      error: String(err?.message || err),
    });
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
