<div align="center">

# Listed

**Listas compartilhadas de jogos para grupos que querem decidir o que jogar.**

[English](./README.md) · [**Português (Brasil)**](./README.pt-BR.md)

</div>

![Cartão social do Listed](public/og.png)

## Visão geral

Listed ajuda grupos a montar uma lista compartilhada de jogos, descobrir quais opções funcionam para todos, votar, filtrar a lista e decidir juntos o que jogar.

O MVP atual inclui sessões temporárias, identidades anônimas pelo Supabase, códigos curtos de convite, salas em tempo real, jogos adicionados manualmente, descoberta pela Steam, votos, registro de propriedade, filtros combináveis, sorteio simples ou ponderado, controles de owner/co-owner, compartilhamento por QR, múltiplos temas, interface en-US/pt-BR e persistência PostgreSQL protegida por RLS.

Grupos permanentes, OAuth/upgrade de conta e fluxos mais avançados continuam no roadmap e já possuem parte da base no schema.

## Stack

| Área | Tecnologias |
| --- | --- |
| Aplicação | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, padrões shadcn/ui, Radix UI, Lucide |
| Backend | Supabase Auth, PostgreSQL, Realtime, RLS |
| Testes | Vitest, Testing Library, Playwright |
| Deploy | Vercel, além de build compatível com Sites/vinext |

## Primeiros passos

### Requisitos

- Node.js 22.13+
- npm 11+
- Um projeto Supabase
- Docker somente se você quiser executar o stack Supabase local completo

### Instalação e execução

```bash
npm ci
cp .env.example .env.local
npm run dev:next
```

Abra [http://localhost:3000](http://localhost:3000).

`npm run dev` inicia a variante de desenvolvimento compatível com Sites/vinext.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e configure os valores do seu ambiente.

### Públicas

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | URL canônica da aplicação |
| `NEXT_PUBLIC_SUPABASE_URL` | Endpoint do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública de baixo privilégio do Supabase |

### Somente servidor

| Variável | Uso |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Cliente administrativo do Supabase |
| `STEAM_WEB_API_KEY` | Sincronização oficial do catálogo Steam |
| `CRON_SECRET` | Autenticação Bearer dos endpoints cron |

### Feature flags

| Variável | Uso |
| --- | --- |
| `STEAM_PROVIDER_ENABLED` | Habilita consultas server-side de detalhes da Steam |
| `STEAM_CATALOG_SYNC_ENABLED` | Habilita o sync incremental protegido do catálogo |

Não comite `.env.local`. Qualquer valor `NEXT_PUBLIC_*` é incluído no bundle do navegador, então chaves privilegiadas nunca devem usar esse prefixo.

## Supabase

Comandos úteis para o ambiente local:

```bash
npx supabase start
npx supabase db reset
npx supabase migration new nome_da_mudanca
npx supabase test db supabase/tests/rls.sql
```

As migrations ficam em `supabase/migrations/`. Catálogos determinísticos usados pelos testes ficam em `tests/fixtures/`.

Para sessões rápidas, habilite **Authentication → Providers → Anonymous Sign-Ins** no Supabase. CAPTCHA/Turnstile deve ser habilitado antes de produção.

## Catálogo Steam

Confira o estado do catálogo com:

```bash
npm run steam:catalog:status
```

O bootstrap e o sync incremental do catálogo Steam rodam no servidor. A pesquisa usa o índice local, enquanto imagens visíveis ausentes podem ser enriquecidas sob demanda. A chave da API da Steam nunca é exposta ao navegador.

Veja [integração com Steam](docs/steam-integration.md) para a arquitetura completa e os detalhes operacionais.

## Comandos úteis

| Comando | Uso |
| --- | --- |
| `npm run dev:next` | Inicia o servidor de desenvolvimento Next.js |
| `npm run dev` | Inicia o servidor dev compatível com Sites/vinext |
| `npm run lint` | Executa o ESLint |
| `npm run typecheck` | Executa as verificações do TypeScript |
| `npm test` | Executa o Vitest |
| `npm run test:e2e` | Executa os testes E2E com Playwright |
| `npm run build:vercel` | Gera o build Vercel/Next.js |
| `npm run build` | Gera o build Sites/Cloudflare Worker |
| `npm run steam:catalog:status` | Verifica o estado do sync do catálogo Steam |

Para os testes E2E, instale o Chromium uma vez com:

```bash
npx playwright install chromium
```

## Estrutura do projeto

```text
app/                 rotas e handlers
components/          UI, temas, jogos e componentes de sessão
features/            regras de domínio e hooks
i18n/                detecção de locale e dicionários tipados
lib/                 Supabase, Steam, ambiente e validação
supabase/             migrations, seed e testes RLS
tests/                testes unitários, de componentes e E2E
docs/                 documentação de arquitetura e operação
types/                tipos de domínio e tipos gerados do Supabase
worker/               código específico de integração com worker
```

## Documentação

- [Arquitetura](docs/architecture.md)
- [Banco de dados](docs/database.md)
- [Segurança](docs/security.md)
- [Integração com Steam](docs/steam-integration.md)
- [Deploy](docs/deployment.md)
- [Identidade visual](docs/brand.md)
- [Decisões de produto](docs/product-decisions.md)
- [Roadmap do player musical](docs/music-player-roadmap.md)
- [Progresso do projeto](docs/progress.md)

## Limitações conhecidas

- Anonymous Sign-Ins deve estar habilitado no projeto Supabase usado pelo ambiente.
- A interface para Google, Discord, magic link e account linking existe, mas os providers ainda exigem configuração no Supabase.
- Os detalhes de loja da Steam dependem de um endpoint não documentado e continuam atrás de uma feature flag.
- A cobertura E2E multicontexto completa depende de um ambiente Supabase de teste com autenticação anônima habilitada.

## Roadmap

Para o estado atual por milestone, consulte [`docs/progress.md`](docs/progress.md).
