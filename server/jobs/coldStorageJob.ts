// server/jobs/coldStorageJob.ts
import { PrismaClient, StorageClass, Midia } from "@prisma/client";
import { s3Service } from "../services/s3Service.js"; // se for reaproveitar, ou criar helper

const prisma = new PrismaClient();
const CUTOFF_DAYS = 150;

// aqui você pode de fato mudar a storageClass no S3,
// ou confiar nas regras de lifecycle do bucket e só atualizar o campo do banco.
async function moveToColdStorage(_m: Midia): Promise<void> {
  // se usar lifecycle, pode deixar vazio mesmo
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