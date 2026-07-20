-- Catálogo mínimo e idempotente para desenvolvimento.
-- Os registros ficam como `partial`: detalhes completos dependem do adapter Steam.
insert into public.catalog_games
  (steam_appid, source, name, normalized_name, store_url, header_image, platforms, metadata_status, cache_expires_at)
values
  (730, 'steam', 'Counter-Strike 2', 'counter strike 2', 'https://store.steampowered.com/app/730/', 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg', array['windows','linux'], 'partial', now()),
  (252490, 'steam', 'Rust', 'rust', 'https://store.steampowered.com/app/252490/', 'https://cdn.akamai.steamstatic.com/steam/apps/252490/header.jpg', array['windows','macos'], 'partial', now()),
  (548430, 'steam', 'Deep Rock Galactic', 'deep rock galactic', 'https://store.steampowered.com/app/548430/', 'https://cdn.akamai.steamstatic.com/steam/apps/548430/header.jpg', array['windows'], 'partial', now()),
  (728880, 'steam', 'Overcooked! 2', 'overcooked 2', 'https://store.steampowered.com/app/728880/', 'https://cdn.akamai.steamstatic.com/steam/apps/728880/header.jpg', array['windows','macos','linux'], 'partial', now()),
  (1966720, 'steam', 'Lethal Company', 'lethal company', 'https://store.steampowered.com/app/1966720/', 'https://cdn.akamai.steamstatic.com/steam/apps/1966720/header.jpg', array['windows'], 'partial', now()),
  (413150, 'steam', 'Stardew Valley', 'stardew valley', 'https://store.steampowered.com/app/413150/', 'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg', array['windows','macos','linux'], 'partial', now())
on conflict (steam_appid) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  store_url = excluded.store_url,
  header_image = excluded.header_image,
  platforms = excluded.platforms,
  metadata_status = excluded.metadata_status,
  updated_at = now();
