begin;

-- MATERIALIZED hid the normalized query value behind an optimization barrier,
-- so Postgres chose a generic full scan inside the SQL function. The function
-- is defined in the immediately preceding migration; remove only that barrier
-- while preserving its signature, grants, scores and response contract.
do $migration$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.search_steam_apps(text,integer,integer)'::regprocedure
  );
  function_definition := replace(
    function_definition,
    'text_candidate_pool as materialized',
    'text_candidate_pool as not materialized'
  );
  if function_definition not like '%text_candidate_pool as not materialized%' then
    raise exception 'search_steam_apps optimizer barrier was not found';
  end if;
  execute function_definition;
end;
$migration$;

commit;
