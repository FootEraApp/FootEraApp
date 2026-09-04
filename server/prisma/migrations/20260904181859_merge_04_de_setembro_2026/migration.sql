-- CreateEnum
CREATE TYPE "VisibilidadePostagem" AS ENUM ('PUBLICO', 'LOGADO', 'SEGUIDORES', 'PRIVADO');

-- AlterTable
ALTER TABLE "Postagem" ADD COLUMN     "visibilidade" "VisibilidadePostagem" NOT NULL DEFAULT 'LOGADO';

-- CreateIndex
CREATE INDEX "Postagem_visibilidade_dataCriacao_idx" ON "Postagem"("visibilidade", "dataCriacao");
