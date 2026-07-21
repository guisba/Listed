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

### Imagens em duas fases

`IStoreService/GetAppList` não fornece cápsulas. A busca inicial junta `steam_app_index` com o cache já hidratado e retorna `capsuleImageUrl` quando disponível, além de `imageStatus`. Em seguida, o cliente envia somente os AppIDs visíveis sem imagem para `POST /api/steam/search/enrich`. O endpoint exige usuário autenticado, aceita 1–12 inteiros positivos, limita requisições e concorrência a 3, consulta o cache antes do provider e isola falhas por item.

O provider prioriza `capsule_imagev5`, depois `capsule_image` e por fim `header_image`. As URLs são persistidas no índice com estados `unknown`, `available`, `missing`, `failed` ou `stale`; ausência tem TTL de sete dias e falha transitória, 30 minutos. A UI reserva 104×39 px no mobile e 120×45 px a partir de `sm`, usa skeleton sem anúncio, `object-fit: cover`, lazy loading, transição apenas com movimento permitido e placeholder estável em falha.

Somente `https://shared.akamai.steamstatic.com` foi observado nos dados reais e está autorizado tanto pelo validador quanto por `next/image`. URLs HTTP, com credenciais, malformadas ou de outros hosts são descartadas. Para depurar, compare `capsule_image_url`, `image_status` e `image_updated_at` no índice, a resposta pública da busca, o POST de enriquecimento e a requisição `/_next/image` no Network.

## Catálogo completo e incremental

`GET|POST /api/steam/sync?mode=auto` exige `Authorization: Bearer $CRON_SECRET`, `STEAM_CATALOG_SYNC_ENABLED=true`, `STEAM_WEB_API_KEY` e `SUPABASE_SECRET_KEY`. O segredo nunca é aceito por query string. `auto` continua o bootstrap enquanto o catálogo estiver parcial e passa a incremental após a conclusão. `mode=full`, `mode=incremental` e `pages=1..100` atendem operação manual e validação controlada.

Cada execução usa o host público com somente jogos, cursor `last_appid`, até 5.000 itens por página, retry transitório e orçamento de tempo. O envelope e cada item passam por schemas Zod; candidatos inválidos são ignorados, contabilizados e nunca persistidos. O checkpoint é confirmado depois de cada upsert; timeout ou limite de páginas produz estado `partial`, retomável pela chamada seguinte. Uma lease atômica no banco impede duas execuções conflitantes.

`steam_catalog_sync_state` mantém checkpoints separados, geração do bootstrap, timestamps completo/incremental, total indexado, última página, completude, lease e erro seguro. `steam_catalog_sync_runs` registra recebidos, inseridos, atualizados, ignorados, erros, cursores e duração. Ambas têm RLS e nenhum grant para clientes.

Não existem jogos fixos no runtime ou no seed. Antes da conclusão, a busca usa o índice parcial e informa essa condição; AppID e URL continuam hidratando dados reais pelo provider de detalhes. O endpoint administrativo `GET|POST /api/steam/catalog` usa o mesmo Bearer e permite consultar status, continuar bootstrap, executar incremental e reprocessar falhas.

## Busca indexada

`pg_trgm` e `unaccent` normalizam e indexam nomes, preservando Unicode e nomes compostos apenas por símbolos. AppID numérico usa um ramo BTREE separado; nomes usam BTREE para prefixos e GIN trigram, evitando que `appid::text` force varredura sequencial. A API devolve somente metadados públicos; checkpoints e erros operacionais ficam restritos ao endpoint administrativo.

A pontuação é explícita: AppID exato 2.000; nome exato 1.500; exato normalizado 1.450; prefixo 1.100–1.150; início de palavra 900–950; similaridade 450–700; contenção 200–400. Tipo `game` soma 150; demo/DLC/soundtrack/software/tool recebem penalidades. Popularidade agrega sessões/grupos distintos e votos do Listed, além de recomendações oficiais somente quando o detalhe já foi carregado; todos os sinais passam por `log1p` e o componente final é limitado a 250. Assim, popularidade desempata qualidade textual próxima sem ultrapassar um match claramente melhor.

Sinais detalhados ficam em `private.steam_app_popularity`; somente `popularity_score` agregado é copiado ao índice. Triggers atualizam eventos internos. Recomendações são atualizadas junto com o cache de detalhes, com o mesmo TTL estável de sete dias. A pesquisa nunca espera imagens, jogadores atuais, recomendações ou chamadas externas.

## Operação

- `401`: sessão Listed ausente ou segredo do cron incorreto.
- `404`: AppID não encontrado.
- `429`: limite por usuário atingido.
- `502/504`: Steam indisponível, host/credencial recusados ou timeout; cache vencido é usado quando existe. Um 403 é classificado pelo host e não vira automaticamente “chave rejeitada”.
- `503`: flag, chave ou cache administrativo ausente.

Logs não devem conter Web API key, payload completo da Steam, cookies ou JWT. Para desligar o risco externo sem parar o produto, use `STEAM_PROVIDER_ENABLED=false` e mantenha a inclusão manual.
