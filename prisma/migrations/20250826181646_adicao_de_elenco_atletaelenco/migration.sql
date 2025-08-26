-- CreateEnum
CREATE TYPE "PosicaoCampo" AS ENUM ('GOL', 'LD', 'ZD', 'ZE', 'LE', 'VOL1', 'VOL2', 'MEI', 'PD', 'CA', 'PE');

-- CreateTable
CREATE TABLE "Elenco" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "professorId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "atletasIds" TEXT[],
    "maxJogadores" INTEGER NOT NULL DEFAULT 11,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Elenco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtletaElenco" (
    "id" TEXT NOT NULL,
    "elencoId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "posicao" "PosicaoCampo" NOT NULL,
    "numeroCamisa" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtletaElenco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtletaElenco_atletaId_idx" ON "AtletaElenco"("atletaId");

-- CreateIndex
CREATE UNIQUE INDEX "AtletaElenco_elencoId_posicao_key" ON "AtletaElenco"("elencoId", "posicao");

-- CreateIndex
CREATE UNIQUE INDEX "AtletaElenco_elencoId_atletaId_key" ON "AtletaElenco"("elencoId", "atletaId");

-- AddForeignKey
ALTER TABLE "AtletaElenco" ADD CONSTRAINT "AtletaElenco_elencoId_fkey" FOREIGN KEY ("elencoId") REFERENCES "Elenco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtletaElenco" ADD CONSTRAINT "AtletaElenco_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
