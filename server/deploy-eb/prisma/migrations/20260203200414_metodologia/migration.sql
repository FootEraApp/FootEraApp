-- CreateEnum
CREATE TYPE "MetodologiaConteudoTipo" AS ENUM ('TREINO', 'VIDEO');

-- CreateEnum
CREATE TYPE "MetodologiaAssinaturaStatus" AS ENUM ('ATIVA', 'CANCELADA', 'CONCLUIDA');

-- AlterTable
ALTER TABLE "TreinoProgramado" ADD COLUMN     "metodologia" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Metodologia" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "capaUrl" TEXT,
    "nivel" "Nivel",
    "categorias" "Categoria"[] DEFAULT ARRAY[]::"Categoria"[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadorUsuarioId" TEXT NOT NULL,
    "professorId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "totalSemanas" INTEGER,
    "totalAssinantes" INTEGER NOT NULL DEFAULT 0,
    "mediaAvaliacao" DOUBLE PRECISION,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metodologia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodologiaItem" (
    "id" TEXT NOT NULL,
    "metodologiaId" TEXT NOT NULL,
    "semana" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "MetodologiaConteudoTipo" NOT NULL DEFAULT 'TREINO',
    "videoUrl" TEXT,
    "thumbUrl" TEXT,
    "duracaoMin" INTEGER,
    "treinoProgramadoId" TEXT,
    "pontos" INTEGER,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodologiaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodologiaAssinante" (
    "id" TEXT NOT NULL,
    "metodologiaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" "MetodologiaAssinaturaStatus" NOT NULL DEFAULT 'ATIVA',
    "iniciouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelouEm" TIMESTAMP(3),
    "concluiuEm" TIMESTAMP(3),
    "aulasConcluidas" INTEGER NOT NULL DEFAULT 0,
    "pontosGanhos" INTEGER NOT NULL DEFAULT 0,
    "progresso" JSONB,
    "lastAccessAt" TIMESTAMP(3),

    CONSTRAINT "MetodologiaAssinante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Metodologia_criadorUsuarioId_idx" ON "Metodologia"("criadorUsuarioId");

-- CreateIndex
CREATE INDEX "Metodologia_professorId_idx" ON "Metodologia"("professorId");

-- CreateIndex
CREATE INDEX "Metodologia_clubeId_idx" ON "Metodologia"("clubeId");

-- CreateIndex
CREATE INDEX "Metodologia_escolinhaId_idx" ON "Metodologia"("escolinhaId");

-- CreateIndex
CREATE INDEX "Metodologia_ativo_idx" ON "Metodologia"("ativo");

-- CreateIndex
CREATE INDEX "MetodologiaItem_metodologiaId_idx" ON "MetodologiaItem"("metodologiaId");

-- CreateIndex
CREATE INDEX "MetodologiaItem_treinoProgramadoId_idx" ON "MetodologiaItem"("treinoProgramadoId");

-- CreateIndex
CREATE INDEX "MetodologiaItem_semana_idx" ON "MetodologiaItem"("semana");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaItem_metodologiaId_semana_ordem_key" ON "MetodologiaItem"("metodologiaId", "semana", "ordem");

-- CreateIndex
CREATE INDEX "MetodologiaAssinante_usuarioId_idx" ON "MetodologiaAssinante"("usuarioId");

-- CreateIndex
CREATE INDEX "MetodologiaAssinante_metodologiaId_idx" ON "MetodologiaAssinante"("metodologiaId");

-- CreateIndex
CREATE INDEX "MetodologiaAssinante_status_idx" ON "MetodologiaAssinante"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MetodologiaAssinante_metodologiaId_usuarioId_key" ON "MetodologiaAssinante"("metodologiaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItem" ADD CONSTRAINT "MetodologiaItem_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaItem" ADD CONSTRAINT "MetodologiaItem_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAssinante" ADD CONSTRAINT "MetodologiaAssinante_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodologiaAssinante" ADD CONSTRAINT "MetodologiaAssinante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
