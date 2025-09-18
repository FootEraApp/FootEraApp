import { Router } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = Router();

router.get("/atleta/:id", async (req, res) => {
  try {
    const atletaId = String(req.params.id);
    const d7  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const atleta = await prisma.atleta.findUnique({
      where: { id: atletaId },
      select: { id: true, usuario: { select: { nome: true, foto: true } } },
    });
    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });

    const subs7 = await prisma.submissaoDesafio.findMany({
      where: { atletaId, createdAt: { gte: d7 } },
      include: {
        _count: { select: { curtidas: true, comentarios: true } },
        desafio: { select: { pontuacao: true } }, 
      },
    });
    const curtidas7d    = subs7.reduce((s, x) => s + (x as any)._count.curtidas, 0);
    const submissoes7d  = subs7.length;
    const pontos7d      = subs7.reduce((s, x) => s + (x.desafio?.pontuacao ?? 0), 0);
    const subs30 = await prisma.submissaoDesafio.findMany({
      where: { atletaId, createdAt: { gte: d30 } },
      include: {
        _count: { select: { curtidas: true, comentarios: true } },
        desafio: { select: { categoria: true } },  
      },
    });

    const byDay = new Map<string, { dia: string; curtidas: number; comentarios: number; submissoes: number }>();
    for (const s of subs30) {
      const dia = new Date(s.createdAt).toLocaleDateString("pt-BR");
      const bucket = byDay.get(dia) || { dia, curtidas: 0, comentarios: 0, submissoes: 0 };
      bucket.submissoes += 1;
      bucket.curtidas += (s as any)._count.curtidas;
      bucket.comentarios += (s as any)._count.comentarios;
      byDay.set(dia, bucket);
    }

    const subTreino30 = await prisma.submissaoTreino.count({
      where: { atletaId, criadoEm: { gte: d30 } },
    });

    const porTipo = [
      { label: "Desafios", value: subs30.length },
      { label: "Treinos", value: subTreino30 },
    ];

    const porCategoria = new Map<string, number>();
    for (const s of subs30) {
      const cats = Array.isArray(s.desafio?.categoria) ? s.desafio!.categoria : [];
      for (const c of cats) porCategoria.set(c, (porCategoria.get(c) || 0) + 1);
    }
    const porCategoriaArr = Array.from(porCategoria, ([label, value]) => ({ label, value }));

    res.json({
      atleta: { id: atleta.id, nome: atleta.usuario?.nome, foto: atleta.usuario?.foto },
      kpis: { curtidas7d, submissoes7d, pontos7d },
      porDia30d: Array.from(byDay.values()).sort((a, b) => {
        const [da, ma, ya] = a.dia.split("/").map(Number);
        const [db, mb, yb] = b.dia.split("/").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      }),
      porTipo,
      porCategoria: porCategoriaArr,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao calcular desempenho" });
  }
});

export default router;