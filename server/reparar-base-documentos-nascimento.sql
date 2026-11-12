\set ON_ERROR_STOP on

-- Pré-requisitos para 20261110124803_add_seguranca_documento_nascimento.
-- Executar na conexão footera/public em que a migration falhou.

BEGIN;
SET LOCAL search_path = public;

DO $$
BEGIN
    IF current_database() <> 'footera' THEN
        RAISE EXCEPTION 'Execute este reparo no banco footera.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."_prisma_migrations"
        WHERE migration_name = '20261110124803_add_seguranca_documento_nascimento'
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
    ) THEN
        RAISE EXCEPTION 'A tentativa esperada não está em aberto no histórico do Prisma.';
    END IF;

    IF to_regclass('public."SolicitacaoCorrecaoNascimento"') IS NOT NULL
       OR to_regclass('public."DocumentoCorrecaoNascimento"') IS NOT NULL
       OR to_regtype('public."StatusCorrecaoNascimento"') IS NOT NULL
       OR to_regtype('public."StatusSegurancaDocumentoNascimento"') IS NOT NULL
    THEN
        RAISE EXCEPTION 'O estado das tabelas ou dos enums diverge do diagnóstico.';
    END IF;
END;
$$;

CREATE TYPE "StatusCorrecaoNascimento" AS ENUM ('PENDENTE_VERIFICACAO', 'EM_ANALISE', 'APROVADA', 'REJEITADA');

CREATE TABLE "SolicitacaoCorrecaoNascimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataSolicitada" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusCorrecaoNascimento" NOT NULL DEFAULT 'PENDENTE_VERIFICACAO',
    "verificacaoRef" TEXT,
    "verificadoEm" TIMESTAMP(3),
    "revisadoPorId" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoCorrecaoNascimento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentoCorrecaoNascimento" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannerReservadoPor" TEXT,
    "scannerReservadoAte" TIMESTAMP(3),

    CONSTRAINT "DocumentoCorrecaoNascimento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitacaoCorrecaoNascimento_usuarioId_status_idx" ON "SolicitacaoCorrecaoNascimento"("usuarioId", "status");

CREATE INDEX "SolicitacaoCorrecaoNascimento_status_criadoEm_idx" ON "SolicitacaoCorrecaoNascimento"("status", "criadoEm");

CREATE UNIQUE INDEX "DocumentoCorrecaoNascimento_solicitacaoId_key" ON "DocumentoCorrecaoNascimento"("solicitacaoId");

CREATE UNIQUE INDEX "DocumentoCorrecaoNascimento_s3Key_key" ON "DocumentoCorrecaoNascimento"("s3Key");

ALTER TABLE "SolicitacaoCorrecaoNascimento" ADD CONSTRAINT "SolicitacaoCorrecaoNascimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentoCorrecaoNascimento" ADD CONSTRAINT "DocumentoCorrecaoNascimento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCorrecaoNascimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
