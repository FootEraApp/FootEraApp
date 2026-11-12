\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'footera' THEN
    RAISE EXCEPTION 'BANCO INCORRETO: esperado footera; atual %', current_database();
  END IF;
END $$;
CREATE TEMP TABLE qa_candidatos (tabela text NOT NULL, id text NOT NULL, coluna text NOT NULL, rotulo text) ON COMMIT DROP;
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('nome', 'nomeDeUsuario', 'titulo', 'nomePublico', 'slug')
      AND c.data_type IN ('text', 'character varying')
      AND EXISTS (
        SELECT 1 FROM information_schema.columns idc
        WHERE idc.table_schema = c.table_schema
          AND idc.table_name = c.table_name
          AND idc.column_name = 'id'
      )
    ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format(
      'INSERT INTO qa_candidatos(tabela,id,coluna,rotulo) SELECT %L, id::text, %L, left(%I::text, 180) FROM %I.%I WHERE %I ~* %L',
      r.table_name, r.column_name, r.column_name,
      'public', r.table_name, r.column_name,
      '^\s*qa($|[ _:\-])'
    );
  END LOOP;
END $$;
\echo '=== TOTAL DE REGISTROS QA POR TABELA ==='
SELECT tabela, count(DISTINCT id) AS registros
FROM qa_candidatos GROUP BY tabela ORDER BY registros DESC, tabela;
\echo '=== CANDIDATOS (LIMITADO A 300 LINHAS) ==='
SELECT DISTINCT tabela, id, rotulo FROM qa_candidatos ORDER BY tabela, rotulo LIMIT 300;
\echo '=== DEPENDENCIAS DIRETAS: TABELAS QUE REFERENCIAM CANDIDATOS ==='
CREATE TEMP TABLE qa_dependencias (origem text, dependente text, fk_coluna text, linhas bigint) ON COMMIT DROP;
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN
    SELECT parent.relname AS pai, child.relname AS filho,
           child_col.attname AS coluna_fk
    FROM pg_constraint fk
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_namespace pn ON pn.oid = parent.relnamespace AND pn.nspname = 'public'
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace cn ON cn.oid = child.relnamespace AND cn.nspname = 'public'
    JOIN pg_attribute child_col ON child_col.attrelid = child.oid AND child_col.attnum = fk.conkey[1]
    JOIN pg_attribute parent_col ON parent_col.attrelid = parent.oid AND parent_col.attnum = fk.confkey[1]
    WHERE fk.contype = 'f'
      AND array_length(fk.conkey,1) = 1
      AND parent_col.attname = 'id'
      AND EXISTS (SELECT 1 FROM qa_candidatos q WHERE q.tabela = parent.relname)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I ch WHERE ch.%I::text IN (SELECT id FROM qa_candidatos WHERE tabela = %L)',
                    r.filho, r.coluna_fk, r.pai) INTO n;
    IF n > 0 THEN
      INSERT INTO qa_dependencias VALUES (r.pai, r.filho, r.coluna_fk, n);
    END IF;
  END LOOP;
END $$;
SELECT * FROM qa_dependencias ORDER BY origem, linhas DESC, dependente;
ROLLBACK;