/*
  Warnings:

  - You are about to drop the column `comentario` on the `AvaliacaoTreino` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[submissaoTreinoId,autorTipo,autorId]` on the table `AvaliacaoTreino` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `autorId` to the `AvaliacaoTreino` table without a default value. This is not possible if the table is not empty.
  - Added the required column `autorTipo` to the `AvaliacaoTreino` table without a default value. This is not possible if the table is not empty.
  - Made the column `submissaoTreinoId` on table `AvaliacaoTreino` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AvaliacaoAutorTipo" AS ENUM ('Professor', 'Clube', 'Escolinha');

-- DropForeignKey
ALTER TABLE "public"."AvaliacaoTreino" DROP CONSTRAINT "AvaliacaoTreino_submissaoTreinoId_fkey";

-- DropIndex
DROP INDEX "public"."AvaliacaoTreino_atletaId_treinoAgendadoId_key";

-- AlterTable
ALTER TABLE "AvaliacaoTreino" DROP COLUMN "comentario",
ADD COLUMN     "autorId" TEXT NOT NULL,
ADD COLUMN     "autorTipo" "AvaliacaoAutorTipo" NOT NULL,
ADD COLUMN     "autorUsuarioId" TEXT,
ALTER COLUMN "submissaoTreinoId" SET NOT NULL;

-- CreateTable
CREATE TABLE "AvaliacaoTreinoComentario" (
    "id" TEXT NOT NULL,
    "avaliacaoTreinoId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoTreinoComentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvaliacaoTreinoComentario_avaliacaoTreinoId_idx" ON "AvaliacaoTreinoComentario"("avaliacaoTreinoId");

-- CreateIndex
CREATE INDEX "AvaliacaoTreinoComentario_createdAt_idx" ON "AvaliacaoTreinoComentario"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoTreinoComentario_avaliacaoTreinoId_ordem_key" ON "AvaliacaoTreinoComentario"("avaliacaoTreinoId", "ordem");

-- CreateIndex
CREATE INDEX "AvaliacaoTreino_submissaoTreinoId_idx" ON "AvaliacaoTreino"("submissaoTreinoId");

-- CreateIndex
CREATE INDEX "AvaliacaoTreino_autorTipo_autorId_idx" ON "AvaliacaoTreino"("autorTipo", "autorId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoTreino_submissaoTreinoId_autorTipo_autorId_key" ON "AvaliacaoTreino"("submissaoTreinoId", "autorTipo", "autorId");

-- AddForeignKey
ALTER TABLE "AvaliacaoTreino" ADD CONSTRAINT "AvaliacaoTreino_submissaoTreinoId_fkey" FOREIGN KEY ("submissaoTreinoId") REFERENCES "SubmissaoTreino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoTreino" ADD CONSTRAINT "AvaliacaoTreino_autorUsuarioId_fkey" FOREIGN KEY ("autorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoTreinoComentario" ADD CONSTRAINT "AvaliacaoTreinoComentario_avaliacaoTreinoId_fkey" FOREIGN KEY ("avaliacaoTreinoId") REFERENCES "AvaliacaoTreino"("id") ON DELETE CASCADE ON UPDATE CASCADE;
