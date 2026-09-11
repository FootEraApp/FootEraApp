-- CreateEnum
CREATE TYPE "StatusUsuarioPapel" AS ENUM ('PENDENTE', 'ATIVO', 'INATIVO');

-- AlterEnum
ALTER TYPE "TipoUsuario" ADD VALUE 'Creator';

-- CreateTable
CREATE TABLE "UsuarioPapel" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" "TipoUsuario" NOT NULL,
    "status" "StatusUsuarioPapel" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ativadoEm" TIMESTAMP(3),
    "desativadoEm" TIMESTAMP(3),
    "perfilCompletoEm" TIMESTAMP(3),

    CONSTRAINT "UsuarioPapel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsuarioPapel_usuarioId_status_idx" ON "UsuarioPapel"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "UsuarioPapel_papel_status_idx" ON "UsuarioPapel"("papel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioPapel_usuarioId_papel_key" ON "UsuarioPapel"("usuarioId", "papel");

-- AddForeignKey
ALTER TABLE "UsuarioPapel" ADD CONSTRAINT "UsuarioPapel_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UsuarioPapel" (
  "id",
  "usuarioId",
  "papel",
  "status",
  "criadoEm",
  "atualizadoEm",
  "ativadoEm",
  "perfilCompletoEm"
)
SELECT
  gen_random_uuid()::text,
  "id",
  "tipo",
  'ATIVO',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Usuario"
ON CONFLICT ("usuarioId", "papel") DO NOTHING;