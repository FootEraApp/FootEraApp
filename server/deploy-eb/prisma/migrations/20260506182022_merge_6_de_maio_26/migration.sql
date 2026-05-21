-- CreateEnum
CREATE TYPE "CreatorTipo" AS ENUM ('PESSOA_FISICA', 'INSTITUCIONAL');

-- CreateEnum
CREATE TYPE "CreatorVendaStatus" AS ENUM ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'REEMBOLSADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoUsuario" ADD VALUE 'Escola';
ALTER TYPE "TipoUsuario" ADD VALUE 'Learning';

-- AlterTable
ALTER TABLE "Escolinha" ADD COLUMN     "categorias" "Categoria"[],
ADD COLUMN     "descricao" TEXT;

-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "descricao" TEXT;

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nomePublico" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "nicho" TEXT,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "siteUrl" TEXT,
    "instagramUrl" TEXT,
    "youtubeUrl" TEXT,
    "tipo" "CreatorTipo" NOT NULL DEFAULT 'PESSOA_FISICA',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "instituicaoOficial" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "comissaoFootera" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorVenda" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "compradorId" TEXT,
    "metodologiaId" TEXT,
    "metodologiaAvulsaId" TEXT,
    "valorBruto" DECIMAL(10,2) NOT NULL,
    "percentualFootera" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "valorFootera" DECIMAL(10,2) NOT NULL,
    "valorCreator" DECIMAL(10,2) NOT NULL,
    "status" "CreatorVendaStatus" NOT NULL DEFAULT 'PENDENTE',
    "provider" TEXT,
    "providerRef" TEXT,
    "meta" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagoEm" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorUsoLearning" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "metodologiaId" TEXT,
    "itemId" TEXT,
    "pontosUso" DECIMAL(65,30) NOT NULL DEFAULT 1.0,
    "tipoUso" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorUsoLearning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_usuarioId_key" ON "Creator"("usuarioId");

-- CreateIndex
CREATE INDEX "Creator_usuarioId_idx" ON "Creator"("usuarioId");

-- CreateIndex
CREATE INDEX "Creator_ativo_idx" ON "Creator"("ativo");

-- CreateIndex
CREATE INDEX "Creator_tipo_idx" ON "Creator"("tipo");

-- CreateIndex
CREATE INDEX "CreatorVenda_creatorId_idx" ON "CreatorVenda"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorVenda_compradorId_idx" ON "CreatorVenda"("compradorId");

-- CreateIndex
CREATE INDEX "CreatorVenda_metodologiaId_idx" ON "CreatorVenda"("metodologiaId");

-- CreateIndex
CREATE INDEX "CreatorVenda_metodologiaAvulsaId_idx" ON "CreatorVenda"("metodologiaAvulsaId");

-- CreateIndex
CREATE INDEX "CreatorVenda_status_idx" ON "CreatorVenda"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorVenda_provider_providerRef_key" ON "CreatorVenda"("provider", "providerRef");

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVenda" ADD CONSTRAINT "CreatorVenda_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVenda" ADD CONSTRAINT "CreatorVenda_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVenda" ADD CONSTRAINT "CreatorVenda_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVenda" ADD CONSTRAINT "CreatorVenda_metodologiaAvulsaId_fkey" FOREIGN KEY ("metodologiaAvulsaId") REFERENCES "MetodologiaAvulsa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
