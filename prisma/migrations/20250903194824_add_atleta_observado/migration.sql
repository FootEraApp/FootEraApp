-- CreateTable
CREATE TABLE "public"."AtletaObservado" (
    "id" TEXT NOT NULL,
    "professorId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,
    "atletaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtletaObservado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtletaObservado_atletaId_idx" ON "public"."AtletaObservado"("atletaId");

-- CreateIndex
CREATE INDEX "AtletaObservado_professorId_idx" ON "public"."AtletaObservado"("professorId");

-- CreateIndex
CREATE INDEX "AtletaObservado_escolinhaId_idx" ON "public"."AtletaObservado"("escolinhaId");

-- CreateIndex
CREATE INDEX "AtletaObservado_clubeId_idx" ON "public"."AtletaObservado"("clubeId");

-- CreateIndex
CREATE UNIQUE INDEX "AtletaObservado_professorId_escolinhaId_clubeId_atletaId_key" ON "public"."AtletaObservado"("professorId", "escolinhaId", "clubeId", "atletaId");

-- AddForeignKey
ALTER TABLE "public"."AtletaObservado" ADD CONSTRAINT "AtletaObservado_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "public"."Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtletaObservado" ADD CONSTRAINT "AtletaObservado_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "public"."Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtletaObservado" ADD CONSTRAINT "AtletaObservado_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtletaObservado" ADD CONSTRAINT "AtletaObservado_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
