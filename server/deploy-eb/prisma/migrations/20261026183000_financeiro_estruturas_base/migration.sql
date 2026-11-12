-- Reconstrucao de estruturas financeiras ausentes do historico.
-- Gerado a partir do diff do banco de replay; NAO executar no banco QA existente.
-- Deve anteceder 20261026190000_pagamento_beneficio_contexto.
-- A coluna postAutorizacaoConsumidaEm pertence a migration 20261030183000.

BEGIN;

-- CreateEnum
CREATE TYPE "PagamentoBeneficioTipo" AS ENUM ('ASSINATURA', 'METODOLOGIA', 'METODOLOGIA_AVULSA', 'AULA_AO_VIVO', 'EVENTO');

-- CreateEnum
CREATE TYPE "BillingCheckoutOperacaoStatus" AS ENUM ('PREPARADA', 'ENVIO_POSSIVEL', 'CONFIRMADA', 'INCONCLUSIVA', 'FALHA_COMPROVADA');

-- CreateEnum
CREATE TYPE "BillingPendenciaEventoStatus" AS ENUM ('PENDENTE_ANALISE', 'EM_ANALISE', 'AGUARDANDO_ESTORNO', 'ESTORNO_CONFIRMADO', 'RESOLVIDA_MANUALMENTE');

-- CreateEnum
CREATE TYPE "BillingCompensacaoEventoStatus" AS ENUM ('PREPARADA', 'EM_PROCESSAMENTO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADA', 'FALHA_REVISAR', 'CANCELADA');

-- CreateEnum
CREATE TYPE "BillingCompensacaoTentativaStatus" AS ENUM ('EM_PROCESSAMENTO', 'SIMULACAO_ENCERRADA', 'RESULTADO_DESCONHECIDO', 'CONFIRMACAO_EXTERNA_PENDENTE');

