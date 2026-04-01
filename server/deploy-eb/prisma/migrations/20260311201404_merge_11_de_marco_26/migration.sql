/*
  Warnings:


*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'EVENTO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'BILLING_WARNING';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'BILLING_BLOCKED';

-- DropIndex
DROP INDEX "public"."ExercicioPersonalizado_criadorUsuarioId_nome_key";

