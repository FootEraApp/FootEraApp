-- AlterTable
ALTER TABLE "public"."SubmissaoDesafio" ADD COLUMN     "conteudo" JSONB,
ADD COLUMN     "resultado" DOUBLE PRECISION,
ADD COLUMN     "resultadoDeclarado" DOUBLE PRECISION,
ADD COLUMN     "tempoMs" INTEGER,
ADD COLUMN     "unidadeResultado" TEXT;
