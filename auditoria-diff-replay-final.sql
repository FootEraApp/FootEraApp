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

-- CreateEnum
CREATE TYPE "EventoPagamentoStatus" AS ENUM ('RECEBIDO', 'PROCESSANDO', 'CONCLUIDO', 'FALHOU');

-- CreateEnum
CREATE TYPE "LearningFavoritoTipo" AS ENUM ('METODOLOGIA', 'METODOLOGIA_AVULSA', 'AULA_AO_VIVO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'CONVOCACAO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'COLABORACAO_OLHEIRO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'COLABORACAO_RESPONDIDA';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_SOLICITACAO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_VINCULO';

-- AlterEnum
ALTER TYPE "TipoUsuario" ADD VALUE 'Responsavel';

-- DropForeignKey
ALTER TABLE "Clube" DROP CONSTRAINT "Clube_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Creator" DROP CONSTRAINT "Creator_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Escolinha" DROP CONSTRAINT "Escolinha_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Federacao" DROP CONSTRAINT "Federacao_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Marca" DROP CONSTRAINT "Marca_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Metodologia" DROP CONSTRAINT "Metodologia_criadorUsuarioId_fkey";

-- DropForeignKey
ALTER TABLE "MetodologiaAvulsa" DROP CONSTRAINT "MetodologiaAvulsa_criadorUsuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Postagem" DROP CONSTRAINT "Postagem_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Assinatura" ALTER COLUMN "contextoKey" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Clube" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Creator" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CreatorVenda" ADD COLUMN     "pagamentoId" TEXT;

-- AlterTable
ALTER TABLE "EventoPagamento" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "concluidoEm" TIMESTAMP(3),
ADD COLUMN     "processandoEm" TIMESTAMP(3),
ADD COLUMN     "status" "EventoPagamentoStatus" NOT NULL DEFAULT 'RECEBIDO',
ADD COLUMN     "tentativas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoErro" TEXT;

-- AlterTable
ALTER TABLE "Federacao" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Marca" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Metodologia" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MetodologiaAvulsa" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Postagem" ADD COLUMN     "autorContextoKey" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "destaque" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PerfilPontuacaoVisualizacao" (
    "id" TEXT NOT NULL,
    "viewerUsuarioId" TEXT NOT NULL,
    "perfilUsuarioId" TEXT NOT NULL,
    "ultimaPontuacaoVista" INTEGER NOT NULL DEFAULT 0,
    "visualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilPontuacaoVisualizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoColaboracaoOlheiro" (
    "id" TEXT NOT NULL,
    "olheiroId" TEXT NOT NULL,
    "olheiroUsuarioId" TEXT NOT NULL,
    "destinoTipo" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "destinoUsuarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "notificacaoId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaEm" TIMESTAMP(3),

    CONSTRAINT "SolicitacaoColaboracaoOlheiro_pkey" PRIMARY KEY ("id")
);

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
    "postAutorizacaoConsumidaEm" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "LearningFavorito" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "LearningFavoritoTipo" NOT NULL,
    "alvoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningFavorito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoFavorito" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoFavorito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LembreteNotificacaoEnviado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "janela" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LembreteNotificacaoEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDeviceToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerfilPontuacaoVisualizacao_viewerUsuarioId_idx" ON "PerfilPontuacaoVisualizacao"("viewerUsuarioId");

-- CreateIndex
CREATE INDEX "PerfilPontuacaoVisualizacao_perfilUsuarioId_idx" ON "PerfilPontuacaoVisualizacao"("perfilUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilPontuacaoVisualizacao_viewerUsuarioId_perfilUsuarioId_key" ON "PerfilPontuacaoVisualizacao"("viewerUsuarioId", "perfilUsuarioId");

-- CreateIndex
CREATE INDEX "SolicitacaoColaboracaoOlheiro_olheiroId_status_idx" ON "SolicitacaoColaboracaoOlheiro"("olheiroId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoColaboracaoOlheiro_destinoUsuarioId_status_idx" ON "SolicitacaoColaboracaoOlheiro"("destinoUsuarioId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoColaboracaoOlheiro_notificacaoId_idx" ON "SolicitacaoColaboracaoOlheiro"("notificacaoId");

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

-- CreateIndex
CREATE INDEX "LearningFavorito_usuarioId_idx" ON "LearningFavorito"("usuarioId");

-- CreateIndex
CREATE INDEX "LearningFavorito_tipo_alvoId_idx" ON "LearningFavorito"("tipo", "alvoId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningFavorito_usuarioId_tipo_alvoId_key" ON "LearningFavorito"("usuarioId", "tipo", "alvoId");

-- CreateIndex
CREATE INDEX "TreinoFavorito_usuarioId_idx" ON "TreinoFavorito"("usuarioId");

-- CreateIndex
CREATE INDEX "TreinoFavorito_treinoProgramadoId_idx" ON "TreinoFavorito"("treinoProgramadoId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoFavorito_usuarioId_treinoProgramadoId_key" ON "TreinoFavorito"("usuarioId", "treinoProgramadoId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_usuarioId_idx" ON "PushSubscription"("usuarioId");

-- CreateIndex
CREATE INDEX "LembreteNotificacaoEnviado_usuarioId_idx" ON "LembreteNotificacaoEnviado"("usuarioId");

-- CreateIndex
CREATE INDEX "LembreteNotificacaoEnviado_tipo_alvoId_idx" ON "LembreteNotificacaoEnviado"("tipo", "alvoId");

-- CreateIndex
CREATE INDEX "LembreteNotificacaoEnviado_criadoEm_idx" ON "LembreteNotificacaoEnviado"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "LembreteNotificacaoEnviado_usuarioId_tipo_alvoId_janela_key" ON "LembreteNotificacaoEnviado"("usuarioId", "tipo", "alvoId", "janela");

-- CreateIndex
CREATE UNIQUE INDEX "PushDeviceToken_token_key" ON "PushDeviceToken"("token");

-- CreateIndex
CREATE INDEX "PushDeviceToken_usuarioId_idx" ON "PushDeviceToken"("usuarioId");

-- CreateIndex
CREATE INDEX "Assinatura_contextoKey_idx" ON "Assinatura"("contextoKey");

-- CreateIndex
CREATE INDEX "CreatorVenda_pagamentoId_idx" ON "CreatorVenda"("pagamentoId");

-- CreateIndex
CREATE INDEX "EventoPagamento_status_processandoEm_idx" ON "EventoPagamento"("status", "processandoEm");

-- CreateIndex
CREATE INDEX "Postagem_autorContextoKey_idx" ON "Postagem"("autorContextoKey");

-- AddForeignKey
ALTER TABLE "PerfilPontuacaoVisualizacao" ADD CONSTRAINT "PerfilPontuacaoVisualizacao_viewerUsuarioId_fkey" FOREIGN KEY ("viewerUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilPontuacaoVisualizacao" ADD CONSTRAINT "PerfilPontuacaoVisualizacao_perfilUsuarioId_fkey" FOREIGN KEY ("perfilUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clube" ADD CONSTRAINT "Clube_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVenda" ADD CONSTRAINT "CreatorVenda_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Federacao" ADD CONSTRAINT "Federacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningFavorito" ADD CONSTRAINT "LearningFavorito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoFavorito" ADD CONSTRAINT "TreinoFavorito_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoFavorito" ADD CONSTRAINT "TreinoFavorito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LembreteNotificacaoEnviado" ADD CONSTRAINT "LembreteNotificacaoEnviado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDeviceToken" ADD CONSTRAINT "PushDeviceToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
