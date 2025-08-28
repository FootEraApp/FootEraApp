/*
  Warnings:

  - The values [Fisico] on the enum `TipoTreino` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Atleta` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[desafioEmGrupoId,usuarioId]` on the table `SubmissaoDesafioEmGrupo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `criadoPorId` to the `DesafioEmGrupo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TipoMensagem" ADD VALUE 'GRUPO_DESAFIO';
ALTER TYPE "public"."TipoMensagem" ADD VALUE 'GRUPO_DESAFIO_BONUS';
ALTER TYPE "public"."TipoMensagem" ADD VALUE 'CARD';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TipoTreino_new" AS ENUM ('Tecnico', 'Físico', 'Tatico', 'Mental');
ALTER TABLE "public"."TreinoProgramado" ALTER COLUMN "tipoTreino" TYPE "public"."TipoTreino_new" USING ("tipoTreino"::text::"public"."TipoTreino_new");
ALTER TABLE "public"."SubmissaoTreino" ALTER COLUMN "tipoTreinoSnapshot" TYPE "public"."TipoTreino_new" USING ("tipoTreinoSnapshot"::text::"public"."TipoTreino_new");
ALTER TYPE "public"."TipoTreino" RENAME TO "TipoTreino_old";
ALTER TYPE "public"."TipoTreino_new" RENAME TO "TipoTreino";
DROP TYPE "public"."TipoTreino_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."DesafioEmGrupo" ADD COLUMN     "bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bonusDado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "criadoPorId" TEXT NOT NULL,
ADD COLUMN     "pontosSnapshot" INTEGER;

-- AlterTable
ALTER TABLE "public"."MensagemGrupo" ADD COLUMN     "conteudoJson" JSONB,
ADD COLUMN     "desafioEmGrupoId" TEXT;

-- AlterTable
ALTER TABLE "public"."SubmissaoDesafioEmGrupo" ADD COLUMN     "dentroDoPrazo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."FavoritoUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "favoritoUsuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoritoUsuario_usuarioId_idx" ON "public"."FavoritoUsuario"("usuarioId");

-- CreateIndex
CREATE INDEX "FavoritoUsuario_favoritoUsuarioId_idx" ON "public"."FavoritoUsuario"("favoritoUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritoUsuario_usuarioId_favoritoUsuarioId_key" ON "public"."FavoritoUsuario"("usuarioId", "favoritoUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Atleta_email_key" ON "public"."Atleta"("email");

-- CreateIndex
CREATE INDEX "DesafioEmGrupo_grupoId_idx" ON "public"."DesafioEmGrupo"("grupoId");

-- CreateIndex
CREATE INDEX "DesafioEmGrupo_desafioOficialId_idx" ON "public"."DesafioEmGrupo"("desafioOficialId");

-- CreateIndex
CREATE INDEX "DesafioEmGrupo_criadoPorId_idx" ON "public"."DesafioEmGrupo"("criadoPorId");

-- CreateIndex
CREATE INDEX "MensagemGrupo_desafioEmGrupoId_idx" ON "public"."MensagemGrupo"("desafioEmGrupoId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoDesafioEmGrupo_desafioEmGrupoId_usuarioId_key" ON "public"."SubmissaoDesafioEmGrupo"("desafioEmGrupoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "public"."MensagemGrupo" ADD CONSTRAINT "MensagemGrupo_desafioEmGrupoId_fkey" FOREIGN KEY ("desafioEmGrupoId") REFERENCES "public"."DesafioEmGrupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesafioEmGrupo" ADD CONSTRAINT "DesafioEmGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "public"."Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesafioEmGrupo" ADD CONSTRAINT "DesafioEmGrupo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FavoritoUsuario" ADD CONSTRAINT "FavoritoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FavoritoUsuario" ADD CONSTRAINT "FavoritoUsuario_favoritoUsuarioId_fkey" FOREIGN KEY ("favoritoUsuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
