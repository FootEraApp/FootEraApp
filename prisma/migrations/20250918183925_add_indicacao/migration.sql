-- CreateEnum
CREATE TYPE "public"."IndicacaoStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateTable
CREATE TABLE "public"."Indicacao" (
    "id" TEXT NOT NULL,
    "olheiroId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "clubeId" TEXT NOT NULL,
    "status" "public"."IndicacaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Indicacao_olheiroId_status_idx" ON "public"."Indicacao"("olheiroId", "status");

-- CreateIndex
CREATE INDEX "Indicacao_clubeId_idx" ON "public"."Indicacao"("clubeId");

-- CreateIndex
CREATE INDEX "Indicacao_atletaId_idx" ON "public"."Indicacao"("atletaId");

-- AddForeignKey
ALTER TABLE "public"."Indicacao" ADD CONSTRAINT "Indicacao_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "public"."Olheiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Indicacao" ADD CONSTRAINT "Indicacao_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Indicacao" ADD CONSTRAINT "Indicacao_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
