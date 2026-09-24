-- ETAPA 15 — Organizações

CREATE TYPE "TipoOrganizacao" AS ENUM (
  'CLUBE',
  'ESCOLA',
  'MARCA',
  'FEDERACAO'
);

CREATE TYPE "FuncaoMembroOrganizacao" AS ENUM (
  'PROPRIETARIO',
  'ADMINISTRADOR',
  'PROFESSOR',
  'MEMBRO'
);

CREATE TABLE "Organizacao" (
  "id" TEXT NOT NULL,
  "tipo" "TipoOrganizacao" NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "legacyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Organizacao_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "MembroOrganizacao" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "funcao" "FuncaoMembroOrganizacao" NOT NULL,
  "permissoes" JSONB,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MembroOrganizacao_pkey"
    PRIMARY KEY ("id")
);

ALTER TABLE "Clube"
ADD COLUMN "organizacaoId" TEXT;

ALTER TABLE "Escolinha"
ADD COLUMN "organizacaoId" TEXT;

ALTER TABLE "Marca"
ADD COLUMN "organizacaoId" TEXT;

ALTER TABLE "Federacao"
ADD COLUMN "organizacaoId" TEXT;

CREATE UNIQUE INDEX
"Organizacao_legacyKey_key"
ON "Organizacao"("legacyKey");

CREATE INDEX
"Organizacao_tipo_ativo_idx"
ON "Organizacao"("tipo", "ativo");

CREATE INDEX
"Organizacao_nome_idx"
ON "Organizacao"("nome");

CREATE UNIQUE INDEX
"MembroOrganizacao_organizacaoId_usuarioId_key"
ON "MembroOrganizacao"("organizacaoId", "usuarioId");

CREATE INDEX
"MembroOrganizacao_usuarioId_ativo_idx"
ON "MembroOrganizacao"("usuarioId", "ativo");

CREATE INDEX
"MembroOrganizacao_organizacaoId_funcao_ativo_idx"
ON "MembroOrganizacao"("organizacaoId", "funcao", "ativo");

CREATE UNIQUE INDEX
"Clube_organizacaoId_key"
ON "Clube"("organizacaoId");

CREATE UNIQUE INDEX
"Escolinha_organizacaoId_key"
ON "Escolinha"("organizacaoId");

CREATE UNIQUE INDEX
"Marca_organizacaoId_key"
ON "Marca"("organizacaoId");

CREATE UNIQUE INDEX
"Federacao_organizacaoId_key"
ON "Federacao"("organizacaoId");

ALTER TABLE "MembroOrganizacao"
ADD CONSTRAINT "MembroOrganizacao_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "MembroOrganizacao"
ADD CONSTRAINT "MembroOrganizacao_usuarioId_fkey"
FOREIGN KEY ("usuarioId")
REFERENCES "Usuario"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Clube"
ADD CONSTRAINT "Clube_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Escolinha"
ADD CONSTRAINT "Escolinha_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Marca"
ADD CONSTRAINT "Marca_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Federacao"
ADD CONSTRAINT "Federacao_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;