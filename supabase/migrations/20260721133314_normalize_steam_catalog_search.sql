begin;

create or replace function public.normalize_steam_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))),
          $chars$'’`´$chars$,
          ''
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

update public.steam_app_index
set normalized_name = public.normalize_steam_name(name)
where normalized_name is distinct from public.normalize_steam_name(name);

alter table public.steam_app_index
  drop constraint if exists steam_app_index_source_allowed;

update public.steam_app_index
set source = 'official_store_service'
where source = 'steam_catalog_sync';

alter table public.steam_app_index
  add constraint steam_app_index_source_allowed check (
    source in ('official_store_service', 'legacy_app_list', 'steamkit', 'individual_lookup')
  );

alter table public.steam_catalog_sync_state
  add column if not exists provider text not null default 'official_store_service';

alter table public.steam_catalog_sync_runs
  add column if not exists provider text not null default 'official_store_service';

alter table public.steam_catalog_sync_state
  drop constraint if exists steam_catalog_sync_state_provider_allowed;
alter table public.steam_catalog_sync_runs
  drop constraint if exists steam_catalog_sync_runs_provider_allowed;

alter table public.steam_catalog_sync_state
  add constraint steam_catalog_sync_state_provider_allowed check (
    provider in ('official_store_service', 'legacy_app_list', 'steamkit')
  );
alter table public.steam_catalog_sync_runs
  add constraint steam_catalog_sync_runs_provider_allowed check (
    provider in ('official_store_service', 'legacy_app_list', 'steamkit')
  );

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
    select public.normalize_steam_name(btrim(search_query)) as value
  ),
  candidates as (
    select
      sai.appid,
      sai.name,
      sai.app_type,
      sai.source,
      extensions.similarity(sai.normalized_name, query.value)::real as score,
      case
        when sai.appid::text = query.value then 0
        when sai.name = btrim(search_query) then 1
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
        sai.appid::text = query.value
        or sai.normalized_name = query.value
        or sai.normalized_name like query.value || '%'
        or sai.normalized_name like '% ' || query.value || '%'
        or sai.normalized_name operator(extensions.%) query.value
        or sai.normalized_name like '%' || query.value || '%'
      )
  ),
  ranked as (
    select candidates.*, count(*) over() as match_count
    from candidates
    order by rank_group, score desc, name, appid
    offset least(greatest(result_offset, 0), 1000)
    limit least(greatest(result_limit, 1), 20)
  )
  select
    ranked.appid,
    ranked.name,
    ranked.app_type,
    ranked.source,
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
  order by ranked.rank_group, ranked.score desc, ranked.name, ranked.appid;
$$;

revoke all on function public.search_steam_apps(text, integer, integer) from public, anon;
grant execute on function public.search_steam_apps(text, integer, integer) to authenticated;

commit;
