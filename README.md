# Listed

**Listed é uma plataforma para grupos criarem listas compartilhadas de jogos, descobrirem quais opções funcionam para todos, votarem e decidirem o que jogar.**

![Cartão social do Listed](public/og.png)

## Estado do produto

O MVP inclui landing page, criação e entrada em sessões temporárias, identidade anônima Supabase, código curto, sala em tempo real, jogos manuais, busca Steam server-side/cache local, votos, propriedade, filtros, sorteio simples ou ponderado, administração básica, três temas e persistência PostgreSQL com RLS.

Grupos permanentes, OAuth, upgrade de conta, importação completa do catálogo Steam e modos avançados já têm fundação no schema, mas continuam no roadmap.

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

| Variável | Escopo | Obrigatória | Uso |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | público | sim | URL canônica |
| `NEXT_PUBLIC_SUPABASE_URL` | público | sim | endpoint Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | público | sim | chave moderna de baixo privilégio |
| `SUPABASE_SECRET_KEY` | server-only | cron/admin | nunca vai ao browser |
| `STEAM_WEB_API_KEY` | server-only | sync Steam | `IStoreService/GetAppList/v1` |
| `CRON_SECRET` | server-only | cron | autentica limpeza |
| `STEAM_PROVIDER_ENABLED` | server-only | não | habilita detalhes instáveis da loja |
| `STEAM_COMMUNITY_TAGS_ENABLED` | server-only | não | permanece `false`; scraping é proibido |
| `AI_RECOMMENDATIONS_ENABLED` | server-only | não | recomendações externas opcionais |

Não comite `.env.local`. Variáveis `NEXT_PUBLIC_*` são incorporadas ao bundle; nenhuma chave privilegiada pode usar esse prefixo.

## Supabase

```bash
npx supabase start
npx supabase db reset
npx supabase migration new nome_da_mudanca
npx supabase test db supabase/tests/rls.sql
```

Migrations ficam em `supabase/migrations/`; `supabase/seed.sql` cria um catálogo parcial, sem depender da Steam. No Dashboard, habilite **Authentication → Providers → Anonymous Sign-Ins** antes de testar sessões rápidas. Ative CAPTCHA/Turnstile antes de produção.

O projeto usa publishable keys atuais e grants explícitos, necessários para novos projetos Supabase. Todas as 15 tabelas públicas têm RLS.

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

1. Configure Development e Preview na Vercel com as variáveis públicas do projeto Supabase de desenvolvimento.
2. Configure `SUPABASE_SECRET_KEY` e `CRON_SECRET` apenas se o cron for habilitado.
3. Rode migrations e advisors.
4. Faça push de uma branch e valide o Preview.
5. Promova o mesmo artefato somente após smoke test.

O `vercel.json` usa `npm run build:vercel`. O comando `npm run build` produz o artefato Cloudflare Worker para Sites.

## Estrutura

```text
app/                 rotas e handlers
components/          UI, temas, jogos e sessões
features/            regras de domínio e hooks
lib/                 Supabase, Steam, ambiente e validação
supabase/             migrations, seed e testes RLS
tests/                unitários, componentes e E2E
docs/                 arquitetura, banco, segurança e operação
types/                domínio e tipos gerados do Supabase
```

Consulte [identidade visual](docs/brand.md), [arquitetura](docs/architecture.md), [banco](docs/database.md), [segurança](docs/security.md), [Steam](docs/steam-integration.md), [deploy](docs/deployment.md) e [decisões](docs/product-decisions.md).

## Limitações conhecidas

- Anonymous Sign-Ins precisa ser habilitado manualmente no Dashboard do Supabase.
- Google, Discord, magic link e account linking possuem interface; os providers exigem configuração no Supabase.
- Detalhes de loja usam endpoint não documentado e permanecem atrás de feature flag.
- Sync completo do catálogo, grupos permanentes e modos avançados são fundações de schema, não fluxos completos.
- O E2E multicontexto depende de um ambiente Supabase de teste com autenticação anônima ativa.

## Roadmap

Veja [docs/progress.md](docs/progress.md) para o estado verificável por milestone.
