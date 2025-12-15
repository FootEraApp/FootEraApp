/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,conteudo,repostOfId]` on the table `Postagem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Postagem_usuarioId_conteudo_key";

-- AlterTable
ALTER TABLE "Postagem" ADD COLUMN     "repostOfId" TEXT,
ADD COLUMN     "reposts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- CreateIndex
CREATE INDEX "Postagem_repostOfId_idx" ON "Postagem"("repostOfId");

-- CreateIndex
CREATE UNIQUE INDEX "Postagem_usuarioId_conteudo_repostOfId_key" ON "Postagem"("usuarioId", "conteudo", "repostOfId");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "Postagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
