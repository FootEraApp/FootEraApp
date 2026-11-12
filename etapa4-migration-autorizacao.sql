-- CreateEnum
CREATE TYPE "BillingAutorizacaoEstornoStatus" AS ENUM ('PENDENTE', 'APROVADA', 'CONSUMIDA', 'REVOGADA', 'EXPIRADA');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoTreino_new" AS ENUM ('Tecnico', 'Físico', 'Tatico', 'Mental');
ALTER TABLE "Atleta" ALTER COLUMN "perfilTipoTreino" TYPE "TipoTreino_new" USING ("perfilTipoTreino"::text::"TipoTreino_new");
ALTER TABLE "TreinoProgramado" ALTER COLUMN "tipoTreino" TYPE "TipoTreino_new" USING ("tipoTreino"::text::"TipoTreino_new");
ALTER TABLE "SubmissaoTreino" ALTER COLUMN "tipoTreinoSnapshot" TYPE "TipoTreino_new" USING ("tipoTreinoSnapshot"::text::"TipoTreino_new");
ALTER TABLE "TreinoSalvo" ALTER COLUMN "tipoTreino" TYPE "TipoTreino_new" USING ("tipoTreino"::text::"TipoTreino_new");
ALTER TYPE "TipoTreino" RENAME TO "TipoTreino_old";
ALTER TYPE "TipoTreino_new" RENAME TO "TipoTreino";
DROP TYPE "TipoTreino_old";
COMMIT;

-- AlterTable
ALTER TABLE "DesafioOficial" DROP COLUMN "tipoMetrificaÃ§Ã£o",
ADD COLUMN     "tipoMetrificação" TEXT;

-- AlterTable
ALTER TABLE "EventoConvocacao" ALTER COLUMN "nome" SET DEFAULT 'Convocação';

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
    "status" "BillingAutorizacaoEstornoStatus" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "aprovadoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),
    "consumidoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "BillingAutorizacaoEstorno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingAutorizacaoEstorno_pagamentoId_key" ON "BillingAutorizacaoEstorno"("pagamentoId");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_status_criadoEm_idx" ON "BillingAutorizacaoEstorno"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_solicitanteId_idx" ON "BillingAutorizacaoEstorno"("solicitanteId");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_aprovadorId_idx" ON "BillingAutorizacaoEstorno"("aprovadorId");

-- AddForeignKey
ALTER TABLE "BillingAutorizacaoEstorno" ADD CONSTRAINT "BillingAutorizacaoEstorno_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
