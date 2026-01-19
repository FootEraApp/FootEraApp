import { prisma } from "../prisma.js";
import type { Request, Response } from 'express';
import { enforceTotalLimit } from '../services/usage.js';


async function assertListaDoOlheiro(listaId: string, olheiroId: string) {
  const lista = await prisma.listaOlheiro.findUnique({
    where: { id: listaId },
    select: { id: true, olheiroId: true },
  });
  if (!lista) return { ok: false as const, status: 404, body: { message: "Lista não encontrada." } };
  if (lista.olheiroId !== olheiroId) {
    return { ok: false as const, status: 403, body: { code: "FORBIDDEN" } };
  }
  return { ok: true as const };
}

function getUserId(req: Request) {
  // @ts-ignore
  return req.user?.id || (req as any).userId;
}

async function requireOlheiroId(userId: string) {
  const o = await prisma.olheiro.findUnique({ where: { usuarioId: userId }, select: { id: true } });
  return o?.id || null;
}

export async function criarLista(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED' });

  const olheiroId = await requireOlheiroId(userId);
  if (!olheiroId) return res.status(403).json({ code: 'NOT_SCOUT' });

  const gate = await enforceTotalLimit(req, res, 'listas_salvas_total', async () =>
    prisma.listaOlheiro.count({ where: { olheiroId } })
  );
  if (gate === undefined) return;

  const { nome, descricao, publico = false } = req.body || {};
  if (!nome?.trim()) return res.status(400).json({ message: "Informe 'nome'." });

  try {
    const lista = await prisma.listaOlheiro.create({
      data: { nome: nome.trim(), descricao: descricao ?? null, publico: Boolean(publico), olheiroId },
    });
    return res.status(201).json(lista);
  } catch (e: any) {
    if (String(e?.code) === 'P2002') {
      return res.status(400).json({ message: 'Você já tem uma lista com esse nome.' });
    }
    console.error('criarLista', e);
    return res.status(500).json({ message: 'Erro ao criar lista.' });
  }
}

export async function minhasListas(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED' });

  const olheiroId = await requireOlheiroId(userId);
  if (!olheiroId) return res.status(403).json({ code: 'NOT_SCOUT' });

  const includeItems = String(req.query.items || '') === '1';

  const listas = await prisma.listaOlheiro.findMany({
    where: { olheiroId },
    orderBy: { createdAt: 'desc' },
    include: includeItems ? {
      itens: { include: { atleta: { select: { id: true, nome: true, foto: true } } } },
    } : undefined,
  });

  if (!includeItems) {
    const ids = listas.map(l => l.id);
    const counts = await prisma.listaOlheiroItem.groupBy({
      by: ['listaId'],
      where: { listaId: { in: ids } },
      _count: { _all: true },
    });
    const map = new Map(counts.map(c => [c.listaId, c._count._all]));
    return res.json(listas.map(l => ({ ...l, itensCount: map.get(l.id) || 0 })));
  }

  return res.json(listas);
}

export async function deletarLista(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED' });

  const olheiroId = await requireOlheiroId(userId);
  if (!olheiroId) return res.status(403).json({ code: 'NOT_SCOUT' });

  const { id } = req.params;

  const check = await assertListaDoOlheiro(id, olheiroId);
  if (!check.ok) return res.status(check.status).json(check.body);

  await prisma.listaOlheiroItem.deleteMany({ where: { listaId: id } });
  await prisma.listaOlheiro.delete({ where: { id } });

  return res.json({ ok: true });
}


export async function adicionarAtleta(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED' });

  const olheiroId = await requireOlheiroId(userId);
  if (!olheiroId) return res.status(403).json({ code: 'NOT_SCOUT' });

  const { id } = req.params;
  const { atletaId } = req.body || {};
  if (!atletaId) return res.status(400).json({ message: "Informe 'atletaId'." });

  const check = await assertListaDoOlheiro(id, olheiroId);
  if (!check.ok) return res.status(check.status).json(check.body);

  try {
    const item = await prisma.listaOlheiroItem.create({
      data: { listaId: id, atletaId },
      include: { atleta: { select: { id: true, nome: true, foto: true } } },
    });
    return res.status(201).json(item);
  } catch (e: any) {
    if (String(e?.code) === 'P2002') {
      return res.status(200).json({ ok: true, duplicated: true });
    }
    console.error('adicionarAtleta', e);
    return res.status(500).json({ message: 'Erro ao adicionar atleta.' });
  }
}

export async function removerAtleta(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED' });

  const olheiroId = await requireOlheiroId(userId);
  if (!olheiroId) return res.status(403).json({ code: 'NOT_SCOUT' });

  const { id, atletaId } = req.params;

  const check = await assertListaDoOlheiro(id, olheiroId);
  if (!check.ok) return res.status(check.status).json(check.body);

  await prisma.listaOlheiroItem.delete({
    where: { listaId_atletaId: { listaId: id, atletaId } },
  });
  return res.json({ ok: true });
}
