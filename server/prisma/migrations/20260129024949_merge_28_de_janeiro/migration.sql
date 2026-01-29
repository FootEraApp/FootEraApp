/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,submissaoTreinoId]` on the table `Curtida` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[olheiroId,atletaId,clubeId]` on the table `Indicacao` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[olheiroId,atletaId,escolinhaId]` on the table `Indicacao` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Indicacao_olheiroId_status_idx";

-- DropIndex
DROP INDEX "public"."Professor_codigo_key";

-- DropIndex
DROP INDEX "public"."TreinoProgramado_codigo_key";

-- AlterTable
ALTER TABLE "Curtida" ADD COLUMN     "submissaoTreinoId" TEXT;

-- AlterTable
ALTER TABLE "Indicacao" ADD COLUMN     "escolinhaId" TEXT,
ALTER COLUMN "clubeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "dataNascimento" TIMESTAMP(3),
ALTER COLUMN "codigo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TreinoProgramado" ALTER COLUMN "codigo" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Curtida_submissaoTreinoId_idx" ON "Curtida"("submissaoTreinoId");

-- CreateIndex
CREATE UNIQUE INDEX "Curtida_usuarioId_submissaoTreinoId_key" ON "Curtida"("usuarioId", "submissaoTreinoId");

-- CreateIndex
CREATE INDEX "Indicacao_olheiroId_idx" ON "Indicacao"("olheiroId");

-- CreateIndex
CREATE INDEX "Indicacao_escolinhaId_idx" ON "Indicacao"("escolinhaId");

-- CreateIndex
CREATE UNIQUE INDEX "Indicacao_olheiroId_atletaId_clubeId_key" ON "Indicacao"("olheiroId", "atletaId", "clubeId");

-- CreateIndex
CREATE UNIQUE INDEX "Indicacao_olheiroId_atletaId_escolinhaId_key" ON "Indicacao"("olheiroId", "atletaId", "escolinhaId");

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_submissaoTreinoId_fkey" FOREIGN KEY ("submissaoTreinoId") REFERENCES "SubmissaoTreino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
