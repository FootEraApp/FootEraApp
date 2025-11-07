-- AlterTable
ALTER TABLE "TreinoAgendado" ADD COLUMN     "criadoPorProfessorId" TEXT;

-- CreateTable
CREATE TABLE "EstatisticaTreino" (
    "treinoId" TEXT NOT NULL,
    "usosProfessores" INTEGER NOT NULL DEFAULT 0,
    "feitosAlunos" INTEGER NOT NULL DEFAULT 0,
    "ultimoUsoEm" TIMESTAMP(3),
    "ultimoFeitoEm" TIMESTAMP(3),

    CONSTRAINT "EstatisticaTreino_pkey" PRIMARY KEY ("treinoId")
);

-- CreateTable
CREATE TABLE "TreinoProfessorUso" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoProfessorUso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstatisticaExercicio" (
    "exercicioId" TEXT NOT NULL,
    "inclusoesEmTreinos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIncluidoEm" TIMESTAMP(3),
    "recomendadoPorProfessorId" TEXT,
    "ultimoProfessorId" TEXT,

    CONSTRAINT "EstatisticaExercicio_pkey" PRIMARY KEY ("exercicioId")
);

-- CreateIndex
CREATE INDEX "TreinoProfessorUso_professorId_idx" ON "TreinoProfessorUso"("professorId");

-- CreateIndex
CREATE INDEX "TreinoProfessorUso_treinoId_idx" ON "TreinoProfessorUso"("treinoId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoProfessorUso_treinoId_professorId_key" ON "TreinoProfessorUso"("treinoId", "professorId");

-- CreateIndex
CREATE INDEX "EstatisticaExercicio_recomendadoPorProfessorId_idx" ON "EstatisticaExercicio"("recomendadoPorProfessorId");

-- CreateIndex
CREATE INDEX "EstatisticaExercicio_ultimoProfessorId_idx" ON "EstatisticaExercicio"("ultimoProfessorId");

-- CreateIndex
CREATE INDEX "TreinoAgendado_criadoPorProfessorId_idx" ON "TreinoAgendado"("criadoPorProfessorId");

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_criadoPorProfessorId_fkey" FOREIGN KEY ("criadoPorProfessorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstatisticaTreino" ADD CONSTRAINT "EstatisticaTreino_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProfessorUso" ADD CONSTRAINT "TreinoProfessorUso_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProfessorUso" ADD CONSTRAINT "TreinoProfessorUso_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstatisticaExercicio" ADD CONSTRAINT "EstatisticaExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstatisticaExercicio" ADD CONSTRAINT "EstatisticaExercicio_recomendadoPorProfessorId_fkey" FOREIGN KEY ("recomendadoPorProfessorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstatisticaExercicio" ADD CONSTRAINT "EstatisticaExercicio_ultimoProfessorId_fkey" FOREIGN KEY ("ultimoProfessorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
