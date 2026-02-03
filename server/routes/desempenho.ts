import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.get("/atleta/:id/historico", async (req, res) => {
  try {
    const atletaId = String(req.params.id);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));

    const [desafios, treinos, totalDesafios, totalTreinos] = await Promise.all([
      prisma.submissaoDesafio.findMany({
        where: { atletaId },
        select: { id: true, createdAt: true, aprovado: true, desafioId: true, videoUrl: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.submissaoTreino.findMany({
        where: { atletaId },
        select: { id: true, criadoEm: true, aprovado: true, pontosCreditados: true, treinoTituloSnapshot: true },
        orderBy: { criadoEm: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.submissaoDesafio.count({ where: { atletaId } }),
      prisma.submissaoTreino.count({ where: { atletaId } }),
    ]);

    res.json({
      page,
      pageSize,
      total: totalDesafios + totalTreinos,
      desafios,
      treinos,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

router.get("/atleta/:id", async (req, res) => {
  try {
    const atletaId = String(req.params.id);
    const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const atleta = await prisma.atleta.findUnique({
      where: { id: atletaId },
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { nome: true, foto: true } },
      },
    });
    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });

    const [subsDesafio7, subsTreino7] = await Promise.all([
      prisma.submissaoDesafio.findMany({
        where: { atletaId, createdAt: { gte: d7 } },
        include: {
          _count: { select: { curtidas: true, comentarios: true } },
          desafio: { select: { pontuacao: true } },
        },
      }),
      prisma.submissaoTreino.findMany({
        where: { atletaId, criadoEm: { gte: d7 } },
        include: {
          _count: { select: { curtidas: true } },
        },
      }),
      prisma.postagem.findMany({
        where: { usuarioId: atleta.usuarioId, dataCriacao: { gte: d7 } },
        include: {
          _count: { select: { curtidas: true, comentarios: true } },
        },
      }),
    ]);

    const curtidasRecebidas7 = await prisma.curtida.count({
      where: {
        createdAt: { gte: d7 },
        OR: [
          { postagem: { usuarioId: atleta.usuarioId } },
          { submissao: { atletaId } },
          { submissaoTreino: { atletaId } },
        ],
      },
    });

    const curtidas7d = curtidasRecebidas7;
    const submissoes7d = subsDesafio7.length + subsTreino7.length;
    const pontos7d =
      subsTreino7.reduce((s, x) => s + Number(x.pontosCreditados ?? 0), 0) +
      subsDesafio7.reduce((s, x) => {
        const pts = Number(x.desafio?.pontuacao ?? 0);
        return s + pts;
      }, 0);

    const [subsDesafio30, subsTreino30, posts30] = await Promise.all([
      prisma.submissaoDesafio.findMany({
        where: { atletaId, createdAt: { gte: d30 } },
        include: { _count: { select: { curtidas: true, comentarios: true } } },
      }),
      prisma.submissaoTreino.findMany({
        where: { atletaId, criadoEm: { gte: d30 } },
        include: { _count: { select: { curtidas: true } } },
      }),
      prisma.postagem.findMany({
        where: { usuarioId: atleta.usuarioId, dataCriacao: { gte: d30 } },
        include: { _count: { select: { curtidas: true, comentarios: true } } },
      }),
    ]);

    const curtidasRecebidas30 = await prisma.curtida.findMany({
      where: {
        createdAt: { gte: d30 },
        OR: [
          { postagem: { usuarioId: atleta.usuarioId } },
          { submissao: { atletaId } },
          { submissaoTreino: { atletaId } },
        ],
      },
      select: { createdAt: true },
    });

    const comentariosRecebidos30 = await prisma.comentario.findMany({
      where: {
        dataCriacao: { gte: d30 },
        OR: [
          { postagem: { usuarioId: atleta.usuarioId } },
          { submissao: { atletaId } },
        ],
      },
      select: { dataCriacao: true },
    });

    const comentariosTreino30 = await prisma.avaliacaoTreinoComentario.findMany({
      where: {
        avaliacaoTreino: {
          submissaoTreino: { atletaId },
        },
        createdAt: { gte: d30 },
      },
      select: { createdAt: true },
    });

    const byDay = new Map<
      string,
      { dia: string; curtidas: number; comentarios: number; submissoes: number }
    >();

    function addBucket(d: Date, add: { curtidas?: number; comentarios?: number; submissoes?: number }) {
      const dia = new Date(d).toLocaleDateString("pt-BR");
      const bucket = byDay.get(dia) || { dia, curtidas: 0, comentarios: 0, submissoes: 0 };
      bucket.curtidas += Number(add.curtidas ?? 0);
      bucket.comentarios += Number(add.comentarios ?? 0);
      bucket.submissoes += Number(add.submissoes ?? 0);
      byDay.set(dia, bucket);
    }

    for (const s of subsDesafio30) {
      addBucket(s.createdAt, { submissoes: 1 });
    }

    for (const s of subsTreino30) {
      addBucket(s.criadoEm, {
        submissoes: 1,
      });
    }

    for (const p of posts30) {
      addBucket(p.dataCriacao, {});
    }

    for (const c of curtidasRecebidas30) {
      addBucket(c.createdAt, { curtidas: 1 });
    }

    for (const c of comentariosRecebidos30) {
      addBucket(c.dataCriacao, { comentarios: 1 });
    }

    for (const c of comentariosTreino30) {
      addBucket(c.createdAt, { comentarios: 1 });
    }

    const porDia30d = Array.from(byDay.values()).sort((a, b) => {
      const [da, ma, ya] = a.dia.split("/").map(Number);
      const [db, mb, yb] = b.dia.split("/").map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });

    const consistencia30d = porDia30d.filter((d) => (d.curtidas + d.comentarios + d.submissoes) > 0).length;

    const porTipo = [
      { label: "Posts", value: posts30.length },
      { label: "Desafios", value: subsDesafio30.length },
      { label: "Treinos", value: subsTreino30.length },
    ];

    res.json({
      atleta: { id: atleta.id, nome: atleta.usuario?.nome, foto: atleta.usuario?.foto },
      kpis: { curtidas7d, submissoes7d, pontos7d, consistencia30d },
      porDia30d,
      porTipo,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao calcular desempenho" });
  }
});

export default router;