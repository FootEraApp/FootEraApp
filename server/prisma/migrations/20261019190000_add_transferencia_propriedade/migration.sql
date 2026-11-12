
-- CreateTable
CREATE TABLE "TransferenciaPropriedade" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "proprietarioAtualId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "mensagem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "respondidoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "TransferenciaPropriedade_pkey"
        PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX
    "TransferenciaPropriedade_organizacaoId_status_idx"
ON "TransferenciaPropriedade"("organizacaoId", "status");

-- CreateIndex
CREATE INDEX
    "TransferenciaPropriedade_destinatarioId_status_idx"
ON "TransferenciaPropriedade"("destinatarioId", "status");

-- CreateIndex
CREATE INDEX
    "TransferenciaPropriedade_proprietarioAtualId_status_idx"
ON "TransferenciaPropriedade"("proprietarioAtualId", "status");
