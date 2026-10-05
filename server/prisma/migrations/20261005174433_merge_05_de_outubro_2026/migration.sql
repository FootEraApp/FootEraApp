/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,plano,contextoKey]` on the table `Assinatura` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Assinatura_usuarioId_plano_key";

-- AlterTable
ALTER TABLE "Assinatura" ADD COLUMN     "contextoKey" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN     "contextoKind" TEXT,
ADD COLUMN     "contextoLegacyOrganizationId" TEXT,
ADD COLUMN     "contextoOrganizacaoId" TEXT,
ADD COLUMN     "contextoPerfilId" TEXT,
ADD COLUMN     "contextoTipo" TEXT;

-- CreateIndex
CREATE INDEX "Assinatura_contextoKind_idx" ON "Assinatura"("contextoKind");

-- CreateIndex
CREATE INDEX "Assinatura_contextoTipo_idx" ON "Assinatura"("contextoTipo");

-- CreateIndex
CREATE INDEX "Assinatura_contextoPerfilId_idx" ON "Assinatura"("contextoPerfilId");

-- CreateIndex
CREATE INDEX "Assinatura_contextoOrganizacaoId_idx" ON "Assinatura"("contextoOrganizacaoId");

-- CreateIndex
CREATE INDEX "Assinatura_contextoLegacyOrganizationId_idx" ON "Assinatura"("contextoLegacyOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_usuarioId_plano_contextoKey_key" ON "Assinatura"("usuarioId", "plano", "contextoKey");
