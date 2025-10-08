-- PERF DE TREINOS (pontos creditados -> snapshot -> treinoProgramado.pontuacao)
WITH st AS (
  SELECT st."atletaId" AS atletaId,
         SUM(COALESCE(st."pontosCreditados", st."pontuacaoSnapshot", tp."pontuacao", 0)) AS perf,
         COUNT(*) AS n
  FROM "SubmissaoTreino" st
  LEFT JOIN "TreinoAgendado" ta ON ta.id = st."treinoAgendadoId"
  LEFT JOIN "TreinoProgramado" tp ON tp.id = ta."treinoProgramadoId"
  WHERE st."aprovado" IS TRUE
  GROUP BY st."atletaId"
),
-- PERF DE DESAFIOS (usa DesafioOficial.pontuacao)
sd AS (
  SELECT sd."atletaId" AS atletaId,
         SUM(COALESCE(d."pontuacao", 0)) AS perf,
         COUNT(*) AS n
  FROM "SubmissaoDesafio" sd
  LEFT JOIN "DesafioOficial" d ON d.id = sd."desafioId"
  WHERE sd."aprovado" IS TRUE
  GROUP BY sd."atletaId"
),
agg AS (
  SELECT a.id AS atletaId,
         COALESCE(st.perf,0) + COALESCE(sd.perf,0)                      AS performance,
         COALESCE(st.n,0) * 2                                           AS disciplina,
         COALESCE(sd.n,0) * 2                                           AS responsabilidade
  FROM "Atleta" a
  LEFT JOIN st ON st.atletaId = a.id
  LEFT JOIN sd ON sd.atletaId = a.id
)
INSERT INTO "PontuacaoAtleta"
  ("atletaId","pontuacaoTotal","pontuacaoPerformance",
   "pontuacaoDisciplina","pontuacaoResponsabilidade","ultimaAtualizacao")
SELECT atletaId,
       (performance + disciplina + responsabilidade) AS total,
       performance, disciplina, responsabilidade, now()
FROM agg
ON CONFLICT ("atletaId") DO UPDATE
SET "pontuacaoTotal"            = EXCLUDED."pontuacaoTotal",
    "pontuacaoPerformance"      = EXCLUDED."pontuacaoPerformance",
    "pontuacaoDisciplina"       = EXCLUDED."pontuacaoDisciplina",
    "pontuacaoResponsabilidade" = EXCLUDED."pontuacaoResponsabilidade",
    "ultimaAtualizacao"         = now();

-- Sincroniza Atleta.pontosTotal com PontuacaoAtleta
UPDATE "Atleta" a
SET "pontosTotal" = pa."pontuacaoTotal"
FROM "PontuacaoAtleta" pa
WHERE pa."atletaId" = a.id;
