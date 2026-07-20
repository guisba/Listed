# Integração Steam

## Fontes

- Oficial: `GET https://partner.steam-api.com/IStoreService/GetAppList/v1/`, com Web API key, paginação por `last_appid`, até 50 mil registros e atualização incremental por `if_modified_since`.
- Instável: `https://store.steampowered.com/api/appdetails`, encapsulado em `SteamStoreProvider`, sem scraping e protegido por `STEAM_PROVIDER_ENABLED`.
- Community tags ficam desativadas; não existe scraping alternativo.

## Entrada e cache

O parser aceita AppID, URL `https://store.steampowered.com/app/<id>` ou nome. Hosts parecidos são rejeitados. Nome consulta PostgreSQL com trigram; não há chamada externa por tecla.

Estados: `pending`, `complete`, `partial`, `failed`, `stale`. Resultados futuros podem usar TTL de 24h; lançados 30 dias; categorias 14 dias. Falha nunca bloqueia jogo manual.

## Sync planejado

O adapter `fetchSteamCatalogPage` já usa a interface oficial e limita página a mil itens. O job completo deve persistir checkpoint, limitar concorrência, aceitar dry run e registrar somente contagens/latência. A chave nunca chega ao browser.
