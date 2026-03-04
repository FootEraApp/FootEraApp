-- CreateEnum
CREATE TYPE "OrganizacaoTipo" AS ENUM ('CLUBE', 'ESCOLINHA');

-- CreateTable
CREATE TABLE "OrganizacaoGestor" (
    "id" TEXT NOT NULL,
    "tipo" "OrganizacaoTipo" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "papel" TEXT,
    "permissoes" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizacaoGestor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizacaoGestor_professorId_idx" ON "OrganizacaoGestor"("professorId");

-- CreateIndex
CREATE INDEX "OrganizacaoGestor_tipo_ownerId_idx" ON "OrganizacaoGestor"("tipo", "ownerId");

-- CreateIndex
CREATE INDEX "OrganizacaoGestor_ativo_idx" ON "OrganizacaoGestor"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizacaoGestor_tipo_ownerId_professorId_key" ON "OrganizacaoGestor"("tipo", "ownerId", "professorId");

-- AddForeignKey
ALTER TABLE "OrganizacaoGestor" ADD CONSTRAINT "OrganizacaoGestor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
