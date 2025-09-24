/*
  Correções:
  - Evita P3006 usando IF NOT EXISTS / DROP CONSTRAINT IF EXISTS / blocks com EXCEPTION.
  - Remove unicidades antigas duplicadas e recria a correta incluindo "olheiroId".
  - Converte "perfilTipoTreino" para o enum sem perder dados.
*/

-- --- Limpeza de unicidades antigas (nomes que podem existir em migrações anteriores) ---
DO $$ BEGIN
  ALTER TABLE "public"."AtletaObservado"
    DROP CONSTRAINT IF EXISTS "AtletaObservado_professorId_escolinhaId_clubeId_atletaId_key";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Pode ter sido criado como índice único (não usual). Remova sem erro se existir:
DROP INDEX IF EXISTS "public"."AtletaObservado_professorId_escolinhaId_clubeId_atletaId_key";
DROP INDEX IF EXISTS "public"."AtletaObservado_professorId_escolinhaId_clubeId_atletaId_ol_key";
DROP INDEX IF EXISTS "public"."AtletaObservado_owner_atleta_key";

-- Se a versão nova já existir, derruba antes para evitar "duplicate_object"
ALTER TABLE "public"."AtletaObservado"
  DROP CONSTRAINT IF EXISTS "AtletaObservado_professorId_escolinhaId_clubeId_olheiroId_atletaId_key";

-- --- Alteração de tipo sem perda (reaproveita os valores existentes) ---
ALTER TABLE "public"."Atleta"
  ALTER COLUMN "perfilTipoTreino" TYPE "public"."TipoTreino"
  USING "perfilTipoTreino"::"public"."TipoTreino";

-- --- Nova coluna (idempotente) ---
ALTER TABLE "public"."AtletaObservado"
  ADD COLUMN IF NOT EXISTS "olheiroId" TEXT;

-- --- Índices auxiliares (idempotentes) ---
CREATE INDEX IF NOT EXISTS "Atleta_perfilTipoTreino_idx"
  ON "public"."Atleta"("perfilTipoTreino");

CREATE INDEX IF NOT EXISTS "AtletaObservado_olheiroId_idx"
  ON "public"."AtletaObservado"("olheiroId");

-- --- Unicidade correta com 5 colunas, incluindo olheiroId (idempotente via EXCEPTION) ---
DO $$ BEGIN
  ALTER TABLE "public"."AtletaObservado"
    ADD CONSTRAINT "AtletaObservado_professorId_escolinhaId_clubeId_olheiroId_atletaId_key"
    UNIQUE ("professorId", "escolinhaId", "clubeId", "olheiroId", "atletaId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --- Foreign key para Olheiro (idempotente via EXCEPTION) ---
DO $$ BEGIN
  ALTER TABLE "public"."AtletaObservado"
    ADD CONSTRAINT "AtletaObservado_olheiroId_fkey"
    FOREIGN KEY ("olheiroId") REFERENCES "public"."Olheiro"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
