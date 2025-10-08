-- CreateEnum
CREATE TYPE "public"."OrigemFormador" AS ENUM ('Escolinha', 'Clube');

-- CreateTable
CREATE TABLE "public"."VinculoFormacao" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "origem" "public"."OrigemFormador" NOT NULL,
    "origemId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "documentos" TEXT[],
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VinculoFormacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferenciaFormador" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "deClubeId" TEXT,
    "paraClubeId" TEXT,
    "data" TIMESTAMP(3),
    "valorTransferencia" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "gerouSolidariedade" BOOLEAN NOT NULL DEFAULT false,
    "valorSolidariedade" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferenciaFormador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BadgeFormador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "icon" TEXT,
    "iconUrl" TEXT,
    "conquistadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeFormador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentoFormador" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "descricao" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vinculoFormacaoId" TEXT,

    CONSTRAINT "DocumentoFormador_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."VinculoFormacao" ADD CONSTRAINT "VinculoFormacao_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferenciaFormador" ADD CONSTRAINT "TransferenciaFormador_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentoFormador" ADD CONSTRAINT "DocumentoFormador_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentoFormador" ADD CONSTRAINT "DocumentoFormador_vinculoFormacaoId_fkey" FOREIGN KEY ("vinculoFormacaoId") REFERENCES "public"."VinculoFormacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
