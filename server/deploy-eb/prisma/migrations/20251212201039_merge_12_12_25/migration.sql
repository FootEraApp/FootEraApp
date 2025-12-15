/*
  Warnings:

  - A unique constraint covering the columns `[atletaId,treinoAgendadoId]` on the table `SubmissaoTreino` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusSessaoTreinoTurma" AS ENUM ('AGENDADO', 'EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO');

-- DropIndex
DROP INDEX "public"."AtividadeRecente_imagemUrl_key";

-- DropIndex
DROP INDEX "public"."DesafioOficial_imagemUrl_key";

-- DropIndex
DROP INDEX "public"."Exercicio_videoDemonstrativoUrl_key";

-- DropIndex
DROP INDEX "public"."Midia_url_key";

-- DropIndex
DROP INDEX "public"."Professor_fotoUrl_key";

-- DropIndex
DROP INDEX "public"."SubmissaoDesafio_videoUrl_key";

-- DropIndex
DROP INDEX "public"."SubmissaoTreino_observacao_key";

-- AlterTable
ALTER TABLE "ExercicioTemporario" ADD COLUMN     "videoDemonstrativoUrl" TEXT;

-- AlterTable
ALTER TABLE "RelacaoTreinamento" ALTER COLUMN "encerradoEm" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SessaoTreinoTurma" (
    "id" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "criadorId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "status" "StatusSessaoTreinoTurma" NOT NULL DEFAULT 'AGENDADO',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "observacoes" TEXT,
    "duracaoMinutosReal" INTEGER,
    "penalidadeAtraso" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessaoTreinoTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresencaSessaoTreino" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresencaSessaoTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoTreinoTurmaExercicio" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "ordem" INTEGER,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "concluidoEm" TIMESTAMP(3),
    "exercicioId" TEXT,
    "exercicioTemporarioId" TEXT,

    CONSTRAINT "SessaoTreinoTurmaExercicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresencaSessaoTreino_sessaoId_atletaId_key" ON "PresencaSessaoTreino"("sessaoId", "atletaId");

-- CreateIndex
CREATE INDEX "SessaoTreinoTurmaExercicio_sessaoId_idx" ON "SessaoTreinoTurmaExercicio"("sessaoId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoTreino_atletaId_treinoAgendadoId_key" ON "SubmissaoTreino"("atletaId", "treinoAgendadoId");

-- AddForeignKey
ALTER TABLE "SessaoTreinoTurma" ADD CONSTRAINT "SessaoTreinoTurma_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoTreinoTurma" ADD CONSTRAINT "SessaoTreinoTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoTreinoTurma" ADD CONSTRAINT "SessaoTreinoTurma_criadorId_fkey" FOREIGN KEY ("criadorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresencaSessaoTreino" ADD CONSTRAINT "PresencaSessaoTreino_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoTreinoTurma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresencaSessaoTreino" ADD CONSTRAINT "PresencaSessaoTreino_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoTreinoTurmaExercicio" ADD CONSTRAINT "SessaoTreinoTurmaExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoTreinoTurmaExercicio" ADD CONSTRAINT "SessaoTreinoTurmaExercicio_exercicioTemporarioId_fkey" FOREIGN KEY ("exercicioTemporarioId") REFERENCES "ExercicioTemporario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoTreinoTurmaExercicio" ADD CONSTRAINT "SessaoTreinoTurmaExercicio_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoTreinoTurma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
