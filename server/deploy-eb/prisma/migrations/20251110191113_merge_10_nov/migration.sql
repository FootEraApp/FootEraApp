-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('Mensal', 'Anual');

-- CreateEnum
CREATE TYPE "PagamentoStatus" AS ENUM ('PENDENTE', 'APROVADO', 'FALHOU', 'CANCELADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'CREDITO', 'DEBITO', 'BOLETO');

-- CreateEnum
CREATE TYPE "TipoCupom" AS ENUM ('PERCENTUAL', 'VALOR', 'PRESENTE');

-- AlterEnum
ALTER TYPE "TreinoAgendadoStatus" ADD VALUE 'EM_ANDAMENTO';

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "periodicidade" "Periodicidade" NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "valor" DECIMAL(10,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "cupomId" TEXT,
    "provider" TEXT,
    "providerRef" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "reembolsadoEm" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pagadorNome" TEXT,
    "pagadorEmail" TEXT,
    "pagadorCpf" TEXT,
    "pagadorTelefone" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMes" INTEGER,
    "cardExpAno" INTEGER,
    "pixCopiaECola" TEXT,
    "boletoLinhaDigitavel" TEXT,
    "meta" JSONB,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cupom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCupom" NOT NULL,
    "descontoPerc" INTEGER,
    "descontoFixo" DECIMAL(10,2),
    "plano" TEXT,
    "periodicidade" "Periodicidade",
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usosMax" INTEGER,
    "usosAtuais" INTEGER NOT NULL DEFAULT 0,
    "expiraEm" TIMESTAMP(3),
    "concedidoParaUsuarioId" TEXT,
    "transferivel" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorUsuarioId" TEXT,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CupomResgate" (
    "id" TEXT NOT NULL,
    "cupomId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "resgatadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagamentoId" TEXT,

    CONSTRAINT "CupomResgate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pagamento_usuarioId_criadoEm_idx" ON "Pagamento"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "Pagamento_status_idx" ON "Pagamento"("status");

-- CreateIndex
CREATE INDEX "Pagamento_status_criadoEm_idx" ON "Pagamento"("status", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_provider_providerRef_key" ON "Pagamento"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");

-- CreateIndex
CREATE INDEX "Cupom_ativo_idx" ON "Cupom"("ativo");

-- CreateIndex
CREATE INDEX "Cupom_codigo_idx" ON "Cupom"("codigo");

-- CreateIndex
CREATE INDEX "CupomResgate_usuarioId_idx" ON "CupomResgate"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "CupomResgate_cupomId_usuarioId_key" ON "CupomResgate"("cupomId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_criadoPorUsuarioId_fkey" FOREIGN KEY ("criadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomResgate" ADD CONSTRAINT "CupomResgate_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomResgate" ADD CONSTRAINT "CupomResgate_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomResgate" ADD CONSTRAINT "CupomResgate_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
