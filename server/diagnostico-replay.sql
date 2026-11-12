-- CreateEnum
CREATE TYPE "BillingAutorizacaoEstornoStatus" AS ENUM ('PENDENTE', 'APROVADA', 'CONSUMIDA', 'REVOGADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "StatusCorrecaoNascimento" AS ENUM ('PENDENTE_VERIFICACAO', 'EM_ANALISE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "StatusSegurancaDocumentoNascimento" AS ENUM ('PENDENTE', 'EM_ANALISE', 'SEGURO', 'AMEACA_DETECTADA', 'FALHA_ANALISE');

-- CreateEnum
CREATE TYPE "CupomAniversarioStatus" AS ENUM ('RESERVADO', 'CONSUMIDO', 'LIBERADO', 'CONCILIACAO_PENDENTE');

-- CreateEnum
CREATE TYPE "EventoPagamentoStatus" AS ENUM ('RECEBIDO', 'PROCESSANDO', 'CONCLUIDO', 'FALHOU');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_SOLICITACAO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_VINCULO';

-- AlterEnum
ALTER TYPE "TipoMensagem" ADD VALUE 'AUDIO';

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
ALTER TABLE "MembroGrupo" ADD COLUMN     "ultimaLeituraEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN     "audioDuracaoMs" INTEGER,
ADD COLUMN     "audioKey" TEXT,
ADD COLUMN     "audioMime" TEXT,
ADD COLUMN     "audioTamanhoBytes" INTEGER;

-- AlterTable
ALTER TABLE "MensagemGrupo" ADD COLUMN     "audioDuracaoMs" INTEGER,
ADD COLUMN     "audioKey" TEXT,
ADD COLUMN     "audioMime" TEXT,
ADD COLUMN     "audioTamanhoBytes" INTEGER;

-- AlterTable
ALTER TABLE "Metodologia" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MetodologiaAvulsa" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN     "agrupamentoKey" TEXT;

-- AlterTable
ALTER TABLE "Postagem" ADD COLUMN     "autorContextoKey" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubmissaoTreino" ADD COLUMN     "estatisticasProcessadasEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "aniversarioElegivelApartirDe" TIMESTAMP(3);

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
CREATE TABLE "DocumentoCorrecaoNascimento" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusSeguranca" "StatusSegurancaDocumentoNascimento" NOT NULL DEFAULT 'PENDENTE',
    "analisadoEm" TIMESTAMP(3),
    "scannerRef" TEXT,
    "scannerReservadoPor" TEXT,
    "scannerReservadoAte" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "DocumentoCorrecaoNascimento_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "ExclusaoDocumentoNascimentoPendente" (
    "id" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservadoPor" TEXT,
    "reservadoAte" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExclusaoDocumentoNascimentoPendente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusaoAudioMensagemPendente" (
    "id" TEXT NOT NULL,
    "audioKey" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoErro" TEXT,
    "reservadoPor" TEXT,
    "reservadoAte" TIMESTAMP(3),

    CONSTRAINT "ExclusaoAudioMensagemPendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreinoRealizacaoDiaria_atletaId_diaReferencia_idx" ON "TreinoRealizacaoDiaria"("atletaId", "diaReferencia");

-- CreateIndex
CREATE INDEX "TreinoRealizacaoDiaria_realizadoEm_idx" ON "TreinoRealizacaoDiaria"("realizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoRealizacaoDiaria_atletaId_origem_origemId_key" ON "TreinoRealizacaoDiaria"("atletaId", "origem", "origemId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAutorizacaoEstorno_pagamentoId_key" ON "BillingAutorizacaoEstorno"("pagamentoId");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_status_criadoEm_idx" ON "BillingAutorizacaoEstorno"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_solicitanteId_idx" ON "BillingAutorizacaoEstorno"("solicitanteId");

-- CreateIndex
CREATE INDEX "BillingAutorizacaoEstorno_aprovadorId_idx" ON "BillingAutorizacaoEstorno"("aprovadorId");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecaoNascimento_usuarioId_status_idx" ON "SolicitacaoCorrecaoNascimento"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoCorrecaoNascimento_status_criadoEm_idx" ON "SolicitacaoCorrecaoNascimento"("status", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoCorrecaoNascimento_solicitacaoId_key" ON "DocumentoCorrecaoNascimento"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoCorrecaoNascimento_s3Key_key" ON "DocumentoCorrecaoNascimento"("s3Key");

-- CreateIndex
CREATE INDEX "DocumentoCorrecaoNascimento_statusSeguranca_scannerReservad_idx" ON "DocumentoCorrecaoNascimento"("statusSeguranca", "scannerReservadoAte");

-- CreateIndex
CREATE INDEX "DocumentoCorrecaoNascimento_statusSeguranca_criadoEm_idx" ON "DocumentoCorrecaoNascimento"("statusSeguranca", "criadoEm");

-- CreateIndex
CREATE INDEX "DocumentoCorrecaoNascimento_expiraEm_idx" ON "DocumentoCorrecaoNascimento"("expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "CupomAniversarioUso_pagamentoId_key" ON "CupomAniversarioUso"("pagamentoId");

-- CreateIndex
CREATE INDEX "CupomAniversarioUso_status_criadoEm_idx" ON "CupomAniversarioUso"("status", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CupomAniversarioUso_usuarioId_ano_key" ON "CupomAniversarioUso"("usuarioId", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusaoDocumentoNascimentoPendente_s3Key_key" ON "ExclusaoDocumentoNascimentoPendente"("s3Key");

-- CreateIndex
CREATE INDEX "ExclusaoDocumentoNascimentoPendente_proximaTentativaEm_idx" ON "ExclusaoDocumentoNascimentoPendente"("proximaTentativaEm");

-- CreateIndex
CREATE INDEX "ExclusaoDocumentoNascimentoPendente_reservadoAte_idx" ON "ExclusaoDocumentoNascimentoPendente"("reservadoAte");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusaoAudioMensagemPendente_audioKey_key" ON "ExclusaoAudioMensagemPendente"("audioKey");

-- CreateIndex
CREATE INDEX "ExclusaoAudioMensagemPendente_proximaTentativaEm_idx" ON "ExclusaoAudioMensagemPendente"("proximaTentativaEm");

-- CreateIndex
CREATE INDEX "ExclusaoAudioMensagemPendente_reservadoAte_idx" ON "ExclusaoAudioMensagemPendente"("reservadoAte");

-- CreateIndex
CREATE INDEX "Assinatura_contextoKey_idx" ON "Assinatura"("contextoKey");

-- CreateIndex
CREATE INDEX "CreatorVenda_pagamentoId_idx" ON "CreatorVenda"("pagamentoId");

-- CreateIndex
CREATE INDEX "EventoPagamento_status_processandoEm_idx" ON "EventoPagamento"("status", "processandoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_audioKey_key" ON "Mensagem"("audioKey");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemGrupo_audioKey_key" ON "MensagemGrupo"("audioKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_agrupamentoKey_key" ON "Notificacao"("agrupamentoKey");

-- CreateIndex
CREATE INDEX "Postagem_autorContextoKey_idx" ON "Postagem"("autorContextoKey");

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
ALTER TABLE "TreinoRealizacaoDiaria" ADD CONSTRAINT "TreinoRealizacaoDiaria_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAutorizacaoEstorno" ADD CONSTRAINT "BillingAutorizacaoEstorno_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCorrecaoNascimento" ADD CONSTRAINT "SolicitacaoCorrecaoNascimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoCorrecaoNascimento" ADD CONSTRAINT "DocumentoCorrecaoNascimento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCorrecaoNascimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomAniversarioUso" ADD CONSTRAINT "CupomAniversarioUso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVenda" ADD CONSTRAINT "CreatorVenda_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Federacao" ADD CONSTRAINT "Federacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
