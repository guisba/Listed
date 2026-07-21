begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.unaccent_safe(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')));
$$;

alter table public.steam_app_index
  add column if not exists catalog_type text not null default 'game',
  add column if not exists source text,
  add column if not exists is_available boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists synced_at timestamptz not null default now(),
  add column if not exists last_seen_generation uuid;

update public.steam_app_index sai
set source = case
      when exists (
        select 1
        from public.catalog_games cg
        where cg.steam_appid = sai.appid
          and cg.metadata_updated_at is not null
      ) then 'individual_lookup'
      else 'legacy_seed'
    end,
    catalog_type = sai.app_type,
    created_at = least(sai.indexed_at, now()),
    updated_at = sai.indexed_at,
    synced_at = sai.indexed_at
where sai.source is null;

-- Remove the former two-item bootstrap (and any equivalent untouched seed row).
-- Rows refreshed from the real Store provider are retained as individual lookups.
delete from public.steam_app_index sai
where sai.source = 'legacy_seed'
  and sai.last_modified is null
  and not exists (
    select 1
    from public.catalog_games cg
    where cg.steam_appid = sai.appid
      and cg.metadata_updated_at is not null
  );

alter table public.steam_app_index
  alter column source set default 'individual_lookup',
  alter column source set not null;

alter table public.steam_app_index
  drop constraint if exists steam_app_index_catalog_type_length,
  drop constraint if exists steam_app_index_source_allowed;

alter table public.steam_app_index
  add constraint steam_app_index_catalog_type_length check (char_length(catalog_type) between 2 and 40),
  add constraint steam_app_index_source_allowed check (source in ('steam_catalog_sync', 'individual_lookup'));

create index if not exists steam_app_index_normalized_name_idx
  on public.steam_app_index (normalized_name text_pattern_ops)
  where is_available;

drop index if exists public.steam_app_index_name_trgm_idx;
create index steam_app_index_name_trgm_idx
  on public.steam_app_index using gin (normalized_name extensions.gin_trgm_ops)
  where is_available;

create index if not exists steam_app_index_source_synced_idx
  on public.steam_app_index (source, synced_at desc);

create index if not exists steam_app_index_available_modified_idx
  on public.steam_app_index (last_modified desc, appid)
  where is_available;

alter table public.steam_catalog_sync_state
  add column if not exists sync_mode text not null default 'full',
  add column if not exists last_appid_checkpoint bigint not null default 0,
  add column if not exists last_modified_checkpoint bigint not null default 0,
  add column if not exists bootstrap_last_appid bigint not null default 0,
  add column if not exists incremental_last_appid bigint not null default 0,
  add column if not exists bootstrap_generation uuid,
  add column if not exists bootstrap_started_at timestamptz,
  add column if not exists bootstrap_completed_at timestamptz,
  add column if not exists last_full_sync_at timestamptz,
  add column if not exists last_incremental_sync_at timestamptz,
  add column if not exists catalog_complete boolean not null default false,
  add column if not exists total_indexed bigint not null default 0,
  add column if not exists last_page_size integer not null default 0,
  add column if not exists lock_token uuid,
  add column if not exists lease_expires_at timestamptz;

alter table public.steam_catalog_sync_state
  drop constraint if exists steam_catalog_sync_state_status_check,
  drop constraint if exists steam_catalog_sync_state_mode_check,
  drop constraint if exists steam_catalog_sync_state_checkpoints_nonnegative;
alter table public.steam_catalog_sync_state
  add constraint steam_catalog_sync_state_status_check
  check (status in ('idle', 'running', 'complete', 'partial', 'failed')),
  add constraint steam_catalog_sync_state_mode_check
  check (sync_mode in ('full', 'incremental')),
  add constraint steam_catalog_sync_state_checkpoints_nonnegative
  check (
    last_appid_checkpoint >= 0
    and last_modified_checkpoint >= 0
    and bootstrap_last_appid >= 0
    and incremental_last_appid >= 0
    and total_indexed >= 0
    and last_page_size >= 0
  );

update public.steam_catalog_sync_state
set last_appid_checkpoint = last_appid,
    last_modified_checkpoint = if_modified_since,
    bootstrap_last_appid = last_appid,
    total_indexed = (select count(*) from public.steam_app_index where is_available),
    catalog_complete = false;

alter table public.steam_catalog_sync_runs
  add column if not exists mode text not null default 'full',
  add column if not exists initial_cursor bigint not null default 0,
  add column if not exists final_cursor bigint not null default 0,
  add column if not exists received_count bigint not null default 0,
  add column if not exists inserted_count bigint not null default 0,
  add column if not exists updated_count bigint not null default 0,
  add column if not exists ignored_count bigint not null default 0,
  add column if not exists duration_ms bigint,
  add column if not exists lock_token uuid;

alter table public.steam_catalog_sync_runs
  drop constraint if exists steam_catalog_sync_runs_mode_check,
  drop constraint if exists steam_catalog_sync_runs_counts_nonnegative;

alter table public.steam_catalog_sync_runs
  add constraint steam_catalog_sync_runs_mode_check check (mode in ('full', 'incremental')),
  add constraint steam_catalog_sync_runs_counts_nonnegative check (
    initial_cursor >= 0
    and final_cursor >= 0
    and received_count >= 0
    and inserted_count >= 0
    and updated_count >= 0
    and ignored_count >= 0
    and (duration_ms is null or duration_ms >= 0)
  );

create index if not exists steam_catalog_sync_runs_started_idx
  on public.steam_catalog_sync_runs (started_at desc);

create index if not exists steam_catalog_sync_runs_status_idx
  on public.steam_catalog_sync_runs (status, started_at desc)
  where status in ('running', 'failed', 'partial');

create or replace function public.claim_steam_catalog_sync(
  requested_mode text,
  requested_restart boolean default false,
  lease_seconds integer default 270
)
returns table(
  acquired boolean,
  sync_mode text,
  start_cursor bigint,
  modified_since bigint,
  generation uuid,
  claim_token uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_state public.steam_catalog_sync_state;
  next_cursor bigint;
  next_generation uuid;
  next_token uuid := gen_random_uuid();
begin
  if requested_mode not in ('full', 'incremental') then
    raise exception 'Modo de sincronização inválido';
  end if;

  select * into current_state
  from public.steam_catalog_sync_state
  where singleton = true
  for update;

  if current_state.status = 'running'
     and current_state.lease_expires_at is not null
     and current_state.lease_expires_at > now() then
    return query select false, requested_mode, 0::bigint, 0::bigint, null::uuid, null::uuid;
    return;
  end if;

  if requested_mode = 'full' then
    if requested_restart or current_state.catalog_complete or current_state.bootstrap_started_at is null then
      next_cursor := 0;
      next_generation := gen_random_uuid();
    else
      next_cursor := current_state.bootstrap_last_appid;
      next_generation := coalesce(current_state.bootstrap_generation, gen_random_uuid());
    end if;
  else
    next_cursor := current_state.incremental_last_appid;
    next_generation := current_state.bootstrap_generation;
  end if;

  update public.steam_catalog_sync_state
  set status = 'running',
      sync_mode = requested_mode,
      lock_token = next_token,
      lease_expires_at = now() + make_interval(secs => least(greatest(lease_seconds, 30), 600)),
      last_error = null,
      last_started_at = now(),
      last_appid_checkpoint = next_cursor,
      last_appid = next_cursor,
      bootstrap_generation = case when requested_mode = 'full' then next_generation else bootstrap_generation end,
      bootstrap_started_at = case
        when requested_mode = 'full' and (requested_restart or catalog_complete or bootstrap_started_at is null) then now()
        else bootstrap_started_at
      end,
      bootstrap_completed_at = case
        when requested_mode = 'full' and (requested_restart or catalog_complete) then null
        else bootstrap_completed_at
      end,
      catalog_complete = case
        when requested_mode = 'full' and (requested_restart or catalog_complete) then false
        else catalog_complete
      end,
      processed_apps = case
        when requested_mode = 'full' and (requested_restart or catalog_complete) then 0
        else processed_apps
      end,
      updated_at = now()
  where singleton = true;

  return query select true, requested_mode, next_cursor,
    case when requested_mode = 'incremental' then current_state.last_modified_checkpoint else 0 end,
    next_generation, next_token;
end;
$$;

create or replace function public.checkpoint_steam_catalog_sync(
  claim_token uuid,
  requested_mode text,
  next_cursor bigint,
  page_size integer,
  received_delta bigint
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  update public.steam_catalog_sync_state
  set last_appid_checkpoint = next_cursor,
      last_appid = next_cursor,
      bootstrap_last_appid = case when requested_mode = 'full' then next_cursor else bootstrap_last_appid end,
      incremental_last_appid = case when requested_mode = 'incremental' then next_cursor else incremental_last_appid end,
      last_page_size = page_size,
      processed_apps = processed_apps + received_delta,
      total_indexed = (select count(*) from public.steam_app_index where is_available),
      lease_expires_at = now() + interval '270 seconds',
      updated_at = now()
  where singleton = true and lock_token = claim_token and status = 'running';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.finish_steam_catalog_sync(
  claim_token uuid,
  requested_mode text,
  reached_end boolean,
  final_cursor bigint,
  modified_checkpoint bigint
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  if requested_mode = 'full' and reached_end then
    update public.steam_app_index sai
    set is_available = false, updated_at = now()
    where sai.source = 'steam_catalog_sync'
      and sai.is_available
      and sai.last_seen_generation is distinct from (
        select bootstrap_generation
        from public.steam_catalog_sync_state
        where singleton = true and lock_token = claim_token
      );
  end if;

  update public.steam_catalog_sync_state
  set status = case when reached_end then 'complete' else 'partial' end,
      last_appid_checkpoint = case when reached_end then 0 else final_cursor end,
      last_appid = case when reached_end then 0 else final_cursor end,
      bootstrap_last_appid = case when requested_mode = 'full' and reached_end then 0 else bootstrap_last_appid end,
      incremental_last_appid = case when requested_mode = 'incremental' and reached_end then 0 else incremental_last_appid end,
      last_modified_checkpoint = case
        when requested_mode = 'incremental' and reached_end then modified_checkpoint
        when requested_mode = 'full' and reached_end then modified_checkpoint
        else last_modified_checkpoint
      end,
      if_modified_since = case when reached_end then modified_checkpoint else if_modified_since end,
      bootstrap_completed_at = case when requested_mode = 'full' and reached_end then now() else bootstrap_completed_at end,
      last_full_sync_at = case when requested_mode = 'full' and reached_end then now() else last_full_sync_at end,
      last_incremental_sync_at = case when requested_mode = 'incremental' and reached_end then now() else last_incremental_sync_at end,
      last_completed_at = case when reached_end then now() else last_completed_at end,
      catalog_complete = case when requested_mode = 'full' and reached_end then true else catalog_complete end,
      total_indexed = (select count(*) from public.steam_app_index where is_available),
      lock_token = null,
      lease_expires_at = null,
      updated_at = now()
  where singleton = true and lock_token = claim_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.fail_steam_catalog_sync(
  claim_token uuid,
  safe_error text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  update public.steam_catalog_sync_state
  set status = 'failed',
      last_error = left(safe_error, 1000),
      lock_token = null,
      lease_expires_at = null,
      updated_at = now()
  where singleton = true and lock_token = claim_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

drop function if exists public.search_steam_apps(text, integer);
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
    select public.unaccent_safe(btrim(search_query)) as value
  ),
  candidates as (
    select
      sai.appid,
      sai.name,
      sai.app_type,
      extensions.similarity(sai.normalized_name, query.value)::real as score,
      case
        when sai.appid::text = query.value then 0
        when sai.normalized_name = query.value then 1
        when sai.normalized_name like query.value || '%' then 2
        when sai.normalized_name like '% ' || query.value || '%' then 3
        when sai.normalized_name operator(extensions.%) query.value then 4
        else 5
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

revoke all on function public.claim_steam_catalog_sync(text, boolean, integer) from public, anon, authenticated;
revoke all on function public.checkpoint_steam_catalog_sync(uuid, text, bigint, integer, bigint) from public, anon, authenticated;
revoke all on function public.finish_steam_catalog_sync(uuid, text, boolean, bigint, bigint) from public, anon, authenticated;
revoke all on function public.fail_steam_catalog_sync(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_steam_catalog_sync(text, boolean, integer) to service_role;
grant execute on function public.checkpoint_steam_catalog_sync(uuid, text, bigint, integer, bigint) to service_role;
grant execute on function public.finish_steam_catalog_sync(uuid, text, boolean, bigint, bigint) to service_role;
grant execute on function public.fail_steam_catalog_sync(uuid, text) to service_role;

revoke all on function public.search_steam_apps(text, integer, integer) from public, anon;
grant execute on function public.search_steam_apps(text, integer, integer) to authenticated;

commit;
