ALTER TABLE "Pagamento"
ADD COLUMN IF NOT EXISTS "contextoKind" TEXT,
ADD COLUMN IF NOT EXISTS "contextoTipo" TEXT,
ADD COLUMN IF NOT EXISTS "contextoPerfilId" TEXT,
ADD COLUMN IF NOT EXISTS "contextoOrganizacaoId" TEXT,
ADD COLUMN IF NOT EXISTS "contextoLegacyOrganizationId" TEXT;

CREATE INDEX IF NOT EXISTS "Pagamento_contextoKind_idx"
ON "Pagamento"("contextoKind");

CREATE INDEX IF NOT EXISTS "Pagamento_contextoTipo_idx"
ON "Pagamento"("contextoTipo");

CREATE INDEX IF NOT EXISTS "Pagamento_contextoPerfilId_idx"
ON "Pagamento"("contextoPerfilId");

CREATE INDEX IF NOT EXISTS "Pagamento_contextoOrganizacaoId_idx"
ON "Pagamento"("contextoOrganizacaoId");

CREATE INDEX IF NOT EXISTS "Pagamento_contextoLegacyOrganizationId_idx"
ON "Pagamento"("contextoLegacyOrganizationId");
