-- ETAPA 1: Creator institucional
-- Associação opcional entre Creator e Organização.
-- Não altera usuários, conteúdos ou vendas existentes.

ALTER TABLE "Creator"
ADD COLUMN "organizacaoId" TEXT;

CREATE UNIQUE INDEX "Creator_organizacaoId_key"
ON "Creator"("organizacaoId");

ALTER TABLE "Creator"
ADD CONSTRAINT "Creator_organizacaoId_fkey"
FOREIGN KEY ("organizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;