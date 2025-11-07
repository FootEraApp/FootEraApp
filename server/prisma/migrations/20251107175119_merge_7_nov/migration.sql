/*
  Warnings:

  - You are about to drop the column `tempoSeg` on the `SubmissaoTreino` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[atletaId,treinoProgramadoId,dataTreino]` on the table `TreinoAgendado` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TreinoAgendadoStatus" AS ENUM ('AGENDADO', 'CONCLUIDO', 'FALTOU', 'CANCELADO');

-- DropIndex
DROP INDEX "public"."TreinoAgendado_titulo_key";

-- AlterTable
ALTER TABLE "SubmissaoTreino" DROP COLUMN "tempoSeg",
ADD COLUMN     "duracaoSegundos" INTEGER,
ADD COLUMN     "midiaTipo" "TipoMidia",
ADD COLUMN     "midiaUrl" TEXT;

-- AlterTable
ALTER TABLE "TreinoAgendado" ADD COLUMN     "dataOriginal" TIMESTAMP(3),
ADD COLUMN     "duracaoSegundos" INTEGER,
ADD COLUMN     "execucaoStatus" "TreinoStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "reagendadoDeId" TEXT,
ADD COLUMN     "reagendamentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "TreinoAgendadoStatus" NOT NULL DEFAULT 'AGENDADO',
ADD COLUMN     "treinoRotinaAtribuicaoId" TEXT;

-- CreateTable
CREATE TABLE "TreinoRotina" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ownerTipo" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "criadoPorUsuarioId" TEXT,
    "professorId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreinoRotina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoRotinaItem" (
    "id" TEXT NOT NULL,
    "rotinaId" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "data" TIMESTAMP(3),
    "diaDaSemana" INTEGER,

    CONSTRAINT "TreinoRotinaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoRotinaAtribuicao" (
    "id" TEXT NOT NULL,
    "rotinaId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "atletaObservadoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoRotinaAtribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreinoRotina_inicio_idx" ON "TreinoRotina"("inicio");

-- CreateIndex
CREATE INDEX "TreinoRotina_fim_idx" ON "TreinoRotina"("fim");

-- CreateIndex
CREATE INDEX "TreinoRotinaItem_rotinaId_idx" ON "TreinoRotinaItem"("rotinaId");

-- CreateIndex
CREATE INDEX "TreinoRotinaItem_treinoProgramadoId_idx" ON "TreinoRotinaItem"("treinoProgramadoId");

-- CreateIndex
CREATE INDEX "TreinoRotinaItem_diaDaSemana_idx" ON "TreinoRotinaItem"("diaDaSemana");

-- CreateIndex
CREATE INDEX "TreinoRotinaAtribuicao_atletaId_idx" ON "TreinoRotinaAtribuicao"("atletaId");

-- CreateIndex
CREATE INDEX "TreinoRotinaAtribuicao_atletaObservadoId_idx" ON "TreinoRotinaAtribuicao"("atletaObservadoId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoRotinaAtribuicao_rotinaId_atletaId_key" ON "TreinoRotinaAtribuicao"("rotinaId", "atletaId");

-- CreateIndex
CREATE INDEX "TreinoAgendado_status_idx" ON "TreinoAgendado"("status");

-- CreateIndex
CREATE INDEX "TreinoAgendado_dataTreino_idx" ON "TreinoAgendado"("dataTreino");

-- CreateIndex
CREATE INDEX "TreinoAgendado_treinoRotinaAtribuicaoId_idx" ON "TreinoAgendado"("treinoRotinaAtribuicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoAgendado_atletaId_treinoProgramadoId_dataTreino_key" ON "TreinoAgendado"("atletaId", "treinoProgramadoId", "dataTreino");

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_treinoRotinaAtribuicaoId_fkey" FOREIGN KEY ("treinoRotinaAtribuicaoId") REFERENCES "TreinoRotinaAtribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_reagendadoDeId_fkey" FOREIGN KEY ("reagendadoDeId") REFERENCES "TreinoAgendado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotina" ADD CONSTRAINT "TreinoRotina_criadoPorUsuarioId_fkey" FOREIGN KEY ("criadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotina" ADD CONSTRAINT "TreinoRotina_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotina" ADD CONSTRAINT "TreinoRotina_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotina" ADD CONSTRAINT "TreinoRotina_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotinaItem" ADD CONSTRAINT "TreinoRotinaItem_rotinaId_fkey" FOREIGN KEY ("rotinaId") REFERENCES "TreinoRotina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotinaItem" ADD CONSTRAINT "TreinoRotinaItem_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotinaAtribuicao" ADD CONSTRAINT "TreinoRotinaAtribuicao_rotinaId_fkey" FOREIGN KEY ("rotinaId") REFERENCES "TreinoRotina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotinaAtribuicao" ADD CONSTRAINT "TreinoRotinaAtribuicao_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRotinaAtribuicao" ADD CONSTRAINT "TreinoRotinaAtribuicao_atletaObservadoId_fkey" FOREIGN KEY ("atletaObservadoId") REFERENCES "AtletaObservado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
