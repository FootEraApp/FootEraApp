import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export async function rankingSemanal(req: Request, res: Response) {
  try {
    const N = Number(req.query.top ?? 10);
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const subs = await prisma.submissaoDesafio.findMany({
      where: { createdAt: { gte: desde } },
      include: {
        atleta: { include: { usuario: true } },
        desafio: true,
        _count: { select: { curtidas: true } },
      },
    });

    const porAtleta = new Map<
      string,
      { atletaId: string; total: number; usuario: any; atleta: any }
    >();
    const porCategoria = new Map<string, Map<string, { atletaId: string; total: number; usuario: any; atleta: any }>>();

    for (const s of subs) {
      const likes = s._count?.curtidas ?? 0;
      if (!s.atleta?.id) continue;

      const key = s.atleta.id;
      const atual = porAtleta.get(key) ?? {
        atletaId: key,
        total: 0,
        usuario: s.atleta.usuario,
        atleta: { id: s.atleta.id },
      };
      atual.total += likes;
      porAtleta.set(key, atual);

      const cats: string[] = Array.isArray(s.desafio?.categoria)
        ? (s.desafio.categoria as string[])
        : [];
      for (const cat of cats) {
        if (!porCategoria.has(cat)) porCategoria.set(cat, new Map());
        const mapa = porCategoria.get(cat)!;
        const a = mapa.get(key) ?? {
          atletaId: key,
          total: 0,
          usuario: s.atleta.usuario,
          atleta: { id: s.atleta.id },
        };
        a.total += likes;
        mapa.set(key, a);
      }
    }

    const ordenar = (arr: any[]) => arr.sort((a, b) => b.total - a.total).slice(0, N);

    const geral = ordenar(Array.from(porAtleta.values()));

    const porCatObj: Record<string, any[]> = {};
    for (const [cat, mapa] of porCategoria.entries()) {
      porCatObj[cat] = ordenar(Array.from(mapa.values()));
    }

    res.json({ geral, porCategoria: porCatObj, desde });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar ranking semanal" });
  }
}