-- CreateTable
CREATE TABLE "PagamentoBeneficio" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "tipo" "PagamentoBeneficioTipo" NOT NULL,
    "recursoId" TEXT NOT NULL,
    "contextoKind" TEXT,
    "contextoTipo" TEXT,
    "contextoPerfilId" TEXT,
    "contextoOrganizacaoId" TEXT,
    "concedidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "motivoRevogacao" TEXT,

    CONSTRAINT "PagamentoBeneficio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCheckoutOperacao" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "chaveCliente" TEXT NOT NULL,
    "chaveOperacao" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "status" "BillingCheckoutOperacaoStatus" NOT NULL DEFAULT 'PREPARADA',
    "fingerprintRequisicao" TEXT NOT NULL,
    "providerRef" TEXT,
    "ultimoErro" TEXT,
    "envioPossivelEm" TIMESTAMP(3),
    "confirmadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckoutOperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPendenciaEvento" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "BillingPendenciaEventoStatus" NOT NULL DEFAULT 'PENDENTE_ANALISE',
    "providerRef" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "BillingPendenciaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCompensacaoEvento" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "pendenciaId" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "status" "BillingCompensacaoEventoStatus" NOT NULL DEFAULT 'PREPARADA',
    "valor" DECIMAL(10,2) NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "providerRef" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCompensacaoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCompensacaoTentativa" (
    "id" TEXT NOT NULL,
    "compensacaoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "BillingCompensacaoTentativaStatus" NOT NULL DEFAULT 'EM_PROCESSAMENTO',
    "ambiente" TEXT NOT NULL DEFAULT 'QA',
    "operacaoExternaExecutada" BOOLEAN NOT NULL DEFAULT false,
    "estornoProviderRef" TEXT,
    "chaveIdempotenciaOperacao" TEXT,
    "requisicaoEnviadaEm" TIMESTAMP(3),
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradoEm" TIMESTAMP(3),
    "observacao" TEXT,

    CONSTRAINT "BillingCompensacaoTentativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCompensacaoConsultaRecuperacao" (
    "id" TEXT NOT NULL,
    "compensacaoId" TEXT NOT NULL,
    "tentativaId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'QA',
    "simulada" BOOLEAN NOT NULL DEFAULT true,
    "tipoEvidencia" TEXT NOT NULL,
    "decisao" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "identidadeConfirmada" BOOLEAN NOT NULL DEFAULT false,
    "providerRef" TEXT NOT NULL,
    "estornoId" TEXT,
    "statusEstorno" TEXT,
    "valorEstorno" DECIMAL(10,2),
    "moedaEstorno" TEXT,
    "consultadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCompensacaoConsultaRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagamentoBeneficio_usuarioId_tipo_recursoId_idx" ON "PagamentoBeneficio"("usuarioId", "tipo", "recursoId");

-- CreateIndex
CREATE INDEX "PagamentoBeneficio_pagamentoId_idx" ON "PagamentoBeneficio"("pagamentoId");

-- CreateIndex
CREATE INDEX "PagamentoBeneficio_revogadoEm_idx" ON "PagamentoBeneficio"("revogadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoBeneficio_pagamentoId_itemKey_key" ON "PagamentoBeneficio"("pagamentoId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutOperacao_pagamentoId_key" ON "BillingCheckoutOperacao"("pagamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutOperacao_chaveOperacao_key" ON "BillingCheckoutOperacao"("chaveOperacao");

-- CreateIndex
CREATE INDEX "BillingCheckoutOperacao_status_criadoEm_idx" ON "BillingCheckoutOperacao"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "BillingCheckoutOperacao_usuarioId_criadoEm_idx" ON "BillingCheckoutOperacao"("usuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutOperacao_usuarioId_chaveCliente_key" ON "BillingCheckoutOperacao"("usuarioId", "chaveCliente");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPendenciaEvento_pagamentoId_key" ON "BillingPendenciaEvento"("pagamentoId");

-- CreateIndex
CREATE INDEX "BillingPendenciaEvento_status_criadoEm_idx" ON "BillingPendenciaEvento"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "BillingPendenciaEvento_eventoId_idx" ON "BillingPendenciaEvento"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCompensacaoEvento_pagamentoId_key" ON "BillingCompensacaoEvento"("pagamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCompensacaoEvento_pendenciaId_key" ON "BillingCompensacaoEvento"("pendenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCompensacaoEvento_chaveIdempotencia_key" ON "BillingCompensacaoEvento"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "BillingCompensacaoEvento_status_criadoEm_idx" ON "BillingCompensacaoEvento"("status", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCompensacaoTentativa_estornoProviderRef_key" ON "BillingCompensacaoTentativa"("estornoProviderRef");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCompensacaoTentativa_chaveIdempotenciaOperacao_key" ON "BillingCompensacaoTentativa"("chaveIdempotenciaOperacao");

-- CreateIndex
CREATE INDEX "BillingCompensacaoTentativa_status_iniciadoEm_idx" ON "BillingCompensacaoTentativa"("status", "iniciadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCompensacaoTentativa_compensacaoId_numero_key" ON "BillingCompensacaoTentativa"("compensacaoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCompensacaoTentativa_id_compensacaoId_key" ON "BillingCompensacaoTentativa"("id", "compensacaoId");

-- CreateIndex
CREATE INDEX "BillingCompensacaoConsultaRecuperacao_compensacaoId_consult_idx" ON "BillingCompensacaoConsultaRecuperacao"("compensacaoId", "consultadoEm");

-- CreateIndex
CREATE INDEX "BillingCompensacaoConsultaRecuperacao_tentativaId_idx" ON "BillingCompensacaoConsultaRecuperacao"("tentativaId");

-- AddForeignKey
ALTER TABLE "PagamentoBeneficio" ADD CONSTRAINT "PagamentoBeneficio_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoBeneficio" ADD CONSTRAINT "PagamentoBeneficio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutOperacao" ADD CONSTRAINT "BillingCheckoutOperacao_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPendenciaEvento" ADD CONSTRAINT "BillingPendenciaEvento_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCompensacaoEvento" ADD CONSTRAINT "BillingCompensacaoEvento_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCompensacaoEvento" ADD CONSTRAINT "BillingCompensacaoEvento_pendenciaId_fkey" FOREIGN KEY ("pendenciaId") REFERENCES "BillingPendenciaEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCompensacaoTentativa" ADD CONSTRAINT "BillingCompensacaoTentativa_compensacaoId_fkey" FOREIGN KEY ("compensacaoId") REFERENCES "BillingCompensacaoEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCompensacaoConsultaRecuperacao" ADD CONSTRAINT "BillingCompensacaoConsultaRecuperacao_compensacaoId_fkey" FOREIGN KEY ("compensacaoId") REFERENCES "BillingCompensacaoEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCompensacaoConsultaRecuperacao" ADD CONSTRAINT "BillingCompensacaoConsultaRecuperacao_tentativaId_compensa_fkey" FOREIGN KEY ("tentativaId", "compensacaoId") REFERENCES "BillingCompensacaoTentativa"("id", "compensacaoId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;