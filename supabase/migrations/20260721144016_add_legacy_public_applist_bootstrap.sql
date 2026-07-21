begin;

alter table public.steam_app_index
  add column if not exists catalog_source text;

alter table public.steam_app_index
  drop constraint if exists steam_app_index_source_allowed,
  drop constraint if exists steam_app_index_catalog_source_allowed;

update public.steam_app_index
set catalog_source = case
  when source = 'legacy_app_list' then 'legacy_public_applist'
  when source = 'steamkit' then null
  else source
end
where catalog_source is null;

update public.steam_app_index
set source = 'legacy_public_applist'
where source = 'legacy_app_list';

alter table public.steam_app_index
  add constraint steam_app_index_source_allowed check (
    source in ('official_store_service', 'legacy_public_applist', 'individual_lookup')
  ),
  add constraint steam_app_index_catalog_source_allowed check (
    catalog_source is null
    or catalog_source in ('official_store_service', 'legacy_public_applist', 'individual_lookup')
  );

create index if not exists steam_app_index_catalog_source_synced_idx
  on public.steam_app_index (catalog_source, synced_at desc);

alter table public.steam_catalog_sync_state
  add column if not exists legacy_source_hash text,
  add column if not exists legacy_total_received bigint not null default 0,
  add column if not exists legacy_total_persisted bigint not null default 0,
  add column if not exists legacy_total_failed bigint not null default 0,
  add column if not exists legacy_last_batch integer not null default -1,
  add column if not exists legacy_batch_size integer,
  add column if not exists legacy_started_at timestamptz,
  add column if not exists legacy_completed_at timestamptz;

alter table public.steam_catalog_sync_state
  drop constraint if exists steam_catalog_sync_state_status_check,
  drop constraint if exists steam_catalog_sync_state_provider_allowed,
  drop constraint if exists steam_catalog_sync_state_legacy_counts_nonnegative;

alter table public.steam_catalog_sync_runs
  drop constraint if exists steam_catalog_sync_runs_provider_allowed;

update public.steam_catalog_sync_state
set provider = 'legacy_public_applist'
where provider = 'legacy_app_list';

update public.steam_catalog_sync_state
set provider = 'official_store_service'
where provider = 'steamkit';

update public.steam_catalog_sync_runs
set provider = 'legacy_public_applist'
where provider = 'legacy_app_list';

update public.steam_catalog_sync_runs
set provider = 'official_store_service'
where provider = 'steamkit';

alter table public.steam_catalog_sync_state
  add constraint steam_catalog_sync_state_status_check check (
    status in (
      'empty', 'idle', 'running', 'syncing', 'complete', 'partial',
      'complete_legacy', 'complete_official', 'failed'
    )
  ),
  add constraint steam_catalog_sync_state_provider_allowed check (
    provider in ('official_store_service', 'legacy_public_applist')
  ),
  add constraint steam_catalog_sync_state_legacy_counts_nonnegative check (
    legacy_total_received >= 0
    and legacy_total_persisted >= 0
    and legacy_total_failed >= 0
    and legacy_last_batch >= -1
    and (legacy_batch_size is null or legacy_batch_size between 500 and 2000)
  );

alter table public.steam_catalog_sync_runs
  add constraint steam_catalog_sync_runs_provider_allowed check (
    provider in ('official_store_service', 'legacy_public_applist')
  );

