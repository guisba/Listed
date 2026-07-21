begin;

drop function if exists public.search_steam_apps(text, integer, integer);

create function public.search_steam_apps(
  search_query text,
  result_limit integer default 12,
  result_offset integer default 0
)
returns table(
  appid bigint,
  name text,
  app_type text,
  catalog_source text,
  catalog_game_id uuid,
  header_image text,
  release_date text,
  platforms text[],
  metadata_status public.metadata_status,
  cache_expires_at timestamptz,
  relevance real,
  total_matches bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query as (
    select
      public.normalize_steam_name(btrim(search_query)) as value,
      btrim(search_query) as original,
      public.normalize_steam_name(btrim(search_query)) ~ '^[0-9]{1,10}$' as is_numeric
  ),
  numeric_candidates as (
    select
      sai.appid,
      sai.name,
      sai.app_type,
      coalesce(sai.catalog_source, sai.source) as catalog_source,
      1::real as score,
      0 as rank_group
    from public.steam_app_index sai
    cross join query
    where sai.is_available
      and query.is_numeric
      and sai.appid = case when query.is_numeric then query.value::bigint end
  ),
  text_candidates as (
    select
      sai.appid,
      sai.name,
      sai.app_type,
      coalesce(sai.catalog_source, sai.source) as catalog_source,
      extensions.similarity(sai.normalized_name, query.value)::real as score,
      case
        when sai.name = query.original then 1
        when sai.normalized_name = query.value then 2
        when sai.normalized_name like query.value || '%' then 3
        when sai.normalized_name like '% ' || query.value || '%' then 4
        when sai.normalized_name operator(extensions.%) query.value then 5
        else 6
      end as rank_group
    from public.steam_app_index sai
    cross join query
    where sai.is_available
      and char_length(query.value) between 2 and 120
      and (
        sai.normalized_name = query.value
        or sai.normalized_name like query.value || '%'
        or sai.normalized_name like '% ' || query.value || '%'
        or sai.normalized_name operator(extensions.%) query.value
        or sai.normalized_name like '%' || query.value || '%'
      )
  ),
  candidates as (
    select * from numeric_candidates
    union all
    select * from text_candidates
  ),
  deduplicated as (
    select distinct on (candidates.appid) candidates.*
    from candidates
    order by candidates.appid, candidates.rank_group, candidates.score desc
  ),
  ranked as (
    select deduplicated.*, count(*) over() as match_count
    from deduplicated
    order by rank_group, case when app_type = 'game' then 0 else 1 end, score desc, name, appid
    offset least(greatest(result_offset, 0), 1000)
    limit least(greatest(result_limit, 1), 20)
  )
  select
    ranked.appid,
    ranked.name,
    ranked.app_type,
    ranked.catalog_source,
    cg.id,
    cg.header_image,
    cg.release_date,
    coalesce(cg.platforms, '{}'::text[]),
    cg.metadata_status,
    cg.cache_expires_at,
    ranked.score,
    ranked.match_count
  from ranked
  left join public.catalog_games cg on cg.steam_appid = ranked.appid
  order by ranked.rank_group,
    case when ranked.app_type = 'game' then 0 else 1 end,
    ranked.score desc,
    ranked.name,
    ranked.appid;
$$;

revoke all on function public.search_steam_apps(text, integer, integer) from public, anon;
grant execute on function public.search_steam_apps(text, integer, integer) to authenticated;

commit;
