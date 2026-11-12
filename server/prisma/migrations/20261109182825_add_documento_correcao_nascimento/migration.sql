-- CreateTable
CREATE TABLE "DocumentoCorrecaoNascimento" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoCorrecaoNascimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoCorrecaoNascimento_solicitacaoId_key" ON "DocumentoCorrecaoNascimento"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoCorrecaoNascimento_s3Key_key" ON "DocumentoCorrecaoNascimento"("s3Key");

-- AddForeignKey
ALTER TABLE "DocumentoCorrecaoNascimento" ADD CONSTRAINT "DocumentoCorrecaoNascimento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCorrecaoNascimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
