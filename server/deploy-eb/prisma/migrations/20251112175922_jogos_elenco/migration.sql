-- CreateEnum
CREATE TYPE "EventoChaveTipo" AS ENUM ('MATA_MATA');

-- CreateEnum
CREATE TYPE "JogoStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'ENCERRADO');

-- CreateTable
CREATE TABLE "EventoElenco" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "EventoChaveTipo" NOT NULL DEFAULT 'MATA_MATA',
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "participantes" TEXT[],
    "ownerTipo" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoElenco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartidaElenco" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "fase" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "elencoAId" TEXT,
    "elencoBId" TEXT,
    "placarA" INTEGER NOT NULL DEFAULT 0,
    "placarB" INTEGER NOT NULL DEFAULT 0,
    "faltasA" INTEGER NOT NULL DEFAULT 0,
    "faltasB" INTEGER NOT NULL DEFAULT 0,
    "status" "JogoStatus" NOT NULL DEFAULT 'PENDENTE',
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "vencedorElencoId" TEXT,
    "proximaPartidaId" TEXT,
    "proximaPartidaSlot" TEXT,

    CONSTRAINT "PartidaElenco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartidaElenco_eventoId_fase_idx" ON "PartidaElenco"("eventoId", "fase");

-- CreateIndex
CREATE INDEX "PartidaElenco_proximaPartidaId_idx" ON "PartidaElenco"("proximaPartidaId");

-- AddForeignKey
ALTER TABLE "PartidaElenco" ADD CONSTRAINT "PartidaElenco_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoElenco"("id") ON DELETE CASCADE ON UPDATE CASCADE;
