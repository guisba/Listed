begin;

alter table public.steam_app_index
  add column if not exists capsule_image_url text,
  add column if not exists header_image_url text,
  add column if not exists image_source text,
  add column if not exists image_status text not null default 'unknown',
  add column if not exists image_updated_at timestamptz,
  add column if not exists popularity_score real not null default 0,
  add column if not exists popularity_updated_at timestamptz;

alter table public.steam_app_index
  drop constraint if exists steam_app_index_capsule_image_https,
  add constraint steam_app_index_capsule_image_https
    check (capsule_image_url is null or capsule_image_url ~ '^https://'),
  drop constraint if exists steam_app_index_header_image_https,
  add constraint steam_app_index_header_image_https
    check (header_image_url is null or header_image_url ~ '^https://'),
  drop constraint if exists steam_app_index_image_source_check,
  add constraint steam_app_index_image_source_check
    check (image_source is null or image_source = any (array['individual_lookup', 'catalog_cache'])),
  drop constraint if exists steam_app_index_image_status_check,
  add constraint steam_app_index_image_status_check
    check (image_status = any (array['unknown', 'available', 'missing', 'failed', 'stale'])),
  drop constraint if exists steam_app_index_popularity_score_check,
  add constraint steam_app_index_popularity_score_check
    check (popularity_score between 0 and 250);

create index if not exists steam_app_index_image_refresh_idx
  on public.steam_app_index (image_status, image_updated_at)
  where is_available;

update public.steam_app_index sai
set
  capsule_image_url = coalesce(cg.cover_image, cg.header_image),
  header_image_url = cg.header_image,
  image_source = 'catalog_cache',
  image_status = 'available',
  image_updated_at = coalesce(cg.metadata_updated_at, cg.updated_at, now())
from public.catalog_games cg
where cg.steam_appid = sai.appid
  and (cg.cover_image is not null or cg.header_image is not null);

create table if not exists private.steam_app_popularity (
  appid bigint primary key references public.steam_app_index(appid) on delete cascade,
  listed_additions bigint not null default 0 check (listed_additions >= 0),
  listed_votes bigint not null default 0 check (listed_votes >= 0),
  listed_unique_groups bigint not null default 0 check (listed_unique_groups >= 0),
  calculated_at timestamptz not null default now()
);

revoke all on table private.steam_app_popularity from public, anon, authenticated;

create or replace function private.calculate_steam_popularity_score(
  listed_additions bigint,
  listed_votes bigint,
  listed_unique_groups bigint
)
returns real
language sql
immutable
strict
set search_path = ''
as $$
  select least(
    250::double precision,
    60 * ln(1 + greatest(listed_unique_groups, 0))
      + 18 * ln(1 + greatest(listed_votes, 0))
      + 8 * ln(1 + greatest(listed_additions, 0))
  )::real;
$$;

revoke all on function private.calculate_steam_popularity_score(bigint, bigint, bigint) from public, anon, authenticated;

