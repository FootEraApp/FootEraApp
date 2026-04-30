-- AlterTable
ALTER TABLE "ExercicioPersonalizado" ADD COLUMN     "descanso" TEXT,
ADD COLUMN     "duracao" TEXT,
ADD COLUMN     "espacoNecessario" "EspacoExercicio",
ADD COLUMN     "favorito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materiaisNecessarios" TEXT,
ADD COLUMN     "modoExecucao" "ModoExecucaoExercicio",
ADD COLUMN     "quantidadeAtletas" TEXT,
ADD COLUMN     "repeticoes" TEXT,
ADD COLUMN     "series" INTEGER,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tipo" "TipoExercicio";
