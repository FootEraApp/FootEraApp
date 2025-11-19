/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,treinoProgramadoId]` on the table `TreinoSalvo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `treinoProgramadoId` to the `TreinoSalvo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `TreinoSalvo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Elenco" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "escala" JSONB,
ADD COLUMN     "turmaId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Midia" ADD COLUMN     "durationSec" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "RelacaoTreinamento" ADD COLUMN     "encerradoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TreinoSalvo" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "treinoProgramadoId" TEXT NOT NULL,
ADD COLUMN     "usuarioId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "descricao" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaOlheiro" (
    "id" TEXT NOT NULL,
    "olheiroId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaOlheiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaOlheiroItem" (
    "id" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListaOlheiroItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "windowKind" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "value" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_acao_createdAt_idx" ON "LogAuditoria"("usuarioId", "acao", "createdAt");

-- CreateIndex
CREATE INDEX "ListaOlheiro_olheiroId_createdAt_idx" ON "ListaOlheiro"("olheiroId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListaOlheiro_olheiroId_nome_key" ON "ListaOlheiro"("olheiroId", "nome");

-- CreateIndex
CREATE INDEX "ListaOlheiroItem_atletaId_idx" ON "ListaOlheiroItem"("atletaId");

-- CreateIndex
CREATE UNIQUE INDEX "ListaOlheiroItem_listaId_atletaId_key" ON "ListaOlheiroItem"("listaId", "atletaId");

-- CreateIndex
CREATE INDEX "UsageCounter_key_windowKind_windowStart_idx" ON "UsageCounter"("key", "windowKind", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_key_windowKind_windowStart_key" ON "UsageCounter"("userId", "key", "windowKind", "windowStart");

-- CreateIndex
CREATE INDEX "Elenco_turmaId_idx" ON "Elenco"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoSalvo_usuarioId_treinoProgramadoId_key" ON "TreinoSalvo"("usuarioId", "treinoProgramadoId");

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elenco" ADD CONSTRAINT "Elenco_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaOlheiro" ADD CONSTRAINT "ListaOlheiro_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "Olheiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaOlheiroItem" ADD CONSTRAINT "ListaOlheiroItem_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "ListaOlheiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaOlheiroItem" ADD CONSTRAINT "ListaOlheiroItem_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
