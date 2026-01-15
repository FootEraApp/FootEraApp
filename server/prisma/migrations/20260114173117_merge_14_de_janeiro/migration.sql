/*
  Warnings:

  - A unique constraint covering the columns `[seguidorUsuarioId,seguidoUsuarioId]` on the table `Seguidor` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotificacaoTipo" AS ENUM ('GENERICA', 'FOLLOW', 'FOLLOW_BACK', 'FOLLOW_REMOVED');

-- CreateEnum
CREATE TYPE "ConquistaOwnerTipo" AS ENUM ('Atleta', 'Professor', 'Clube', 'Escolinha');

-- CreateEnum
CREATE TYPE "ConquistaTipo" AS ENUM ('GERAL', 'TREINO', 'DESAFIO', 'SOCIAL', 'PERFIL', 'ORGANIZACAO');

-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "tipo" "NotificacaoTipo" NOT NULL DEFAULT 'GENERICA';

-- CreateTable
CREATE TABLE "Conquista" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "ConquistaTipo" NOT NULL DEFAULT 'GERAL',
    "publico" "ConquistaOwnerTipo"[] DEFAULT ARRAY['Atleta']::"ConquistaOwnerTipo"[],
    "icon" TEXT,
    "iconUrl" TEXT,
    "pontos" INTEGER DEFAULT 0,
    "meta" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conquista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConquistaVinculo" (
    "id" TEXT NOT NULL,
    "conquistaId" TEXT NOT NULL,
    "ownerTipo" "ConquistaOwnerTipo" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "atletaId" TEXT,
    "professorId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "conquistadoEm" TIMESTAMP(3),
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "refTipo" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConquistaVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conquista_codigo_key" ON "Conquista"("codigo");

-- CreateIndex
CREATE INDEX "Conquista_tipo_idx" ON "Conquista"("tipo");

-- CreateIndex
CREATE INDEX "Conquista_ativo_idx" ON "Conquista"("ativo");

-- CreateIndex
CREATE INDEX "ConquistaVinculo_ownerTipo_ownerId_idx" ON "ConquistaVinculo"("ownerTipo", "ownerId");

-- CreateIndex
CREATE INDEX "ConquistaVinculo_atletaId_idx" ON "ConquistaVinculo"("atletaId");

-- CreateIndex
CREATE INDEX "ConquistaVinculo_professorId_idx" ON "ConquistaVinculo"("professorId");

-- CreateIndex
CREATE INDEX "ConquistaVinculo_clubeId_idx" ON "ConquistaVinculo"("clubeId");

-- CreateIndex
CREATE INDEX "ConquistaVinculo_escolinhaId_idx" ON "ConquistaVinculo"("escolinhaId");

-- CreateIndex
CREATE INDEX "ConquistaVinculo_concluida_conquistadoEm_idx" ON "ConquistaVinculo"("concluida", "conquistadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ConquistaVinculo_ownerTipo_ownerId_conquistaId_key" ON "ConquistaVinculo"("ownerTipo", "ownerId", "conquistaId");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_createdAt_idx" ON "Notificacao"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "Notificacao_actorId_idx" ON "Notificacao"("actorId");

-- CreateIndex
CREATE INDEX "Seguidor_seguidoUsuarioId_idx" ON "Seguidor"("seguidoUsuarioId");

-- CreateIndex
CREATE INDEX "Seguidor_seguidorUsuarioId_idx" ON "Seguidor"("seguidorUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Seguidor_seguidorUsuarioId_seguidoUsuarioId_key" ON "Seguidor"("seguidorUsuarioId", "seguidoUsuarioId");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_conquistaId_fkey" FOREIGN KEY ("conquistaId") REFERENCES "Conquista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaVinculo" ADD CONSTRAINT "ConquistaVinculo_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
