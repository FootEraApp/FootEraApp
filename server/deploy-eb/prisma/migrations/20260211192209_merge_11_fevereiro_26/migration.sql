-- AlterTable
ALTER TABLE "Metodologia" ALTER COLUMN "ativo" SET DEFAULT false;

-- AlterTable
ALTER TABLE "TreinoAgendado" ADD COLUMN     "turmaId" TEXT;

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
