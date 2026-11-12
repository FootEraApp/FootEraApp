-- Estruturas necessárias para a migration de segurança dos documentos.

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
