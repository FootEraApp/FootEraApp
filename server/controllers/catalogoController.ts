import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();
 export async function catalogoClubes(req: Request, res: Response) {
  const itens = await prisma.clube.findMany({
    select: {
      id: true,
      usuario: { select: { nome: true } },
    },
    orderBy: { usuario: { nome: "asc" } },
  });

  res.json(
    itens.map((c) => ({
      id: c.id,
      nome: c.usuario.nome,
    }))
  );
}

export async function catalogoEscolinhas(req: Request, res: Response) {
  const itens = await prisma.escolinha.findMany({
    select: {
      id: true,
      nome: true,                    
      usuario: { select: { nome: true } },
    },
    orderBy: { usuario: { nome: "asc" } },
  });

  res.json(
    itens.map((e) => ({
      id: e.id,
      nome: e.usuario?.nome ?? e.nome,
    }))
  );
}

export async function catalogoProfessores(req: Request, res: Response) {
  const itens = await prisma.professor.findMany({
    select: {
      id: true,
      nome: true,                       
      usuario: { select: { nome: true } },
    },
    orderBy: { usuario: { nome: "asc" } },
  });

  res.json(
    itens.map((p) => ({
      id: p.id,
      nome: p.usuario?.nome ?? p.nome,
    }))
  );
}