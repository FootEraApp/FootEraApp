-- CreateEnum
CREATE TYPE "StatusResponsavelAtleta" AS ENUM ('PENDENTE', 'ATIVO', 'REVOGADO');

-- CreateEnum
CREATE TYPE "OrigemSolicitacaoResponsavel" AS ENUM ('ATLETA', 'RESPONSAVEL', 'CADASTRO_MENOR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_SOLICITACAO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_VINCULO';

-- AlterEnum
ALTER TYPE "TipoUsuario" ADD VALUE 'Responsavel';

-- DropForeignKey
ALTER TABLE "Clube" DROP CONSTRAINT "Clube_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Creator" DROP CONSTRAINT "Creator_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Escolinha" DROP CONSTRAINT "Escolinha_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Federacao" DROP CONSTRAINT "Federacao_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Marca" DROP CONSTRAINT "Marca_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Metodologia" DROP CONSTRAINT "Metodologia_criadorUsuarioId_fkey";

-- DropForeignKey
ALTER TABLE "MetodologiaAvulsa" DROP CONSTRAINT "MetodologiaAvulsa_criadorUsuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Postagem" DROP CONSTRAINT "Postagem_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Assinatura" ALTER COLUMN "contextoKey" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Clube" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "organizacaoId" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Federacao" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Marca" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Metodologia" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MetodologiaAvulsa" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Postagem" ADD COLUMN     "autorContextoKey" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ResponsavelAtleta" (
    "id" TEXT NOT NULL,
    "responsavelUsuarioId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "status" "StatusResponsavelAtleta" NOT NULL DEFAULT 'ATIVO',
    "origemSolicitacao" "OrigemSolicitacaoResponsavel",
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "podeEditarPerfil" BOOLEAN NOT NULL DEFAULT true,
    "podeGerenciarPrivacidade" BOOLEAN NOT NULL DEFAULT true,
    "podeGerenciarTreinos" BOOLEAN NOT NULL DEFAULT true,
    "podeGerenciarConteudo" BOOLEAN NOT NULL DEFAULT true,
    "permitirPerfilPublico" BOOLEAN NOT NULL DEFAULT false,
    "permitirMensagensDiretas" BOOLEAN NOT NULL DEFAULT false,
    "permitirMostrarEmail" BOOLEAN NOT NULL DEFAULT false,
    "parentesco" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "confirmadoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "ResponsavelAtleta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResponsavelAtleta_responsavelUsuarioId_status_idx" ON "ResponsavelAtleta"("responsavelUsuarioId", "status");

-- CreateIndex
CREATE INDEX "ResponsavelAtleta_atletaId_status_idx" ON "ResponsavelAtleta"("atletaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsavelAtleta_responsavelUsuarioId_atletaId_key" ON "ResponsavelAtleta"("responsavelUsuarioId", "atletaId");

-- CreateIndex
CREATE INDEX "Assinatura_contextoKey_idx" ON "Assinatura"("contextoKey");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_organizacaoId_key" ON "Creator"("organizacaoId");

-- CreateIndex
CREATE INDEX "Postagem_autorContextoKey_idx" ON "Postagem"("autorContextoKey");

-- AddForeignKey
ALTER TABLE "ResponsavelAtleta" ADD CONSTRAINT "ResponsavelAtleta_responsavelUsuarioId_fkey" FOREIGN KEY ("responsavelUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsavelAtleta" ADD CONSTRAINT "ResponsavelAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clube" ADD CONSTRAINT "Clube_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Federacao" ADD CONSTRAINT "Federacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
