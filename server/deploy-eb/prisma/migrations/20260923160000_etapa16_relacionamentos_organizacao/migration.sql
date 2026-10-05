-- ETAPA 16 — Relacionamentos migrados para Organizacao

CREATE TABLE "OrganizacaoSeguidor" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizacaoSeguidor_pkey"
    PRIMARY KEY ("id")
);

ALTER TABLE "Postagem"
ADD COLUMN "organizacaoId" TEXT;

ALTER TABLE "Evento"
ADD COLUMN "organizacaoId" TEXT;

ALTER TABLE "Turma"
ADD COLUMN "organizacaoId" TEXT;

CREATE UNIQUE INDEX
"OrganizacaoSeguidor_organizacaoId_usuarioId_key"
ON "OrganizacaoSeguidor"("organizacaoId", "usuarioId");

CREATE INDEX
"OrganizacaoSeguidor_usuarioId_idx"
ON "OrganizacaoSeguidor"("usuarioId");

CREATE INDEX
"OrganizacaoSeguidor_organizacaoId_idx"
ON "OrganizacaoSeguidor"("organizacaoId");

CREATE INDEX
"Postagem_organizacaoId_idx"
ON "Postagem"("organizacaoId");

CREATE INDEX
"Evento_organizacaoId_idx"
ON "Evento"("organizacaoId");

CREATE INDEX
"Turma_organizacaoId_idx"
ON "Turma"("organizacaoId");

CREATE INDEX
"RelacaoTreinamento_organizacaoId_idx"
ON "RelacaoTreinamento"("organizacaoId");

ALTER TABLE "OrganizacaoSeguidor"
ADD CONSTRAINT "OrganizacaoSeguidor_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "OrganizacaoSeguidor"
ADD CONSTRAINT "OrganizacaoSeguidor_usuarioId_fkey"
FOREIGN KEY ("usuarioId")
REFERENCES "Usuario"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Postagem"
ADD CONSTRAINT "Postagem_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Evento"
ADD CONSTRAINT "Evento_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Turma"
ADD CONSTRAINT "Turma_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "RelacaoTreinamento"
ADD CONSTRAINT "RelacaoTreinamento_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;