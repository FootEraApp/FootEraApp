WITH alvos AS (
    SELECT id, "usuarioId"
    FROM public."Assinatura"
    WHERE "contextoKey" LIKE 'qa-etapa6-final-%'
)
SELECT
    (SELECT COUNT(*) FROM alvos) AS assinaturas,
    (
        SELECT COUNT(*)
        FROM public."BillingComunicacao" c
        JOIN alvos a ON a.id = c."assinaturaId"
    ) AS comunicacoes,
    (
        SELECT COUNT(*)
        FROM public."Notificacao" n
        JOIN alvos a
          ON n."usuarioId" = a."usuarioId"
         AND n.link LIKE
             '/pagamentos?assinaturaId=' || a.id || '&ciclo=%'
    ) AS notificacoes_app,
    (
        SELECT COUNT(*)
        FROM public."LembreteNotificacaoEnviado" l
        JOIN alvos a
          ON l."usuarioId" = a."usuarioId"
         AND l."alvoId" = a.id
    ) AS lembretes;

SELECT
    n.id,
    n."usuarioId",
    n.tipo,
    n.link
FROM public."Notificacao" n
WHERE EXISTS (
    SELECT 1
    FROM public."Assinatura" a
    WHERE a."contextoKey" LIKE 'qa-etapa6-final-%'
      AND a.id IS NOT NULL
      AND a."usuarioId" = n."usuarioId"
      AND n.link LIKE
          '/pagamentos?assinaturaId=' || a.id || '&ciclo=%'
)
ORDER BY n."createdAt" DESC
LIMIT 10;
