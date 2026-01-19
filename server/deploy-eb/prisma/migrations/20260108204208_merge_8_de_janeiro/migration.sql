/*
  Warnings:

  - You are about to drop the column `professorId` on the `Atleta` table. All the data in the column will be lost.
  - You are about to drop the column `feitosAlunos` on the `EstatisticaTreino` table. All the data in the column will be lost.
  - You are about to drop the column `ultimoFeitoEm` on the `EstatisticaTreino` table. All the data in the column will be lost.
  - You are about to drop the column `ultimoUsoEm` on the `EstatisticaTreino` table. All the data in the column will be lost.
  - You are about to drop the column `usosProfessores` on the `EstatisticaTreino` table. All the data in the column will be lost.
  - Changed the type of `periodicidade` on the `Assinatura` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `ativo` on table `RelacaoTreinamento` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AssinaturaStatus" AS ENUM ('TRIAL', 'ATIVA', 'BLOQUEADA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "AvaliacaoAutorTipo" ADD VALUE 'Atleta';

-- DropForeignKey
ALTER TABLE "public"."Atleta" DROP CONSTRAINT "Atleta_professorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TreinoRealizado" DROP CONSTRAINT "TreinoRealizado_treinoId_fkey";

-- DropIndex
DROP INDEX "public"."Atleta_perfilTipoTreino_idx";

-- DropIndex
DROP INDEX "public"."Atleta_professorId_idx";

-- AlterTable
ALTER TABLE "Assinatura" ADD COLUMN     "bloqueadoEm" TIMESTAMP(3),
ADD COLUMN     "metodoPreferido" "MetodoPagamento",
ADD COLUMN     "metodoPreferidoDefinidoEm" TIMESTAMP(3),
ADD COLUMN     "status" "AssinaturaStatus" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartsAt" TIMESTAMP(3);

-- ✅ MIGRAÇÃO SEGURA DA periodicidade (sem dropar e recriar required)
ALTER TABLE "Assinatura"
ADD COLUMN "periodicidade_nova" "Periodicidade";

-- tenta converter o valor antigo para o enum novo (via texto)
UPDATE "Assinatura"
SET "periodicidade_nova" =
  CASE LOWER("periodicidade"::text)
    WHEN 'mensal' THEN 'Mensal'::"Periodicidade"
    WHEN 'anual'  THEN 'Anual'::"Periodicidade"
    ELSE NULL
  END
WHERE "periodicidade" IS NOT NULL;

-- fallback para não ficar NULL
UPDATE "Assinatura"
SET "periodicidade_nova" = 'Mensal'
WHERE "periodicidade_nova" IS NULL;

ALTER TABLE "Assinatura"
ALTER COLUMN "periodicidade_nova" SET NOT NULL;

ALTER TABLE "Assinatura" DROP COLUMN "periodicidade";
ALTER TABLE "Assinatura" RENAME COLUMN "periodicidade_nova" TO "periodicidade";

-- AlterTable
ALTER TABLE "Atleta" DROP COLUMN "professorId";

-- AlterTable
ALTER TABLE "AtletaObservado" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "EstatisticaTreino" DROP COLUMN "feitosAlunos",
DROP COLUMN "ultimoFeitoEm",
DROP COLUMN "ultimoUsoEm",
DROP COLUMN "usosProfessores",
ADD COLUMN     "realizacoes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoRealizadoEm" TIMESTAMP(3);


UPDATE "RelacaoTreinamento"
SET "ativo" = true
WHERE "ativo" IS NULL;

-- AlterTable
ALTER TABLE "RelacaoTreinamento" ALTER COLUMN "ativo" SET NOT NULL,
ALTER COLUMN "ativo" SET DEFAULT true;

-- AlterTable
ALTER TABLE "TreinoRealizado" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Assinatura_status_idx" ON "Assinatura"("status");

-- CreateIndex
CREATE INDEX "Assinatura_trialEndsAt_idx" ON "Assinatura"("trialEndsAt");

-- CreateIndex
CREATE INDEX "RelacaoTreinamento_atletaId_idx" ON "RelacaoTreinamento"("atletaId");

-- CreateIndex
CREATE INDEX "RelacaoTreinamento_professorId_idx" ON "RelacaoTreinamento"("professorId");

-- CreateIndex
CREATE INDEX "RelacaoTreinamento_clubeId_idx" ON "RelacaoTreinamento"("clubeId");

-- CreateIndex
CREATE INDEX "RelacaoTreinamento_escolinhaId_idx" ON "RelacaoTreinamento"("escolinhaId");

-- CreateIndex
CREATE INDEX "RelacaoTreinamento_ativo_idx" ON "RelacaoTreinamento"("ativo");

-- CreateIndex
CREATE INDEX "TreinoRealizado_treinoId_idx" ON "TreinoRealizado"("treinoId");

-- CreateIndex
CREATE INDEX "TreinoRealizado_usuarioId_idx" ON "TreinoRealizado"("usuarioId");

-- CreateIndex
CREATE INDEX "TreinoRealizado_createdAt_idx" ON "TreinoRealizado"("createdAt");

-- AddForeignKey
ALTER TABLE "TreinoRealizado" ADD CONSTRAINT "TreinoRealizado_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
