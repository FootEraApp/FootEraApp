-- (1) Atualiza CHECK para aceitar exatamente um dono (inclui olheiro)
ALTER TABLE "public"."AtletaObservado"
DROP CONSTRAINT IF EXISTS "AtletaObservado_one_owner_chk";

ALTER TABLE "public"."AtletaObservado"
ADD CONSTRAINT "AtletaObservado_one_owner_chk" CHECK (
  (CASE WHEN "professorId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "escolinhaId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "clubeId"     IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "olheiroId"   IS NOT NULL THEN 1 ELSE 0 END)
  = 1
);

-- (2) Índice único parcial para evitar duplicata: (olheiroId, atletaId)
CREATE UNIQUE INDEX IF NOT EXISTS "AtletaObservado_olheiro_atleta_unique"
  ON "public"."AtletaObservado" ("olheiroId", "atletaId")
  WHERE "olheiroId" IS NOT NULL;
