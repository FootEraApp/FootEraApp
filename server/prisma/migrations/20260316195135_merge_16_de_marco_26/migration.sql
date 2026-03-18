/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,plano]` on the table `Assinatura` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleSub]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'LOCAL_GOOGLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'INDICACAO_OLHEIRO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'INDICACAO_RESPONDIDA';

-- DropIndex
DROP INDEX "public"."Assinatura_usuarioId_key";

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "googleLinkedAt" TIMESTAMP(3),
ADD COLUMN     "googlePicture" TEXT,
ADD COLUMN     "googleSub" TEXT;

-- CreateTable
CREATE TABLE "GooglePreCadastro" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "nome" TEXT,
    "foto" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GooglePreCadastro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GooglePreCadastro_token_key" ON "GooglePreCadastro"("token");

-- CreateIndex
CREATE INDEX "GooglePreCadastro_googleSub_idx" ON "GooglePreCadastro"("googleSub");

-- CreateIndex
CREATE INDEX "GooglePreCadastro_email_idx" ON "GooglePreCadastro"("email");

-- CreateIndex
CREATE INDEX "GooglePreCadastro_expiresAt_idx" ON "GooglePreCadastro"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_usuarioId_plano_key" ON "Assinatura"("usuarioId", "plano");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleSub_key" ON "Usuario"("googleSub");
