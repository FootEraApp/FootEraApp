/*
  Warnings:

  - Made the column `descricao` on table `TreinoLivre` required. This step will fail if there are existing NULL values in that column.
  - Made the column `duracaoMin` on table `TreinoLivre` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SubmissaoDesafio" ADD COLUMN     "repeticoes" INTEGER;

-- AlterTable
ALTER TABLE "TreinoLivre" ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tipoAtividade" TEXT,
ADD COLUMN     "urlEvidencia" TEXT,
ALTER COLUMN "descricao" SET NOT NULL,
ALTER COLUMN "duracaoMin" SET NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "configuracoesPrivacidade" JSONB,
ADD COLUMN     "dataNascimento" TIMESTAMP(3),
ADD COLUMN     "responsavelEmail" TEXT,
ADD COLUMN     "responsavelNome" TEXT,
ADD COLUMN     "responsavelTelefone" TEXT;

-- CreateTable
CREATE TABLE "Consentimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "doc" TEXT NOT NULL,
    "versaoTermos" TEXT NOT NULL,
    "versaoPriv" TEXT NOT NULL,
    "hashTermos" TEXT,
    "hashPriv" TEXT,
    "metodo" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consentimento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Consentimento" ADD CONSTRAINT "Consentimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
