-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "clubeId" TEXT,
ADD COLUMN     "escolinhaId" TEXT,
ADD COLUMN     "organizacaoId" TEXT;

-- CreateIndex
CREATE INDEX "Professor_escolinhaId_idx" ON "Professor"("escolinhaId");

-- CreateIndex
CREATE INDEX "Professor_clubeId_idx" ON "Professor"("clubeId");

-- CreateIndex
CREATE INDEX "Professor_organizacaoId_idx" ON "Professor"("organizacaoId");

-- AddForeignKey
ALTER TABLE "Professor" ADD CONSTRAINT "Professor_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Professor" ADD CONSTRAINT "Professor_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;
