SELECT
    origem_ns.nspname AS schema_origem,
    origem.relname AS tabela_origem,
    con.conname AS restricao,
    destino_ns.nspname AS schema_destino,
    destino.relname AS tabela_destino,
    pg_get_constraintdef(con.oid) AS definicao
FROM pg_constraint con
JOIN pg_class origem
    ON origem.oid = con.conrelid
JOIN pg_namespace origem_ns
    ON origem_ns.oid = origem.relnamespace
JOIN pg_class destino
    ON destino.oid = con.confrelid
JOIN pg_namespace destino_ns
    ON destino_ns.oid = destino.relnamespace
WHERE con.contype = 'f'
  AND origem_ns.nspname = 'public'
  AND origem.relname IN (
      'BillingComunicacao',
      'Notificacao',
      'LembreteNotificacaoEnviado'
  )
ORDER BY origem.relname, con.conname;

SELECT
    origem.relname AS tabela_origem,
    destino.relname AS tabela_destino,
    con.conname AS restricao,
    pg_get_constraintdef(con.oid) AS definicao
FROM pg_constraint con
JOIN pg_class origem
    ON origem.oid = con.conrelid
JOIN pg_class destino
    ON destino.oid = con.confrelid
WHERE con.contype = 'f'
  AND destino.relname = 'Assinatura'
ORDER BY origem.relname;
