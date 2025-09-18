-- 1) Último CLUBE por atleta
WITH last_clube AS (
  SELECT DISTINCT ON (rt."atletaId")
         rt."atletaId", rt."clubeId"
  FROM "RelacaoTreinamento" rt
  WHERE rt."clubeId" IS NOT NULL
  ORDER BY rt."atletaId", rt."criadoEm" DESC
),
-- 2) Última ESCOLINHA por atleta
last_escola AS (
  SELECT DISTINCT ON (rt."atletaId")
         rt."atletaId", rt."escolinhaId"
  FROM "RelacaoTreinamento" rt
  WHERE rt."escolinhaId" IS NOT NULL
  ORDER BY rt."atletaId", rt."criadoEm" DESC
)
UPDATE "Atleta" a
SET "clubeId"     = COALESCE(lc."clubeId", a."clubeId"),
    "escolinhaId" = COALESCE(le."escolinhaId", a."escolinhaId")
FROM last_clube lc
FULL JOIN last_escola le ON le."atletaId" = lc."atletaId"
WHERE a.id = COALESCE(lc."atletaId", le."atletaId");

-- 3) Pontos: prioriza PontuacaoAtleta; senão soma os 3 campos; se não houver, cai para EstatisticaAtleta.totalPontos; senão 0
UPDATE "Atleta" a
SET "pontosTotal" = sub.total
FROM (
  SELECT a2.id AS atleta_id,
         COALESCE(
           pa."pontuacaoTotal",
           CASE WHEN pa."atletaId" IS NOT NULL THEN
             COALESCE(pa."pontuacaoPerformance",0)
           + COALESCE(pa."pontuacaoDisciplina",0)
           + COALESCE(pa."pontuacaoResponsabilidade",0)
           ELSE NULL END,
           ea."totalPontos",
           0
         ) AS total
  FROM "Atleta" a2
  LEFT JOIN "PontuacaoAtleta"    pa ON pa."atletaId" = a2.id
  LEFT JOIN "EstatisticaAtleta"  ea ON ea."atletaId" = a2.id
) sub
WHERE a.id = sub.atleta_id;