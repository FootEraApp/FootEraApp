\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN IF current_database() <> 'footera' THEN RAISE EXCEPTION 'Banco incorreto: %', current_database(); END IF; END $$;
CREATE TEMP TABLE qa_alvos (tabela text NOT NULL, id text NOT NULL, PRIMARY KEY(tabela,id)) ON COMMIT DROP;
INSERT INTO qa_alvos(tabela,id) VALUES
('Usuario','f8bd1ba8-54b8-4a44-8900-8e4c571948b2'),
('Usuario','21a2a402-ea82-4808-8c16-130789dc050b'),
('Usuario','02a9322b-01a7-4ba0-9307-62ca7c4bdb4c'),
('Usuario','a5921600-0796-4731-8cde-0484c0cfc348'),
('Usuario','0d669ccf-cac3-4d52-a62d-35702c8cbdb8'),
('Usuario','c41dc4a0-918b-41a2-ab08-4950e327e83d'),
('Usuario','d2999a7b-7878-4424-b150-dc391cf4b573'),
('Usuario','5339b96b-0109-47c3-878d-3a80ef6e3abd'),
('Usuario','7f1c675b-6470-4858-85ba-24c9bab773e5'),
('Usuario','0fda7d22-a53f-43b0-8211-d7cbf41ae8b8'),
('Usuario','6ebcf098-bf20-4c41-a270-fe8afafda4fc'),
('Usuario','de90a9c2-228c-4e48-a118-d3ccf52f2e0b'),
('Usuario','c9f1be0e-3b55-420b-a5c1-7d783fc62ca5'),
('Usuario','b1997acd-9802-4506-9872-9c14613bbdf3'),
('Usuario','96d4c3b5-ae0e-4d57-b465-515be75b73c1'),
('Usuario','908c59cb-e57a-4a0d-9097-5e7c7f3b9729'),
('Usuario','c9454413-d35c-4730-af10-9b3badf8b71f'),
('Usuario','5bb74725-86e0-4f5e-9da8-6950b607243c'),
('Usuario','1847d200-29e6-4cc1-bd35-2e6318b23328'),
('Usuario','df07c93c-b972-403e-a430-e7ce0e76fc9f');
INSERT INTO qa_alvos(tabela,id) VALUES
('Organizacao','b420708e-1708-4085-94ef-f2a39064e4b2'),
('Organizacao','f8c87203-27f9-4cd3-9cfe-fa109d558be8'),
('Organizacao','68aa8c19-6f02-4621-91d8-f07f98d5b8d1'),
('Organizacao','c7e699ff-e194-4e27-bdbe-57f3925b1cac'),
('Organizacao','8ea2ab35-84ea-494f-9494-7c46b2f48d63'),
('Organizacao','fb386568-c808-450e-8f81-56f08726b284'),
('Organizacao','12d177ef-fcb0-4bd2-ae93-090e0cc64f18'),
('Organizacao','73c1df6f-92c5-4e76-82bd-d67a0dfb3ff9');
INSERT INTO qa_alvos(tabela,id) VALUES
('Creator','608a7a29-5e5f-4a23-8b80-72bf55037d0a'),
('Creator','a91ba6ee-aa0e-4c50-9f98-9bdce5eaa36d'),
('Creator','77bfe2bc-6596-4a61-b4aa-6bffc017c1a3'),
('Creator','6a99974e-9af4-49a4-874c-b910dce61c47'),
('Creator','fcb0df10-7f94-4ed8-b13c-4a0e4b5812d4'),
('Creator','e4c073eb-888c-4b90-b600-3dacd5d00b39');
INSERT INTO qa_alvos(tabela,id) VALUES
('Clube','f7a8bd68-a2b0-4b3e-af66-ab62f0ee0db9'),
('Clube','26af081d-124f-4625-bdb3-5c5184b89a14');
INSERT INTO qa_alvos(tabela,id) VALUES
('Escolinha','015c1380-0f5c-4547-b4d8-f8a9b657dacf'),
('Escolinha','9beb428b-8b97-453d-8be1-6742a8bf6391');
INSERT INTO qa_alvos(tabela,id) VALUES
('Federacao','3dfb9da5-5004-40c1-bf5d-ee44d9f3672a'),
('Federacao','48e001e9-c52a-42da-9b0d-89c599050a97');
INSERT INTO qa_alvos(tabela,id) VALUES
('Marca','b0b9a408-5dfe-4ef0-9c96-4dd545ed0e5b'),
('Marca','7a25f26e-8a9a-4371-b48f-2409e7d6f21c');
INSERT INTO qa_alvos(tabela,id) VALUES
('Professor','d01e97d0-ffe9-4bc0-b686-a687a23c3d0f'),
('Professor','78e9ca14-32dc-466b-8142-84a9cb2a4ad6');
-- Tambem monitora dependencias dos perfis secundarios dos usuarios QA.
INSERT INTO qa_alvos(tabela,id)
SELECT 'Atleta', a.id::text FROM "Atleta" a JOIN qa_alvos q ON q.tabela='Usuario' AND q.id=a."usuarioId"::text
ON CONFLICT DO NOTHING;
INSERT INTO qa_alvos(tabela,id)
SELECT 'Olheiro', a.id::text FROM "Olheiro" a JOIN qa_alvos q ON q.tabela='Usuario' AND q.id=a."usuarioId"::text
ON CONFLICT DO NOTHING;
INSERT INTO qa_alvos(tabela,id)
SELECT 'LearningProfile', a.id::text FROM "LearningProfile" a JOIN qa_alvos q ON q.tabela='Usuario' AND q.id=a."usuarioId"::text
ON CONFLICT DO NOTHING;

