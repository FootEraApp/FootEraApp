/*
  Warnings:

  - A unique constraint covering the columns `[agrupamentoKey]` on the table `Notificacao` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN     "agrupamentoKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_agrupamentoKey_key" ON "Notificacao"("agrupamentoKey");
