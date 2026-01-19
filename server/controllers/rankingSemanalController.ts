import { prisma } from "../prisma.js";
import { Request, Response } from "express";


function categoriaPorIdade(idade?: number | null): string {
  if (idade == null) return "Livre";
  if (idade <= 9)  return "Sub9";
  if (idade <= 11) return "Sub11";
  if (idade <= 13) return "Sub13";
  if (idade <= 15) return "Sub15";
  if (idade <= 17) return "Sub17";
  if (idade <= 20) return "Sub20";
  return "Livre";
}

export async function rankingSemanal(req: Request, res: Response) {
  try {
    const N = Number(req.query.top ?? 10);
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const subs = await prisma.submissaoDesafio.findMany({
      where: { createdAt: { gte: desde } },
      select: {
        _count: { select: { curtidas: true } },
        atleta: {
          select: {
            id: true,
            idade: true, 
            usuario: { select: { id: true, nome: true, foto: true } },
          },
        },
      },
    });

    const porAtleta = new Map<
      string,
      { atletaId: string; total: number; usuario: { id: string; nome: string; foto?: string | null }, idade: number | null }
    >();

    for (const s of subs) {
      const likes = s._count?.curtidas ?? 0;
      const a = s.atleta;
      if (!a?.id) continue;

      const atual =
        porAtleta.get(a.id) ??
        {
          atletaId: a.id,
          total: 0,
          usuario: a.usuario!,
          idade: typeof a.idade === "number" ? a.idade : null,
        };

      atual.total += likes;
      if (atual.idade == null && typeof a.idade === "number") atual.idade = a.idade;
      if (!atual.usuario && a.usuario) atual.usuario = a.usuario;

      porAtleta.set(a.id, atual);
    }

    const ordenar = (arr: any[]) => arr.sort((a, b) => b.total - a.total).slice(0, N);

    const geral = ordenar(
      Array.from(porAtleta.values()).map(({ idade: _ignore, ...rest }) => rest)
    );

    const porCatObj: Record<string, Array<{ atletaId: string; total: number; usuario: any }>> = {};
    for (const a of porAtleta.values()) {
      const cat = categoriaPorIdade(a.idade);
      (porCatObj[cat] ??= []).push({ atletaId: a.atletaId, total: a.total, usuario: a.usuario });
    }
    for (const cat of Object.keys(porCatObj)) {
      porCatObj[cat] = ordenar(porCatObj[cat]);
    }

    res.json({ geral, porCategoria: porCatObj, desde });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar ranking semanal" });
  }
}