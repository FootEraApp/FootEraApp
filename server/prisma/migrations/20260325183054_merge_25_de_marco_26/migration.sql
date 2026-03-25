/*
  Warnings:

  - You are about to drop the column `descricao` on the `Exercicio` table. All the data in the column will be lost.
  - You are about to drop the column `bairro` on the `Usuario` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nomeNormalizado]` on the table `Exercicio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nomeNormalizado]` on the table `ExercicioPersonalizado` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `estruturaTipo` to the `Metodologia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `Metodologia` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MetodologiaProgressoStatus" AS ENUM ('NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA');

-- CreateEnum
CREATE TYPE "MetodologiaItemTipo" AS ENUM ('TREINO', 'VIDEO', 'AULA', 'MATERIAL', 'DESAFIO');

-- CreateEnum
CREATE TYPE "MetodologiaModoExecucao" AS ENUM ('LIVRE', 'PRAZO_SUGERIDO', 'DESAFIO_FECHADO');

-- CreateEnum
CREATE TYPE "MetodologiaTipo" AS ENUM ('TRILHAS_TREINO', 'CURSO_FORMACAO');

-- CreateEnum
CREATE TYPE "MetodologiaEstruturaTipo" AS ENUM ('TRILHA', 'MODULO');

-- CreateEnum
CREATE TYPE "MetodologiaArea" AS ENUM ('TECNICO', 'FISICO', 'TATICO', 'MENTAL', 'GOLEIROS', 'PSICOLOGIA', 'INOVACAO', 'ANALISE_DESEMPENHO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoExercicio" AS ENUM ('Tecnico', 'Fisico', 'Tatico', 'Mental');

-- CreateEnum
CREATE TYPE "ModoExecucaoExercicio" AS ENUM ('Tempo', 'SeriesRepeticoes', 'LivreOrientativo');

-- CreateEnum
CREATE TYPE "EspacoExercicio" AS ENUM ('Pequeno', 'Medio', 'Grande');

-- CreateEnum
CREATE TYPE "FaixaEtariaExercicio" AS ENUM ('Sub9', 'Sub11', 'Sub13', 'Sub15', 'Sub17', 'Sub20', 'Livre');

-- AlterTable
ALTER TABLE "Exercicio" DROP COLUMN "descricao",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "criadoPorId" TEXT,
ADD COLUMN     "descanso" TEXT,
ADD COLUMN     "duracao" TEXT,
ADD COLUMN     "espacoNecessario" "EspacoExercicio",
ADD COLUMN     "faixaEtaria" "FaixaEtariaExercicio"[],
ADD COLUMN     "favorito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materiaisNecessarios" TEXT,
ADD COLUMN     "modoExecucao" "ModoExecucaoExercicio",
ADD COLUMN     "nomeNormalizado" TEXT,
ADD COLUMN     "objetivo" TEXT,
ADD COLUMN     "quantidadeAtletas" TEXT,
ADD COLUMN     "repeticoes" TEXT,
ADD COLUMN     "series" INTEGER,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "tipo" "TipoExercicio",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ExercicioPersonalizado" ADD COLUMN     "nomeNormalizado" TEXT;

-- AlterTable
ALTER TABLE "Metodologia"
ADD COLUMN "area" "MetodologiaArea",
ADD COLUMN "estruturaTipo" "MetodologiaEstruturaTipo",
ADD COLUMN "geraBadge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "geraCertificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tipo" "MetodologiaTipo";

UPDATE "Metodologia"
SET "tipo" = 'CURSO_FORMACAO'
WHERE "tipo" IS NULL;

UPDATE "Metodologia"
SET "estruturaTipo" = 'MODULO'
WHERE "estruturaTipo" IS NULL;

ALTER TABLE "Metodologia"
ALTER COLUMN "tipo" SET NOT NULL,
ALTER COLUMN "estruturaTipo" SET NOT NULL;

-- AlterTable
ALTER TABLE "Olheiro" ADD COLUMN     "clubeId" TEXT,
ADD COLUMN     "colaboracaoEscolinhaId" TEXT,
ADD COLUMN     "colaboracaoProfessorId" TEXT;

-- AlterTable
ALTER TABLE "Professor" ALTER COLUMN "areaFormacao" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TreinoProgramadoExercicio" ADD COLUMN     "descanso" TEXT,
ADD COLUMN     "duracao" TEXT,
ADD COLUMN     "series" INTEGER;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "bairro",
ADD COLUMN     "logradouro" TEXT;

-- CreateTable
CREATE TABLE "MetodologiaEstrutura" (
    "id" TEXT NOT NULL,
    "metodologiaId" TEXT NOT NULL,
    "tipo" "MetodologiaEstruturaTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "objetivo" TEXT,
    "ordem" INTEGER NOT NULL,
    "duracaoSemanas" INTEGER,
    "treinosPorSemana" INTEGER,
    "quantidadeMinConclusao" INTEGER,
    "modoExecucao" "MetodologiaModoExecucao",
    "pontosPorItem" INTEGER,
    "bonusConsistencia" INTEGER,
    "bonusFinal" INTEGER,
    "permiteAtraso" BOOLEAN NOT NULL DEFAULT true,
    "prazoFinal" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodologiaEstrutura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodologiaEstruturaItem" (
    "id" TEXT NOT NULL,
    "estruturaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "MetodologiaItemTipo" NOT NULL,
    "videoUrl" TEXT,
    "thumbUrl" TEXT,
    "arquivoUrl" TEXT,
    "materialUrl" TEXT,
    "duracaoMin" INTEGER,
    "treinoProgramadoId" TEXT,
    "pontos" INTEGER,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodologiaEstruturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodologiaProgressoEstrutura" (
    "id" TEXT NOT NULL,
    "metodologiaAssinanteId" TEXT NOT NULL,
    "estruturaId" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "status" "MetodologiaProgressoStatus" NOT NULL DEFAULT 'NAO_INICIADA',
    "itensConcluidos" INTEGER NOT NULL DEFAULT 0,
    "pontosGanhos" INTEGER NOT NULL DEFAULT 0,
    "progresso" JSONB,
    "cicloInicioEm" TIMESTAMP(3),
    "cicloFimEm" TIMESTAMP(3),
    "ultimoAcessoEm" TIMESTAMP(3),

    CONSTRAINT "MetodologiaProgressoEstrutura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetodologiaEstrutura_metodologiaId_idx" ON "MetodologiaEstrutura"("metodologiaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaEstrutura_metodologiaId_ordem_key" ON "MetodologiaEstrutura"("metodologiaId", "ordem");

-- CreateIndex
CREATE INDEX "MetodologiaEstruturaItem_estruturaId_idx" ON "MetodologiaEstruturaItem"("estruturaId");

-- CreateIndex
CREATE INDEX "MetodologiaEstruturaItem_treinoProgramadoId_idx" ON "MetodologiaEstruturaItem"("treinoProgramadoId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaEstruturaItem_estruturaId_ordem_key" ON "MetodologiaEstruturaItem"("estruturaId", "ordem");

-- CreateIndex
CREATE INDEX "MetodologiaProgressoEstrutura_estruturaId_idx" ON "MetodologiaProgressoEstrutura"("estruturaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaProgressoEstrutura_metodologiaAssinanteId_estrut_key" ON "MetodologiaProgressoEstrutura"("metodologiaAssinanteId", "estruturaId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_nomeNormalizado_key" ON "Exercicio"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "ExercicioPersonalizado_nomeNormalizado_key" ON "ExercicioPersonalizado"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "Olheiro_colaboracaoProfessorId_idx" ON "Olheiro"("colaboracaoProfessorId");

-- CreateIndex
CREATE INDEX "Olheiro_colaboracaoEscolinhaId_idx" ON "Olheiro"("colaboracaoEscolinhaId");

-- AddForeignKey
ALTER TABLE "Olheiro" ADD CONSTRAINT "Olheiro_colaboracaoProfessorId_fkey" FOREIGN KEY ("colaboracaoProfessorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Olheiro" ADD CONSTRAINT "Olheiro_colaboracaoEscolinhaId_fkey" FOREIGN KEY ("colaboracaoEscolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Olheiro" ADD CONSTRAINT "Olheiro_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaEstrutura" ADD CONSTRAINT "MetodologiaEstrutura_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaEstruturaItem" ADD CONSTRAINT "MetodologiaEstruturaItem_estruturaId_fkey" FOREIGN KEY ("estruturaId") REFERENCES "MetodologiaEstrutura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaEstruturaItem" ADD CONSTRAINT "MetodologiaEstruturaItem_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaProgressoEstrutura" ADD CONSTRAINT "MetodologiaProgressoEstrutura_metodologiaAssinanteId_fkey" FOREIGN KEY ("metodologiaAssinanteId") REFERENCES "MetodologiaAssinante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaProgressoEstrutura" ADD CONSTRAINT "MetodologiaProgressoEstrutura_estruturaId_fkey" FOREIGN KEY ("estruturaId") REFERENCES "MetodologiaEstrutura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
