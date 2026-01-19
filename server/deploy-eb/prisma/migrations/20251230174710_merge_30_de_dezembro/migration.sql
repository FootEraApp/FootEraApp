/*
  Warnings:

  - You are about to drop the column `fim` on the `Evento` table. All the data in the column will be lost.
  - You are about to drop the column `inicio` on the `Evento` table. All the data in the column will be lost.
  - You are about to drop the column `professorId` on the `Turma` table. All the data in the column will be lost.
  - Added the required column `dataEvento` to the `Evento` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Turma" DROP CONSTRAINT "Turma_professorId_fkey";

-- DropIndex
DROP INDEX "public"."Professor_clubeId_idx";

-- DropIndex
DROP INDEX "public"."Professor_escolinhaId_idx";

-- DropIndex
DROP INDEX "public"."RelacaoTreinamento_professorId_atletaId_escolinhaId_clubeId_key";

-- AlterTable
ALTER TABLE "Evento" DROP COLUMN "fim",
DROP COLUMN "inicio",
ADD COLUMN     "dataEvento" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "inscricaoFim" TIMESTAMP(3),
ADD COLUMN     "inscricaoInicio" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Turma" DROP COLUMN "professorId";

-- CreateTable
CREATE TABLE "ProfessorClube" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "clubeId" TEXT NOT NULL,
    "papel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessorClube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessorEscolinha" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "escolinhaId" TEXT NOT NULL,
    "papel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessorEscolinha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaProfessor" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "papel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaProfessor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessorClube_clubeId_idx" ON "ProfessorClube"("clubeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessorClube_professorId_clubeId_key" ON "ProfessorClube"("professorId", "clubeId");

-- CreateIndex
CREATE INDEX "ProfessorEscolinha_escolinhaId_idx" ON "ProfessorEscolinha"("escolinhaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessorEscolinha_professorId_escolinhaId_key" ON "ProfessorEscolinha"("professorId", "escolinhaId");

-- CreateIndex
CREATE INDEX "TurmaProfessor_turmaId_idx" ON "TurmaProfessor"("turmaId");

-- CreateIndex
CREATE INDEX "TurmaProfessor_professorId_idx" ON "TurmaProfessor"("professorId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaProfessor_turmaId_professorId_key" ON "TurmaProfessor"("turmaId", "professorId");

-- AddForeignKey
ALTER TABLE "ProfessorClube" ADD CONSTRAINT "ProfessorClube_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorClube" ADD CONSTRAINT "ProfessorClube_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEscolinha" ADD CONSTRAINT "ProfessorEscolinha_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEscolinha" ADD CONSTRAINT "ProfessorEscolinha_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaProfessor" ADD CONSTRAINT "TurmaProfessor_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaProfessor" ADD CONSTRAINT "TurmaProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
