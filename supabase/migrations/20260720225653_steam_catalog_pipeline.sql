begin;

alter table public.catalog_games
  add column if not exists full_description text,
  add column if not exists developers text[] not null default '{}',
  add column if not exists publishers text[] not null default '{}',
  add column if not exists supported_languages text[] not null default '{}',
  add column if not exists price jsonb,
  add column if not exists release_date text,
  add column if not exists coming_soon boolean not null default false,
  add column if not exists metadata_updated_at timestamptz,
  add column if not exists last_import_attempt_at timestamptz,
  add column if not exists last_import_error text,
  add column if not exists import_attempts integer not null default 0;

alter table public.catalog_games
  add constraint catalog_games_full_description_length
  check (full_description is null or char_length(full_description) <= 12000),
  add constraint catalog_games_last_import_error_length
  check (last_import_error is null or char_length(last_import_error) <= 500),
  add constraint catalog_games_import_attempts_nonnegative
  check (import_attempts >= 0);

alter table public.session_games
  add column if not exists description text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists game_mode text;

alter table public.session_games
  add constraint session_games_description_length
  check (description is null or char_length(description) <= 2000),
  add constraint session_games_game_mode_length
  check (game_mode is null or char_length(game_mode) <= 80);

create index if not exists catalog_games_cache_refresh_idx
  on public.catalog_games (cache_expires_at, metadata_status)
  where steam_appid is not null;

create index if not exists steam_app_index_last_modified_idx
  on public.steam_app_index (last_modified, appid);

create table public.steam_catalog_sync_state (
  singleton boolean primary key default true check (singleton),
  last_appid bigint not null default 0 check (last_appid >= 0),
  if_modified_since bigint not null default 0 check (if_modified_since >= 0),
  status text not null default 'idle' check (status in ('idle', 'running', 'failed')),
  processed_apps bigint not null default 0 check (processed_apps >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.steam_catalog_sync_state (singleton)
values (true)
on conflict (singleton) do nothing;

create table public.steam_catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check (trigger_source in ('manual', 'cron')),
  status text not null default 'running' check (status in ('running', 'complete', 'partial', 'failed')),
  start_appid bigint not null default 0,
  end_appid bigint not null default 0,
  pages_processed integer not null default 0,
  apps_processed integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.steam_catalog_sync_state enable row level security;
alter table public.steam_catalog_sync_runs enable row level security;

revoke all on public.steam_catalog_sync_state from public, anon, authenticated;
revoke all on public.steam_catalog_sync_runs from public, anon, authenticated;
grant select, insert, update on public.steam_catalog_sync_state to service_role;
grant select, insert, update on public.steam_catalog_sync_runs to service_role;

create or replace function public.search_steam_apps(search_query text, result_limit integer default 8)
returns table(
  appid bigint,
  name text,
  app_type text,
  catalog_game_id uuid,
  header_image text,
  metadata_status public.metadata_status,
  cache_expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      sai.appid,
      sai.name,
      sai.app_type,
      extensions.similarity(sai.normalized_name, public.unaccent_safe(search_query)) as score,
      case when sai.normalized_name like public.unaccent_safe(search_query) || '%' then 1 else 0 end as prefix_match
    from public.steam_app_index sai
    where
      char_length(trim(search_query)) between 2 and 120
      and (
        sai.normalized_name like '%' || public.unaccent_safe(search_query) || '%'
        or extensions.similarity(sai.normalized_name, public.unaccent_safe(search_query)) > 0.12
      )
  )
  select
    ranked.appid,
    ranked.name,
    ranked.app_type,
    cg.id,
    cg.header_image,
    cg.metadata_status,
    cg.cache_expires_at
  from ranked
  left join public.catalog_games cg on cg.steam_appid = ranked.appid
  order by ranked.prefix_match desc, ranked.score desc, ranked.name
  limit least(greatest(result_limit, 1), 20);
$$;

revoke all on function public.search_steam_apps(text, integer) from public, anon;
grant execute on function public.search_steam_apps(text, integer) to authenticated;

-- A tiny bootstrap lets the documented smoke cases work before the first
-- incremental catalog job. The regular sync owns all subsequent updates.
insert into public.steam_app_index (appid, name, normalized_name, app_type)
values
  (730, 'Counter-Strike 2', public.unaccent_safe('Counter-Strike 2'), 'game'),
  (105600, 'Terraria', public.unaccent_safe('Terraria'), 'game')
on conflict (appid) do update
set name = excluded.name,
    normalized_name = excluded.normalized_name,
    app_type = excluded.app_type,
    indexed_at = now();

commit;
