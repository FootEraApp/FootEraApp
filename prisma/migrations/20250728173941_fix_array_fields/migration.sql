/*
  Warnings:

  - You are about to drop the column `compartilhamentos` on the `Postagem` table. All the data in the column will be lost.
  - The `qualificacoes` column on the `Professor` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `certificacoes` column on the `Professor` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TipoTreino" AS ENUM ('Tecnico', 'Físico', 'Tatico');

-- DropForeignKey
ALTER TABLE "Escolinha" DROP CONSTRAINT "Escolinha_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Professor" DROP CONSTRAINT "Professor_usuarioId_fkey";

-- AlterTable
ALTER TABLE "DesafioOficial" ALTER COLUMN "prazoSubmissao" DROP DEFAULT,
ALTER COLUMN "prazoSubmissao" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Escolinha" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Midia" ADD COLUMN     "submissaoDesafioId" TEXT,
ADD COLUMN     "submissaoTreinoId" TEXT;

-- AlterTable
ALTER TABLE "Postagem" DROP COLUMN "compartilhamentos";

-- AlterTable
ALTER TABLE "Professor" DROP COLUMN "qualificacoes",
ADD COLUMN     "qualificacoes" TEXT[],
DROP COLUMN "certificacoes",
ADD COLUMN     "certificacoes" TEXT[],
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubmissaoDesafio" ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "TreinoAgendado" ADD COLUMN     "dataTreino" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TreinoProgramado" ADD COLUMN     "TipoTreino" "TipoTreino",
ADD COLUMN     "categoria" "Categoria"[],
ADD COLUMN     "dicas" TEXT[],
ADD COLUMN     "duracao" INTEGER,
ADD COLUMN     "escolinhaId" TEXT,
ADD COLUMN     "objetivo" TEXT;

-- CreateTable
CREATE TABLE "RelacaoTreinamento" (
    "id" TEXT NOT NULL,
    "professorId" TEXT,
    "atletaId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelacaoTreinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissaoTreino" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "treinoAgendadoId" TEXT NOT NULL,
    "aprovado" BOOLEAN,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "SubmissaoTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoSistema" (
    "id" TEXT NOT NULL,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "allowAthleteChallenges" BOOLEAN NOT NULL DEFAULT true,
    "allowProfileEditing" BOOLEAN NOT NULL DEFAULT true,
    "maxDailyPosts" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "ConfiguracaoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelacaoTreinamento_professorId_atletaId_escolinhaId_clubeId_key" ON "RelacaoTreinamento"("professorId", "atletaId", "escolinhaId", "clubeId");

-- AddForeignKey
ALTER TABLE "Professor" ADD CONSTRAINT "Professor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_submissaoDesafioId_fkey" FOREIGN KEY ("submissaoDesafioId") REFERENCES "SubmissaoDesafio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_submissaoTreinoId_fkey" FOREIGN KEY ("submissaoTreinoId") REFERENCES "SubmissaoTreino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoTreino" ADD CONSTRAINT "SubmissaoTreino_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoTreino" ADD CONSTRAINT "SubmissaoTreino_treinoAgendadoId_fkey" FOREIGN KEY ("treinoAgendadoId") REFERENCES "TreinoAgendado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoTreino" ADD CONSTRAINT "SubmissaoTreino_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
