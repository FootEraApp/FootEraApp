/*
  Warnings:

  - The `categoria` column on the `Turma` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Categoria" ADD VALUE 'Sub3';
ALTER TYPE "Categoria" ADD VALUE 'Sub5';
ALTER TYPE "Categoria" ADD VALUE 'Sub7';
ALTER TYPE "Categoria" ADD VALUE 'Sub16';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FaixaEtariaExercicio" ADD VALUE 'Sub3';
ALTER TYPE "FaixaEtariaExercicio" ADD VALUE 'Sub5';
ALTER TYPE "FaixaEtariaExercicio" ADD VALUE 'Sub7';
ALTER TYPE "FaixaEtariaExercicio" ADD VALUE 'Sub16';

-- DropIndex
DROP INDEX "public"."TreinoProgramado_nome_key";

-- AlterTable
ALTER TABLE "TreinoProgramado" ADD COLUMN     "sessaoTreinoId" TEXT;

-- AlterTable
ALTER TABLE "TreinoProgramadoExercicio" ADD COLUMN     "descricaoExecucao" TEXT;

-- AlterTable
ALTER TABLE "Turma" DROP COLUMN "categoria",
ADD COLUMN     "categoria" "Categoria"[] DEFAULT ARRAY[]::"Categoria"[];

-- CreateTable
CREATE TABLE "TreinoSessao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreinoSessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreinoSessao_nomeNormalizado_key" ON "TreinoSessao"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "TreinoProgramado_sessaoTreinoId_idx" ON "TreinoProgramado"("sessaoTreinoId");

-- AddForeignKey
ALTER TABLE "TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_sessaoTreinoId_fkey" FOREIGN KEY ("sessaoTreinoId") REFERENCES "TreinoSessao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
