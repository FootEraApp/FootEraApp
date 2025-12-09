// server/controllers/catalogoController.ts
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export async function catalogoClubes(req: Request, res: Response) {
  const itens = await prisma.usuario.findMany({
    where: { tipo: "Clube" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  res.json(itens);
}

export async function catalogoEscolinhas(req: Request, res: Response) {
  const itens = await prisma.usuario.findMany({
    where: { tipo: "Escolinha" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  res.json(itens);
}

export async function catalogoProfessores(req: Request, res: Response) {
  const itens = await prisma.usuario.findMany({
    where: { tipo: "Professor" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  res.json(itens);
}