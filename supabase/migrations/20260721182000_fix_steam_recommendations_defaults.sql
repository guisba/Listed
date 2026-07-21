begin;

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
    coalesce((select listed_additions from private.steam_app_popularity where appid = target_appid), 0),
    coalesce((select listed_votes from private.steam_app_popularity where appid = target_appid), 0),
    coalesce((select listed_unique_groups from private.steam_app_popularity where appid = target_appid), 0)
  into additions_count, votes_count, unique_groups_count;

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

commit;
