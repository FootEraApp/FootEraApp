import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function listPendentesDesafio(req: Request, res: Response) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);

  const status = String(req.query.status || "pendente");
  const where: any = {};
  if (status === "pendente") where.aprovado = null;
  else if (status === "aprovado") where.aprovado = true;
  else if (status === "invalido") where.aprovado = false;

  const [items, total] = await Promise.all([
    prisma.submissaoDesafio.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        videoUrl: true,
        observacao: true,
        atleta: {
          select: {
            id: true,
            usuario: { select: { id: true, nome: true, nomeDeUsuario: true, foto: true } },
          },
        },
        desafio: { select: { id: true, titulo: true, pontuacao: true } },
      },
    }),
    prisma.submissaoDesafio.count({ where }),
  ]);

  const rows = items.map((s) => ({
    id: s.id,
    criadoEm: s.createdAt,
    videoUrl: s.videoUrl,
    atleta: {
      id: s.atleta?.id ?? null,
      nome: s.atleta?.usuario?.nome ?? s.atleta?.usuario?.nomeDeUsuario ?? "(sem nome)",
      foto: s.atleta?.usuario?.foto ?? null,
      usuarioId: s.atleta?.usuario?.id ?? null,
    },
    desafio: {
      id: s.desafio?.id ?? null,
      titulo: s.desafio?.titulo ?? "Desafio",
      pontuacao: s.desafio?.pontuacao ?? 0,
    },
    observacao: s.observacao ?? null,
  }));

  res.json({ items: rows, total });
}

export async function aprovarSubmissao(req: Request, res: Response) {
  const { id } = req.params;
  const { ajustePontuacao } = (req.body ?? {}) as { ajustePontuacao?: number };

  await prisma.$transaction(async (tx) => {
    const atual = await tx.submissaoDesafio.findUnique({ where: { id }, select: { aprovado: true, atletaId: true, desafioId: true, usuarioId: true } });
    if (!atual) return res.status(404).json({ message: "Submissão não encontrada" });
    if (atual.aprovado === true) return res.status(409).json({ message: "Já aprovada" });
    if (atual.aprovado === false) return res.status(409).json({ message: "Já invalidada" });

    await tx.submissaoDesafio.update({ where: { id }, data: { aprovado: true } });

    const desafio = await tx.desafioOficial.findUnique({
      where: { id: atual.desafioId },
      select: { pontuacao: true, titulo: true },
    });

    const pontos = Number.isFinite(ajustePontuacao) ? Number(ajustePontuacao) : (desafio?.pontuacao ?? 0);

    if (pontos && pontos !== 0) {
      await tx.pontuacaoAtleta.upsert({
        where: { atletaId: atual.atletaId },
        create: { atletaId: atual.atletaId, pontuacaoTotal: pontos },
        update: { pontuacaoTotal: { increment: pontos } },
      });
    }

    const atleta = await tx.atleta.findUnique({ where: { id: atual.atletaId }, select: { usuarioId: true } });
    const usuarioId = atual.usuarioId ?? atleta?.usuarioId ?? null;
    if (usuarioId) {
      await tx.atividadeRecente.create({
        data: { usuarioId, tipo: "DESAFIO_APROVADO" },
      });
    }
  });

  res.json({ ok: true });
}

export async function invalidarSubmissao(req: Request, res: Response) {
  const { id } = req.params;
  const { motivo } = (req.body ?? {}) as { motivo?: string };

  const s = await prisma.submissaoDesafio.findUnique({ where: { id }, select: { aprovado: true } });
  if (!s) return res.status(404).json({ message: "Submissão não encontrada" });
  if (s.aprovado === false) return res.status(409).json({ message: "Já invalidada" });

  await prisma.submissaoDesafio.update({
    where: { id },
    data: { aprovado: false, observacao: motivo ?? null },
  });

  res.json({ ok: true });
}