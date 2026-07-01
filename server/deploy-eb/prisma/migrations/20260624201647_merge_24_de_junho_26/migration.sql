-- CreateEnum
CREATE TYPE "LearningFavoritoTipo" AS ENUM ('METODOLOGIA', 'METODOLOGIA_AVULSA', 'AULA_AO_VIVO');

-- CreateTable
CREATE TABLE "LearningFavorito" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "LearningFavoritoTipo" NOT NULL,
    "alvoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningFavorito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoFavorito" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoFavorito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LembreteNotificacaoEnviado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "janela" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LembreteNotificacaoEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDeviceToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningFavorito_usuarioId_idx" ON "LearningFavorito"("usuarioId");

-- CreateIndex
CREATE INDEX "LearningFavorito_tipo_alvoId_idx" ON "LearningFavorito"("tipo", "alvoId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningFavorito_usuarioId_tipo_alvoId_key" ON "LearningFavorito"("usuarioId", "tipo", "alvoId");

-- CreateIndex
CREATE INDEX "TreinoFavorito_usuarioId_idx" ON "TreinoFavorito"("usuarioId");

-- CreateIndex
CREATE INDEX "TreinoFavorito_treinoProgramadoId_idx" ON "TreinoFavorito"("treinoProgramadoId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoFavorito_usuarioId_treinoProgramadoId_key" ON "TreinoFavorito"("usuarioId", "treinoProgramadoId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_usuarioId_idx" ON "PushSubscription"("usuarioId");

-- CreateIndex
CREATE INDEX "LembreteNotificacaoEnviado_usuarioId_idx" ON "LembreteNotificacaoEnviado"("usuarioId");

-- CreateIndex
CREATE INDEX "LembreteNotificacaoEnviado_tipo_alvoId_idx" ON "LembreteNotificacaoEnviado"("tipo", "alvoId");

-- CreateIndex
CREATE INDEX "LembreteNotificacaoEnviado_criadoEm_idx" ON "LembreteNotificacaoEnviado"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "LembreteNotificacaoEnviado_usuarioId_tipo_alvoId_janela_key" ON "LembreteNotificacaoEnviado"("usuarioId", "tipo", "alvoId", "janela");

-- CreateIndex
CREATE UNIQUE INDEX "PushDeviceToken_token_key" ON "PushDeviceToken"("token");

-- CreateIndex
CREATE INDEX "PushDeviceToken_usuarioId_idx" ON "PushDeviceToken"("usuarioId");

-- AddForeignKey
ALTER TABLE "LearningFavorito" ADD CONSTRAINT "LearningFavorito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoFavorito" ADD CONSTRAINT "TreinoFavorito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoFavorito" ADD CONSTRAINT "TreinoFavorito_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LembreteNotificacaoEnviado" ADD CONSTRAINT "LembreteNotificacaoEnviado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDeviceToken" ADD CONSTRAINT "PushDeviceToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
