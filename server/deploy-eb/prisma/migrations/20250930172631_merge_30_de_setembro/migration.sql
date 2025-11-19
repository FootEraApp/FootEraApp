-- CreateEnum
CREATE TYPE "public"."TreinoStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ChecklistContext" AS ENUM ('SUBMISSAO_TREINO', 'SUBMISSAO_DESAFIO', 'POSTAGEM', 'PENEIRA');

-- CreateEnum
CREATE TYPE "public"."ChecklistItemType" AS ENUM ('BOOLEAN', 'SELECT', 'SCORE');

-- AlterTable
ALTER TABLE "public"."SubmissaoTreino" ADD COLUMN     "repeticoes" INTEGER,
ADD COLUMN     "tempoSeg" INTEGER;

-- CreateTable
CREATE TABLE "public"."ScoutNote" (
    "id" TEXT NOT NULL,
    "olheiroId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "lastScoreSeen" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoutNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TreinoUsuario" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" "public"."TreinoStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "tempoSeg" INTEGER,
    "repeticoes" INTEGER,
    "observacao" TEXT,

    CONSTRAINT "TreinoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "context" "public"."ChecklistContext" NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "professorId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "public"."ChecklistItemType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "options" TEXT[],

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubmissionChecklist" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "context" "public"."ChecklistContext" NOT NULL,
    "submissaoTreinoId" TEXT,
    "submissaoDesafioId" TEXT,
    "postagemId" TEXT,
    "totalScore" INTEGER,
    "aprovado" BOOLEAN,
    "finalizedByUserId" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistAnswer" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "value" JSONB,
    "comment" TEXT,

    CONSTRAINT "ChecklistAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RankingSnapshot" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RankingRow" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "pontuacao" INTEGER NOT NULL,
    "estado" TEXT,
    "categoria" TEXT,
    "rankingSnapshotId" TEXT,

    CONSTRAINT "RankingRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoutNote_olheiroId_atletaId_key" ON "public"."ScoutNote"("olheiroId", "atletaId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoUsuario_treinoId_usuarioId_key" ON "public"."TreinoUsuario"("treinoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "public"."ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "public"."SubmissionChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RankingRow" ADD CONSTRAINT "RankingRow_rankingSnapshotId_fkey" FOREIGN KEY ("rankingSnapshotId") REFERENCES "public"."RankingSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
