import { Request, Response } from "express";
import { prisma } from "../prisma.js";

function normalizaTipo(raw: string) {
  const t = raw?.toLowerCase();
  const map: Record<string, string> = {
    atleta: "Atleta",
    escola: "Escolinha",
    escolinha: "Escolinha",
    clube: "Clube",
    professor: "Professor",
    admin: "Admin",
    olheiro: "Olheiro",
  };
  return map[t] || "";
}

function resolveFoto(u: any): string | null {
  return (
    u.foto ??
    u.atleta?.foto ??
    u.professor?.fotoUrl ??
    u.clube?.logo ??
    u.escolinha?.logo ??
    u.olheiro?.fotoUrl ??
    null
  );
}

export async function listAdminUsers(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20) || 20));
    const q = String(req.query.q || "").trim();
    const tipo = normalizaTipo(String(req.query.tipo || ""));

    const where: any = {};
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: "insensitive" } },
        { nomeDeUsuario: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (tipo) where.tipo = tipo;

    const [rows, total] = await prisma.$transaction([
      prisma.usuario.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { dataCriacao: "desc" },
        include: {
          atleta: { select: { foto: true } },
          professor: { select: { fotoUrl: true } },
          clube: { select: { logo: true } },
          escolinha: { select: { logo: true } },
          olheiro: { select: { fotoUrl: true } },
        },
      }),
      prisma.usuario.count({ where }),
    ]);

    const items = rows.map((u) => {
      const rawCriado =
        (u as any).criadoEm ??
        (u as any).dataCriacao ??
        (u as any).createdAt ??
        null;

      const criadoEm =
        rawCriado && typeof (rawCriado as any).toISOString === "function"
          ? (rawCriado as any).toISOString()
          : rawCriado;

      return {
        id: u.id,
        nome: u.nome,
        nomeDeUsuario: u.nomeDeUsuario,
        email: u.email ?? null,
        tipo: u.tipo,
        foto: resolveFoto(u),
        criadoEm,
        verificado: (u as any).verified ?? false,
        ultimaAtividade: null as string | null,
        ultimaAtividadeNome: null as string | null,
      };
    });

    res.json({ items, total, page, pageSize });
  } catch (e: any) {
    console.error("Erro em listAdminUsers:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Erro ao listar usuários (admin)." });
  }
}

