/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,metodologiaAvulsaId]` on the table `CertificadoMetodologia` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[metodologiaAvulsaId,usuarioId]` on the table `MetodologiaAssinante` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."ExercicioPersonalizado_nomeNormalizado_key";

-- AlterTable
ALTER TABLE "CertificadoMetodologia" ADD COLUMN     "metodologiaAvulsaId" TEXT,
ALTER COLUMN "metodologiaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MetodologiaAssinante" ADD COLUMN     "metodologiaAvulsaId" TEXT,
ALTER COLUMN "metodologiaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MetodologiaAvulsa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "capaUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criadorUsuarioId" TEXT NOT NULL,
    "professorId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "publicoAlvo" "MetodologiaPublicoAlvo" NOT NULL DEFAULT 'AMBOS',
    "tipo" "MetodologiaTipo" NOT NULL,
    "estruturaTipo" "MetodologiaEstruturaTipo" NOT NULL,
    "area" "MetodologiaArea",
    "geraCertificado" BOOLEAN NOT NULL DEFAULT false,
    "geraBadge" BOOLEAN NOT NULL DEFAULT false,
    "precoAssinaturaMensal" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodologiaAvulsa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodologiaAvulsaEstrutura" (
    "id" TEXT NOT NULL,
    "metodologiaAvulsaId" TEXT NOT NULL,
    "tipo" "MetodologiaEstruturaTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "objetivo" TEXT,
    "ordem" INTEGER NOT NULL,
    "duracaoSemanas" INTEGER,
    "treinosPorSemana" INTEGER,
    "quantidadeMinConclusao" INTEGER,
    "modoExecucao" "MetodologiaModoExecucao",
    "pontosPorItem" INTEGER,
    "bonusConsistencia" INTEGER,
    "bonusFinal" INTEGER,
    "permiteAtraso" BOOLEAN NOT NULL DEFAULT true,
    "prazoInicio" TIMESTAMP(3),
    "prazoFinal" TIMESTAMP(3),
    "percentualPerdaAtraso" INTEGER DEFAULT 20,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodologiaAvulsaEstrutura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodologiaAvulsaEstruturaItem" (
    "id" TEXT NOT NULL,
    "estruturaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "MetodologiaItemTipo" NOT NULL,
    "videoUrl" TEXT,
    "thumbUrl" TEXT,
    "arquivoUrl" TEXT,
    "materialUrl" TEXT,
    "duracaoMin" INTEGER,
    "treinoProgramadoId" TEXT,
    "pontos" INTEGER,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodologiaAvulsaEstruturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetodologiaAvulsa_criadorUsuarioId_idx" ON "MetodologiaAvulsa"("criadorUsuarioId");

-- CreateIndex
CREATE INDEX "MetodologiaAvulsa_ativo_idx" ON "MetodologiaAvulsa"("ativo");

-- CreateIndex
CREATE INDEX "MetodologiaAvulsaEstrutura_metodologiaAvulsaId_idx" ON "MetodologiaAvulsaEstrutura"("metodologiaAvulsaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaAvulsaEstrutura_metodologiaAvulsaId_ordem_key" ON "MetodologiaAvulsaEstrutura"("metodologiaAvulsaId", "ordem");

-- CreateIndex
CREATE INDEX "MetodologiaAvulsaEstruturaItem_estruturaId_idx" ON "MetodologiaAvulsaEstruturaItem"("estruturaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaAvulsaEstruturaItem_estruturaId_ordem_key" ON "MetodologiaAvulsaEstruturaItem"("estruturaId", "ordem");

-- CreateIndex
CREATE INDEX "CertificadoMetodologia_metodologiaId_idx" ON "CertificadoMetodologia"("metodologiaId");

-- CreateIndex
CREATE INDEX "CertificadoMetodologia_metodologiaAvulsaId_idx" ON "CertificadoMetodologia"("metodologiaAvulsaId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificadoMetodologia_usuarioId_metodologiaAvulsaId_key" ON "CertificadoMetodologia"("usuarioId", "metodologiaAvulsaId");

-- CreateIndex
CREATE INDEX "MetodologiaAssinante_metodologiaAvulsaId_idx" ON "MetodologiaAssinante"("metodologiaAvulsaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaAssinante_metodologiaAvulsaId_usuarioId_key" ON "MetodologiaAssinante"("metodologiaAvulsaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "CertificadoMetodologia" ADD CONSTRAINT "CertificadoMetodologia_metodologiaAvulsaId_fkey" FOREIGN KEY ("metodologiaAvulsaId") REFERENCES "MetodologiaAvulsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAssinante" ADD CONSTRAINT "MetodologiaAssinante_metodologiaAvulsaId_fkey" FOREIGN KEY ("metodologiaAvulsaId") REFERENCES "MetodologiaAvulsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsaEstrutura" ADD CONSTRAINT "MetodologiaAvulsaEstrutura_metodologiaAvulsaId_fkey" FOREIGN KEY ("metodologiaAvulsaId") REFERENCES "MetodologiaAvulsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsaEstruturaItem" ADD CONSTRAINT "MetodologiaAvulsaEstruturaItem_estruturaId_fkey" FOREIGN KEY ("estruturaId") REFERENCES "MetodologiaAvulsaEstrutura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAvulsaEstruturaItem" ADD CONSTRAINT "MetodologiaAvulsaEstruturaItem_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