create or replace function public.claim_legacy_public_applist(
  p_source_hash text,
  p_total_received bigint,
  p_batch_size integer,
  p_lease_seconds integer default 600
)
returns table(acquired boolean, start_batch integer, claim_token uuid, resumed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_state public.steam_catalog_sync_state;
  next_token uuid := gen_random_uuid();
  next_batch integer := 0;
  is_resume boolean := false;
begin
  if p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador de catálogo inválido';
  end if;
  if p_total_received <= 0 then
    raise exception 'Catálogo vazio';
  end if;
  if p_batch_size not between 500 and 2000 then
    raise exception 'Tamanho de lote inválido';
  end if;

  select * into current_state
  from public.steam_catalog_sync_state
  where singleton = true
  for update;

  if current_state.status in ('running', 'syncing')
     and current_state.lease_expires_at is not null
     and current_state.lease_expires_at > now() then
    return query select false, 0, null::uuid, false;
    return;
  end if;

  is_resume := current_state.provider = 'legacy_public_applist'
    and current_state.legacy_source_hash = p_source_hash
    and current_state.legacy_total_received = p_total_received
    and current_state.legacy_batch_size = p_batch_size
    and current_state.status in ('syncing', 'partial', 'failed');

  if is_resume then
    next_batch := greatest(current_state.legacy_last_batch + 1, 0);
  end if;

  update public.steam_catalog_sync_state
  set status = 'syncing',
      sync_mode = 'full',
      provider = 'legacy_public_applist',
      catalog_complete = false,
      lock_token = next_token,
      lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 60), 1800)),
      last_error = null,
      last_started_at = now(),
      legacy_source_hash = p_source_hash,
      legacy_total_received = p_total_received,
      legacy_total_persisted = case when is_resume then legacy_total_persisted else 0 end,
      legacy_total_failed = case when is_resume then legacy_total_failed else 0 end,
      legacy_last_batch = case when is_resume then legacy_last_batch else -1 end,
      legacy_batch_size = p_batch_size,
      legacy_started_at = case when is_resume then coalesce(legacy_started_at, now()) else now() end,
      legacy_completed_at = null,
      bootstrap_started_at = case when is_resume then coalesce(bootstrap_started_at, now()) else now() end,
      bootstrap_completed_at = null,
      updated_at = now()
  where singleton = true;

  return query select true, next_batch, next_token, is_resume;
end;
$$;

