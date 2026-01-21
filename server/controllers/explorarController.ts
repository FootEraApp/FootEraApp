import { Request, Response } from "express";
import { prisma } from "../prisma.js";

function calcIsPro(assinatura: { status?: string | null; trialEndsAt?: Date | string | null } | null | undefined) {
  if (!assinatura) return false;

  const status = String(assinatura.status || "").toUpperCase();

  if (status === "BLOQUEADA") return false;
  if (status === "ATIVA") return true;

  if (status === "TRIAL") {
    const trialEndsAt = assinatura.trialEndsAt ? new Date(assinatura.trialEndsAt as any) : null;
    return !!trialEndsAt && new Date() <= trialEndsAt;
  }

  return false;
}

export async function listarAtletasExplorar(req: Request, res: Response) {
  try {
    const authUserId = (req as any).userId as string | undefined;
    const excludeUsuarioId = (req.query.excludeUsuarioId as string) || authUserId || "";
    const excludeAtletaId = req.query.excludeAtletaId as string | undefined;
    const andFilters: any[] = [];

    if (excludeUsuarioId) andFilters.push({ usuarioId: { not: excludeUsuarioId } });
    if (excludeAtletaId) andFilters.push({ id: { not: excludeAtletaId } });

    const where = andFilters.length ? { AND: andFilters } : undefined;

    const atletas = await prisma.atleta.findMany({
      where,
      select: {
        id: true,
        usuarioId: true,
        idade: true,
        posicao: true,
        categoria: true,
        perfilTipoTreino: true,
        pontosTotal: true,
        clubeId: true,
        escolinhaId: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            cidade: true,
            estado: true,
            assinatura: {select: {plano: true, status: true, trialEndsAt: true}},
          },
        },
        pontuacao: {
          select: {
            pontuacaoTotal: true,
          },
        },
      },
      orderBy: { dataCriacao: "desc" },
      take: 100,
    });

    const payload = atletas.map((a) => {
      const pontuacaoTotal = a.pontuacao?.pontuacaoTotal ?? a.pontosTotal ?? 0;
      const independente = !a.clubeId && !a.escolinhaId;
      const isPro = calcIsPro(a.usuario?.assinatura);

      return {
        id: a.id,
        usuarioId: a.usuarioId,
        usuario: a.usuario,
        foto: a.usuario?.foto ?? null,
        idade: a.idade ?? null,
        posicao: a.posicao ?? null,
        categoria: a.categoria ?? [],
        cidade: a.usuario?.cidade ?? null,
        estado: a.usuario?.estado ?? null,
        independente,
        pontuacao: pontuacaoTotal,
        categoriaBase: null,
        tipoTreino: a.perfilTipoTreino ?? null,
        isPro,
      };
    });

    res.json(payload);
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

    const excludeUsuarioId =
      (req.query.excludeUsuarioId as string) ||
      ((req as any).userId as string) ||
      "";

    const atletasRaw = await prisma.atleta.findMany({
      where: excludeUsuarioId ? { usuarioId: { not: excludeUsuarioId } } : undefined,
      select: {
        id: true,
        usuarioId: true,
        idade: true,
        posicao: true,
        categoria: true,
        perfilTipoTreino: true,
        pontosTotal: true,
        clubeId: true,
        escolinhaId: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            cidade: true,
            estado: true,
            assinatura: {select: {plano: true, status: true, trialEndsAt: true}},
          },
        },
        pontuacao: {
          select: {
            pontuacaoTotal: true,
          },
        },
      },
      orderBy: { dataCriacao: "desc" },
      take: 200,
    });

    const atletas = atletasRaw.map((a) => {
      const pontuacaoTotal = a.pontuacao?.pontuacaoTotal ?? a.pontosTotal ?? 0;
      const independente = !a.clubeId && !a.escolinhaId;
      const isPro = calcIsPro(a.usuario?.assinatura);

      return {
        id: a.id,
        usuarioId: a.usuarioId,
        usuario: a.usuario,
        foto: a.usuario?.foto ?? null,
        idade: a.idade ?? null,
        posicao: a.posicao ?? null,
        categoria: a.categoria ?? [],
        cidade: a.usuario?.cidade ?? null,
        estado: a.usuario?.estado ?? null,
        independente,
        pontuacao: pontuacaoTotal,
        categoriaBase: null,
        tipoTreino: a.perfilTipoTreino ?? null,
        isPro,
      };
    });

    const clubesRaw = await prisma.clube.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            cidade: true,
            estado: true,
            assinatura: { select: { plano: true, status: true, trialEndsAt: true} },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { nome: "asc" },
      take: 100,
    });

    const clubes = clubesRaw.map((c) => ({
      ...c,
      isPro: calcIsPro(c.usuario?.assinatura),
    }));

    const escolasRaw = await prisma.escolinha.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            cidade: true,
            estado: true,
            assinatura: { select: { plano: true, status: true, trialEndsAt: true } },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { nome: "asc" },
      take: 100,
    });

    const escolas = escolasRaw.map((e) => ({
      ...e,
      isPro: calcIsPro(e.usuario?.assinatura),
    }));

    const professoresRaw = await prisma.professor.findMany({
      select: {
        id: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            cidade: true,
            estado: true,
            assinatura: { select: { plano: true, status: true, trialEndsAt: true } },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { usuario: { nome: "asc" } },
      take: 100,
    });

    const professores = professoresRaw.map((p) => ({
      ...p,
      isPro: calcIsPro(p.usuario?.assinatura),

    }));

    const olheirosRaw = await prisma.olheiro.findMany({
      select: {
        id: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            foto: true,
            cidade: true,
            estado: true,
            assinatura: { select: { plano: true, status: true, trialEndsAt: true } },
          },
        },
      },
      where: termo ? { usuario: { nome: { contains: termo, mode: "insensitive" } } } : {},
      orderBy: { usuario: { nome: "asc" } },
      take: 100,
    });

    const olheiros = olheirosRaw.map((o) => ({
      ...o,
      isPro: calcIsPro(o.usuario?.assinatura),

    }));

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
      inscrito: e.inscricoes?.some(
        (i: any) => String(i.usuarioId) === String(userIdLogado)
      ),
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
    const termo = q ? String(q).trim() : "";

    const [atletas, clubes, escolas, professores, olheiros] = await Promise.all([
      prisma.atleta.findMany({
        where: termo
          ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
          : {},
        select: {
          id: true,
          usuarioId: true,
          idade: true,
          posicao: true,
          categoria: true,
          perfilTipoTreino: true,
          pontosTotal: true,
          clubeId: true,
          escolinhaId: true,
          usuario: {
            select: { id: true, nome: true, foto: true, cidade: true, estado: true, assinatura: {select: {plano: true, status: true}}},
          },
          pontuacao: { select: { pontuacaoTotal: true } },
        },
        take: 50,
      }),

      prisma.clube.findMany({
        where: termo ? { nome: { contains: termo, mode: "insensitive" } } : {},
        include: { usuario: true },
        take: 50,
      }),

      prisma.escolinha.findMany({
        where: termo ? { nome: { contains: termo, mode: "insensitive" } } : {},
        include: { usuario: true },
        take: 50,
      }),

      prisma.professor.findMany({
        where: termo
          ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
          : {},
        include: { usuario: { select: { id: true, nome: true, foto: true } } },
        take: 50,
      }),

      prisma.olheiro.findMany({
        where: termo
          ? { usuario: { nome: { contains: termo, mode: "insensitive" } } }
          : {},
        include: { usuario: { select: { id: true, nome: true, foto: true } } },
        take: 50,
      }),
    ]);

    res.json({ atletas, clubes, escolas, professores, olheiros });
  } catch (error) {
    console.error("Erro em /api/explorar/buscar:", error);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
};