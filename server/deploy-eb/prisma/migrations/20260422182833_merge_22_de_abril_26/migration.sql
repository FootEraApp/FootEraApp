/*
  Warnings:

  - A unique constraint covering the columns `[metodologiaAvulsaId,usuarioId]` on the table `AvaliacaoMetodologia` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AvaliacaoMetodologia" ADD COLUMN     "metodologiaAvulsaId" TEXT,
ALTER COLUMN "metodologiaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MetodologiaAvulsa" ADD COLUMN     "mediaAvaliacao" DOUBLE PRECISION,
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TreinoAgendado" ALTER COLUMN "atletaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MetodologiaItemSubmissao" (
    "id" TEXT NOT NULL,
    "metodologiaId" TEXT,
    "metodologiaAvulsaId" TEXT,
    "estruturaId" TEXT,
    "estruturaAvulsaId" TEXT,
    "itemId" TEXT,
    "itemAvulsaId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "tipoItem" TEXT NOT NULL,
    "observacao" TEXT,
    "arquivoUrl" TEXT,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ENVIADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodologiaItemSubmissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetodologiaItemSubmissao_metodologiaId_estruturaId_itemId_u_idx" ON "MetodologiaItemSubmissao"("metodologiaId", "estruturaId", "itemId", "usuarioId");

-- CreateIndex
CREATE INDEX "MetodologiaItemSubmissao_metodologiaAvulsaId_estruturaAvuls_idx" ON "MetodologiaItemSubmissao"("metodologiaAvulsaId", "estruturaAvulsaId", "itemAvulsaId", "usuarioId");

-- CreateIndex
CREATE INDEX "AvaliacaoMetodologia_metodologiaAvulsaId_idx" ON "AvaliacaoMetodologia"("metodologiaAvulsaId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoMetodologia_metodologiaAvulsaId_usuarioId_key" ON "AvaliacaoMetodologia"("metodologiaAvulsaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "MetodologiaItemSubmissao" ADD CONSTRAINT "MetodologiaItemSubmissao_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItemSubmissao" ADD CONSTRAINT "MetodologiaItemSubmissao_metodologiaAvulsaId_fkey" FOREIGN KEY ("metodologiaAvulsaId") REFERENCES "MetodologiaAvulsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItemSubmissao" ADD CONSTRAINT "MetodologiaItemSubmissao_estruturaId_fkey" FOREIGN KEY ("estruturaId") REFERENCES "MetodologiaEstrutura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItemSubmissao" ADD CONSTRAINT "MetodologiaItemSubmissao_estruturaAvulsaId_fkey" FOREIGN KEY ("estruturaAvulsaId") REFERENCES "MetodologiaAvulsaEstrutura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItemSubmissao" ADD CONSTRAINT "MetodologiaItemSubmissao_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MetodologiaEstruturaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItemSubmissao" ADD CONSTRAINT "MetodologiaItemSubmissao_itemAvulsaId_fkey" FOREIGN KEY ("itemAvulsaId") REFERENCES "MetodologiaAvulsaEstruturaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItemSubmissao" ADD CONSTRAINT "MetodologiaItemSubmissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoMetodologia" ADD CONSTRAINT "AvaliacaoMetodologia_metodologiaAvulsaId_fkey" FOREIGN KEY ("metodologiaAvulsaId") REFERENCES "MetodologiaAvulsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
