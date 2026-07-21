# AGENTS.md

## Comandos

- `npm run dev:next`: Next.js local (Vercel)
- `npm run dev`: preview vinext/Sites
- `npm run lint && npm run typecheck && npm test`: gate mínimo
- `npm run build:vercel`: build Vercel
- `npm run build`: build Sites
- `npx supabase migration new <nome>`: única forma de criar migration

## Regras de arquitetura

- Server Components são o padrão; mova `use client` para a folha interativa.
- SDKs server-only devem ser inicializados de forma lazy, nunca no topo com secrets obrigatórios.
- Use tokens semânticos de `app/globals.css`; os três temas precisam continuar equivalentes.
- Preserve o App Router e os dois builds. `vercel.json` seleciona o build Next; Sites usa o script padrão.
- Não use barrel files em diretórios grandes.

## Supabase e segurança

- Toda tabela no schema público exige RLS, policy específica e grants explícitos.
- Anonymous users usam o role `authenticated`; diferencie contas permanentes com o claim `is_anonymous`.
- Nunca autorize por `user_metadata`. Papéis vivem nas tabelas de membership.
- Nunca exponha `SUPABASE_SECRET_KEY`; código admin fica em `lib/supabase/admin.ts` e server-only.
- Crie a migration com CLI, aplique uma vez, gere os tipos e rode advisors.
- Funções `SECURITY DEFINER` exigem `auth.uid()`, `search_path` fixo, revoke de `public`/`anon` e testes de privilégio.
- Variáveis públicas são `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_APP_URL`.
- Variáveis secretas são `SUPABASE_SECRET_KEY`, `STEAM_WEB_API_KEY` e `CRON_SECRET`; nenhuma pode ser importada por Client Components ou aparecer em respostas/logs.
- Em Preview, URLs absolutas devem preferir `VERCEL_URL`; `NEXT_PUBLIC_APP_URL` é a URL canônica de Production e o fallback local/estável.

## Steam

- Não faça scraping HTML.
- `IStoreService/GetAppList/v1` é a fonte oficial para sync incremental.
- O endpoint `appdetails` da Store é instável e só pode ser usado atrás de `STEAM_PROVIDER_ENABLED`.
- Toda chamada é server-side, com timeout, cache/fallback e sanitização.
- Autocomplete pesquisa somente `steam_app_index`; nunca chame a Steam a cada tecla.
- Sync exige `CRON_SECRET`, checkpoint por página e escrita com `SUPABASE_SECRET_KEY`.
- Preserve os casos de fumaça Terraria/105600 e Counter-Strike 2/730 nos testes.

## Áreas sensíveis

- `supabase/migrations`: não reescreva migrations já aplicadas; adicione uma nova.
- RLS, `lib/supabase/admin.ts`, cron e funções de convite exigem revisão de segurança.
- Não remova `.openai/hosting.json`, `worker/` ou `vite.config.ts`: fazem parte do build Sites.
