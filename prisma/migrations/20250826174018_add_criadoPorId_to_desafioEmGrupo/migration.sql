-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMensagem" ADD VALUE 'GRUPO_DESAFIO';
ALTER TYPE "TipoMensagem" ADD VALUE 'GRUPO_DESAFIO_BONUS';

-- AlterTable
ALTER TABLE "DesafioEmGrupo" ADD COLUMN     "bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bonusDado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "criadoPorId" TEXT NOT NULL,
ADD COLUMN     "pontosSnapshot" INTEGER;

-- AlterTable
ALTER TABLE "MensagemGrupo" ADD COLUMN     "conteudoJson" JSONB,
ADD COLUMN     "desafioEmGrupoId" TEXT;

-- AlterTable
ALTER TABLE "SubmissaoDesafioEmGrupo" ADD COLUMN     "dentroDoPrazo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DesafioEmGrupo_grupoId_idx" ON "DesafioEmGrupo"("grupoId");

-- CreateIndex
CREATE INDEX "DesafioEmGrupo_desafioOficialId_idx" ON "DesafioEmGrupo"("desafioOficialId");

-- CreateIndex
CREATE INDEX "DesafioEmGrupo_criadoPorId_idx" ON "DesafioEmGrupo"("criadoPorId");

-- CreateIndex
CREATE INDEX "MensagemGrupo_desafioEmGrupoId_idx" ON "MensagemGrupo"("desafioEmGrupoId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoDesafioEmGrupo_desafioEmGrupoId_usuarioId_key" ON "SubmissaoDesafioEmGrupo"("desafioEmGrupoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "MensagemGrupo" ADD CONSTRAINT "MensagemGrupo_desafioEmGrupoId_fkey" FOREIGN KEY ("desafioEmGrupoId") REFERENCES "DesafioEmGrupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesafioEmGrupo" ADD CONSTRAINT "DesafioEmGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesafioEmGrupo" ADD CONSTRAINT "DesafioEmGrupo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



