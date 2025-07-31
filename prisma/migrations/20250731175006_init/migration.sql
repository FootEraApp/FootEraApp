/*
  Warnings:

  - A unique constraint covering the columns `[titulo]` on the table `DesafioOficial` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[usuarioId,conteudo]` on the table `Postagem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Postagem" ADD COLUMN     "compartilhamentos" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "AtividadeRecente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtividadeRecente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoRealizado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT,

    CONSTRAINT "TreinoRealizado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesafioOficial_titulo_key" ON "DesafioOficial"("titulo");

-- CreateIndex
CREATE UNIQUE INDEX "Postagem_usuarioId_conteudo_key" ON "Postagem"("usuarioId", "conteudo");

-- AddForeignKey
ALTER TABLE "AtividadeRecente" ADD CONSTRAINT "AtividadeRecente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRealizado" ADD CONSTRAINT "TreinoRealizado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoRealizado" ADD CONSTRAINT "TreinoRealizado_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoProgramado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
