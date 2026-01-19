import { Request, Response } from "express";
import { prisma } from "../prisma.js";

export async function listarAtletasExplorar(req: Request, res: Response) {
  try {
    const authUserId = (req as any).userId as string | undefined;
    const excludeUsuarioId = (req.query.excludeUsuarioId as string) || authUserId;
    const excludeAtletaId = req.query.excludeAtletaId as string | undefined;

    const andFilters: any[] = [];
    if (excludeUsuarioId) andFilters.push({ usuarioId: { not: excludeUsuarioId } });
    if (excludeAtletaId) andFilters.push({ id: { not: excludeAtletaId } });

    const where = andFilters.length ? { AND: andFilters } : {};

    const atletas = await prisma.atleta.findMany({
      where,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        foto: true,
      },
      orderBy: { dataCriacao: "desc" },
      take: 100,
    });

    res.json(atletas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao carregar atletas do explorar" });
  }
}

export async function explorar(req: Request, res: Response) {
  try {
    const { q } = req.query;
    const userIdLogado = (req as any).userId || null;
    const termo = q ? String(q).trim() : "";
    const atletasRaw = await prisma.atleta.findMany({
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
      orderBy: { dataCriacao: "desc" },
      take: 200,
    });

    const atletas = atletasRaw.map((a: any) => ({
      id: a.id,
      usuario: a.usuario,
      foto: a.usuario?.foto ?? null,
      tipoTreino: a.perfilTipoTreino ?? null,
    }));

    const clubes = await prisma.clube.findMany({
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
      where: termo
        ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
        : {},
      orderBy: { nome: "asc" },
      take: 100,
    });

    const escolas = await prisma.escolinha.findMany({
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
      where: termo
        ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
        : {},
      orderBy: { nome: "asc" },
      take: 100,
    });

    const professores = await prisma.professor.findMany({
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
      where: termo
        ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
        : {},
      orderBy: { usuario: { nome: "asc" } },
      take: 100,
    });

    const olheiros = await prisma.olheiro.findMany({
      include: {
        usuario: { select: { id: true, nome: true, foto: true } },
      },
      where: termo
        ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
        : {},
      orderBy: { usuario: { nome: "asc" } },
      take: 100,
    });

    const agora = new Date();
    
    const whereEvento: any = {
      status: "ABERTO",
      dataEvento: { gte: agora },
    };

    if (termo) {
      whereEvento.OR = [
        { titulo: { contains: termo, mode: "insensitive" } },
        { cidade: { contains: termo, mode: "insensitive" } },
        { estado: { contains: termo, mode: "insensitive" } },
        { pais: { contains: termo, mode: "insensitive" } },
        { local: { contains: termo, mode: "insensitive" } },
      ];
    }

    const eventosRaw = await prisma.evento.findMany({
      where: whereEvento,
      include: {
        clube: { select: { id: true, nome: true, logo: true } },
        escolinha: { select: { id: true, nome: true, logo: true } },
        inscricoes: { select: { usuarioId: true } },
      },
      orderBy: { dataEvento: "asc" },
      take: 50,
    });

    const eventos = eventosRaw.map((e: any) => ({
      ...e,
      dataEvento: e.dataEvento?.toISOString?.() ?? e.dataEvento,
      inscricaoInicio: e.inscricaoInicio?.toISOString?.() ?? e.inscricaoInicio,
      inscricaoFim: e.inscricaoFim?.toISOString?.() ?? e.inscricaoFim,
      inscrito: e.inscricoes.some((i: any) => String(i.usuarioId) === String(userIdLogado)),
    }));

    return res.json({
      atletas,
      clubes,
      escolas,
      professores,
      olheiros,
      eventos,
    });
  } catch (error) {
    console.error("Erro em /api/explorar:", error);
    return res.status(500).json({ error: "Erro ao carregar dados do explorar" });
  }
}

export const buscarExplorar = async (req: Request, res: Response) => {
  const { q } = req.query;

  try {
    const termo = q ? String(q).toLowerCase() : "";

    const [atletas, clubes, escolas, professores, olheiros] = await Promise.all([
      prisma.atleta.findMany({
        where: { usuario: { nome: { contains: termo, mode: "insensitive" } } },
        include: { usuario: { select: { id: true, nome: true, foto: true } } },
      }),
      prisma.clube.findMany({
        where: { nome: { contains: termo, mode: "insensitive" } },
        include: { usuario: true },
      }),
      prisma.escolinha.findMany({
        where: { nome: { contains: termo, mode: "insensitive" } },
        include: { usuario: true },
      }),
      prisma.professor.findMany({
        where: { usuario: { nome: { contains: termo, mode: "insensitive" } } },
        include: { usuario: { select: { id: true, nome: true, foto: true } } },
      }),
      prisma.olheiro.findMany({
        where: { usuario: { nome: { contains: termo, mode: "insensitive" } } },
        include: { usuario: { select: { id: true, nome: true, foto: true } } },
      }),
    ]);

    res.json({ atletas, clubes, escolas, professores, olheiros });
  } catch (error) {
    console.error("Erro em /api/explorar/buscar:", error);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
};