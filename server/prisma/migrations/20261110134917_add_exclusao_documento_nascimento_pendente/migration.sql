-- CreateTable
CREATE TABLE "ExclusaoDocumentoNascimentoPendente" (
    "id" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExclusaoDocumentoNascimentoPendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExclusaoDocumentoNascimentoPendente_s3Key_key" ON "ExclusaoDocumentoNascimentoPendente"("s3Key");

-- CreateIndex
CREATE INDEX "ExclusaoDocumentoNascimentoPendente_proximaTentativaEm_idx" ON "ExclusaoDocumentoNascimentoPendente"("proximaTentativaEm");