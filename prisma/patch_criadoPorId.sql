DO $$
BEGIN
  -- Adiciona a coluna se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DesafioEmGrupo' AND column_name = 'criadoPorId'
  ) THEN
    ALTER TABLE "DesafioEmGrupo" ADD COLUMN "criadoPorId" TEXT;
  END IF;
END $$;

-- Backfill: usa o dono do grupo como criador
UPDATE "DesafioEmGrupo" d
SET "criadoPorId" = g."ownerId"
FROM "Grupo" g
WHERE d."grupoId" = g."id" AND d."criadoPorId" IS NULL;

-- Se ainda ficar nulo, usa o primeiro membro do grupo
UPDATE "DesafioEmGrupo" d
SET "criadoPorId" = m."usuarioId"
FROM "MembroGrupo" m
WHERE d."grupoId" = m."grupoId" AND d."criadoPorId" IS NULL;

-- Travar como NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DesafioEmGrupo' AND column_name = 'criadoPorId' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "DesafioEmGrupo" ALTER COLUMN "criadoPorId" SET NOT NULL;
  END IF;
END $$;

-- FK (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DesafioEmGrupo_criadoPorId_fkey'
  ) THEN
    ALTER TABLE "DesafioEmGrupo"
    ADD CONSTRAINT "DesafioEmGrupo_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Índice (se não existir)
CREATE INDEX IF NOT EXISTS "DesafioEmGrupo_criadoPorId_idx" ON "DesafioEmGrupo"("criadoPorId");
