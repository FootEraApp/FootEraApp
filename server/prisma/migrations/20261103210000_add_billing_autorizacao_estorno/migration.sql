-- ETAPA 4: Autorizacao administrativa de estornos

-- CreateEnum
CREATE TYPE "BillingAutorizacaoEstornoStatus" AS ENUM (
    'PENDENTE',
    'APROVADA',
    'CONSUMIDA',
    'REVOGADA',
    'EXPIRADA'
);

-- CreateTable
CREATE TABLE "BillingAutorizacaoEstorno" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "motivo" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "providerRef" TEXT NOT NULL,
    "status" "BillingAutorizacaoEstornoStatus"
        NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "aprovadoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),
    "consumidoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "BillingAutorizacaoEstorno_pkey"
        PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingAutorizacaoEstorno_pagamentoId_key"
    ON "BillingAutorizacaoEstorno"("pagamentoId");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_status_criadoEm_idx"
    ON "BillingAutorizacaoEstorno"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_solicitanteId_idx"
    ON "BillingAutorizacaoEstorno"("solicitanteId");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_aprovadorId_idx"
    ON "BillingAutorizacaoEstorno"("aprovadorId");

-- AddForeignKey
ALTER TABLE "BillingAutorizacaoEstorno"
    ADD CONSTRAINT "BillingAutorizacaoEstorno_pagamentoId_fkey"
    FOREIGN KEY ("pagamentoId")
    REFERENCES "Pagamento"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;