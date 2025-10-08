/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,postagemId]` on the table `Curtida` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[usuarioId,submissaoId]` on the table `Curtida` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Comentario" DROP CONSTRAINT "Comentario_postagemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Curtida" DROP CONSTRAINT "Curtida_postagemId_fkey";

-- AlterTable
ALTER TABLE "public"."Comentario" ADD COLUMN     "submissaoId" TEXT,
ALTER COLUMN "postagemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Curtida" ADD COLUMN     "submissaoId" TEXT,
ALTER COLUMN "postagemId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Comentario_postagemId_idx" ON "public"."Comentario"("postagemId");

-- CreateIndex
CREATE INDEX "Comentario_submissaoId_idx" ON "public"."Comentario"("submissaoId");

-- CreateIndex
CREATE INDEX "Curtida_submissaoId_idx" ON "public"."Curtida"("submissaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Curtida_usuarioId_postagemId_key" ON "public"."Curtida"("usuarioId", "postagemId");

-- CreateIndex
CREATE UNIQUE INDEX "Curtida_usuarioId_submissaoId_key" ON "public"."Curtida"("usuarioId", "submissaoId");

-- AddForeignKey
ALTER TABLE "public"."Comentario" ADD CONSTRAINT "Comentario_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "public"."Postagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comentario" ADD CONSTRAINT "Comentario_submissaoId_fkey" FOREIGN KEY ("submissaoId") REFERENCES "public"."SubmissaoDesafio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Curtida" ADD CONSTRAINT "Curtida_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "public"."Postagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Curtida" ADD CONSTRAINT "Curtida_submissaoId_fkey" FOREIGN KEY ("submissaoId") REFERENCES "public"."SubmissaoDesafio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
