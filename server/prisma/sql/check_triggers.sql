SELECT event_object_table AS tabela, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('PontuacaoAtleta','EstatisticaAtleta','RelacaoTreinamento')
ORDER BY 1,2;

-- Ver se sobrou alguma função usando 'new.' (minúsculo)
SELECT proname AS funcao
FROM pg_proc
WHERE pg_get_functiondef(oid) ILIKE '%new.%';
