-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConquistaOwnerTipo" ADD VALUE 'Learning';
ALTER TYPE "ConquistaOwnerTipo" ADD VALUE 'Marca';
ALTER TYPE "ConquistaOwnerTipo" ADD VALUE 'Federacao';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoUsuario" ADD VALUE 'Federacao';
ALTER TYPE "TipoUsuario" ADD VALUE 'Marca';

-- AlterTable
ALTER TABLE "ConquistaVinculo" ADD COLUMN     "federacaoId" TEXT,
ADD COLUMN     "learningProfileId" TEXT,
ADD COLUMN     "marcaId" TEXT;

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "creatorTipo" TEXT,
ADD COLUMN     "creatorUsuarioId" TEXT,
ADD COLUMN     "federacaoId" TEXT,
ADD COLUMN     "marcaId" TEXT;

-- AlterTable
ALTER TABLE "Metodologia" ADD COLUMN     "federacaoId" TEXT,
ADD COLUMN     "marcaId" TEXT;

-- AlterTable
ALTER TABLE "MetodologiaAvulsa" ADD COLUMN     "federacaoId" TEXT,
ADD COLUMN     "marcaId" TEXT;

-- AlterTable
ALTER TABLE "Olheiro" ADD COLUMN     "dataNascimento" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LearningProfile" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "bio" TEXT,
    "objetivo" TEXT,
    "interesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Federacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT,
    "telefone1" TEXT,
    "telefone2" TEXT,
    "siteOficial" TEXT,
    "sede" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "cep" TEXT,
    "logo" TEXT,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Federacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT,
    "telefone1" TEXT,
    "telefone2" TEXT,
    "siteOficial" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "cep" TEXT,
    "sede" TEXT,
    "logo" TEXT,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningProfile_usuarioId_key" ON "LearningProfile"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Federacao_usuarioId_key" ON "Federacao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_usuarioId_key" ON "Marca"("usuarioId");

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_federacaoId_fkey" FOREIGN KEY ("federacaoId") REFERENCES "Federacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_federacaoId_fkey" FOREIGN KEY ("federacaoId") REFERENCES "Federacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_federacaoId_fkey" FOREIGN KEY ("federacaoId") REFERENCES "Federacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "LearningProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_federacaoId_fkey" FOREIGN KEY ("federacaoId") REFERENCES "Federacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProfile" ADD CONSTRAINT "LearningProfile_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Federacao" ADD CONSTRAINT "Federacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
