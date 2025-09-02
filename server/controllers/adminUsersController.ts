// src/controllers/adminUsersController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function listAdminUsers(req: Request, res: Response) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const q = String(req.query.q || "").trim();

  // normaliza o tipo vindo do front
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
      orderBy: { dataCriacao: "desc" }, // campo existe no schema
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

  const items = rows.map((u) => ({
    id: u.id,
    nome: u.nome,
    nomeDeUsuario: u.nomeDeUsuario,
    email: u.email || null,
    tipo: u.tipo,
    foto: u.foto || null,
    criadoEm: u.dataCriacao,
    verificado: u.verified,
  }));

  res.json({ items, total });
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
        select: {
          postagens: true,
          comentarios: true,
          seguidores: true,
        },
      },
    },
  });

  if (!u) return res.status(404).json({ message: "Usuário não encontrado" });

  res.json({
    id: u.id,
    nome: u.nome,
    nomeDeUsuario: u.nomeDeUsuario,
    email: u.email || null,
    tipo: u.tipo,
    foto: u.foto || null,
    criadoEm: u.dataCriacao,
    verificado: u.verified,
    status: "ativo", 
    contagens: {
      posts: u._count.postagens,
      comentarios: u._count.comentarios,
      seguidores: u._count.seguidores,
    },
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
    return res
      .status(400)
      .json({ message: "Nenhum campo válido para atualizar." });
  }

  const u = await prisma.usuario.update({ where: { id }, data });
  res.json(u);
}

export async function banUser(req: Request, res: Response) {
  return res
    .status(501)
    .json({ message: "Banimento não implementado (campo 'status' ausente)." });
}

export async function unbanUser(req: Request, res: Response) {
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