DO $$
DECLARE r record; esperado_count bigint; rotulo text; coluna text;
BEGIN
  FOR r IN SELECT tabela, count(*) AS n FROM qa_alvos GROUP BY tabela LOOP
    SELECT v.quantidade INTO esperado_count
    FROM (VALUES
      ('Usuario',20::bigint), ('Organizacao',8::bigint),
      ('Creator',6::bigint), ('Clube',2::bigint),
      ('Escolinha',2::bigint), ('Federacao',2::bigint),
      ('Marca',2::bigint), ('Professor',2::bigint)
    ) AS v(tabela, quantidade)
    WHERE v.tabela = r.tabela;

    IF esperado_count IS NOT NULL AND r.n <> esperado_count THEN
      RAISE EXCEPTION 'Quantidade inesperada na lista: % (atual %, esperado %)',
        r.tabela, r.n, esperado_count;
    END IF;
  END LOOP;
  FOR r IN SELECT tabela, id FROM qa_alvos LOOP
    coluna := CASE r.tabela WHEN 'Usuario' THEN 'nomeDeUsuario' WHEN 'Creator' THEN 'nomePublico' ELSE 'nome' END;
    IF r.tabela IN ('Atleta','Olheiro','LearningProfile') THEN CONTINUE; END IF;
    EXECUTE format('SELECT %I::text FROM public.%I WHERE id::text=$1',coluna,r.tabela) INTO rotulo USING r.id;
    IF rotulo IS NULL OR rotulo !~* '^\s*qa([_ -]|$)' THEN
      RAISE EXCEPTION 'Alvo ausente ou nao QA: %.% = %',r.tabela,r.id,rotulo;
    END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE qa_fks (origem text, dependente text, coluna text, linhas bigint, esperado bigint) ON COMMIT DROP;
DO $$
DECLARE r record; n bigint; esperado bigint;
BEGIN
  FOR r IN
    SELECT p.relname pai, c.relname filho, ca.attname fk_col
    FROM pg_constraint fk
    JOIN pg_class p ON p.oid=fk.confrelid
    JOIN pg_namespace pn ON pn.oid=p.relnamespace AND pn.nspname='public'
    JOIN pg_class c ON c.oid=fk.conrelid
    JOIN pg_namespace cn ON cn.oid=c.relnamespace AND cn.nspname='public'
    JOIN pg_attribute ca ON ca.attrelid=c.oid AND ca.attnum=fk.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=p.oid AND pa.attnum=fk.confkey[1]
    WHERE fk.contype='f' AND array_length(fk.conkey,1)=1
      AND pa.attname='id'
      AND EXISTS(SELECT 1 FROM qa_alvos q WHERE q.tabela=p.relname)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I x WHERE x.%I::text IN (SELECT id FROM qa_alvos WHERE tabela=%L)',r.filho,r.fk_col,r.pai) INTO n;
    esperado := CASE concat_ws('|',r.pai,r.filho,r.fk_col)

      WHEN 'Organizacao|MembroOrganizacao|organizacaoId' THEN 8
      WHEN 'Organizacao|Usuario|contextoOrganizacaoId' THEN 8
      WHEN 'Organizacao|Creator|organizacaoId' THEN 4
      WHEN 'Organizacao|Clube|organizacaoId' THEN 2
      WHEN 'Organizacao|Escolinha|organizacaoId' THEN 2
      WHEN 'Organizacao|Federacao|organizacaoId' THEN 2
      WHEN 'Organizacao|Marca|organizacaoId' THEN 2
      WHEN 'Usuario|UsuarioPapel|usuarioId' THEN 38
      WHEN 'Usuario|LoginEvent|usuarioId' THEN 20
      WHEN 'Usuario|MembroOrganizacao|usuarioId' THEN 8
      WHEN 'Usuario|Atleta|usuarioId' THEN 2
      WHEN 'Usuario|Clube|usuarioId' THEN 2
      WHEN 'Usuario|Creator|usuarioId' THEN 2
      WHEN 'Usuario|Escolinha|usuarioId' THEN 2
      WHEN 'Usuario|Federacao|usuarioId' THEN 2
      WHEN 'Usuario|LearningProfile|usuarioId' THEN 2
      WHEN 'Usuario|Marca|usuarioId' THEN 2
      WHEN 'Usuario|Olheiro|usuarioId' THEN 2
      WHEN 'Usuario|Professor|usuarioId' THEN 2
      WHEN 'Atleta|PontuacaoAtleta|atletaId' THEN 2
      ELSE 0 END;
    INSERT INTO qa_fks VALUES (r.pai,r.filho,r.fk_col,n,esperado);
    -- Registra todas as divergencias para auditoria conjunta.
    -- Nenhuma exclusao e permitida se houver divergencias.
  END LOOP;
