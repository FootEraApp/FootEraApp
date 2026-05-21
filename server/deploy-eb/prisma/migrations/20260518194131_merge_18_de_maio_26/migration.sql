/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `AulaAoVivo` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AulaAoVivo" ADD COLUMN     "acessoPago" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "convidadoDescricao" TEXT,
ADD COLUMN     "convidadoNome" TEXT,
ADD COLUMN     "convidadoUsuarioId" TEXT,
ADD COLUMN     "inscricaoFim" TIMESTAMP(3),
ADD COLUMN     "inscricaoInicio" TIMESTAMP(3),
ADD COLUMN     "precoAcesso" DECIMAL(10,2),
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "AulaAoVivoAcesso" (
    "id" TEXT NOT NULL,
    "aulaAoVivoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "origem" TEXT NOT NULL DEFAULT 'PAGAMENTO',
    "valorPago" DECIMAL(10,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "AulaAoVivoAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AulaAoVivoConvidado" (
    "id" TEXT NOT NULL,
    "aulaAoVivoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nome" TEXT,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AulaAoVivoConvidado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AulaAoVivoAcesso_usuarioId_idx" ON "AulaAoVivoAcesso"("usuarioId");

-- CreateIndex
CREATE INDEX "AulaAoVivoAcesso_aulaAoVivoId_idx" ON "AulaAoVivoAcesso"("aulaAoVivoId");

-- CreateIndex
CREATE UNIQUE INDEX "AulaAoVivoAcesso_aulaAoVivoId_usuarioId_key" ON "AulaAoVivoAcesso"("aulaAoVivoId", "usuarioId");

-- CreateIndex
CREATE INDEX "AulaAoVivoConvidado_aulaAoVivoId_idx" ON "AulaAoVivoConvidado"("aulaAoVivoId");

-- CreateIndex
CREATE INDEX "AulaAoVivoConvidado_usuarioId_idx" ON "AulaAoVivoConvidado"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "AulaAoVivo_slug_key" ON "AulaAoVivo"("slug");

-- AddForeignKey
ALTER TABLE "AulaAoVivo" ADD CONSTRAINT "AulaAoVivo_convidadoUsuarioId_fkey" FOREIGN KEY ("convidadoUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoAcesso" ADD CONSTRAINT "AulaAoVivoAcesso_aulaAoVivoId_fkey" FOREIGN KEY ("aulaAoVivoId") REFERENCES "AulaAoVivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoAcesso" ADD CONSTRAINT "AulaAoVivoAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoConvidado" ADD CONSTRAINT "AulaAoVivoConvidado_aulaAoVivoId_fkey" FOREIGN KEY ("aulaAoVivoId") REFERENCES "AulaAoVivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoConvidado" ADD CONSTRAINT "AulaAoVivoConvidado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
