WITH last_rel AS (
  SELECT DISTINCT ON (rt."atletaId")
         rt."atletaId",
         rt."clubeId",
         rt."escolinhaId",
         rt."criadoEm"
  FROM "RelacaoTreinamento" rt
  WHERE rt."clubeId" IS NOT NULL
     OR rt."escolinhaId" IS NOT NULL
  ORDER BY rt."atletaId", rt."criadoEm" DESC
)
UPDATE "Atleta" a
SET "clubeId"     = COALESCE(lr."clubeId", a."clubeId"),
    "escolinhaId" = COALESCE(lr."escolinhaId", a."escolinhaId")
FROM last_rel lr
WHERE lr."atletaId" = a.id;

UPDATE "Atleta" a
SET "pontosTotal" = COALESCE(
  (SELECT pa."pontuacaoTotal" FROM "PontuacaoAtleta" pa WHERE pa."atletaId" = a.id),
  (SELECT
     COALESCE(pa."pontuacaoPerformance",0)
   + COALESCE(pa."pontuacaoDisciplina",0)
   + COALESCE(pa."pontuacaoResponsabilidade",0)
   FROM "PontuacaoAtleta" pa
   WHERE pa."atletaId" = a.id),
  (SELECT ea."totalPontos" FROM "EstatisticaAtleta" ea WHERE ea."atletaId" = a.id),
  0
);

CREATE OR REPLACE FUNCTION sync_atleta_vinculos() RETURNS trigger AS $$
BEGIN
  IF NEW."clubeId" IS NOT NULL THEN
    UPDATE "Atleta" SET "clubeId" = NEW."clubeId" WHERE id = NEW."atletaId";
  END IF;
  IF NEW."escolinhaId" IS NOT NULL THEN
    UPDATE "Atleta" SET "escolinhaId" = NEW."escolinhaId" WHERE id = NEW."atletaId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_vinculos ON "RelacaoTreinamento";
CREATE TRIGGER trg_sync_vinculos
AFTER INSERT OR UPDATE ON "RelacaoTreinamento"
FOR EACH ROW EXECUTE FUNCTION sync_atleta_vinculos();

CREATE OR REPLACE FUNCTION recompute_atleta_pontos() RETURNS trigger AS $$
DECLARE total integer;
DECLARE atleta_id text;
BEGIN
  atleta_id := COALESCE(NEW."atletaId", NEW."id");

  SELECT COALESCE(
     pa."pontuacaoTotal",
     (COALESCE(pa."pontuacaoPerformance",0)
    + COALESCE(pa."pontuacaoDisciplina",0)
    + COALESCE(pa."pontuacaoResponsabilidade",0)),
     ea."totalPontos", 0)
  INTO total
  FROM "Atleta" a
  LEFT JOIN "PontuacaoAtleta" pa ON pa."atletaId" = a.id
  LEFT JOIN "EstatisticaAtleta" ea ON ea."atletaId" = a.id
  WHERE a.id = atleta_id;

  UPDATE "Atleta" SET "pontosTotal" = COALESCE(total,0) WHERE id = atleta_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pontos_pa ON "PontuacaoAtleta";
CREATE TRIGGER trg_sync_pontos_pa
AFTER INSERT OR UPDATE ON "PontuacaoAtleta"
FOR EACH ROW EXECUTE FUNCTION recompute_atleta_pontos();

DROP TRIGGER IF EXISTS trg_sync_pontos_ea ON "EstatisticaAtleta";
CREATE TRIGGER trg_sync_pontos_ea
AFTER INSERT OR UPDATE ON "EstatisticaAtleta"
FOR EACH ROW EXECUTE FUNCTION recompute_atleta_pontos();