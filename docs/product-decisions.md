# Decisões de produto

1. **Listed é o nome definitivo do produto, do repositório e dos projetos de deploy.** A linguagem da interface gira em torno de listas, seleção e decisão.
2. **Sessões rápidas primeiro.** O schema separa grupos permanentes, mas o fluxo utilizável prioriza criar, entrar, adicionar e decidir.
3. **Anonymous Auth real.** Não usamos uma identidade local falsa; memberships e votos permanecem recuperáveis enquanto a sessão do navegador existir.
4. **RLS e RPCs transacionais.** Criação, ingresso e sorteio cruzam várias tabelas e precisam de atomicidade.
5. **Steam não é dependência crítica.** Catálogo oficial e adapter instável são separados; jogos manuais são sempre possíveis.
6. **Dois builds, uma UI.** Next nativo atende Vercel; vinext mantém compatibilidade Sites sem duplicar produto.
7. **Temas semânticos.** Claro, escuro e escuro vermelho compartilham os mesmos tokens e componentes.
8. **Identidade de catálogo em decisão.** Linhas, divisórias e trilhas de seleção comunicam ranking e escolha; efeitos decorativos sem função foram removidos.
