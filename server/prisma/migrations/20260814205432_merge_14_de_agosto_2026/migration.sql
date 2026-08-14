-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'COLABORACAO_OLHEIRO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'COLABORACAO_RESPONDIDA';

-- CreateTable
CREATE TABLE "PerfilPontuacaoVisualizacao" (
    "id" TEXT NOT NULL,
    "viewerUsuarioId" TEXT NOT NULL,
    "perfilUsuarioId" TEXT NOT NULL,
    "ultimaPontuacaoVista" INTEGER NOT NULL DEFAULT 0,
    "visualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilPontuacaoVisualizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoColaboracaoOlheiro" (
    "id" TEXT NOT NULL,
    "olheiroId" TEXT NOT NULL,
    "olheiroUsuarioId" TEXT NOT NULL,
    "destinoTipo" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "destinoUsuarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "notificacaoId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaEm" TIMESTAMP(3),

    CONSTRAINT "SolicitacaoColaboracaoOlheiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerfilPontuacaoVisualizacao_viewerUsuarioId_idx" ON "PerfilPontuacaoVisualizacao"("viewerUsuarioId");

-- CreateIndex
CREATE INDEX "PerfilPontuacaoVisualizacao_perfilUsuarioId_idx" ON "PerfilPontuacaoVisualizacao"("perfilUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilPontuacaoVisualizacao_viewerUsuarioId_perfilUsuarioId_key" ON "PerfilPontuacaoVisualizacao"("viewerUsuarioId", "perfilUsuarioId");

-- CreateIndex
CREATE INDEX "SolicitacaoColaboracaoOlheiro_olheiroId_status_idx" ON "SolicitacaoColaboracaoOlheiro"("olheiroId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoColaboracaoOlheiro_destinoUsuarioId_status_idx" ON "SolicitacaoColaboracaoOlheiro"("destinoUsuarioId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoColaboracaoOlheiro_notificacaoId_idx" ON "SolicitacaoColaboracaoOlheiro"("notificacaoId");

-- AddForeignKey
ALTER TABLE "PerfilPontuacaoVisualizacao" ADD CONSTRAINT "PerfilPontuacaoVisualizacao_viewerUsuarioId_fkey" FOREIGN KEY ("viewerUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilPontuacaoVisualizacao" ADD CONSTRAINT "PerfilPontuacaoVisualizacao_perfilUsuarioId_fkey" FOREIGN KEY ("perfilUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
