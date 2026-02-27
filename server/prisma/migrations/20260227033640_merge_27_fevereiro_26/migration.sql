-- AlterTable
ALTER TABLE "ExercicioTemporario" ADD COLUMN     "videoPosterUrl" TEXT;

-- AlterTable
ALTER TABLE "SessaoTreinoTurmaExercicio" ADD COLUMN     "exercicioPersonalizadoId" TEXT;

-- AlterTable
ALTER TABLE "TreinoProgramadoExercicio" ADD COLUMN     "exercicioPersonalizadoId" TEXT;

-- CreateTable
CREATE TABLE "ExercicioPersonalizado" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "Nivel",
    "categorias" "Categoria"[] DEFAULT ARRAY[]::"Categoria"[],
    "videoDemonstrativoUrl" TEXT,
    "videoPosterUrl" TEXT,
    "criadorUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExercicioPersonalizado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExercicioPersonalizado_criadorUsuarioId_idx" ON "ExercicioPersonalizado"("criadorUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ExercicioPersonalizado_criadorUsuarioId_nome_key" ON "ExercicioPersonalizado"("criadorUsuarioId", "nome");

-- CreateIndex
CREATE INDEX "TreinoProgramadoExercicio_exercicioPersonalizadoId_idx" ON "TreinoProgramadoExercicio"("exercicioPersonalizadoId");

-- AddForeignKey
ALTER TABLE "TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_exercicioPersonalizadoId_fkey" FOREIGN KEY ("exercicioPersonalizadoId") REFERENCES "ExercicioPersonalizado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercicioPersonalizado" ADD CONSTRAINT "ExercicioPersonalizado_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoTreinoTurmaExercicio" ADD CONSTRAINT "SessaoTreinoTurmaExercicio_exercicioPersonalizadoId_fkey" FOREIGN KEY ("exercicioPersonalizadoId") REFERENCES "ExercicioPersonalizado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
