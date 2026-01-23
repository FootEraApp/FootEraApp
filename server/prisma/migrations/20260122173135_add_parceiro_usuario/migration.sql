-- DropIndex
DROP INDEX "public"."Postagem_conteudo_key";

-- DropIndex
DROP INDEX "public"."Professor_nome_key";

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "configuracoesNotificacoes" JSONB,
ADD COLUMN     "parceiro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "senhaAtualizadaEm" TIMESTAMP(3),
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Parceiro" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parceiro_usuarioId_key" ON "Parceiro"("usuarioId");

-- AddForeignKey
ALTER TABLE "Parceiro" ADD CONSTRAINT "Parceiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
