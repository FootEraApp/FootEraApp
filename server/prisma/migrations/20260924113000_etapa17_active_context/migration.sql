-- ETAPA 17 — Active Context

ALTER TABLE "Usuario"
ADD COLUMN "contextoOrganizacaoId" TEXT;

CREATE INDEX
"Usuario_contextoOrganizacaoId_idx"
ON "Usuario"("contextoOrganizacaoId");

ALTER TABLE "Usuario"
ADD CONSTRAINT "Usuario_contextoOrganizacaoId_fkey"
FOREIGN KEY ("contextoOrganizacaoId")
REFERENCES "Organizacao"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;