/*
  Warnings:

  - The values [Iniciante] on the enum `Nivel` will be removed. If these variants are still used in the database, this will fail.
  - Changed the column `categoria` on the `Atleta` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.
  - Changed the column `categoria` on the `DesafioOficial` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.
  - Changed the column `categorias` on the `Exercicio` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Nivel_new" AS ENUM ('Base', 'Avancado', 'Performance');
ALTER TABLE "TreinoProgramado" ALTER COLUMN "nivel" TYPE "Nivel_new" USING ("nivel"::text::"Nivel_new");
ALTER TABLE "Exercicio" ALTER COLUMN "nivel" TYPE "Nivel_new" USING ("nivel"::text::"Nivel_new");
ALTER TABLE "DesafioOficial" ALTER COLUMN "nivel" TYPE "Nivel_new" USING ("nivel"::text::"Nivel_new");
ALTER TABLE "Administrador" ALTER COLUMN "nivel" TYPE "Nivel_new" USING ("nivel"::text::"Nivel_new");
ALTER TABLE "Video" ALTER COLUMN "nivel" TYPE "Nivel_new" USING ("nivel"::text::"Nivel_new");
ALTER TYPE "Nivel" RENAME TO "Nivel_old";
ALTER TYPE "Nivel_new" RENAME TO "Nivel";
DROP TYPE "Nivel_old";
COMMIT;

-- AlterTable
ALTER TABLE "Atleta" ALTER COLUMN "categoria" SET DATA TYPE "Categoria"[];

-- AlterTable
ALTER TABLE "DesafioOficial" ALTER COLUMN "categoria" SET DATA TYPE "Categoria"[];

-- AlterTable
ALTER TABLE "Exercicio" ALTER COLUMN "categorias" SET DATA TYPE "Categoria"[];

-- AlterTable
ALTER TABLE "TreinoAgendado" ADD COLUMN     "treinoProgramadoId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "codigo" TEXT;

-- CreateTable
CREATE TABLE "PontuacaoAtleta" (
    "atletaId" TEXT NOT NULL,
    "pontuacaoTotal" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoPerformance" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoDisciplina" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoResponsabilidade" INTEGER NOT NULL DEFAULT 0,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontuacaoAtleta_pkey" PRIMARY KEY ("atletaId")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "atletaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" "Categoria"[],
    "nivel" "Nivel" NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranking" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "posicao" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ranking_atletaId_key" ON "Ranking"("atletaId");

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontuacaoAtleta" ADD CONSTRAINT "PontuacaoAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
