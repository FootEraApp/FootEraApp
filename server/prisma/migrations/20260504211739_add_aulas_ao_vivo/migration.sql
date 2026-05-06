-- CreateEnum
CREATE TYPE "AulaAoVivoStatus" AS ENUM ('AGENDADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMensagemLive" AS ENUM ('TEXTO', 'SISTEMA', 'ALERTA');

-- AlterEnum
ALTER TYPE "MetodologiaConteudoTipo" ADD VALUE 'AULA_AO_VIVO';

-- AlterEnum
ALTER TYPE "MetodologiaItemTipo" ADD VALUE 'AULA_AO_VIVO';

-- CreateTable
CREATE TABLE "AulaAoVivo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "AulaAoVivoStatus" NOT NULL DEFAULT 'AGENDADA',
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "iniciouEm" TIMESTAMP(3),
    "finalizouEm" TIMESTAMP(3),
    "cancelouEm" TIMESTAMP(3),
    "urlStream" TEXT,
    "streamKey" TEXT,
    "provedorStream" TEXT,
    "videoGravadoUrl" TEXT,
    "thumbUrl" TEXT,
    "duracaoMin" INTEGER,
    "chatAtivo" BOOLEAN NOT NULL DEFAULT true,
    "gravacaoAtiva" BOOLEAN NOT NULL DEFAULT true,
    "replayDisponivel" BOOLEAN NOT NULL DEFAULT false,
    "totalMensagens" INTEGER NOT NULL DEFAULT 0,
    "totalParticipantes" INTEGER NOT NULL DEFAULT 0,
    "criadorUsuarioId" TEXT,
    "metodologiaId" TEXT,
    "estruturaId" TEXT,
    "itemId" TEXT,
    "metodologiaAvulsaId" TEXT,
    "estruturaAvulsaId" TEXT,
    "itemAvulsaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AulaAoVivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AulaAoVivoMensagem" (
    "id" TEXT NOT NULL,
    "aulaAoVivoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" "TipoMensagemLive" NOT NULL DEFAULT 'TEXTO',
    "deletada" BOOLEAN NOT NULL DEFAULT false,
    "deletadaEm" TIMESTAMP(3),
    "deletadaPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AulaAoVivoMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AulaAoVivo_itemId_key" ON "AulaAoVivo"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AulaAoVivo_itemAvulsaId_key" ON "AulaAoVivo"("itemAvulsaId");

-- CreateIndex
CREATE INDEX "AulaAoVivo_status_idx" ON "AulaAoVivo"("status");

-- CreateIndex
CREATE INDEX "AulaAoVivo_dataInicio_idx" ON "AulaAoVivo"("dataInicio");

-- CreateIndex
CREATE INDEX "AulaAoVivo_criadorUsuarioId_idx" ON "AulaAoVivo"("criadorUsuarioId");

-- CreateIndex
CREATE INDEX "AulaAoVivo_metodologiaId_idx" ON "AulaAoVivo"("metodologiaId");

-- CreateIndex
CREATE INDEX "AulaAoVivo_estruturaId_idx" ON "AulaAoVivo"("estruturaId");

-- CreateIndex
CREATE INDEX "AulaAoVivo_metodologiaAvulsaId_idx" ON "AulaAoVivo"("metodologiaAvulsaId");

-- CreateIndex
CREATE INDEX "AulaAoVivo_estruturaAvulsaId_idx" ON "AulaAoVivo"("estruturaAvulsaId");

-- CreateIndex
CREATE INDEX "AulaAoVivoMensagem_aulaAoVivoId_idx" ON "AulaAoVivoMensagem"("aulaAoVivoId");

-- CreateIndex
CREATE INDEX "AulaAoVivoMensagem_usuarioId_idx" ON "AulaAoVivoMensagem"("usuarioId");

-- CreateIndex
CREATE INDEX "AulaAoVivoMensagem_deletadaPorId_idx" ON "AulaAoVivoMensagem"("deletadaPorId");

-- CreateIndex
CREATE INDEX "AulaAoVivoMensagem_criadoEm_idx" ON "AulaAoVivoMensagem"("criadoEm");

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_estruturaId_fkey" FOREIGN KEY ("estruturaId") REFERENCES "MetodologiaEstrutura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MetodologiaEstruturaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_metodologiaAvulsaId_fkey" FOREIGN KEY ("metodologiaAvulsaId") REFERENCES "MetodologiaAvulsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_estruturaAvulsaId_fkey" FOREIGN KEY ("estruturaAvulsaId") REFERENCES "MetodologiaAvulsaEstrutura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_itemAvulsaId_fkey" FOREIGN KEY ("itemAvulsaId") REFERENCES "MetodologiaAvulsaEstruturaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoMensagem" ADD CONSTRAINT "AulaAoVivoMensagem_aulaAoVivoId_fkey" FOREIGN KEY ("aulaAoVivoId") REFERENCES "AulaAoVivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoMensagem" ADD CONSTRAINT "AulaAoVivoMensagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoMensagem" ADD CONSTRAINT "AulaAoVivoMensagem_deletadaPorId_fkey" FOREIGN KEY ("deletadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
