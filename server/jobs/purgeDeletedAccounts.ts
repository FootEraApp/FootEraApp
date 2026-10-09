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

  let removidos = 0;

  for (const u of users) {
    try {
      await prisma.usuario.delete({
        where: {
          id:
            u.id,
        },
      });

      removidos++;
    } catch (error) {
      console.error(
        `[purgeDeletedAccounts] Não foi possível remover usuário ${u.id}:`,
        error
      );
    }
  }

  return removidos;
}