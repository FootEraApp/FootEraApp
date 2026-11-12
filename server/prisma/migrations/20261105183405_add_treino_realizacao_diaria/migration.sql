-- CreateTable
CREATE TABLE "TreinoRealizacaoDiaria" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "diaReferencia" TEXT NOT NULL,
    "realizadoEm" TIMESTAMP(3) NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoRealizacaoDiaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreinoRealizacaoDiaria_atletaId_diaReferencia_idx" ON "TreinoRealizacaoDiaria"("atletaId", "diaReferencia");

-- CreateIndex
CREATE INDEX "TreinoRealizacaoDiaria_realizadoEm_idx" ON "TreinoRealizacaoDiaria"("realizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoRealizacaoDiaria_atletaId_origem_origemId_key" ON "TreinoRealizacaoDiaria"("atletaId", "origem", "origemId");

-- AddForeignKey
ALTER TABLE "TreinoRealizacaoDiaria" ADD CONSTRAINT "TreinoRealizacaoDiaria_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;