create or replace function public.upsert_legacy_public_applist_batch(
  p_claim_token uuid,
  p_batch_index integer,
  p_apps jsonb
)
returns table(inserted_count bigint, updated_count bigint, ignored_count bigint, persisted_count bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_rows bigint := 0;
  updated_rows bigint := 0;
  ignored_rows bigint := 0;
  persisted_rows bigint := 0;
  changed integer := 0;
begin
  if jsonb_typeof(p_apps) <> 'array' or jsonb_array_length(p_apps) not between 1 and 2000 then
    raise exception 'Payload de lote inválido';
  end if;

  if not exists (
    select 1 from public.steam_catalog_sync_state
    where singleton = true
      and lock_token = p_claim_token
      and status = 'syncing'
      and lease_expires_at > now()
  ) then
    raise exception 'Lease de sincronização inválida';
  end if;

  with incoming as materialized (
    select distinct on (item.appid)
      item.appid,
      btrim(item.name) as name,
      btrim(item.normalized_name) as normalized_name
    from jsonb_to_recordset(p_apps) as item(appid bigint, name text, normalized_name text)
    where item.appid > 0
      and btrim(coalesce(item.name, '')) <> ''
      and btrim(coalesce(item.normalized_name, '')) <> ''
    order by item.appid, item.name
  ),
  measured as materialized (
    select
      count(*) filter (where existing.appid is null) as inserted_count,
      count(*) filter (
        where existing.appid is not null
          and (
            existing.name is distinct from incoming.name
            or existing.normalized_name is distinct from incoming.normalized_name
            or existing.catalog_source is distinct from 'legacy_public_applist'
            or not existing.is_available
          )
      ) as updated_count,
      count(*) filter (
        where existing.appid is not null
          and existing.name is not distinct from incoming.name
          and existing.normalized_name is not distinct from incoming.normalized_name
          and existing.catalog_source is not distinct from 'legacy_public_applist'
          and existing.is_available
      ) as ignored_count,
      count(*) as persisted_count
    from incoming
    left join public.steam_app_index existing on existing.appid = incoming.appid
  ),
  written as (
    insert into public.steam_app_index (
      appid, name, normalized_name, app_type, catalog_type, source,
      catalog_source, is_available, indexed_at, updated_at, synced_at
    )
    select
      incoming.appid, incoming.name, incoming.normalized_name, 'unknown', 'unknown',
      'legacy_public_applist', 'legacy_public_applist', true, now(), now(), now()
    from incoming
    on conflict (appid) do update
    set name = excluded.name,
        normalized_name = excluded.normalized_name,
        source = case
          when public.steam_app_index.source = 'individual_lookup' then public.steam_app_index.source
          else excluded.source
        end,
        catalog_source = excluded.catalog_source,
        is_available = true,
        updated_at = now(),
        synced_at = now()
    returning appid
  )
  select
    measured.inserted_count,
    measured.updated_count,
    measured.ignored_count,
    measured.persisted_count
  into inserted_rows, updated_rows, ignored_rows, persisted_rows
  from measured
  cross join (select count(*) from written) written_count;

  update public.steam_catalog_sync_state
  set legacy_last_batch = p_batch_index,
      legacy_total_persisted = legacy_total_persisted + persisted_rows,
      last_page_size = persisted_rows::integer,
      processed_apps = legacy_total_persisted + persisted_rows,
      total_indexed = (select count(*) from public.steam_app_index where is_available),
      lease_expires_at = now() + interval '10 minutes',
      updated_at = now()
  where singleton = true
    and lock_token = p_claim_token
    and status = 'syncing';
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Checkpoint de sincronização não atualizado';
  end if;

  return query select inserted_rows, updated_rows, ignored_rows, persisted_rows;
end;
$$;

create or replace function public.finish_legacy_public_applist(
  p_claim_token uuid,
  p_total_failed bigint default 0
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  update public.steam_catalog_sync_state
  set status = case when p_total_failed = 0 then 'complete_legacy' else 'partial' end,
      catalog_complete = p_total_failed = 0,
      legacy_total_failed = p_total_failed,
      legacy_completed_at = now(),
      bootstrap_completed_at = case when p_total_failed = 0 then now() else null end,
      last_full_sync_at = case when p_total_failed = 0 then now() else last_full_sync_at end,
      last_completed_at = now(),
      total_indexed = (select count(*) from public.steam_app_index where is_available),
      lock_token = null,
      lease_expires_at = null,
      updated_at = now()
  where singleton = true and lock_token = p_claim_token and status = 'syncing';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.pause_legacy_public_applist(p_claim_token uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  update public.steam_catalog_sync_state
  set status = 'partial', lock_token = null, lease_expires_at = null, updated_at = now()
  where singleton = true and lock_token = p_claim_token and status = 'syncing';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.fail_legacy_public_applist(p_claim_token uuid, p_safe_error text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  update public.steam_catalog_sync_state
  set status = 'failed',
      last_error = left(p_safe_error, 1000),
      lock_token = null,
      lease_expires_at = null,
      updated_at = now()
  where singleton = true and lock_token = p_claim_token and status = 'syncing';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

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
      coalesce(sai.catalog_source, sai.source) as catalog_source,
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

revoke all on function public.claim_legacy_public_applist(text, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.upsert_legacy_public_applist_batch(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.finish_legacy_public_applist(uuid, bigint) from public, anon, authenticated;
revoke all on function public.pause_legacy_public_applist(uuid) from public, anon, authenticated;
revoke all on function public.fail_legacy_public_applist(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_legacy_public_applist(text, bigint, integer, integer) to service_role;
grant execute on function public.upsert_legacy_public_applist_batch(uuid, integer, jsonb) to service_role;
grant execute on function public.finish_legacy_public_applist(uuid, bigint) to service_role;
grant execute on function public.pause_legacy_public_applist(uuid) to service_role;
grant execute on function public.fail_legacy_public_applist(uuid, text) to service_role;

revoke all on function public.search_steam_apps(text, integer, integer) from public, anon;
grant execute on function public.search_steam_apps(text, integer, integer) to authenticated;

commit;