export async function getAdminUserDetail(req: Request, res: Response) {
  const { id } = req.params;

  const u = await prisma.usuario.findUnique({
    where: { id },
    include: {
      atleta: { select: { id: true, foto: true, posicao: true } },
      professor: { select: { id: true, fotoUrl: true } },
      clube: { select: { id: true, logo: true } },
      escolinha: { select: { id: true, logo: true } },
      olheiro: { select: { id: true, fotoUrl: true } },
      _count: {
        select: { postagens: true, comentarios: true, seguidores: true },
      },
    },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado" });

  const [ultima, posicaoCampo, totalVinculados] = await Promise.all([
    u.tipo === "Atleta" ? ultimaAtividadeDeAtleta(u.id) : Promise.resolve(null),
    u.tipo === "Atleta"
      ? posicaoDoAtletaPorUsuarioId(u.id)
      : Promise.resolve(null),
    totalVinculadosDoUsuario(u as any),
  ]);

  res.json({
    id: u.id,
    nome: u.nome,
    nomeDeUsuario: u.nomeDeUsuario,
    email: u.email ?? null,
    tipo: u.tipo,
    foto: resolveFoto(u),
    criadoEm:
      (u as any).criadoEm ??
      (u as any).dataCriacao ??
      (u as any).createdAt ??
      null,
    verificado: (u as any).verified ?? false,
    contagens: {
      posts: u._count.postagens,
      comentarios: u._count.comentarios,
      seguidores: u._count.seguidores,
    },
    posicaoCampo,
    totalVinculados,
    ultimaAtividade: ultima?.when?.toISOString() ?? null,
    ultimaAtividadeNome: ultima?.label ?? null,
  });
}

async function ultimaAtividadeDeAtleta(usuarioId: string) {
  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  if (!atleta) return null;

  const ultimaSub = await prisma.submissaoDesafio.findFirst({
    where: { atletaId: atleta.id },
    include: { desafio: { select: { titulo: true } } },
    orderBy: { createdAt: "desc" },
  });

  const ultimaTreino = await prisma.submissaoTreino.findFirst({
    where: { atletaId: atleta.id },
    include: {
      treinoAgendado: {
        include: { treinoProgramado: { select: { nome: true } } },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  const candidatos: { when: Date; label: string }[] = [];
  if (ultimaSub) {
    candidatos.push({
      when: ultimaSub.createdAt,
      label: `Desafio: ${ultimaSub.desafio?.titulo ?? "Desafio"}`,
    });
  }
  if (ultimaTreino) {
    const when = (ultimaTreino.atualizadoEm ?? ultimaTreino.criadoEm) as Date;
    const nomeTreino =
      ultimaTreino.treinoTituloSnapshot ||
      ultimaTreino.treinoAgendado?.titulo ||
      ultimaTreino.treinoAgendado?.treinoProgramado?.nome ||
      "Treino";
    candidatos.push({ when, label: `Treino: ${nomeTreino}` });
  }

  if (!candidatos.length) return null;
  candidatos.sort((a, b) => +b.when - +a.when);
  return candidatos[0];
}

function legivelPosicao(cod?: string | null): string | null {
  if (!cod) return null;
  const key = cod.toUpperCase();
  const map: Record<string, string> = {
    GOL: "Goleiro",
    LD: "Lateral Direito",
    ZD: "Zagueiro Direito",
    ZE: "Zagueiro Esquerdo",
    LE: "Lateral Esquerdo",
    VOL1: "Volante",
    VOL2: "Volante",
    MEI: "Meia",
    PD: "Ponta Direita",
    CA: "Centroavante",
    PE: "Ponta Esquerda",
  };
  return map[key] ?? cod;
}

async function posicaoDoAtletaPorUsuarioId(usuarioId: string) {
  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId },
    select: { id: true, posicao: true },
  });
  if (!atleta) return null;
  if (atleta.posicao) return legivelPosicao(atleta.posicao);
  const ultNoElenco = await prisma.atletaElenco.findFirst({
    where: { atletaId: atleta.id },
    orderBy: { updatedAt: "desc" },
    select: { posicao: true },
  });
  return ultNoElenco ? legivelPosicao(ultNoElenco.posicao) : null;
}

async function totalVinculadosDoUsuario(u: { id: string; tipo: string }) {
  if (u.tipo === "Professor") {
    const prof = await prisma.professor.findFirst({
      where: { usuarioId: u.id },
      select: { id: true },
    });
    if (!prof) return 0;
    return prisma.relacaoTreinamento.count({
      where: { professorId: prof.id, atletaId: { not: null } },
    });
  }
  if (u.tipo === "Clube") {
    const clube = await prisma.clube.findFirst({
      where: { usuarioId: u.id },
      select: { id: true },
    });
    if (!clube) return 0;
    return prisma.atleta.count({ where: { clubeId: clube.id } });
  }
  if (u.tipo === "Escolinha") {
    const esc = await prisma.escolinha.findFirst({
      where: { usuarioId: u.id },
      select: { id: true },
    });
    if (!esc) return 0;
    return prisma.atleta.count({ where: { escolinhaId: esc.id } });
  }
  return 0;
}

export async function patchAdminUser(req: Request, res: Response) {
  const { id } = req.params;
  const { verificado } = req.body as { verificado?: boolean };

  const data: any = {};
  if (typeof verificado === "boolean") data.verified = verificado;
  if (!Object.keys(data).length) {
    return res
      .status(400)
      .json({ message: "Nenhum campo válido para atualizar." });
  }
  const u = await prisma.usuario.update({ where: { id }, data });
  res.json(u);
}

export async function banUser(_req: Request, res: Response) {
  res.status(501).json({ message: "Banimento não implementado." });
}
export async function unbanUser(_req: Request, res: Response) {
  res.status(501).json({ message: "Desbanir não implementado." });
}
export async function removeUserContent(req: Request, res: Response) {
  const { id } = req.params;
  const { escopo } = req.body as {
    escopo: "posts" | "comentarios" | "todos";
  };
  if (escopo === "posts" || escopo === "todos")
    await prisma.postagem.deleteMany({ where: { usuarioId: id } });
  if (escopo === "comentarios" || escopo === "todos")
    await prisma.comentario.deleteMany({ where: { usuarioId: id } });
  res.json({ ok: true });
}