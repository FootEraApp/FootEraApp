import { PrismaClient, StorageClass, Midia } from "@prisma/client";

const prisma = new PrismaClient();
const CUTOFF_DAYS = 150;

async function moveToColdStorage(_m: Midia): Promise<void> {
  return;
}

export async function runColdStorageJob() {
  const limite = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000);

  const antigas = await prisma.midia.findMany({
    where: {
      storageClass: StorageClass.HOT,
      OR: [
        { lastAccessAt: { lt: limite } },
        { lastAccessAt: null, criadoEm: { lt: limite } },
      ],
    },
  });

  for (const m of antigas) {
    await moveToColdStorage(m);
    await prisma.midia.update({
      where: { id: m.id },
      data: { storageClass: StorageClass.COLD },
    });
  }
}