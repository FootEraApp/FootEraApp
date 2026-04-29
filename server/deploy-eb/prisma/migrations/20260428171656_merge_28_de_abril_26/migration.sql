/*
  Warnings:

  - A unique constraint covering the columns `[atletaId,origem,origemId]` on the table `VinculoFormacao` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "VinculoFormacao" ALTER COLUMN "documentos" SET DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "VinculoFormacao_atletaId_origem_origemId_key" ON "VinculoFormacao"("atletaId", "origem", "origemId");
