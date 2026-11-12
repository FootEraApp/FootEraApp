/*
  Warnings:

  - A unique constraint covering the columns `[audioKey]` on the table `Mensagem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[audioKey]` on the table `MensagemGrupo` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[agrupamentoKey]` on the table `Notificacao` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CupomAniversarioStatus" AS ENUM ('RESERVADO', 'CONSUMIDO', 'LIBERADO', 'CONCILIACAO_PENDENTE');

-- AlterEnum
ALTER TYPE "TipoMensagem" ADD VALUE 'AUDIO';

-- AlterTable
ALTER TABLE "ExclusaoDocumentoNascimentoPendente" ADD COLUMN     "reservadoAte" TIMESTAMP(3),
ADD COLUMN     "reservadoPor" TEXT;

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
ALTER TABLE "Notificacao" ADD COLUMN     "agrupamentoKey" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "aniversarioElegivelApartirDe" TIMESTAMP(3);

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
CREATE UNIQUE INDEX "CupomAniversarioUso_pagamentoId_key" ON "CupomAniversarioUso"("pagamentoId");

-- CreateIndex
CREATE INDEX "CupomAniversarioUso_status_criadoEm_idx" ON "CupomAniversarioUso"("status", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CupomAniversarioUso_usuarioId_ano_key" ON "CupomAniversarioUso"("usuarioId", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusaoAudioMensagemPendente_audioKey_key" ON "ExclusaoAudioMensagemPendente"("audioKey");

-- CreateIndex
CREATE INDEX "ExclusaoAudioMensagemPendente_proximaTentativaEm_idx" ON "ExclusaoAudioMensagemPendente"("proximaTentativaEm");

-- CreateIndex
CREATE INDEX "ExclusaoAudioMensagemPendente_reservadoAte_idx" ON "ExclusaoAudioMensagemPendente"("reservadoAte");

-- CreateIndex
CREATE INDEX "ExclusaoDocumentoNascimentoPendente_reservadoAte_idx" ON "ExclusaoDocumentoNascimentoPendente"("reservadoAte");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_audioKey_key" ON "Mensagem"("audioKey");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemGrupo_audioKey_key" ON "MensagemGrupo"("audioKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_agrupamentoKey_key" ON "Notificacao"("agrupamentoKey");

-- AddForeignKey
ALTER TABLE "CupomAniversarioUso" ADD CONSTRAINT "CupomAniversarioUso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
