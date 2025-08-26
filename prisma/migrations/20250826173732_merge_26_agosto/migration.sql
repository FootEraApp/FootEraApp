/*
  Warnings:

  - You are about to drop the column `pontos` on the `DesafioOficial` table. All the data in the column will be lost.
  - You are about to drop the column `referer` on the `LogErro` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `LogErro` table. All the data in the column will be lost.
  - You are about to drop the column `atletaId` on the `MembroGrupo` table. All the data in the column will be lost.
  - You are about to drop the column `dataHora` on the `TreinoAgendado` table. All the data in the column will be lost.
  - You are about to drop the column `TipoTreino` on the `TreinoProgramado` table. All the data in the column will be lost.
  - You are about to drop the column `dataHora` on the `TreinoRealizado` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[grupoId,usuarioId]` on the table `MembroGrupo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ownerId` to the `Grupo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Grupo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postagemId` to the `LogErro` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `LogErro` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MembroGrupo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `MembroGrupo` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusDesafioGrupo" AS ENUM ('ativo', 'concluido', 'expirado');

-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('NORMAL', 'DESAFIO', 'POST', 'USUARIO', 'CONQUISTA');

-- CreateEnum
CREATE TYPE "TipoMembro" AS ENUM ('DONO', 'ADMIN', 'MEMBRO');

-- AlterEnum
ALTER TYPE "TipoTreino" ADD VALUE 'Mental';

-- DropForeignKey
ALTER TABLE "MembroGrupo" DROP CONSTRAINT "MembroGrupo_atletaId_fkey";

-- DropForeignKey
ALTER TABLE "MembroGrupo" DROP CONSTRAINT "MembroGrupo_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "TreinoProgramadoExercicio" DROP CONSTRAINT "TreinoProgramadoExercicio_treinoProgramadoId_fkey";

-- DropIndex
DROP INDEX "Grupo_nome_key";

-- AlterTable
ALTER TABLE "Atleta" ADD COLUMN     "perfilTipoTreino" TEXT,
ADD COLUMN     "perfilTipoTreinoAtualizadoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DesafioOficial" DROP COLUMN "pontos",
ADD COLUMN     "pontuacao" INTEGER,
ADD COLUMN     "regras" TEXT,
ADD COLUMN     "tipoMetrificação" TEXT;

-- AlterTable
ALTER TABLE "Grupo" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "LogErro" DROP COLUMN "referer",
DROP COLUMN "userAgent",
ADD COLUMN     "postagemId" TEXT NOT NULL,
ADD COLUMN     "usuarioId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MembroGrupo" DROP COLUMN "atletaId",
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tipo" "TipoMembro" NOT NULL DEFAULT 'MEMBRO',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usuarioId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN     "atletaId" TEXT,
ADD COLUMN     "desafioId" TEXT,
ADD COLUMN     "postId" TEXT,
ADD COLUMN     "tipo" "TipoMensagem" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "Midia" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SolicitacaoVinculo" ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubmissaoDesafio" ADD COLUMN     "observacao" TEXT;

-- AlterTable
ALTER TABLE "SubmissaoTreino" ADD COLUMN     "duracaoMinutos" INTEGER,
ADD COLUMN     "pontosCreditados" INTEGER,
ADD COLUMN     "pontuacaoSnapshot" INTEGER,
ADD COLUMN     "tipoTreinoSnapshot" "TipoTreino",
ADD COLUMN     "treinoTituloSnapshot" TEXT;

-- AlterTable
ALTER TABLE "TreinoAgendado" DROP COLUMN "dataHora",
ADD COLUMN     "dataExpiracao" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TreinoProgramado" DROP COLUMN "TipoTreino",
ADD COLUMN     "clubeId" TEXT,
ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "imagemUrl" TEXT,
ADD COLUMN     "metas" TEXT,
ADD COLUMN     "naoExpira" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pontuacao" INTEGER,
ADD COLUMN     "tipoTreino" "TipoTreino";

-- AlterTable
ALTER TABLE "TreinoRealizado" DROP COLUMN "dataHora",
ADD COLUMN     "dataExpiracao" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SolicitacaoTreino" (
    "id" TEXT NOT NULL,
    "remetenteId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "status" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" "TipoMensagem" NOT NULL DEFAULT 'NORMAL',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluida" BOOLEAN NOT NULL DEFAULT false,
    "excluidaEm" TIMESTAMP(3),
    "excluidaPor" TEXT,

    CONSTRAINT "MensagemGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesafioEmGrupo" (
    "id" TEXT NOT NULL,
    "desafioOficialId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "status" "StatusDesafioGrupo" NOT NULL DEFAULT 'ativo',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataExpiracao" TIMESTAMP(3),
    "pontosAcumulados" INTEGER DEFAULT 0,

    CONSTRAINT "DesafioEmGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissaoDesafioEmGrupo" (
    "id" TEXT NOT NULL,
    "submissaoDesafioId" TEXT NOT NULL,
    "desafioEmGrupoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprovado" BOOLEAN,
    "pontosGanhos" INTEGER,

    CONSTRAINT "SubmissaoDesafioEmGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstatisticaAtleta" (
    "atletaId" TEXT NOT NULL,
    "totalTreinos" INTEGER NOT NULL DEFAULT 0,
    "totalDesafios" INTEGER NOT NULL DEFAULT 0,
    "totalPontos" INTEGER NOT NULL DEFAULT 0,
    "horasTreinadas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fisico" INTEGER NOT NULL DEFAULT 0,
    "tecnico" INTEGER NOT NULL DEFAULT 0,
    "tatico" INTEGER NOT NULL DEFAULT 0,
    "mental" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstatisticaAtleta_pkey" PRIMARY KEY ("atletaId")
);

-- CreateTable
CREATE TABLE "_MembrosDesafioEmGrupo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MembrosDesafioEmGrupo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "MensagemGrupo_grupoId_idx" ON "MensagemGrupo"("grupoId");

-- CreateIndex
CREATE INDEX "MensagemGrupo_usuarioId_idx" ON "MensagemGrupo"("usuarioId");

-- CreateIndex
CREATE INDEX "MensagemGrupo_criadaEm_idx" ON "MensagemGrupo"("criadaEm");

-- CreateIndex
CREATE INDEX "SubmissaoDesafioEmGrupo_desafioEmGrupoId_idx" ON "SubmissaoDesafioEmGrupo"("desafioEmGrupoId");

-- CreateIndex
CREATE INDEX "SubmissaoDesafioEmGrupo_usuarioId_idx" ON "SubmissaoDesafioEmGrupo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_usuarioId_idx" ON "PasswordReset"("usuarioId");

-- CreateIndex
CREATE INDEX "_MembrosDesafioEmGrupo_B_index" ON "_MembrosDesafioEmGrupo"("B");

-- CreateIndex
CREATE INDEX "Grupo_ownerId_idx" ON "Grupo"("ownerId");

-- CreateIndex
CREATE INDEX "Grupo_createdAt_idx" ON "Grupo"("createdAt");

-- CreateIndex
CREATE INDEX "Grupo_updatedAt_idx" ON "Grupo"("updatedAt");

-- CreateIndex
CREATE INDEX "MembroGrupo_usuarioId_idx" ON "MembroGrupo"("usuarioId");

-- CreateIndex
CREATE INDEX "MembroGrupo_grupoId_tipo_idx" ON "MembroGrupo"("grupoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "MembroGrupo_grupoId_usuarioId_key" ON "MembroGrupo"("grupoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_desafioId_fkey" FOREIGN KEY ("desafioId") REFERENCES "DesafioOficial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Postagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoTreino" ADD CONSTRAINT "SolicitacaoTreino_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoTreino" ADD CONSTRAINT "SolicitacaoTreino_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroGrupo" ADD CONSTRAINT "MembroGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroGrupo" ADD CONSTRAINT "MembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemGrupo" ADD CONSTRAINT "MensagemGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemGrupo" ADD CONSTRAINT "MensagemGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogErro" ADD CONSTRAINT "LogErro_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogErro" ADD CONSTRAINT "LogErro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesafioEmGrupo" ADD CONSTRAINT "DesafioEmGrupo_desafioOficialId_fkey" FOREIGN KEY ("desafioOficialId") REFERENCES "DesafioOficial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafioEmGrupo" ADD CONSTRAINT "SubmissaoDesafioEmGrupo_submissaoDesafioId_fkey" FOREIGN KEY ("submissaoDesafioId") REFERENCES "SubmissaoDesafio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafioEmGrupo" ADD CONSTRAINT "SubmissaoDesafioEmGrupo_desafioEmGrupoId_fkey" FOREIGN KEY ("desafioEmGrupoId") REFERENCES "DesafioEmGrupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafioEmGrupo" ADD CONSTRAINT "SubmissaoDesafioEmGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstatisticaAtleta" ADD CONSTRAINT "EstatisticaAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MembrosDesafioEmGrupo" ADD CONSTRAINT "_MembrosDesafioEmGrupo_A_fkey" FOREIGN KEY ("A") REFERENCES "DesafioEmGrupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MembrosDesafioEmGrupo" ADD CONSTRAINT "_MembrosDesafioEmGrupo_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
