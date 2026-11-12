BEGIN;

DO $qa$
DECLARE
    quantidade INTEGER;
BEGIN
    SELECT COUNT(*) INTO quantidade
    FROM public."Pagamento"
    WHERE id IN (
        'dd57c0fd-0d04-4cca-b531-9fd75022cb46',
        '371c2ca9-6312-42ae-923a-6dffde0cff0c',
        '7ddee043-24b2-4f80-b5e5-9ac0eeeca40e'
    )
      AND status::text = 'PENDENTE'
      AND provider::text = 'MERCADOPAGO'
      AND plano = 'ATLETA_PRO'
      AND valor = 25
      AND meta IS NULL
      AND "providerRef" = 'PREF-QA-' || id
      AND (
        (id = 'dd57c0fd-0d04-4cca-b531-9fd75022cb46'
         AND "usuarioId" = '028ac42d-dec7-43d7-a2df-55da65b22b8b')
        OR
        (id IN (
            '371c2ca9-6312-42ae-923a-6dffde0cff0c',
            '7ddee043-24b2-4f80-b5e5-9ac0eeeca40e'
         )
         AND "usuarioId" = '45cdfd17-6761-4787-b2f7-bd14cd10fe92')
      );

    IF quantidade <> 3 THEN
        RAISE EXCEPTION
            'QA_ABORTADO: esperados 3 pagamentos, encontrados %',
            quantidade;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public."Pagamento" p
        WHERE p.id IN (
            'dd57c0fd-0d04-4cca-b531-9fd75022cb46',
            '371c2ca9-6312-42ae-923a-6dffde0cff0c',
            '7ddee043-24b2-4f80-b5e5-9ac0eeeca40e'
        )
        AND (
            EXISTS (SELECT 1 FROM public."BillingAutorizacaoEstorno" x WHERE x."pagamentoId" = p.id)
            OR EXISTS (SELECT 1 FROM public."BillingCheckoutOperacao" x WHERE x."pagamentoId" = p.id)
            OR EXISTS (SELECT 1 FROM public."BillingCompensacaoEvento" x WHERE x."pagamentoId" = p.id)
            OR EXISTS (SELECT 1 FROM public."BillingPendenciaEvento" x WHERE x."pagamentoId" = p.id)
            OR EXISTS (SELECT 1 FROM public."CreatorVenda" x WHERE x."pagamentoId" = p.id)
            OR EXISTS (SELECT 1 FROM public."CupomReserva" x WHERE x."pagamentoId" = p.id)
            OR EXISTS (SELECT 1 FROM public."CupomResgate" x WHERE x."pagamentoId" = p.id)
            OR EXISTS (SELECT 1 FROM public."PagamentoBeneficio" x WHERE x."pagamentoId" = p.id)
        )
    ) THEN
        RAISE EXCEPTION 'QA_ABORTADO: pagamento com relacionamento';
    END IF;

    DELETE FROM public."Pagamento"
    WHERE id IN (
        'dd57c0fd-0d04-4cca-b531-9fd75022cb46',
        '371c2ca9-6312-42ae-923a-6dffde0cff0c',
        '7ddee043-24b2-4f80-b5e5-9ac0eeeca40e'
    );

    GET DIAGNOSTICS quantidade = ROW_COUNT;

    IF quantidade <> 3 THEN
        RAISE EXCEPTION 'QA_ABORTADO: exclusao incompleta';
    END IF;

    RAISE NOTICE 'PAGAMENTOS_QA_REMOVIDOS: %', quantidade;
END
$qa$;

COMMIT;

SELECT COUNT(*) AS pagamentos_qa_restantes
FROM public."Pagamento"
WHERE id IN (
    'dd57c0fd-0d04-4cca-b531-9fd75022cb46',
    '371c2ca9-6312-42ae-923a-6dffde0cff0c',
    '7ddee043-24b2-4f80-b5e5-9ac0eeeca40e'
);
