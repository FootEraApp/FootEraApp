-- This is an empty migration.
-- (1) CHECK: exatamente um dono (professor/escolinha/clube)
ALTER TABLE "public"."AtletaObservado"
ADD CONSTRAINT "AtletaObservado_one_owner_chk" CHECK (
  (CASE WHEN "professorId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "escolinhaId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "clubeId"     IS NOT NULL THEN 1 ELSE 0 END)
  = 1
);

-- (2) remover o UNIQUE de 4 colunas (ele não evita duplicata com NULL)
DROP INDEX IF EXISTS "public"."AtletaObservado_professorId_escolinhaId_clubeId_atletaId_key";

-- (3) unicidade por par dono+atleta (3 índices únicos parciais)
CREATE UNIQUE INDEX "AtletaObservado_prof_atleta_unique"
  ON "public"."AtletaObservado" ("professorId", "atletaId")
  WHERE "professorId" IS NOT NULL;

CREATE UNIQUE INDEX "AtletaObservado_escola_atleta_unique"
  ON "public"."AtletaObservado" ("escolinhaId", "atletaId")
  WHERE "escolinhaId" IS NOT NULL;

CREATE UNIQUE INDEX "AtletaObservado_clube_atleta_unique"
  ON "public"."AtletaObservado" ("clubeId", "atletaId")
  WHERE "clubeId" IS NOT NULL;
