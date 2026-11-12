\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() <> 'footera' THEN RAISE EXCEPTION 'Banco incorreto: %', current_database(); END IF;
END $$;
\echo '=== BANCO ==='
SELECT current_database() AS banco, current_user AS usuario, inet_server_port() AS porta;
\echo '=== METODOLOGIAS QA NO BANCO PRINCIPAL ==='
SELECT 'Metodologia' AS tabela, id, titulo FROM public."Metodologia"
WHERE titulo ~* '(^[[:space:]]*qa([[:space:]_:-]|$)|qa-rollback|qa-validade|qa-valid)' 
UNION ALL
SELECT 'MetodologiaAvulsa', id, titulo FROM public."MetodologiaAvulsa"
WHERE titulo ~* '(^[[:space:]]*qa([[:space:]_:-]|$)|qa-rollback|qa-validade|qa-valid)'
ORDER BY tabela,titulo;
\echo '=== CONTAGEM DE METODOLOGIAS ==='
SELECT 'Metodologia' AS tabela, count(*) AS total FROM public."Metodologia"
UNION ALL SELECT 'MetodologiaAvulsa', count(*) FROM public."MetodologiaAvulsa";
\echo '=== USUARIOS QA (NOME E LOGIN) ==='
SELECT id, "nomeDeUsuario", nome, tipo FROM public."Usuario"
WHERE "nomeDeUsuario" ~* '^[[:space:]]*qa([[:space:]_:-]|$)'
   OR nome ~* '^[[:space:]]*qa([[:space:]_:-]|$)'
ORDER BY "nomeDeUsuario";
\echo '=== RELACOES DE EXCLUSAO ==='
SELECT parent.relname AS tabela_pai, child.relname AS tabela_dependente,
       string_agg(child_attr.attname, ', ' ORDER BY k.ord) AS colunas_fk,
       CASE fk.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS ao_excluir
FROM pg_constraint fk
JOIN pg_class parent ON parent.oid = fk.confrelid
JOIN pg_namespace ns ON ns.oid = parent.relnamespace AND ns.nspname='public'
JOIN pg_class child ON child.oid = fk.conrelid
JOIN LATERAL unnest(fk.conkey) WITH ORDINALITY k(attnum,ord) ON true
JOIN pg_attribute child_attr ON child_attr.attrelid = child.oid AND child_attr.attnum=k.attnum
WHERE fk.contype='f' AND parent.relname IN ('Usuario','Organizacao','Creator','Metodologia','MetodologiaAvulsa','Clube','Escolinha','Federacao','Marca','Professor','Atleta','Olheiro','LearningProfile')
GROUP BY parent.relname, child.relname, fk.oid, fk.confdeltype
ORDER BY tabela_pai,tabela_dependente;