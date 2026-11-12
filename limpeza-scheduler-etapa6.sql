BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE qa_assinaturas_alvo
ON COMMIT DROP AS
SELECT
    id,
    "usuarioId",
    "contextoKey"
FROM public."Assinatura"
WHERE "contextoKey" LIKE 'qa-etapa6-final-%';

CREATE TEMP TABLE qa_comunicacoes_alvo
ON COMMIT DROP AS
SELECT c.id
FROM public."BillingComunicacao" c
JOIN qa_assinaturas_alvo a
    ON a.id = c."assinaturaId";

CREATE TEMP TABLE qa_notificacoes_alvo
ON COMMIT DROP AS
SELECT n.id
FROM public."Notificacao" n
JOIN qa_assinaturas_alvo a
    ON a."usuarioId" = n."usuarioId"
   AND n.link LIKE
       '/pagamentos?assinaturaId=' || a.id || '&ciclo=%';

DO $qa$
DECLARE
    qtd_assinaturas INTEGER;
    qtd_comunicacoes INTEGER;
    qtd_notificacoes INTEGER;
    qtd_lembretes INTEGER;
    qtd_removida INTEGER;
BEGIN
    IF current_database() <>
       'footera_billing_scheduler_qa_20261103'
    THEN
        RAISE EXCEPTION 'BANCO_SCHEDULER_INCORRETO';
    END IF;

    SELECT COUNT(*)
    INTO qtd_assinaturas
    FROM qa_assinaturas_alvo;

    SELECT COUNT(*)
    INTO qtd_comunicacoes
    FROM qa_comunicacoes_alvo;

    SELECT COUNT(*)
    INTO qtd_notificacoes
    FROM qa_notificacoes_alvo;

    SELECT COUNT(*)
    INTO qtd_lembretes
    FROM public."LembreteNotificacaoEnviado" l
    JOIN qa_assinaturas_alvo a
      ON l."usuarioId" = a."usuarioId"
     AND l."alvoId" = a.id;

    IF qtd_assinaturas <> 22
       OR qtd_comunicacoes <> 47
       OR qtd_notificacoes <> 13
       OR qtd_lembretes <> 0
    THEN
        RAISE EXCEPTION
          'QA_ABORTADO: contagens divergentes A:% C:% N:% L:%',
          qtd_assinaturas,
          qtd_comunicacoes,
          qtd_notificacoes,
          qtd_lembretes;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM qa_assinaturas_alvo a
        JOIN public."Assinatura" s ON s.id = a.id
        WHERE a."usuarioId" NOT IN (
            '1cd77a66-270e-4ce6-832d-08a563d7a86d',
            'eeecc139-3f8e-46fd-a2c9-2eae36db96aa'
        )
        OR s."providerSubscriptionId" IS NOT NULL
        OR a."contextoKey" NOT LIKE
           'qa-etapa6-final-%'
        OR right(a."contextoKey", 36) <> a.id
        OR a."contextoKey" !~
          '^qa-etapa6-final-(retry-vencido|retry-futuro|lease-expirado|lease-valido|limite-cinco|bloqueio-recuperacao|ciclo-antigo|concorrencia-simultanea)-[0-9a-f-]{36}$'
    ) THEN
        RAISE EXCEPTION
          'QA_ABORTADO: assinatura fora do padrao esperado';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM qa_assinaturas_alvo a
        LEFT JOIN public."Usuario" u
          ON u.id = a."usuarioId"
        WHERE
          (
            a."usuarioId" =
            '1cd77a66-270e-4ce6-832d-08a563d7a86d'
            AND u."nomeDeUsuario" IS DISTINCT FROM
                'qa_sched_aviso_20261103'
          )
          OR
          (
            a."usuarioId" =
            'eeecc139-3f8e-46fd-a2c9-2eae36db96aa'
            AND u."nomeDeUsuario" IS DISTINCT FROM
                'qa_sched_bloqueio_20261103'
          )
    ) THEN
        RAISE EXCEPTION 'QA_ABORTADO: usuario divergente';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."Notificacao" n
        JOIN qa_notificacoes_alvo q ON q.id = n.id
        WHERE n.tipo::text NOT IN (
            'BILLING_WARNING',
            'BILLING_BLOCKED'
        )
    ) THEN
        RAISE EXCEPTION
          'QA_ABORTADO: notificacao de tipo inesperado';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."Notificacao" n
        JOIN qa_assinaturas_alvo a
          ON position(a.id IN COALESCE(n.link, '')) > 0
        WHERE NOT EXISTS (
            SELECT 1
            FROM qa_notificacoes_alvo q
            WHERE q.id = n.id
        )
    ) THEN
        RAISE EXCEPTION
          'QA_ABORTADO: outras notificacoes referenciam assinaturas';
    END IF;

    DELETE FROM public."Notificacao" n
    USING qa_notificacoes_alvo q
    WHERE n.id = q.id;

    GET DIAGNOSTICS qtd_removida = ROW_COUNT;

    IF qtd_removida <> 13 THEN
        RAISE EXCEPTION
          'QA_ABORTADO: notificacoes removidas %',
          qtd_removida;
    END IF;

    DELETE FROM public."BillingComunicacao" c
    USING qa_comunicacoes_alvo q
    WHERE c.id = q.id;

    GET DIAGNOSTICS qtd_removida = ROW_COUNT;

    IF qtd_removida <> 47 THEN
        RAISE EXCEPTION
          'QA_ABORTADO: comunicacoes removidas %',
          qtd_removida;
    END IF;

    DELETE FROM public."Assinatura" s
    USING qa_assinaturas_alvo q
    WHERE s.id = q.id
      AND s."contextoKey" = q."contextoKey"
      AND s."usuarioId" = q."usuarioId";

    GET DIAGNOSTICS qtd_removida = ROW_COUNT;

    IF qtd_removida <> 22 THEN
        RAISE EXCEPTION
          'QA_ABORTADO: assinaturas removidas %',
          qtd_removida;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."Assinatura"
        WHERE "contextoKey" LIKE 'qa-etapa6-final-%'
    ) THEN
        RAISE EXCEPTION
          'QA_ABORTADO: assinaturas restantes';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."BillingComunicacao" c
        JOIN qa_assinaturas_alvo a
          ON a.id = c."assinaturaId"
    ) THEN
        RAISE EXCEPTION
          'QA_ABORTADO: comunicacoes restantes';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."Notificacao" n
        JOIN qa_assinaturas_alvo a
          ON position(a.id IN COALESCE(n.link, '')) > 0
    ) THEN
        RAISE EXCEPTION
          'QA_ABORTADO: notificacoes restantes';
    END IF;

    RAISE NOTICE 'ASSINATURAS_QA_REMOVIDAS: 22';
    RAISE NOTICE 'COMUNICACOES_QA_REMOVIDAS: 47';
    RAISE NOTICE 'NOTIFICACOES_QA_REMOVIDAS: 13';
    RAISE NOTICE 'TOTAL_QA_REMOVIDO: 82';
END
$qa$;

COMMIT;

SELECT COUNT(*) AS assinaturas_qa_restantes
FROM public."Assinatura"
WHERE "contextoKey" LIKE 'qa-etapa6-final-%';
