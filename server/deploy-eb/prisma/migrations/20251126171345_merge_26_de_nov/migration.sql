/*
  Warnings:

  - Added the required column `periodicidade` to the `Assinatura` table without a default value. This is not possible if the table is not empty.
  - Added the required column `renovaEm` to the `Assinatura` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Assinatura" ADD COLUMN     "lembreteEnviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "periodicidade" TEXT NOT NULL,
ADD COLUMN     "renovaEm" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "startsAt" DROP DEFAULT;
