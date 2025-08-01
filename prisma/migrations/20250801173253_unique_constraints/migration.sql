/*
  Warnings:

  - A unique constraint covering the columns `[imagemUrl]` on the table `AtividadeRecente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Atleta` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nome]` on the table `Clube` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cnpj]` on the table `Clube` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Clube` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[siteOficial]` on the table `Clube` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[imagemUrl]` on the table `DesafioOficial` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nome]` on the table `Escolinha` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cnpj]` on the table `Escolinha` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Escolinha` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nome]` on the table `Exercicio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[videoDemonstrativoUrl]` on the table `Exercicio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nome]` on the table `Grupo` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[url]` on the table `Midia` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[conteudo]` on the table `Postagem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fotoUrl]` on the table `Professor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nome]` on the table `Professor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[videoUrl]` on the table `SubmissaoDesafio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[observacao]` on the table `SubmissaoTreino` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[titulo]` on the table `TreinoAgendado` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nome]` on the table `TreinoProgramado` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[url]` on the table `Video` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "TreinoProgramadoRecebido" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,

    CONSTRAINT "TreinoProgramadoRecebido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtividadeRecente_imagemUrl_key" ON "AtividadeRecente"("imagemUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Atleta_email_key" ON "Atleta"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_nome_key" ON "Clube"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_cnpj_key" ON "Clube"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_email_key" ON "Clube"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_siteOficial_key" ON "Clube"("siteOficial");

-- CreateIndex
CREATE UNIQUE INDEX "DesafioOficial_imagemUrl_key" ON "DesafioOficial"("imagemUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_nome_key" ON "Escolinha"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_cnpj_key" ON "Escolinha"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_email_key" ON "Escolinha"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_nome_key" ON "Exercicio"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_videoDemonstrativoUrl_key" ON "Exercicio"("videoDemonstrativoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_nome_key" ON "Grupo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Midia_url_key" ON "Midia"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Postagem_conteudo_key" ON "Postagem"("conteudo");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_fotoUrl_key" ON "Professor"("fotoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_nome_key" ON "Professor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoDesafio_videoUrl_key" ON "SubmissaoDesafio"("videoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoTreino_observacao_key" ON "SubmissaoTreino"("observacao");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoAgendado_titulo_key" ON "TreinoAgendado"("titulo");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoProgramado_nome_key" ON "TreinoProgramado"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Video_url_key" ON "Video"("url");

-- AddForeignKey
ALTER TABLE "TreinoProgramadoRecebido" ADD CONSTRAINT "TreinoProgramadoRecebido_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoRecebido" ADD CONSTRAINT "TreinoProgramadoRecebido_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoProgramado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
