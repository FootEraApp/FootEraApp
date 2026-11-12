-- AlterTable
ALTER TABLE "DocumentoCorrecaoNascimento" ADD COLUMN     "scannerReservadoAte" TIMESTAMP(3),
ADD COLUMN     "scannerReservadoPor" TEXT;

-- CreateIndex
CREATE INDEX "DocumentoCorrecaoNascimento_statusSeguranca_scannerReservad_idx" ON "DocumentoCorrecaoNascimento"("statusSeguranca", "scannerReservadoAte");
