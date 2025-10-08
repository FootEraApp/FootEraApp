import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import {
  computeAchievementsForUser,
  ATHLETE_ACHIEVEMENTS,
  PROFESSOR_ACHIEVEMENTS,
  ESCOLINHA_ACHIEVEMENTS,
  CLUBE_ACHIEVEMENTS,
} from "../services/achievements.js";

const prisma = new PrismaClient();

type Tier = "bronze" | "prata" | "ouro" | "platina";
type Entity = "Atleta" | "Professor" | "Escolinha" | "Clube";
type Group = "Treinos" | "Desafios" | "Desafios em Grupo" | "Pontuação" | "Gestão" | "Eventos";
type EarnedDTO = {
  id: string;
  entity: Entity;
  title: string;
  description: string;
  icon?: string;
  tier?: Tier;
  group: Group;
};
type AuthReq = Request & { userId?: string };

function entityFromTipoUsuario(tipo: TipoUsuario): Entity | null {
  if (tipo === "Atleta") return "Atleta";
  if (tipo === "Professor") return "Professor";
  if (tipo === "Escolinha") return "Escolinha";
  if (tipo === "Clube") return "Clube";
  return null;
}

function serializeAchievements(list: any[]): EarnedDTO[] {
  return list.map((a) => ({
    id: a.id,
    entity: a.entity,
    title: a.title,
    description: a.description,
    icon: a.icon,
    tier: a.tier,
    group: a.group,
  }));
}

const BADGES: Record<string, { nome: string; iconUrl?: string }> = {
  "1": { nome: "Disciplina",   iconUrl: "/assets/badges/disciplina.png" },
  "2": { nome: "Pontualidade", iconUrl: "/assets/badges/pontualidade.png" },
  "3": { nome: "Liderança",    iconUrl: "/assets/badges/lideranca.png" },
};

export async function getEarnedByUsuarioId(req: Request, res: Response) {
  try {
    const { usuarioId } = req.params as { usuarioId: string };

    const user = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tipo: true },
    });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const entity = entityFromTipoUsuario(user.tipo);
    if (!entity) {
      return res.json({ usuarioId, entity: null, totalAvailable: 0, earned: [] as EarnedDTO[] });
    }

    const result = await computeAchievementsForUser(prisma, usuarioId, user.tipo);
    if (!result) {
      return res.json({ usuarioId, entity, totalAvailable: 0, earned: [] as EarnedDTO[] });
    }

    const earned = serializeAchievements(result.earned);
    return res.json({ usuarioId, entity, totalAvailable: result.totalAvailable, earned });
  } catch (e: any) {
    console.error("getEarnedByUsuarioId error:", e);
    return res.status(500).json({ error: e?.message || "Erro ao calcular conquistas" });
  }
}

/** GET /api/conquistas/catalog/:entity?   (entity opcional: atleta|professor|escolinha|clube) */
export async function getCatalog(req: Request, res: Response) {
  try {
    const raw = (req.params.entity || req.query.entity || "").toString().toLowerCase().trim();

    const map: Record<string, any[]> = {
      atleta: ATHLETE_ACHIEVEMENTS,
      professor: PROFESSOR_ACHIEVEMENTS,
      escolinha: ESCOLINHA_ACHIEVEMENTS,
      clube: CLUBE_ACHIEVEMENTS,
    };

    if (!raw) {
      const all = [
        ...serializeAchievements(ATHLETE_ACHIEVEMENTS),
        ...serializeAchievements(PROFESSOR_ACHIEVEMENTS),
        ...serializeAchievements(ESCOLINHA_ACHIEVEMENTS),
        ...serializeAchievements(CLUBE_ACHIEVEMENTS),
      ];
      return res.json({ total: all.length, items: all });
    }

    const list = map[raw];
    if (!list) {
      return res.status(400).json({ error: "entity inválida. Use Atleta|Professor|Escolinha|Clube" });
    }

    const items = serializeAchievements(list);
    return res.json({ entity: items[0]?.entity, total: items.length, items });
  } catch (e: any) {
    console.error("getCatalog error:", e);
    return res.status(500).json({ error: e?.message || "Erro ao obter catálogo" });
  }
}

/** POST /api/conquistas/compartilhar  (auth) */
export async function compartilharConquista(req: AuthReq, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Sem autenticação." });

  const { badgeId, mensagem } = req.body as { badgeId?: string; mensagem?: string };
  if (!badgeId) return res.status(400).json({ message: "badgeId é obrigatório." });

  const badge = BADGES[badgeId];
  if (!badge) return res.status(404).json({ message: "Badge não encontrada." });

  const conteudo = (mensagem?.trim() || `Conquista desbloqueada: ${badge.nome}! 💪`);

  try {
    const post = await prisma.postagem.create({
      data: {
        usuarioId: userId,
        conteudo,
        tipo: "CONQUISTA" as any,
        badgeId: badgeId as any,
        imagemUrl: badge.iconUrl || null,
        dataCriacao: new Date(),
      } as any,
    });
    return res.status(201).json({ ok: true, post });
  } catch (e) {
    const post = await prisma.postagem.create({
      data: {
        usuarioId: userId,
        conteudo,
        imagemUrl: badge.iconUrl || null,
        dataCriacao: new Date(),
      } as any,
    });
    return res.status(201).json({ ok: true, post });
  }
}

export const __prisma = prisma;