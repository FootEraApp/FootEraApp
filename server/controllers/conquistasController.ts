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

export type EarnedDTO = {
  id: string;
  entity: Entity;
  title: string;
  description: string;
  icon?: string;
  tier?: Tier;
  group: Group;
};

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

export async function getEarnedByUsuarioId(req: Request, res: Response) {
  try {
    const { usuarioId } = req.params as { usuarioId: string };

    const user = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tipo: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const entity = entityFromTipoUsuario(user.tipo);
    if (!entity) {
      return res.json({
        usuarioId,
        entity: null,
        totalAvailable: 0,
        earned: [] as EarnedDTO[],
      });
    }

    const result = await computeAchievementsForUser(prisma, usuarioId, user.tipo);
    if (!result) {
      return res.json({
        usuarioId,
        entity,
        totalAvailable: 0,
        earned: [] as EarnedDTO[],
      });
    }

    const earned = serializeAchievements(result.earned);
    return res.json({
      usuarioId,
      entity,
      totalAvailable: result.totalAvailable,
      earned,
    });
  } catch (e: any) {
    console.error("getEarnedByUsuarioId error:", e);
    return res.status(500).json({ error: e?.message || "Erro ao calcular conquistas" });
  }
}

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

export const __prisma = prisma;