END $$;
\echo '=== TODAS AS DEPENDENCIAS DIVERGENTES ==='
SELECT origem, dependente, coluna, linhas AS atual, esperado
FROM qa_fks WHERE linhas <> esperado
ORDER BY origem, dependente, coluna;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM qa_fks WHERE linhas <> esperado) THEN
    RAISE EXCEPTION 'SIMULACAO INTERROMPIDA: existem dependencias divergentes. Nenhuma exclusao realizada.';
  END IF;
END $$;
\echo '=== Dependencias conferidas ==='
SELECT origem,dependente,coluna,linhas FROM qa_fks WHERE linhas>0 ORDER BY origem,dependente;
\echo '=== Exclusoes simuladas ==='
-- A sequencia evita o RESTRICT Organizacao -> Creator.

WITH excluidos AS (DELETE FROM "Creator" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Creator') RETURNING id) SELECT 'Creator' AS tabela, count(*) AS excluidos FROM excluidos;
WITH excluidos AS (DELETE FROM "Clube" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Clube') RETURNING id) SELECT 'Clube' AS tabela, count(*) AS excluidos FROM excluidos;
WITH excluidos AS (DELETE FROM "Escolinha" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Escolinha') RETURNING id) SELECT 'Escolinha' AS tabela, count(*) AS excluidos FROM excluidos;
WITH excluidos AS (DELETE FROM "Federacao" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Federacao') RETURNING id) SELECT 'Federacao' AS tabela, count(*) AS excluidos FROM excluidos;
WITH excluidos AS (DELETE FROM "Marca" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Marca') RETURNING id) SELECT 'Marca' AS tabela, count(*) AS excluidos FROM excluidos;
WITH excluidos AS (DELETE FROM "Professor" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Professor') RETURNING id) SELECT 'Professor' AS tabela, count(*) AS excluidos FROM excluidos;
WITH excluidos AS (DELETE FROM "Organizacao" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Organizacao') RETURNING id) SELECT 'Organizacao' AS tabela, count(*) AS excluidos FROM excluidos;
WITH excluidos AS (DELETE FROM "Usuario" WHERE id::text IN (SELECT id FROM qa_alvos WHERE tabela='Usuario') RETURNING id) SELECT 'Usuario' AS tabela, count(*) AS excluidos FROM excluidos;
\echo '=== QA remanescente apos exclusoes dentro da transacao ==='
SELECT 'Usuario' AS tabela, count(*) AS restantes FROM "Usuario" WHERE "nomeDeUsuario" ~* '^qa_rec_'
UNION ALL SELECT 'Organizacao', count(*) FROM "Organizacao" WHERE nome ~* '^qa([ _-]|$)'
UNION ALL SELECT 'Creator', count(*) FROM "Creator" WHERE "nomePublico" ~* '^qa([ _-]|$)'
UNION ALL SELECT 'Metodologia', count(*) FROM "Metodologia" WHERE titulo ~* '^qa([ _-]|$)'
UNION ALL SELECT 'MetodologiaAvulsa', count(*) FROM "MetodologiaAvulsa" WHERE titulo ~* '^qa([ _-]|$)';

ROLLBACK;
\echo SIMULACAO CONCLUIDA: NENHUMA ALTERACAO PERSISTIDA