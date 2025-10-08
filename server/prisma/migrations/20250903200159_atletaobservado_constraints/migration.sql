/*
  Warnings:

  - A unique constraint covering the columns `[professorId,escolinhaId,clubeId,atletaId]` on the table `AtletaObservado` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AtletaObservado_professorId_escolinhaId_clubeId_atletaId_key" ON "public"."AtletaObservado"("professorId", "escolinhaId", "clubeId", "atletaId");
