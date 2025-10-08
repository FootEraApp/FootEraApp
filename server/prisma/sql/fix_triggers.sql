-- 1) Derruba triggers e funções antigas
DROP TRIGGER IF EXISTS trg_sync_pontos_pa ON "PontuacaoAtleta";
DROP TRIGGER IF EXISTS trg_sync_pontos_ea ON "EstatisticaAtleta";
DROP TRIGGER IF EXISTS trg_sync_vinculos  ON "RelacaoTreinamento";

DROP FUNCTION IF EXISTS recompute_atleta_pontos();
DROP FUNCTION IF EXISTS recompute_atleta_pontos_v2();
DROP FUNCTION IF EXISTS sync_atleta_vinculos();

-- 2) Função correta (PL/pgSQL) para sincronizar pontos -> usa NEW (MAIÚSCULO)
CREATE OR REPLACE FUNCTION recompute_atleta_pontos_v2() RETURNS trigger AS $$
DECLARE
  atleta_id text;
  total integer;
BEGIN
  atleta_id := NEW."atletaId";

  SELECT COALESCE(
    pa."pontuacaoTotal",
    (COALESCE(pa."pontuacaoPerformance",0)
     + COALESCE(pa."pontuacaoDisciplina",0)
     + COALESCE(pa."pontuacaoResponsabilidade",0)),
    ea."totalPontos", 0
  )
  INTO total
  FROM "Atleta" a
  LEFT JOIN "PontuacaoAtleta"    pa ON pa."atletaId" = a.id
  LEFT JOIN "EstatisticaAtleta"  ea ON ea."atletaId" = a.id
  WHERE a.id = atleta_id;

  UPDATE "Atleta"
  SET "pontosTotal" = COALESCE(total,0)
  WHERE id = atleta_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Função correta para copiar vínculos (usa NEW MAIÚSCULO)
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

-- 4) Reatacha triggers às funções novas
CREATE TRIGGER trg_sync_pontos_pa
AFTER INSERT OR UPDATE ON "PontuacaoAtleta"
FOR EACH ROW EXECUTE FUNCTION recompute_atleta_pontos_v2();

CREATE TRIGGER trg_sync_pontos_ea
AFTER INSERT OR UPDATE ON "EstatisticaAtleta"
FOR EACH ROW EXECUTE FUNCTION recompute_atleta_pontos_v2();

CREATE TRIGGER trg_sync_vinculos
AFTER INSERT OR UPDATE ON "RelacaoTreinamento"
FOR EACH ROW EXECUTE FUNCTION sync_atleta_vinculos();
