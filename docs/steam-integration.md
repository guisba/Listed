# Integração Steam

## Fontes e limites

- Catálogo oficial: `IStoreService/GetAppList/v1`, com chave server-only, paginação por `last_appid` e atualização incremental por `if_modified_since`.
- Detalhes: `store.steampowered.com/api/appdetails`. Esse endpoint não é documentado pela Valve; fica isolado em `SteamStoreProvider`, atrás de `STEAM_PROVIDER_ENABLED`, com timeout, uma repetição em falhas transitórias, sanitização e fallback de cache.
- Não há scraping HTML. Community tags permanecem desativadas.

## Fluxo do usuário

O único campo inteligente aceita nome, AppID ou URL oficial `https://store.steampowered.com/app/<appid>`. Nomes com ao menos dois caracteres usam debounce de 320 ms e consultam somente `steam_app_index`; requisições anteriores são abortadas e respostas fora de ordem são ignoradas. O combobox suporta setas, Enter e Escape.

Ao selecionar um resultado, ou ao informar AppID/URL, o servidor executa:

1. consulta `catalog_games`;
2. retorna imediatamente cache completo e válido;
3. para cache ausente, parcial ou vencido, consulta o provider se o flag estiver ativo;
4. normaliza e salva com a secret key;
5. em timeout/indisponibilidade, usa o cache vencido com aviso;
6. sem cache, oferece a inclusão manual.

A confirmação passa por `POST /api/steam/session-game`, revalida usuário e sessão via RLS, resolve dados autoritativos e traduz conflito `23505` para erro de duplicidade. Metadados exibidos incluem imagem, descrições convertidas para texto, plataformas, gêneros, recursos, desenvolvedor, editora, idiomas, preço e lançamento.

## Cache

Estados: `pending`, `complete`, `partial`, `failed`, `stale`. Metadados completos expiram em sete dias; parciais, em doze horas. O cache registra atualização, última tentativa e último erro seguro. Falhas nunca removem a última versão válida nem impedem jogos manuais.

`SUPABASE_SECRET_KEY` é necessária para persistir detalhes. Sem ela, o provider ainda pode devolver uma prévia, mas o resultado fica `uncached`; esse modo é apenas degradado e deve ser corrigido no ambiente.

## Catálogo incremental

`GET|POST /api/steam/sync?pages=5` exige `Authorization: Bearer $CRON_SECRET`, `STEAM_CATALOG_SYNC_ENABLED=true`, `STEAM_WEB_API_KEY` e `SUPABASE_SECRET_KEY`. Cada chamada processa de uma a cinco páginas de mil apps, faz upsert em lotes concorrentes de 250 e persiste o checkpoint após cada página.

`steam_catalog_sync_state` mantém `last_appid`, `if_modified_since`, status, contagem e último erro. `steam_catalog_sync_runs` registra início/fim, origem, páginas, apps e erros. Ambas têm RLS e nenhum grant para clientes. O cron Vercel chama cinco páginas por dia; uma execução manual equivalente é:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<preview>/api/steam/sync?pages=5"
```

O bootstrap da migration inclui AppIDs 730 e 105600 para os smoke tests antes do primeiro sync amplo.

## Operação

- `401`: sessão Listed ausente ou segredo do cron incorreto.
- `404`: AppID não encontrado.
- `429`: limite por usuário atingido.
- `502/504`: Steam indisponível/timeout; cache vencido é usado quando existe.
- `503`: flag, chave ou cache administrativo ausente.

Logs não devem conter Web API key, payload completo da Steam, cookies ou JWT. Para desligar o risco externo sem parar o produto, use `STEAM_PROVIDER_ENABLED=false` e mantenha a inclusão manual.
