-- AlterTable
ALTER TABLE "ExclusaoDocumentoNascimentoPendente" ADD COLUMN     "reservadoAte" TIMESTAMP(3),
ADD COLUMN     "reservadoPor" TEXT;

-- CreateIndex
CREATE INDEX "ExclusaoDocumentoNascimentoPendente_reservadoAte_idx" ON "ExclusaoDocumentoNascimentoPendente"("reservadoAte");
