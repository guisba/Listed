begin;

alter table private.steam_app_popularity
  add column if not exists steam_recommendations_total bigint
    check (steam_recommendations_total is null or steam_recommendations_total >= 0);

create or replace function private.calculate_steam_popularity_score(
  listed_additions bigint,
  listed_votes bigint,
  listed_unique_groups bigint,
  steam_recommendations_total bigint
)
returns real
language sql
immutable
set search_path = ''
as $$
  select least(
    250::double precision,
    60 * ln(1 + greatest(coalesce(listed_unique_groups, 0), 0))
      + 18 * ln(1 + greatest(coalesce(listed_votes, 0), 0))
      + 8 * ln(1 + greatest(coalesce(listed_additions, 0), 0))
      + 9 * ln(1 + greatest(coalesce(steam_recommendations_total, 0), 0))
  )::real;
$$;

revoke all on function private.calculate_steam_popularity_score(bigint, bigint, bigint, bigint) from public, anon, authenticated;

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
  recommendations_count bigint := 0;
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

  select coalesce(steam_recommendations_total, 0)
  into recommendations_count
  from private.steam_app_popularity
  where appid = target_appid;

  calculated_score := private.calculate_steam_popularity_score(
    additions_count,
    votes_count,
    unique_groups_count,
    recommendations_count
  );

  insert into private.steam_app_popularity (
    appid,
    listed_additions,
    listed_votes,
    listed_unique_groups,
    steam_recommendations_total,
    calculated_at
  ) values (
    target_appid,
    additions_count,
    votes_count,
    unique_groups_count,
    recommendations_count,
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

grant usage on schema private to service_role;
grant select, insert, update on table private.steam_app_popularity to service_role;

create or replace function public.record_steam_recommendations(
  target_appid bigint,
  recommendations_total bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  additions_count bigint := 0;
  votes_count bigint := 0;
  unique_groups_count bigint := 0;
  calculated_score real := 0;
begin
  if target_appid is null or target_appid <= 0
    or recommendations_total is null or recommendations_total < 0 then
    raise exception 'invalid popularity signal';
  end if;

  select
    coalesce(listed_additions, 0),
    coalesce(listed_votes, 0),
    coalesce(listed_unique_groups, 0)
  into additions_count, votes_count, unique_groups_count
  from private.steam_app_popularity
  where appid = target_appid;

  insert into private.steam_app_popularity (
    appid,
    listed_additions,
    listed_votes,
    listed_unique_groups,
    steam_recommendations_total,
    calculated_at
  ) values (
    target_appid,
    additions_count,
    votes_count,
    unique_groups_count,
    recommendations_total,
    now()
  )
  on conflict (appid) do update set
    steam_recommendations_total = excluded.steam_recommendations_total,
    calculated_at = excluded.calculated_at;

  calculated_score := private.calculate_steam_popularity_score(
    additions_count,
    votes_count,
    unique_groups_count,
    recommendations_total
  );

  update public.steam_app_index
  set popularity_score = calculated_score, popularity_updated_at = now()
  where appid = target_appid;
end;
$$;

revoke all on function public.record_steam_recommendations(bigint, bigint) from public, anon, authenticated;
grant execute on function public.record_steam_recommendations(bigint, bigint) to service_role;

drop function if exists private.calculate_steam_popularity_score(bigint, bigint, bigint);

commit;
