# Deployment

## Ambientes

- Development: `.env.local`, projeto Supabase de desenvolvimento.
- Preview: banco/keys separados de Production sempre que possível.
- Production: somente após Preview, migrations, advisors e smoke test.

## Variáveis

Públicas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Secretas e server-only:

- `SUPABASE_SECRET_KEY`
- `STEAM_WEB_API_KEY`
- `CRON_SECRET`

Flags:

- `STEAM_PROVIDER_ENABLED`
- `STEAM_CATALOG_SYNC_ENABLED`

Configure `CRON_SECRET` separadamente em Preview e Production. Em Production,
`NEXT_PUBLIC_APP_URL` aponta para `https://listedme.vercel.app`. Em Preview, o
servidor prefere a `VERCEL_URL` do deployment e usa a URL canônica apenas como
fallback; assim links e metadados do Preview não redirecionam para produção.

## Supabase Auth

No projeto Listed, mantenha Anonymous Sign-Ins habilitado e configure:

- Site URL: `https://listedme.vercel.app`
- produção: `https://listedme.vercel.app/**`
- Preview Vercel: `https://*-roloncombate-7891s-projects.vercel.app/**`
- desenvolvimento: `http://localhost:3000/**`

O padrão de Preview é limitado ao slug da conta Vercel. Não use `https://**`.
Magic link, Google e Discord devem usar `/auth/callback`; não habilite um
provider OAuth antes de cadastrar suas próprias credenciais.

## Ordem segura

1. `npm ci`
2. `npm run lint && npm run typecheck && npm test`
3. aplicar migrations Supabase e gerar tipos
4. `npm run build:vercel`
5. deployment Preview
6. smoke test de criação, dois participantes, voto, sorteio e temas
7. promover o artefato; não reconstruir

Rollback de app usa o deployment anterior. Migrations são aditivas; uma correção de banco recebe nova migration, nunca `reset` em produção.

Os endpoints cron exigem `Authorization: Bearer <CRON_SECRET>` e rejeitam
segredo em query string. Antes de ativá-los, configure `SUPABASE_SECRET_KEY` e
valide primeiro uma execução pequena no Preview.

Sites usa `.openai/hosting.json` com D1/R2 nulos porque Supabase é a persistência oficial. Vercel usa `vercel.json` e `npm run build:vercel`.
