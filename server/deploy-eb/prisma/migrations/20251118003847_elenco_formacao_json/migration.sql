-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PosicaoCampo" ADD VALUE 'ZC';
ALTER TYPE "PosicaoCampo" ADD VALUE 'ALA_D';
ALTER TYPE "PosicaoCampo" ADD VALUE 'ALA_E';
ALTER TYPE "PosicaoCampo" ADD VALUE 'MC1';
ALTER TYPE "PosicaoCampo" ADD VALUE 'MC2';
ALTER TYPE "PosicaoCampo" ADD VALUE 'MEI_D';
ALTER TYPE "PosicaoCampo" ADD VALUE 'MEI_E';
ALTER TYPE "PosicaoCampo" ADD VALUE 'MD';
ALTER TYPE "PosicaoCampo" ADD VALUE 'ME';
ALTER TYPE "PosicaoCampo" ADD VALUE 'SA';

-- AlterTable
ALTER TABLE "Elenco" ADD COLUMN     "formacao" JSONB;
