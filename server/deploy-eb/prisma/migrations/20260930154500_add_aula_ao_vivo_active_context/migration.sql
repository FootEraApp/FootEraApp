ALTER TABLE "AulaAoVivo"
ADD COLUMN IF NOT EXISTS "contextoKind" TEXT,
ADD COLUMN IF NOT EXISTS "contextoTipo" TEXT,
ADD COLUMN IF NOT EXISTS "contextoPerfilId" TEXT,
ADD COLUMN IF NOT EXISTS "contextoOrganizacaoId" TEXT,
ADD COLUMN IF NOT EXISTS "contextoLegacyOrganizationId" TEXT;

CREATE INDEX IF NOT EXISTS "AulaAoVivo_contextoKind_idx"
ON "AulaAoVivo"("contextoKind");

CREATE INDEX IF NOT EXISTS "AulaAoVivo_contextoTipo_idx"
ON "AulaAoVivo"("contextoTipo");

CREATE INDEX IF NOT EXISTS "AulaAoVivo_contextoPerfilId_idx"
ON "AulaAoVivo"("contextoPerfilId");

CREATE INDEX IF NOT EXISTS "AulaAoVivo_contextoOrganizacaoId_idx"
ON "AulaAoVivo"("contextoOrganizacaoId");

CREATE INDEX IF NOT EXISTS "AulaAoVivo_contextoLegacyOrganizationId_idx"
ON "AulaAoVivo"("contextoLegacyOrganizationId");
