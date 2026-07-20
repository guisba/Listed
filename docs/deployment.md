# Deployment

## Ambientes

- Development: `.env.local`, projeto Supabase de desenvolvimento.
- Preview: banco/keys separados de Production sempre que possível.
- Production: somente após Preview, migrations, advisors e smoke test.

## Ordem segura

1. `npm ci`
2. `npm run lint && npm run typecheck && npm test`
3. aplicar migrations Supabase e gerar tipos
4. `npm run build:vercel`
5. deployment Preview
6. smoke test de criação, dois participantes, voto, sorteio e temas
7. promover o artefato; não reconstruir

Rollback de app usa o deployment anterior. Migrations são aditivas; uma correção de banco recebe nova migration, nunca `reset` em produção.

O cron chama `/api/cron/cleanup` diariamente e exige `Authorization: Bearer <CRON_SECRET>`. Antes de ativá-lo, configure `SUPABASE_SECRET_KEY` e execute `?dryRun=true` manualmente.

Sites usa `.openai/hosting.json` com D1/R2 nulos porque Supabase é a persistência oficial. Vercel usa `vercel.json` e `npm run build:vercel`.
