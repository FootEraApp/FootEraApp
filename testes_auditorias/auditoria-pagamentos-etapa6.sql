WITH pagamentos(id) AS (
    VALUES
        ('dd57c0fd-0d04-4cca-b531-9fd75022cb46'),
        ('371c2ca9-6312-42ae-923a-6dffde0cff0c'),
        ('7ddee043-24b2-4f80-b5e5-9ac0eeeca40e')
)
SELECT
    p.id,

    (
        SELECT COUNT(*)
        FROM public."BillingAutorizacaoEstorno" x
        WHERE x."pagamentoId" = p.id
    ) AS autorizacoes_estorno,

    (
        SELECT COUNT(*)
        FROM public."BillingCompensacaoEvento" x
        WHERE x."pagamentoId" = p.id
    ) AS compensacoes,

    (
        SELECT COUNT(*)
        FROM public."BillingPendenciaEvento" x
        WHERE x."pagamentoId" = p.id
    ) AS pendencias,

    (
        SELECT COUNT(*)
        FROM public."CreatorVenda" x
        WHERE x."pagamentoId" = p.id
    ) AS vendas_creator

FROM pagamentos p;
