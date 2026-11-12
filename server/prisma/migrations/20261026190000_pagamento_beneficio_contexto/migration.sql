-- Adicionar os novos campos de contexto financeiro.

ALTER TABLE "PagamentoBeneficio"
    ADD COLUMN IF NOT EXISTS "contextoKind" TEXT,
    ADD COLUMN IF NOT EXISTS "contextoTipo" TEXT,
    ADD COLUMN IF NOT EXISTS "contextoPerfilId" TEXT,
    ADD COLUMN IF NOT EXISTS "contextoOrganizacaoId" TEXT,
    ADD COLUMN IF NOT EXISTS "motivoRevogacao" TEXT;

-- Criar os índices correspondentes ao schema Prisma.

CREATE INDEX IF NOT EXISTS "PagamentoBeneficio_pagamentoId_idx"
    ON "PagamentoBeneficio"("pagamentoId");

CREATE INDEX IF NOT EXISTS "PagamentoBeneficio_revogadoEm_idx"
    ON "PagamentoBeneficio"("revogadoEm");

-- Remover o índice antigo que não está no schema atual.

DROP INDEX IF EXISTS "PagamentoBeneficio_pagamentoId_revogadoEm_idx";

-- Remover a coluna antiga.
-- Confirmamos anteriormente que a tabela está vazia.

ALTER TABLE "PagamentoBeneficio"
    DROP COLUMN IF EXISTS "contextoKey";