-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "escolinhaId" TEXT,
ALTER COLUMN "clubeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
