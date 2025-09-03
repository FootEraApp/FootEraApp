import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function listAdminUsers(req: Request, res: Response) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const q = String(req.query.q || "").trim();

  const rawTipo = String(req.query.tipo || "").toLowerCase();
  const map: Record<string, string> = {
    atleta: "Atleta",
    escolinha: "Escolinha",
    escola: "Escolinha",
    clube: "Clube",
    professor: "Professor",
    admin: "Admin",
  };
  const tipoNormalizado = map[rawTipo] || "";

  const where: any = {};
  if (q) {
    where.OR = [
      { nome: { contains: q, mode: "insensitive" } },
      { nomeDeUsuario: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (tipoNormalizado) where.tipo = tipoNormalizado;

  const [rows, total] = await prisma.$transaction([
    prisma.usuario.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { dataCriacao: "desc" },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        email: true,
        tipo: true,
        foto: true,
        dataCriacao: true,
        verified: true,
      },
    }),
    prisma.usuario.count({ where }),
  ]);

  const items = await Promise.all(
    rows.map(async (u) => {
      const ultima =
        u.tipo === "Atleta" ? await ultimaAtividadeDeAtleta(u.id) : null;

      return {
        id: u.id,
        nome: u.nome,
        nomeDeUsuario: u.nomeDeUsuario,
        email: u.email ?? null,
        tipo: u.tipo,
        foto: u.foto ?? null,
        criadoEm: u.dataCriacao,
        verificado: u.verified,
        ultimaAtividade: ultima?.when?.toISOString() ?? null,
        ultimaAtividadeNome: ultima?.label ?? null,
      };
    })
  );

  res.json({ items, total });
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

  if (candidatos.length === 0) return null;
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

export async function getAdminUserDetail(req: Request, res: Response) {
  const { id } = req.params;

  const u = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      nomeDeUsuario: true,
      email: true,
      tipo: true,
      foto: true,
      dataCriacao: true,
      verified: true,
      _count: {
        select: { postagens: true, comentarios: true, seguidores: true },
      },
    },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado" });

  const [ultima, posicaoCampo, totalVinculados] = await Promise.all([
    u.tipo === "Atleta" ? ultimaAtividadeDeAtleta(id) : Promise.resolve(null),
    u.tipo === "Atleta" ? posicaoDoAtletaPorUsuarioId(id) : Promise.resolve(null),
    totalVinculadosDoUsuario(u),
  ]);

  res.json({
    id: u.id,
    nome: u.nome,
    nomeDeUsuario: u.nomeDeUsuario,
    email: u.email ?? null,
    tipo: u.tipo,
    foto: u.foto ?? null,
    criadoEm: u.dataCriacao,
    verificado: u.verified,
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

export async function patchAdminUser(req: Request, res: Response) {
  const { id } = req.params;
  const { verificado, destaque } = req.body as {
    verificado?: boolean;
    destaque?: boolean;
  };

  if (typeof destaque === "boolean") {
    return res
      .status(501)
      .json({ message: "Campo 'destaque' não existe no schema Usuario." });
  }

  const data: any = {};
  if (typeof verificado === "boolean") data.verified = verificado;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nenhum campo válido para atualizar." });
  }

  const u = await prisma.usuario.update({ where: { id }, data });
  res.json(u);
}

export async function banUser(_req: Request, res: Response) {
  return res
    .status(501)
    .json({ message: "Banimento não implementado (campo 'status' ausente)." });
}

export async function unbanUser(_req: Request, res: Response) {
  return res
    .status(501)
    .json({ message: "Desbanir não implementado (campo 'status' ausente)." });
}

export async function removeUserContent(req: Request, res: Response) {
  const { id } = req.params;
  const { escopo } = req.body as { escopo: "posts" | "comentarios" | "todos" };

  if (escopo === "posts" || escopo === "todos") {
    await prisma.postagem.deleteMany({ where: { usuarioId: id } });
  }
  if (escopo === "comentarios" || escopo === "todos") {
    await prisma.comentario.deleteMany({ where: { usuarioId: id } });
  }
  res.json({ ok: true });
}