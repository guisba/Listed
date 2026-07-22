# Listed

**Listed é uma plataforma para grupos criarem listas compartilhadas de jogos, descobrirem quais opções funcionam para todos, votarem e decidirem o que jogar.**

![Cartão social do Listed](public/og.png)

## Estado do produto

O MVP inclui landing page com demonstração baseada em jogos reais, criação e entrada em sessões temporárias, identidade anônima Supabase, código curto, sala em tempo real, jogos manuais, seletor Steam com autocomplete local e prévia server-side, votos, propriedade, filtros, sorteio simples ou ponderado, administração básica, três temas, pt-BR/en-US e persistência PostgreSQL com RLS.

Grupos permanentes, OAuth, upgrade de conta e modos avançados já têm fundação no schema, mas continuam no roadmap. O catálogo Steam possui bootstrap e sync incremental oficiais; nenhum sync roda durante a pesquisa do usuário.

## Stack

- Next.js 16 App Router, React 19, TypeScript estrito e Tailwind CSS 4
- componentes no padrão shadcn/ui, Radix UI e Lucide
- Supabase Auth, PostgreSQL, Realtime e RLS
- Vitest, Testing Library e Playwright
- Vercel para o deployment principal e Sites como build compatível adicional

## Requisitos

- Node.js 22.13 ou superior
- npm 11+
- projeto Supabase
- Docker apenas para executar o stack Supabase local completo

## Instalação

```bash
npm ci
cp .env.example .env.local
npm run dev:next
```

Abra `http://localhost:3000`. O comando `npm run dev` inicia a variante compatível com Sites/vinext.

## Ambiente

### Públicas

| Variável | Escopo | Obrigatória | Uso |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | público | sim | URL canônica |
| `NEXT_PUBLIC_SUPABASE_URL` | público | sim | endpoint Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | público | sim | chave moderna de baixo privilégio |

### Secretas e server-only

| Variável | Uso |
| --- | --- |
| `SUPABASE_SECRET_KEY` | cliente administrativo lazy; nunca vai ao browser |
| `STEAM_WEB_API_KEY` | sincronização oficial via `IStoreService/GetAppList/v1` |
| `CRON_SECRET` | autenticação Bearer dos endpoints cron |

### Flags

- `STEAM_PROVIDER_ENABLED`: habilita a consulta server-side de detalhes.
- `STEAM_CATALOG_SYNC_ENABLED`: habilita o catálogo incremental protegido.

Não comite `.env.local`. Variáveis `NEXT_PUBLIC_*` são incorporadas ao bundle; nenhuma chave privilegiada pode usar esse prefixo.

## Supabase

```bash
npx supabase start
npx supabase db reset
npx supabase migration new nome_da_mudanca
npx supabase test db supabase/tests/rls.sql
```

Migrations ficam em `supabase/migrations/`; `supabase/seed.sql` não injeta jogos. Catálogos determinísticos existem somente em `tests/fixtures/`. No Dashboard, habilite **Authentication → Providers → Anonymous Sign-Ins** antes de testar sessões rápidas. Ative CAPTCHA/Turnstile antes de produção.

O projeto usa publishable keys atuais e grants explícitos, necessários para novos projetos Supabase. Todas as 15 tabelas públicas têm RLS.

## Catálogo Steam

```bash
npm run steam:catalog:status
```

O provider oficial chama `GET https://api.steampowered.com/IStoreService/GetAppList/v1/` com `input_json` codificado e a Web API key apenas no servidor. Bootstrap e incremental usam lotes retomáveis, lease e checkpoint no Supabase. A busca live consulta somente o índice local; a seleção continua carregando detalhes sob demanda por AppID.

Resultados são entregues em duas fases: texto e imagens já armazenadas chegam na busca inicial; somente as cápsulas visíveis ausentes são enriquecidas por `POST /api/steam/search/enrich`, em lote de até 12 e concorrência 3. O ranking combina relevância textual, tipo e popularidade limitada. Popularidade usa grupos/sessões e votos distintos do Listed e recomendações oficiais já obtidas no cache de detalhes; nunca bloqueia a pesquisa.

## Idiomas e demonstração

O idioma é resolvido no servidor pelo cookie validado `listed_locale`; na primeira visita, o `Accept-Language` mapeia português para `pt-BR` e demais idiomas para `en-US`. A troca no header atualiza o cookie e o Server Component atual sem alterar a rota nem o código de uma sessão. Metadados e `<html lang>` acompanham a seleção. Os dicionários internos tipados ficam em `i18n/` e a paridade de chaves é testada.

A landing resolve no servidor os AppIDs 728880, 105600 e 730. Ela lê `steam_app_index` e o cache `catalog_games` com revalidação de 12 horas; não chama a Steam pelo browser, não cria usuário e não registra sessão, voto ou popularidade. Se o cache estiver incompleto, exibe somente nome oficial conhecido, AppID e o placeholder do Listed.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build:vercel
npm run build
```

Os testes E2E instalam o navegador uma única vez com `npx playwright install chromium`.

## Deploy

1. Configure Development, Preview e Production na Vercel com as variáveis públicas do projeto Supabase correspondente.
2. Configure `SUPABASE_SECRET_KEY`, `CRON_SECRET` e `STEAM_WEB_API_KEY` somente no servidor; use valores distintos de `CRON_SECRET` em Preview e Production.
3. Defina as duas flags Steam em Preview e Production; isso não publica um deployment de produção.
4. Defina `NEXT_PUBLIC_APP_URL` com a URL canônica apenas em Production. Em Preview, o servidor usa `VERCEL_URL` automaticamente.
5. Rode migrations e advisors.
6. Faça push de uma branch e valide o Preview.
7. Promova o mesmo artefato somente após smoke test.

O `vercel.json` usa `npm run build:vercel`. O comando `npm run build` produz o artefato Cloudflare Worker para Sites.

## Estrutura

```text
app/                 rotas e handlers
components/          UI, temas, jogos e sessões
features/            regras de domínio e hooks
i18n/                detecção, dicionários tipados e APIs server/client
lib/                 Supabase, Steam, ambiente e validação
supabase/             migrations, seed e testes RLS
tests/                unitários, componentes e E2E
docs/                 arquitetura, banco, segurança e operação
types/                domínio e tipos gerados do Supabase
```

Consulte [identidade visual](docs/brand.md), [arquitetura](docs/architecture.md), [banco](docs/database.md), [segurança](docs/security.md), [Steam](docs/steam-integration.md), [deploy](docs/deployment.md) e [decisões](docs/product-decisions.md).

## Limitações conhecidas

- Anonymous Sign-Ins deve permanecer habilitado no projeto Supabase usado pelo ambiente.
- Google, Discord, magic link e account linking possuem interface; os providers exigem configuração no Supabase.
- Detalhes de loja usam endpoint não documentado e permanecem atrás de feature flag.
- O host público `api.steampowered.com` aceita Web API keys comuns; `partner.steam-api.com` exige Publisher Web API Key e não é usado pelo catálogo do Listed.
- O E2E multicontexto depende de um ambiente Supabase de teste com autenticação anônima ativa.

## Roadmap

Veja [docs/progress.md](docs/progress.md) para o estado verificável por milestone.
