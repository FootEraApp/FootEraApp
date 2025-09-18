-- DropForeignKey
ALTER TABLE "public"."TreinoProgramadoExercicio" DROP CONSTRAINT "TreinoProgramadoExercicio_exercicioId_fkey";

-- AlterTable
ALTER TABLE "public"."TreinoProgramadoExercicio" ADD COLUMN     "exercicioTemporarioId" TEXT,
ALTER COLUMN "exercicioId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ExercicioTemporario" (
    "id" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "public"."Nivel" NOT NULL,
    "categorias" "public"."Categoria"[],

    CONSTRAINT "ExercicioTemporario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExercicioTemporario_treinoProgramadoId_idx" ON "public"."ExercicioTemporario"("treinoProgramadoId");

-- CreateIndex
CREATE INDEX "TreinoProgramadoExercicio_treinoProgramadoId_idx" ON "public"."TreinoProgramadoExercicio"("treinoProgramadoId");

-- CreateIndex
CREATE INDEX "TreinoProgramadoExercicio_exercicioId_idx" ON "public"."TreinoProgramadoExercicio"("exercicioId");

-- CreateIndex
CREATE INDEX "TreinoProgramadoExercicio_exercicioTemporarioId_idx" ON "public"."TreinoProgramadoExercicio"("exercicioTemporarioId");

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "public"."Exercicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_exercicioTemporarioId_fkey" FOREIGN KEY ("exercicioTemporarioId") REFERENCES "public"."ExercicioTemporario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExercicioTemporario" ADD CONSTRAINT "ExercicioTemporario_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "public"."TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
