-- CreateEnum
CREATE TYPE "MetodologiaPublicoAlvo" AS ENUM ('ATLETAS', 'PROFISSIONAIS', 'AMBOS');

-- AlterEnum
ALTER TYPE "AssinaturaStatus" ADD VALUE 'SEM_ASSINATURA';

-- AlterTable
ALTER TABLE "Metodologia" ADD COLUMN     "publicoAlvo" "MetodologiaPublicoAlvo" NOT NULL DEFAULT 'AMBOS';

-- CreateTable
CREATE TABLE "MetodologiaTreino" (
    "id" TEXT NOT NULL,
    "metodologiaId" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetodologiaTreino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetodologiaTreino_metodologiaId_idx" ON "MetodologiaTreino"("metodologiaId");

-- CreateIndex
CREATE INDEX "MetodologiaTreino_treinoProgramadoId_idx" ON "MetodologiaTreino"("treinoProgramadoId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaTreino_metodologiaId_treinoProgramadoId_key" ON "MetodologiaTreino"("metodologiaId", "treinoProgramadoId");

-- AddForeignKey
ALTER TABLE "MetodologiaTreino" ADD CONSTRAINT "MetodologiaTreino_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaTreino" ADD CONSTRAINT "MetodologiaTreino_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
