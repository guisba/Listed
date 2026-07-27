begin;

update public.session_games sg
set
  catalog_game_id = coalesce(sg.catalog_game_id, cg.id),
  features = cg.features
from public.catalog_games cg
where sg.steam_appid = cg.steam_appid
  and sg.source = 'steam'
  and sg.removed_at is null
  and (
    sg.catalog_game_id is null
    or sg.features is distinct from cg.features
  );

commit;
