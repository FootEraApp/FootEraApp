-- Índice usado na seleção de documentos para análise de segurança.
CREATE INDEX "DocumentoCorrecaoNascimento_statusSeguranca_scannerReservad_idx" ON "DocumentoCorrecaoNascimento"("statusSeguranca", "scannerReservadoAte");
