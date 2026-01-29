import { Request, Response } from "express";
import { prisma } from "../prisma.js";

export async function getPresenca(req: any, res: any) {
  const { id } = req.params;

  const u = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, lastSeenAt: true, lastLoginAt: true, lastLogoutAt: true, nome: true, tipo: true },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado." });

  const now = Date.now();
  const lastSeen = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;

  // regra simples: online se teve atividade nos últimos 2 minutos
  const ONLINE_WINDOW_MS = 2 * 60_000;
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