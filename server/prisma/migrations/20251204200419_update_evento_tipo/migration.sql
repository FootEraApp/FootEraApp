-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventoTipo" ADD VALUE 'TORNEIO';
ALTER TYPE "EventoTipo" ADD VALUE 'COPA';
ALTER TYPE "EventoTipo" ADD VALUE 'LIGA';
ALTER TYPE "EventoTipo" ADD VALUE 'AMISTOSO';
ALTER TYPE "EventoTipo" ADD VALUE 'TREINO_ABERTO';
ALTER TYPE "EventoTipo" ADD VALUE 'CAMP';
ALTER TYPE "EventoTipo" ADD VALUE 'CLINICA';
ALTER TYPE "EventoTipo" ADD VALUE 'SHOWCASE';
ALTER TYPE "EventoTipo" ADD VALUE 'WORKSHOP';
ALTER TYPE "EventoTipo" ADD VALUE 'PALESTRA';
