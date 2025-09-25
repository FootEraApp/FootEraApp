import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function resolveAtletaId(anyId: string) {
  const a = await prisma.atleta.findFirst({
    where: { OR: [{ id: anyId }, { usuarioId: anyId }, { usuario: { nomeDeUsuario: anyId } }] },
    select: { id: true },
  });
  return a?.id ?? null;
}

export async function resolveClubeId(anyId: string) {
  const c = await prisma.clube.findFirst({
    where: { OR: [{ id: anyId }, { usuarioId: anyId }, { usuario: { nomeDeUsuario: anyId } }] },
    select: { id: true },
  });
  return c?.id ?? null;
}

export async function resolveEscolinhaId(anyId: string) {
  const e = await prisma.escolinha.findFirst({
    where: { OR: [{ id: anyId }, { usuarioId: anyId }, { usuario: { nomeDeUsuario: anyId } }] },
    select: { id: true },
  });
  return e?.id ?? null;
}