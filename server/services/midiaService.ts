import { PrismaClient, Midia } from "@prisma/client";

const prisma = new PrismaClient();

export function getPublicUrl(m: Midia) {
  return m.processedUrl ?? m.url;
}

export async function markMidiaAccessed(midiaId: string) {
  await prisma.midia.update({
    where: { id: midiaId },
    data: { lastAccessAt: new Date() },
  });
}