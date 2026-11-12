-- CreateEnum
CREATE TYPE "StatusSegurancaDocumentoNascimento" AS ENUM ('PENDENTE', 'EM_ANALISE', 'SEGURO', 'AMEACA_DETECTADA', 'FALHA_ANALISE');

-- AlterTable
ALTER TABLE "DocumentoCorrecaoNascimento" ADD COLUMN     "analisadoEm" TIMESTAMP(3),
ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "scannerRef" TEXT,
ADD COLUMN     "statusSeguranca" "StatusSegurancaDocumentoNascimento" NOT NULL DEFAULT 'PENDENTE';

-- CreateIndex
CREATE INDEX "DocumentoCorrecaoNascimento_statusSeguranca_criadoEm_idx" ON "DocumentoCorrecaoNascimento"("statusSeguranca", "criadoEm");

-- CreateIndex
CREATE INDEX "DocumentoCorrecaoNascimento_expiraEm_idx" ON "DocumentoCorrecaoNascimento"("expiraEm");