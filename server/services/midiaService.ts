// server/services/midiaService.ts
import { PrismaClient, Midia } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * URL pública a ser usada no front:
 * - se já temos versão processada (720p), usa ela
 * - se não, cai no original
 */
export function getPublicUrl(m: Midia) {
  return m.processedUrl ?? m.url;
}

/**
 * Atualiza o lastAccessAt sempre que alguém consome essa mídia.
 */
export async function markMidiaAccessed(midiaId: string) {
  await prisma.midia.update({
    where: { id: midiaId },
    data: { lastAccessAt: new Date() },
  });
}