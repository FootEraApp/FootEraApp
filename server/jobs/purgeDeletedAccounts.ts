import { prisma } from "../prisma.js";

export async function purgeDeletedAccounts() {
  const now = new Date();

  const users = await prisma.usuario.findMany({
    where: {
      deletedAt: { not: null },
      deleteScheduledAt: { lte: now },
    },
    select: { id: true },
    take: 200, 
  });

  for (const u of users) {
    await prisma.usuario.delete({ where: { id: u.id } });
  }

  return users.length;
}