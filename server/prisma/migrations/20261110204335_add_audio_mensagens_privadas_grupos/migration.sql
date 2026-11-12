/*
  Warnings:

  - A unique constraint covering the columns `[audioKey]` on the table `Mensagem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[audioKey]` on the table `MensagemGrupo` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "TipoMensagem" ADD VALUE 'AUDIO';

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
CREATE UNIQUE INDEX "ExclusaoAudioMensagemPendente_audioKey_key" ON "ExclusaoAudioMensagemPendente"("audioKey");

-- CreateIndex
CREATE INDEX "ExclusaoAudioMensagemPendente_proximaTentativaEm_idx" ON "ExclusaoAudioMensagemPendente"("proximaTentativaEm");

-- CreateIndex
CREATE INDEX "ExclusaoAudioMensagemPendente_reservadoAte_idx" ON "ExclusaoAudioMensagemPendente"("reservadoAte");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_audioKey_key" ON "Mensagem"("audioKey");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemGrupo_audioKey_key" ON "MensagemGrupo"("audioKey");
