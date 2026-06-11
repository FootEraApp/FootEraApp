import { Request, Response } from "express";
import { prisma } from "../prisma.js";

function normalizaTipo(raw: string) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const map: Record<string, string> = {
    atleta: "Atleta",
    learning: "Learning",
    escola: "Escolinha",
    escolinha: "Escolinha",
    clube: "Clube",
    marca: "Marca",
    federacao: "Federacao",
    federação: "Federacao",
    professor: "Professor",
    admin: "Admin",
    administrador: "Admin",
    olheiro: "Olheiro",
    scout: "Olheiro",
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
    u.marca?.logo ??
    u.federacao?.logo ??
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
        orderBy: [
          { nome: "asc" },
          { nomeDeUsuario: "asc" },
          { email: "asc" },
          { id: "asc" },
        ],
        include: {
          atleta: { select: { foto: true } },
          professor: { select: { fotoUrl: true } },
          clube: { select: { logo: true } },
          escolinha: { select: { logo: true } },
          marca: { select: { logo: true } },
          federacao: { select: { logo: true } },
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
        status: (u as any).status ?? "ATIVO",
        blockedAt: (u as any).blockedAt ?? null,
        blockedReason: (u as any).blockedReason ?? null,
        deletedAt: (u as any).deletedAt ?? null,
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
      marca: { select: { id: true, logo: true } },
      federacao: { select: { id: true, logo: true } },
      olheiro: { select: { id: true, fotoUrl: true } },
      learningProfile: { select: { id: true } },
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
    status: (u as any).status ?? "ATIVO",
    blockedAt: (u as any).blockedAt ?? null,
    blockedReason: (u as any).blockedReason ?? null,
    deletedAt: (u as any).deletedAt ?? null,
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
  if (u.tipo === "Marca") return 0;
  if (u.tipo === "Federacao") return 0;
  if (u.tipo === "Learning") return 0;
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

export async function hardDeleteUsuario(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const requesterId = (req as any).user?.id;
    if (requesterId && requesterId === id) {
      return res.status(400).json({ message: "Você não pode excluir sua própria conta." });
    }

    const exists = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ message: "Usuário não encontrado." });

    await prisma.$transaction(async (tx) => {
      await tx.solicitacaoTreino.deleteMany({
        where: { OR: [{ remetenteId: id }, { destinatarioId: id }] },
      });

      if ((tx as any).amigo) {
        await (tx as any).amigo.deleteMany({
          where: { OR: [{ usuarioId: id }, { amigoId: id }] },
        });
      }

      if ((tx as any).notificacao) {
        await (tx as any).notificacao.deleteMany({
          where: { OR: [{ usuarioId: id }, { actorId: id }] },
        });
      }

      if ((tx as any).comentario) await (tx as any).comentario.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).curtida) await (tx as any).curtida.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).compartilhamento) await (tx as any).compartilhamento.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).postagem) await (tx as any).postagem.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).favoritoUsuario) await (tx as any).favoritoUsuario.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).atleta) await (tx as any).atleta.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).professor) await (tx as any).professor.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).clube) await (tx as any).clube.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).escolinha) await (tx as any).escolinha.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).olheiro) await (tx as any).olheiro.deleteMany({ where: { usuarioId: id } });
      if ((tx as any).administrador) await (tx as any).administrador.deleteMany({ where: { usuarioId: id } });

      await tx.usuario.delete({ where: { id } });
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[Admin] hardDeleteUsuario erro:", e);
    return res.status(500).json({
      message: "Falha ao excluir permanentemente. Veja o log do servidor para a tabela que bloqueou (FK).",
      detail: e?.message,
    });
  }
}