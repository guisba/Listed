# Acompanhamento

## Concluído e verificado

- Fundação App Router, TypeScript estrito, Tailwind, UI responsiva e três temas.
- Schema Supabase remoto, duas migrations aplicadas, 15/15 tabelas com RLS, grants explícitos, Realtime e tipos gerados.
- Criação/ingresso transacionais, sala, jogos manuais, votos, propriedade, filtros, sorteio e audit log.
- Parser/adapter Steam, catálogo parcial e fallback manual.
- lint, typecheck, 30 testes unitários/componentes, 4 execuções E2E e builds Next/Sites.
- CI do GitHub com lockfile, lint, tipos, testes e build Vercel.
- audit de dependências sem vulnerabilidades altas ou críticas.

## Parcial

- Steam: sync oficial está encapsulado, mas o job paginado completo ainda não foi publicado.
- Grupos permanentes: modelagem pronta; telas e account linking pendentes.
- Administração: bloquear/desbloquear e status; rotação de convite e moderação detalhada pendentes.
- E2E conectado ao banco: o fluxo multiusuário completo depende de Anonymous Auth habilitado no ambiente.

## Bloqueado por configuração

- Anonymous Sign-Ins está desabilitado no projeto Supabase; habilitar no Dashboard.
- Publicação GitHub via skill requer a CLI `gh`, ausente neste computador.

## Riscos

- duas vulnerabilidades moderadas transitivas permanecem no PostCSS empacotado pelo Next; `npm audit` sugere um downgrade incorreto para Next 9, portanto não foi aplicado.
- endpoint de detalhes Steam é não documentado e está desativado.
