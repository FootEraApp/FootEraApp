/*
  Warnings:

  - The `perfilTipoTreino` column on the `Atleta` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[professorId,escolinhaId,clubeId,atletaId,olheiroId]` on the table `AtletaObservado` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[professorId,escolinhaId,clubeId,olheiroId,atletaId]` on the table `AtletaObservado` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."AtletaObservado_professorId_escolinhaId_clubeId_atletaId_key";

-- AlterTable
ALTER TABLE "public"."Atleta" DROP COLUMN "perfilTipoTreino",
ADD COLUMN     "perfilTipoTreino" "public"."TipoTreino";

-- AlterTable
ALTER TABLE "public"."AtletaObservado" ADD COLUMN     "olheiroId" TEXT;

-- CreateIndex
CREATE INDEX "Atleta_perfilTipoTreino_idx" ON "public"."Atleta"("perfilTipoTreino");

-- CreateIndex
CREATE INDEX "AtletaObservado_olheiroId_idx" ON "public"."AtletaObservado"("olheiroId");

-- CreateIndex
CREATE UNIQUE INDEX "AtletaObservado_professorId_escolinhaId_clubeId_atletaId_ol_key" ON "public"."AtletaObservado"("professorId", "escolinhaId", "clubeId", "atletaId", "olheiroId");

-- CreateIndex
CREATE UNIQUE INDEX "AtletaObservado_owner_atleta_key" ON "public"."AtletaObservado"("professorId", "escolinhaId", "clubeId", "olheiroId", "atletaId");

-- AddForeignKey
ALTER TABLE "public"."AtletaObservado" ADD CONSTRAINT "AtletaObservado_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "public"."Olheiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
