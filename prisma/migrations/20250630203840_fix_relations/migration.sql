/*
  Warnings:

  - You are about to drop the column `escolaId` on the `Atleta` table. All the data in the column will be lost.
  - You are about to drop the column `pontuacao` on the `Atleta` table. All the data in the column will be lost.
  - You are about to drop the column `duracao` on the `Exercicio` table. All the data in the column will be lost.
  - You are about to drop the column `treinoId` on the `Exercicio` table. All the data in the column will be lost.
  - You are about to drop the column `escolaId` on the `Professor` table. All the data in the column will be lost.
  - You are about to drop the column `especialidade` on the `Professor` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Usuario` table. All the data in the column will be lost.
  - You are about to drop the column `escolaId` on the `Usuario` table. All the data in the column will be lost.
  - You are about to drop the column `senha` on the `Usuario` table. All the data in the column will be lost.
  - You are about to drop the `Desafio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Escola` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Treino` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[codigo]` on the table `Exercicio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigo]` on the table `Professor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nomeDeUsuario]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoria` to the `Atleta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categorias` to the `Exercicio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigo` to the `Exercicio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nivel` to the `Exercicio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `areaFormacao` to the `Professor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigo` to the `Professor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nome` to the `Professor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nomeDeUsuario` to the `Usuario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senhaHash` to the `Usuario` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `tipo` on the `Usuario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('Iniciante', 'Avancado', 'Performance');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('Sub9', 'Sub11', 'Sub13', 'Sub15', 'Sub17', 'Sub20', 'Livre');

-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('Atleta', 'Professor', 'Clube', 'Escolinha', 'Admin');

-- CreateEnum
CREATE TYPE "TipoMidia" AS ENUM ('Imagem', 'Video', 'Documento');

-- CreateEnum
CREATE TYPE "StatusConexao" AS ENUM ('Pendente', 'Aprovado', 'Recusado');

-- DropForeignKey
ALTER TABLE "Atleta" DROP CONSTRAINT "Atleta_escolaId_fkey";

-- DropForeignKey
ALTER TABLE "Desafio" DROP CONSTRAINT "Desafio_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "Exercicio" DROP CONSTRAINT "Exercicio_treinoId_fkey";

-- DropForeignKey
ALTER TABLE "Professor" DROP CONSTRAINT "Professor_escolaId_fkey";

-- DropForeignKey
ALTER TABLE "Treino" DROP CONSTRAINT "Treino_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "Treino" DROP CONSTRAINT "Treino_clubeId_fkey";

-- DropForeignKey
ALTER TABLE "Treino" DROP CONSTRAINT "Treino_escolaId_fkey";

-- DropForeignKey
ALTER TABLE "Treino" DROP CONSTRAINT "Treino_professorId_fkey";

-- DropForeignKey
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_escolaId_fkey";

-- AlterTable
ALTER TABLE "Atleta" DROP COLUMN "escolaId",
DROP COLUMN "pontuacao",
ADD COLUMN     "altura" DECIMAL(65,30),
ADD COLUMN     "categoria" "Categoria" NOT NULL,
ADD COLUMN     "consentimento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dataUltimaModificacao" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "escolinhaId" TEXT,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "nacionalidade" TEXT,
ADD COLUMN     "naturalidade" TEXT,
ADD COLUMN     "nome" TEXT,
ADD COLUMN     "peso" DECIMAL(65,30),
ADD COLUMN     "posicao" TEXT,
ADD COLUMN     "seloQualidade" TEXT,
ADD COLUMN     "senhaHash" TEXT,
ADD COLUMN     "sobrenome" TEXT,
ADD COLUMN     "statusConexao" "StatusConexao" NOT NULL DEFAULT 'Pendente',
ADD COLUMN     "telefone1" TEXT,
ADD COLUMN     "telefone2" TEXT;

-- AlterTable
ALTER TABLE "Clube" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "estadio" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "pais" TEXT,
ADD COLUMN     "sede" TEXT,
ADD COLUMN     "siteOficial" TEXT,
ADD COLUMN     "telefone1" TEXT,
ADD COLUMN     "telefone2" TEXT,
ALTER COLUMN "cidade" DROP NOT NULL,
ALTER COLUMN "estado" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Exercicio" DROP COLUMN "duracao",
DROP COLUMN "treinoId",
ADD COLUMN     "categorias" "Categoria" NOT NULL,
ADD COLUMN     "codigo" TEXT NOT NULL,
ADD COLUMN     "nivel" "Nivel" NOT NULL,
ADD COLUMN     "videoDemonstrativoUrl" TEXT,
ALTER COLUMN "descricao" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN     "lida" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Professor" DROP COLUMN "escolaId",
DROP COLUMN "especialidade",
ADD COLUMN     "areaFormacao" TEXT NOT NULL,
ADD COLUMN     "certificacoes" TEXT,
ADD COLUMN     "codigo" TEXT NOT NULL,
ADD COLUMN     "cref" TEXT,
ADD COLUMN     "escola" TEXT,
ADD COLUMN     "fotoUrl" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "qualificacoes" TEXT;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "createdAt",
DROP COLUMN "escolaId",
DROP COLUMN "senha",
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "nomeDeUsuario" TEXT NOT NULL,
ADD COLUMN     "pais" TEXT,
ADD COLUMN     "senhaHash" TEXT NOT NULL,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoUsuario" NOT NULL;

-- DropTable
DROP TABLE "Desafio";

-- DropTable
DROP TABLE "Escola";

-- DropTable
DROP TABLE "Treino";

-- CreateTable
CREATE TABLE "DesafioOficial" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "nivel" "Nivel" NOT NULL,
    "pontos" INTEGER NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesafioOficial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoProgramado" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "Nivel" NOT NULL,
    "dataAgendada" TIMESTAMP(3),
    "professorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoProgramado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amigo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "amigoId" TEXT NOT NULL,
    "local" TEXT,
    "seguindo" BOOLEAN DEFAULT false,

    CONSTRAINT "Amigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seguidor" (
    "id" TEXT NOT NULL,
    "seguidoUsuarioId" TEXT NOT NULL,
    "seguidorUsuarioId" TEXT NOT NULL,

    CONSTRAINT "Seguidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoProgramadoExercicio" (
    "id" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "repeticoes" TEXT NOT NULL,

    CONSTRAINT "TreinoProgramadoExercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Postagem" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "videoUrl" TEXT,
    "tipoMidia" "TipoMidia",
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "atletaId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,

    CONSTRAINT "Postagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Midia" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "TipoMidia" NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataEnvio" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "atletaId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,

    CONSTRAINT "Midia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escolinha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "telefone1" TEXT,
    "telefone2" TEXT,
    "email" TEXT,
    "siteOficial" TEXT,
    "sede" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "cep" TEXT,
    "logo" TEXT,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escolinha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoVinculo" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "tipoEntidade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissaoDesafio" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "desafioId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "aprovado" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissaoDesafio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,

    CONSTRAINT "MembroGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Administrador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "nivel" "Nivel" NOT NULL,

    CONSTRAINT "Administrador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogErro" (
    "id" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "path" TEXT NOT NULL,
    "clientIp" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "referer" TEXT,

    CONSTRAINT "LogErro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curtida" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curtida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoAgendado" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "atletaId" TEXT NOT NULL,

    CONSTRAINT "TreinoAgendado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoLivre" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "duracaoMin" INTEGER,

    CONSTRAINT "TreinoLivre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroTreino" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "notas" TEXT,
    "completado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegistroTreino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreinoProgramado_codigo_key" ON "TreinoProgramado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_usuarioId_key" ON "Escolinha"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Administrador_usuarioId_key" ON "Administrador"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_codigo_key" ON "Exercicio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_codigo_key" ON "Professor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nomeDeUsuario_key" ON "Usuario"("nomeDeUsuario");

-- AddForeignKey
ALTER TABLE "TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amigo" ADD CONSTRAINT "Amigo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amigo" ADD CONSTRAINT "Amigo_amigoId_fkey" FOREIGN KEY ("amigoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguidor" ADD CONSTRAINT "Seguidor_seguidoUsuarioId_fkey" FOREIGN KEY ("seguidoUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguidor" ADD CONSTRAINT "Seguidor_seguidorUsuarioId_fkey" FOREIGN KEY ("seguidorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoVinculo" ADD CONSTRAINT "SolicitacaoVinculo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_desafioId_fkey" FOREIGN KEY ("desafioId") REFERENCES "DesafioOficial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroGrupo" ADD CONSTRAINT "MembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroGrupo" ADD CONSTRAINT "MembroGrupo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Administrador" ADD CONSTRAINT "Administrador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoLivre" ADD CONSTRAINT "TreinoLivre_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroTreino" ADD CONSTRAINT "RegistroTreino_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoLivre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Usuario" ADD COLUMN "cpf" TEXT;
