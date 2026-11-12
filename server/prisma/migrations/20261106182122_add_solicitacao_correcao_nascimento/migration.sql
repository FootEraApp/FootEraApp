-- CreateEnum
CREATE TYPE "StatusCorrecaoNascimento" AS ENUM ('PENDENTE_VERIFICACAO', 'EM_ANALISE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "CupomAniversarioStatus" AS ENUM ('RESERVADO', 'CONSUMIDO', 'LIBERADO', 'CONCILIACAO_PENDENTE');

-- CreateTable
CREATE TABLE "SolicitacaoCorrecaoNascimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataSolicitada" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusCorrecaoNascimento" NOT NULL DEFAULT 'PENDENTE_VERIFICACAO',
    "verificacaoRef" TEXT,
    "verificadoEm" TIMESTAMP(3),
    "revisadoPorId" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoCorrecaoNascimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CupomAniversarioUso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL DEFAULT '20PARABENS',
    "pagamentoId" TEXT,
    "status" "CupomAniversarioStatus" NOT NULL DEFAULT 'RESERVADO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "consumidoEm" TIMESTAMP(3),

    CONSTRAINT "CupomAniversarioUso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecaoNascimento_usuarioId_status_idx" ON "SolicitacaoCorrecaoNascimento"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecaoNascimento_status_criadoEm_idx" ON "SolicitacaoCorrecaoNascimento"("status", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CupomAniversarioUso_pagamentoId_key" ON "CupomAniversarioUso"("pagamentoId");

-- CreateIndex
CREATE INDEX "CupomAniversarioUso_status_criadoEm_idx" ON "CupomAniversarioUso"("status", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CupomAniversarioUso_usuarioId_ano_key" ON "CupomAniversarioUso"("usuarioId", "ano");

-- AddForeignKey
ALTER TABLE "SolicitacaoCorrecaoNascimento" ADD CONSTRAINT "SolicitacaoCorrecaoNascimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomAniversarioUso" ADD CONSTRAINT "CupomAniversarioUso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
