-- Completa o schema do histórico de migrations.
-- As estruturas já criadas no histórico anterior permanecem nas suas migrations de origem.

CREATE TYPE "EventoPagamentoStatus" AS ENUM ('RECEBIDO', 'PROCESSANDO', 'CONCLUIDO', 'FALHOU');

ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_SOLICITACAO';

ALTER TYPE "NotificacaoTipo" ADD VALUE 'RESPONSAVEL_VINCULO';

ALTER TYPE "TipoUsuario" ADD VALUE 'Responsavel';

ALTER TABLE "Clube" DROP CONSTRAINT "Clube_usuarioId_fkey";

ALTER TABLE "Creator" DROP CONSTRAINT "Creator_usuarioId_fkey";

ALTER TABLE "Escolinha" DROP CONSTRAINT "Escolinha_usuarioId_fkey";

ALTER TABLE "Federacao" DROP CONSTRAINT "Federacao_usuarioId_fkey";

ALTER TABLE "Marca" DROP CONSTRAINT "Marca_usuarioId_fkey";

ALTER TABLE "Metodologia" DROP CONSTRAINT "Metodologia_criadorUsuarioId_fkey";

ALTER TABLE "MetodologiaAvulsa" DROP CONSTRAINT "MetodologiaAvulsa_criadorUsuarioId_fkey";

ALTER TABLE "Postagem" DROP CONSTRAINT "Postagem_usuarioId_fkey";

ALTER TABLE "Assinatura" ALTER COLUMN "contextoKey" DROP DEFAULT;

ALTER TABLE "Clube" ALTER COLUMN "usuarioId" DROP NOT NULL;

ALTER TABLE "Creator" ALTER COLUMN "usuarioId" DROP NOT NULL;

ALTER TABLE "CreatorVenda" ADD COLUMN     "pagamentoId" TEXT;

-- Preenche atualizadoEm para os registros existentes antes de exigir NOT NULL.
ALTER TABLE "EventoPagamento"
    ADD COLUMN "atualizadoEm" TIMESTAMP(3),
    ADD COLUMN "concluidoEm" TIMESTAMP(3),
    ADD COLUMN "processandoEm" TIMESTAMP(3),
    ADD COLUMN "status" "EventoPagamentoStatus" NOT NULL DEFAULT 'RECEBIDO',
    ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "ultimoErro" TEXT;

UPDATE "EventoPagamento"
SET "atualizadoEm" = COALESCE("recebidoEm", CURRENT_TIMESTAMP)
WHERE "atualizadoEm" IS NULL;

ALTER TABLE "EventoPagamento"
    ALTER COLUMN "atualizadoEm" SET NOT NULL;

ALTER TABLE "Federacao" ALTER COLUMN "usuarioId" DROP NOT NULL;

ALTER TABLE "Marca" ALTER COLUMN "usuarioId" DROP NOT NULL;

ALTER TABLE "Metodologia" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

ALTER TABLE "MetodologiaAvulsa" ALTER COLUMN "criadorUsuarioId" DROP NOT NULL;

ALTER TABLE "Postagem" ADD COLUMN     "autorContextoKey" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

CREATE INDEX "Assinatura_contextoKey_idx" ON "Assinatura"("contextoKey");

CREATE INDEX "CreatorVenda_pagamentoId_idx" ON "CreatorVenda"("pagamentoId");

CREATE INDEX "EventoPagamento_status_processandoEm_idx" ON "EventoPagamento"("status", "processandoEm");

CREATE INDEX "Postagem_autorContextoKey_idx" ON "Postagem"("autorContextoKey");

ALTER TABLE "Metodologia" ADD CONSTRAINT "Metodologia_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MetodologiaAvulsa" ADD CONSTRAINT "MetodologiaAvulsa_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Clube" ADD CONSTRAINT "Clube_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Creator" ADD CONSTRAINT "Creator_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreatorVenda" ADD CONSTRAINT "CreatorVenda_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Federacao" ADD CONSTRAINT "Federacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Marca" ADD CONSTRAINT "Marca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
