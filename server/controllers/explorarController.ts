import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


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
  const { q } = req.query;
  const userIdLogado = (req as any).userId || null;

  const atletas = await prisma.atleta.findMany({
  include: {
    usuario: { select: { id: true, nome: true, foto: true } },
  },
  orderBy: { dataCriacao: "desc" },
});

const out = atletas.map(a => ({
  id: a.id,
  usuario: a.usuario,
  foto: a.usuario?.foto ?? null,
  tipoTreino: a.perfilTipoTreino ?? null,
}));

  res.json({
    atletas: out,
    clubes: [],
    escolas: [],
    desafios: [],
    professores: [],
  });
}

export const buscarExplorar = async (req: Request, res: Response) => {
  const { q } = req.query;

  try {
    const termo = q ? String(q).toLowerCase() : "";

    const [atletas, clubes, escolas, desafios, professores] = await Promise.all([
      prisma.atleta.findMany({
        where: {
          usuario: { nome: { contains: termo, mode: "insensitive" } }
        },
        include: { usuario: true }
      }),
      prisma.clube.findMany({
        where: {
          nome: { contains: termo, mode: "insensitive" }
        },
        include: { usuario: true }
      }),
      prisma.escolinha.findMany({
        where: {
          nome: { contains: termo, mode: "insensitive" }
        },
        include: { usuario: true }
      }),
      prisma.desafioOficial.findMany({
        where: {
          titulo: { contains: termo, mode: "insensitive" }
        },
      }),
      prisma.professor.findMany({
        where: {
          usuario: { nome: { contains: termo, mode: "insensitive" } }
        },
        include: { usuario: true }
      })
    ]);

    res.json({ atletas, clubes, escolas, desafios, professores });
  } catch (error) {
    console.error("Erro em /api/explorar:", error);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
};
