-- CreateEnum
CREATE TYPE "public"."EventoTipo" AS ENUM ('PENEIRA', 'EVENTO');

-- CreateEnum
CREATE TYPE "public"."EventoStatus" AS ENUM ('ABERTO', 'ENCERRADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "public"."Evento" (
    "id" TEXT NOT NULL,
    "clubeId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "public"."EventoTipo" NOT NULL DEFAULT 'PENEIRA',
    "descricao" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "local" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "endereco" TEXT,
    "vagas" INTEGER,
    "valorInscricao" DECIMAL(10,2),
    "linkInscricao" TEXT,
    "requisitos" TEXT[],
    "status" "public"."EventoStatus" NOT NULL DEFAULT 'ABERTO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Evento" ADD CONSTRAINT "Evento_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
