-- CreateEnum
CREATE TYPE "SentimentoAvaliacao" AS ENUM ('ruim', 'medio', 'otimo');

-- DropIndex
DROP INDEX "public"."VinculoFormacao_atletaId_origem_origemId_key";

-- AlterTable
ALTER TABLE "AvaliacaoMetodologia" ADD COLUMN     "sentimento" "SentimentoAvaliacao";

-- AlterTable
ALTER TABLE "AvaliacaoTreino" ADD COLUMN     "sentimento" "SentimentoAvaliacao";

-- AlterTable
ALTER TABLE "VinculoFormacao" ALTER COLUMN "documentos" DROP DEFAULT;
