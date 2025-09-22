import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listModeracaoDesafios(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
    const status = String(req.query.status || "pendente").toLowerCase();

    const where: any = {};
    if (status !== "todos") {
      if (status === "pendente") where.aprovado = { equals: null };
      else if (status === "aprovado") where.aprovado = true;
      else if (status === "invalido" || status === "inválido") where.aprovado = false;
    }

    const [rows, total] = await prisma.$transaction([
      prisma.submissaoDesafio.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          atleta: {
            select: {
              id: true,
              foto: true,
              usuario: { select: { nome: true } },
            },
          },
          desafio: { select: { id: true, titulo: true, pontuacao: true } },
        },
      }),
      prisma.submissaoDesafio.count({ where }),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      criadoEm: r.createdAt.toISOString(),
      videoUrl: (r as any).videoUrl ?? (r as any).video ?? (r as any).urlVideo ?? null,
      observacao: (r as any).observacao ?? null,
      resultado: (r as any).resultado ?? null,
      resultadoDeclarado: (r as any).resultadoDeclarado ?? null,
      unidadeResultado: (r as any).unidadeResultado ?? null,
      tempoMs: (r as any).tempoMs ?? null,
      conteudoJson: (r as any).conteudo ?? (r as any).conteudoJson ?? null,

      atleta: {
        id: (r as any).atleta?.id ?? null,
        nome: (r as any).atleta?.usuario?.nome ?? "Atleta",
        foto: (r as any).atleta?.foto ?? null,
      },
      desafio: {
        id: (r as any).desafio?.id ?? null,
        titulo: (r as any).desafio?.titulo ?? "Desafio",
        pontuacao: (r as any).desafio?.pontuacao ?? 0,
      },
    }));

    res.json({ items, total });
  } catch (e) {
    console.error("Erro listModeracaoDesafios:", e);
    res.status(500).json({ message: "Erro ao listar submissões para moderação." });
  }
}

export async function aprovarSubmissaoDesafio(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { ajustePontuacao } = req.body as { ajustePontuacao?: number };

    const sub = await prisma.submissaoDesafio.findUnique({
      where: { id },
      include: { desafio: { select: { pontuacao: true } } },
    });
    if (!sub) return res.status(404).json({ message: "Submissão não encontrada" });

    const pontos =
      typeof ajustePontuacao === "number" && Number.isFinite(ajustePontuacao)
        ? ajustePontuacao
        : (sub as any).desafio?.pontuacao ?? 0;

    const data: any = { aprovado: true, avaliadoEm: new Date() };
    if ("pontuacaoAtribuida" in (sub as any)) data.pontuacaoAtribuida = pontos;
    if ("pontuacaoFinal" in (sub as any)) data.pontuacaoFinal = pontos;

    await prisma.submissaoDesafio.update({ where: { id }, data });
    res.json({ ok: true });
  } catch (e) {
    console.error("Erro aprovarSubmissaoDesafio:", e);
    res.status(500).json({ message: "Erro ao aprovar submissão." });
  }
}

export async function invalidarSubmissaoDesafio(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { motivo } = req.body as { motivo?: string };
    if (!motivo) return res.status(400).json({ message: "Motivo é obrigatório." });

    const sub = await prisma.submissaoDesafio.findUnique({ where: { id } });
    if (!sub) return res.status(404).json({ message: "Submissão não encontrada" });

    const data: any = { aprovado: false, avaliadoEm: new Date() };
    if ("motivoInvalidacao" in (sub as any)) data.motivoInvalidacao = motivo;
    if ("observacaoAdmin" in (sub as any)) data.observacaoAdmin = motivo;

    await prisma.submissaoDesafio.update({ where: { id }, data });
    res.json({ ok: true });
  } catch (e) {
    console.error("Erro invalidarSubmissaoDesafio:", e);
    res.status(500).json({ message: "Erro ao invalidar submissão." });
  }
}