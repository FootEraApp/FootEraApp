-- CreateEnum
CREATE TYPE "CupomReservaStatus" AS ENUM (
    'RESERVADA',
    'CONSUMIDA',
    'LIBERADA',
    'CONCILIACAO_PENDENTE'
);

-- CreateTable
CREATE TABLE "CupomReserva" (
    "id" TEXT NOT NULL,
    "cupomId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "status" "CupomReservaStatus" NOT NULL DEFAULT 'RESERVADA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "consumidaEm" TIMESTAMP(3),
    "liberadaEm" TIMESTAMP(3),

    CONSTRAINT "CupomReserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CupomReserva_pagamentoId_key"
ON "CupomReserva"("pagamentoId");

CREATE INDEX "CupomReserva_cupomId_status_idx"
ON "CupomReserva"("cupomId", "status");

CREATE INDEX "CupomReserva_usuarioId_status_idx"
ON "CupomReserva"("usuarioId", "status");

CREATE INDEX "CupomReserva_expiraEm_idx"
ON "CupomReserva"("expiraEm");

-- AddForeignKey
ALTER TABLE "CupomReserva"
ADD CONSTRAINT "CupomReserva_cupomId_fkey"
FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CupomReserva"
ADD CONSTRAINT "CupomReserva_pagamentoId_fkey"
FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CupomReserva"
ADD CONSTRAINT "CupomReserva_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;