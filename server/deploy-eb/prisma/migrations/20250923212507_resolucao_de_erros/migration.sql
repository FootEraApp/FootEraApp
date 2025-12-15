/*
  Warnings:

  - The `posicao` column on the `Atleta` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[professorId,escolinhaId,clubeId,atletaId,olheiroId]` on the table `AtletaObservado` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Atleta" DROP COLUMN "posicao",
ADD COLUMN     "posicao" "public"."PosicaoCampo";

-- AlterTable
ALTER TABLE "public"."Clube" ADD COLUMN     "categorias" "public"."Categoria"[],
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "responsavel" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AtletaObservado_professorId_escolinhaId_clubeId_atletaId_ol_key" ON "public"."AtletaObservado"("professorId", "escolinhaId", "clubeId", "atletaId", "olheiroId");

-- RenameIndex
ALTER INDEX "public"."AtletaObservado_professorId_escolinhaId_clubeId_olheiroId_atlet" RENAME TO "AtletaObservado_owner_atleta_key";
