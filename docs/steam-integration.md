# Integração Steam

## Fontes e limites

- Catálogo oficial: `GET https://api.steampowered.com/IStoreService/GetAppList/v1/`, com chave server-only, `input_json` codificado, paginação por `last_appid` e incremental por `if_modified_since`.
- O host `partner.steam-api.com` exige Publisher Web API Key. Um 403 nesse host não comprova que uma chave Web API comum seja inválida; o provider público nunca o usa operacionalmente.
- Detalhes: `store.steampowered.com/api/appdetails`. Esse endpoint não é documentado pela Valve; fica isolado em `SteamStoreProvider`, atrás de `STEAM_PROVIDER_ENABLED`, com timeout, uma repetição em falhas transitórias, sanitização e fallback de cache.
- Não há scraping HTML. Community tags permanecem desativadas.

## Fluxo do usuário

O único campo inteligente aceita nome, AppID ou URL oficial `https://store.steampowered.com/app/<appid>`. Nomes com ao menos dois caracteres usam debounce de 320 ms e consultam somente `steam_app_index`; requisições anteriores são abortadas e respostas fora de ordem são ignoradas. O combobox suporta setas, Enter e Escape, retorna 12 itens por página e permite carregar mais sem enviar o catálogo ao navegador.

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

## Catálogo completo e incremental

`GET|POST /api/steam/sync?mode=auto` exige `Authorization: Bearer $CRON_SECRET`, `STEAM_CATALOG_SYNC_ENABLED=true`, `STEAM_WEB_API_KEY` e `SUPABASE_SECRET_KEY`. O segredo nunca é aceito por query string. `auto` continua o bootstrap enquanto o catálogo estiver parcial e passa a incremental após a conclusão. `mode=full`, `mode=incremental` e `pages=1..100` atendem operação manual e validação controlada.

Cada execução usa o host público com somente jogos, cursor `last_appid`, até 5.000 itens por página, retry transitório e orçamento de tempo. O envelope e cada item passam por schemas Zod; candidatos inválidos são ignorados, contabilizados e nunca persistidos. O checkpoint é confirmado depois de cada upsert; timeout ou limite de páginas produz estado `partial`, retomável pela chamada seguinte. Uma lease atômica no banco impede duas execuções conflitantes.

`steam_catalog_sync_state` mantém checkpoints separados, geração do bootstrap, timestamps completo/incremental, total indexado, última página, completude, lease e erro seguro. `steam_catalog_sync_runs` registra recebidos, inseridos, atualizados, ignorados, erros, cursores e duração. Ambas têm RLS e nenhum grant para clientes.

Não existem jogos fixos no runtime ou no seed. Antes da conclusão, a busca usa o índice parcial e informa essa condição; AppID e URL continuam hidratando dados reais pelo provider de detalhes. O endpoint administrativo `GET|POST /api/steam/catalog` usa o mesmo Bearer e permite consultar status, continuar bootstrap, executar incremental e reprocessar falhas.

## Busca indexada

`pg_trgm` e `unaccent` normalizam e indexam nomes, preservando Unicode e nomes compostos apenas por símbolos. A ordem é AppID exato, nome exato, prefixo, início de palavra, similaridade e contenção. AppID numérico usa um ramo BTREE separado; nomes usam BTREE para prefixos e GIN trigram, evitando que `appid::text` force varredura sequencial. A API devolve somente metadados públicos; checkpoints e erros operacionais ficam restritos ao endpoint administrativo.

## Operação

- `401`: sessão Listed ausente ou segredo do cron incorreto.
- `404`: AppID não encontrado.
- `429`: limite por usuário atingido.
- `502/504`: Steam indisponível, host/credencial recusados ou timeout; cache vencido é usado quando existe. Um 403 é classificado pelo host e não vira automaticamente “chave rejeitada”.
- `503`: flag, chave ou cache administrativo ausente.

Logs não devem conter Web API key, payload completo da Steam, cookies ou JWT. Para desligar o risco externo sem parar o produto, use `STEAM_PROVIDER_ENABLED=false` e mantenha a inclusão manual.
