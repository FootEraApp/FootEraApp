-- AlterEnum
ALTER TYPE "public"."TipoUsuario" ADD VALUE 'Olheiro';

-- AlterTable
ALTER TABLE "public"."Administrador" ADD COLUMN     "fotoUrl" TEXT;

-- CreateTable
CREATE TABLE "public"."Olheiro" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "headline" TEXT,
    "descricao" TEXT,
    "areaAtuacao" TEXT,
    "anosExperiencia" INTEGER NOT NULL DEFAULT 0,
    "emailPublico" TEXT,
    "telefonePublico" TEXT,
    "siteOuLinkedin" TEXT,
    "colaboracaoClubeId" TEXT,
    "reputacaoScore" INTEGER NOT NULL DEFAULT 0,
    "totalIndicacoes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Olheiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Olheiro_usuarioId_key" ON "public"."Olheiro"("usuarioId");

-- CreateIndex
CREATE INDEX "Olheiro_areaAtuacao_idx" ON "public"."Olheiro"("areaAtuacao");

-- CreateIndex
CREATE INDEX "Olheiro_colaboracaoClubeId_idx" ON "public"."Olheiro"("colaboracaoClubeId");

-- AddForeignKey
ALTER TABLE "public"."Olheiro" ADD CONSTRAINT "Olheiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Olheiro" ADD CONSTRAINT "Olheiro_colaboracaoClubeId_fkey" FOREIGN KEY ("colaboracaoClubeId") REFERENCES "public"."Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;
