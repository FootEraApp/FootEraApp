-- CreateEnum
CREATE TYPE "MetodologiaAssinaturaOrigem" AS ENUM ('LEARNING', 'AVULSA');

-- AlterTable
ALTER TABLE "AtividadeRecente" ADD COLUMN     "link" TEXT,
ADD COLUMN     "titulo" TEXT;

-- AlterTable
ALTER TABLE "MetodologiaAssinante" ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "origem" "MetodologiaAssinaturaOrigem" NOT NULL DEFAULT 'LEARNING';
