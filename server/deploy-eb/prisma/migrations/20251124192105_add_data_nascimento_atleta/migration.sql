/*
  Warnings:

  - A unique constraint covering the columns `[providerSubscriptionId]` on the table `Assinatura` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `atualizadoEm` to the `Midia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storageClass` to the `Midia` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StorageClass" AS ENUM ('HOT', 'COLD');

-- AlterTable
ALTER TABLE "Assinatura" ADD COLUMN     "providerSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Atleta" ADD COLUMN     "contatoOlheiroConsentidoEm" TIMESTAMP(3),
ADD COLUMN     "contatoOlheiroConsentidoPorId" TEXT,
ADD COLUMN     "contatoOlheiroPermitido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataNascimento" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Midia" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fps" INTEGER,
ADD COLUMN     "lastAccessAt" TIMESTAMP(3),
ADD COLUMN     "processedUrl" TEXT,
ADD COLUMN     "storageClass" "StorageClass" NOT NULL,
ADD COLUMN     "thumbUrl" TEXT;

-- CreateTable
CREATE TABLE "EventoPagamento" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "descricao" TEXT,
    "meta" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventoPagamento_providerEventId_key" ON "EventoPagamento"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_providerSubscriptionId_key" ON "Assinatura"("providerSubscriptionId");