create or replace function private.refresh_steam_app_popularity(target_appid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  additions_count bigint := 0;
  votes_count bigint := 0;
  unique_groups_count bigint := 0;
  calculated_score real := 0;
begin
  if target_appid is null or target_appid <= 0 then
    return;
  end if;

  select
    count(*),
    count(distinct coalesce(s.group_id::text, sg.session_id::text))
  into additions_count, unique_groups_count
  from public.session_games sg
  join public.sessions s on s.id = sg.session_id
  where sg.steam_appid = target_appid
    and sg.removed_at is null
    and s.deleted_at is null;

  select count(*)
  into votes_count
  from public.votes v
  join public.session_games sg on sg.id = v.session_game_id
  where sg.steam_appid = target_appid
    and sg.removed_at is null;

  calculated_score := private.calculate_steam_popularity_score(
    additions_count,
    votes_count,
    unique_groups_count
  );

  insert into private.steam_app_popularity (
    appid,
    listed_additions,
    listed_votes,
    listed_unique_groups,
    calculated_at
  ) values (
    target_appid,
    additions_count,
    votes_count,
    unique_groups_count,
    now()
  )
  on conflict (appid) do update set
    listed_additions = excluded.listed_additions,
    listed_votes = excluded.listed_votes,
    listed_unique_groups = excluded.listed_unique_groups,
    calculated_at = excluded.calculated_at;

  update public.steam_app_index
  set
    popularity_score = calculated_score,
    popularity_updated_at = now()
  where appid = target_appid;
end;
$$;

revoke all on function private.refresh_steam_app_popularity(bigint) from public, anon, authenticated;

create or replace function private.handle_session_game_popularity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.refresh_steam_app_popularity(old.steam_appid);
  end if;
  if tg_op <> 'DELETE' then
    perform private.refresh_steam_app_popularity(new.steam_appid);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.handle_session_game_popularity() from public, anon, authenticated;

drop trigger if exists session_games_refresh_steam_popularity on public.session_games;
create trigger session_games_refresh_steam_popularity
after insert or update of steam_appid, removed_at or delete on public.session_games
for each row execute function private.handle_session_game_popularity();

create or replace function private.handle_vote_popularity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_appid bigint;
  new_appid bigint;
begin
  if tg_op <> 'INSERT' then
    select steam_appid into old_appid from public.session_games where id = old.session_game_id;
    perform private.refresh_steam_app_popularity(old_appid);
  end if;
  if tg_op <> 'DELETE' then
    select steam_appid into new_appid from public.session_games where id = new.session_game_id;
    perform private.refresh_steam_app_popularity(new_appid);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.handle_vote_popularity() from public, anon, authenticated;

drop trigger if exists votes_refresh_steam_popularity on public.votes;
create trigger votes_refresh_steam_popularity
after insert or update of session_game_id or delete on public.votes
for each row execute function private.handle_vote_popularity();

do $$
declare
  current_appid bigint;
begin
  for current_appid in
    select distinct steam_appid
    from public.session_games
    where steam_appid is not null
  loop
    perform private.refresh_steam_app_popularity(current_appid);
  end loop;
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
  capsule_image_url text,
  header_image_url text,
  image_status text,
  release_date text,
  platforms text[],
  metadata_status public.metadata_status,
  cache_expires_at timestamptz,
  match_kind text,
  text_relevance_score real,
  type_score real,
  popularity_score real,
  final_score real,
  total_matches bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query_input as (
    select
      public.normalize_steam_name(btrim(search_query)) as value,
      btrim(search_query) as original,
      public.normalize_steam_name(btrim(search_query)) ~ '^[0-9]{1,10}$' as is_numeric
  ),
  numeric_candidates as (
    select sai.*, 2000::real as text_score, 'appid_exact'::text as match_kind
    from public.steam_app_index sai
    cross join query_input query
    where sai.is_available
      and query.is_numeric
      and sai.appid = query.value::bigint
  ),
  text_candidate_pool as materialized (
    select
      sai.*,
      extensions.similarity(sai.normalized_name, query.value)::real as similarity_score,
      case
        when sai.name = query.original then 1
        when sai.normalized_name = query.value then 2
        when sai.normalized_name like query.value || '%' then 3
        when sai.normalized_name like '% ' || query.value || '%' then 4
        when sai.normalized_name operator(extensions.%) query.value then 5
        else 6
      end as match_rank
    from public.steam_app_index sai
    cross join query_input query
    where sai.is_available
      and not query.is_numeric
      and char_length(query.value) between 2 and 120
      and (
        sai.normalized_name = query.value
        or sai.normalized_name like query.value || '%'
        or sai.normalized_name like '% ' || query.value || '%'
        or sai.normalized_name operator(extensions.%) query.value
        or sai.normalized_name like '%' || query.value || '%'
      )
    order by match_rank, similarity_score desc, sai.name, sai.appid
    limit 1500
  ),
  text_candidates as (
    select
      pool.*,
      case pool.match_rank
        when 1 then 1500::real
        when 2 then 1450::real
        when 3 then (1100 + 50 * pool.similarity_score)::real
        when 4 then (900 + 50 * pool.similarity_score)::real
        when 5 then (450 + 250 * pool.similarity_score)::real
        else (200 + 200 * pool.similarity_score)::real
      end as text_score,
      case pool.match_rank
        when 1 then 'exact'
        when 2 then 'normalized_exact'
        when 3 then 'prefix'
        when 4 then 'word_prefix'
        when 5 then 'similarity'
        else 'contains'
      end as match_kind
    from text_candidate_pool pool
  ),
  candidates as (
    select
      numeric_candidates.appid,
      numeric_candidates.name,
      numeric_candidates.app_type,
      numeric_candidates.catalog_source,
      numeric_candidates.source,
      numeric_candidates.capsule_image_url,
      numeric_candidates.header_image_url,
      numeric_candidates.image_status,
      numeric_candidates.popularity_score,
      numeric_candidates.text_score,
      numeric_candidates.match_kind
    from numeric_candidates
    union all
    select
      text_candidates.appid,
      text_candidates.name,
      text_candidates.app_type,
      text_candidates.catalog_source,
      text_candidates.source,
      text_candidates.capsule_image_url,
      text_candidates.header_image_url,
      text_candidates.image_status,
      text_candidates.popularity_score,
      text_candidates.text_score,
      text_candidates.match_kind
    from text_candidates
  ),
  scored as (
    select
      candidates.*,
      case lower(coalesce(candidates.app_type, 'unknown'))
        when 'game' then 150::real
        when 'unknown' then 0::real
        when 'demo' then -150::real
        when 'dlc' then -400::real
        when 'soundtrack' then -500::real
        when 'software' then -600::real
        when 'tool' then -600::real
        else 0::real
      end as calculated_type_score,
      least(250::real, greatest(0::real, coalesce(candidates.popularity_score, 0::real))) as bounded_popularity_score
    from candidates
  ),
  ranked as (
    select
      scored.*,
      (scored.text_score + scored.calculated_type_score + scored.bounded_popularity_score)::real as calculated_final_score,
      count(*) over() as match_count
    from scored
  ),
  selected as (
    select *
    from ranked
    order by
      calculated_final_score desc,
      text_score desc,
      bounded_popularity_score desc,
      name asc,
      appid asc
    offset least(greatest(result_offset, 0), 1000)
    limit least(greatest(result_limit, 1), 20)
  )
  select
    selected.appid,
    selected.name,
    selected.app_type,
    coalesce(selected.catalog_source, selected.source),
    cg.id,
    coalesce(selected.capsule_image_url, cg.cover_image, cg.header_image),
    coalesce(selected.header_image_url, cg.header_image),
    case
      when coalesce(selected.capsule_image_url, cg.cover_image, cg.header_image) is not null then 'available'
      else coalesce(selected.image_status, 'unknown')
    end,
    cg.release_date,
    coalesce(cg.platforms, '{}'::text[]),
    cg.metadata_status,
    cg.cache_expires_at,
    selected.match_kind,
    selected.text_score,
    selected.calculated_type_score,
    selected.bounded_popularity_score,
    selected.calculated_final_score,
    selected.match_count
  from selected
  left join public.catalog_games cg on cg.steam_appid = selected.appid
  order by
    selected.calculated_final_score desc,
    selected.text_score desc,
    selected.bounded_popularity_score desc,
    selected.name asc,
    selected.appid asc;
$$;

revoke all on function public.search_steam_apps(text, integer, integer) from public, anon;
grant execute on function public.search_steam_apps(text, integer, integer) to authenticated;

commit;
