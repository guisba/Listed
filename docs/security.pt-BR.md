# Segurança

[English](./security.md) · [**Português (Brasil)**](./security.pt-BR.md)

## Ativos e atores

Ativos: identidades, memberships, códigos de convite, votos, biblioteca, chaves externas e histórico. Atores: visitante anônimo, conta permanente, membro, moderador, owner e serviços server-only.

## Controles

- RLS em todas as tabelas públicas e grants explícitos; tabelas operacionais Steam não têm acesso de cliente.
- autorização baseada em membership persistida, nunca em metadados editáveis.
- RPCs transacionais validam `auth.uid()`, limites e status; `search_path` é fixo.
- secret keys ficam em módulos server-only; publishable key é o único segredo-like exposto.
- URL Steam aceita somente HTTPS e hostname exato.
- HTML externo é reduzido a texto; handlers usam timeout, retry limitado, rate limit por identidade e respostas sem detalhes internos.
- headers impedem framing, sniffing e acesso desnecessário a câmera/microfone/geolocalização.
- crons exigem bearer secret, são limitados e persistem progresso; o sync pode ser retomado pelo checkpoint.

## Riscos restantes

- Anonymous Auth pode gerar abuso de armazenamento: habilitar CAPTCHA/Turnstile e revisar rate limits antes de produção.
- Códigos curtos não são credenciais; dados permanecem protegidos por membership e fluxo RPC.
- Store `appdetails` é não documentado: permanece desativado por padrão e possui fallback para cache/manual.
- O rate limit em memória reduz abuso por instância, mas não substitui WAF/Upstash distribuído em produção de alto volume.
- IA é desativada; quando habilitada, não recebe e-mails, códigos ou payloads privados.
- O advisor sinaliza três RPCs `SECURITY DEFINER` executáveis por `authenticated`. Isso é intencional: elas são a fronteira transacional para criar, ingressar e sortear, fixam `search_path`, conferem `auth.uid()`/membership e tiveram `EXECUTE` revogado de `anon` e `public`.
- O audit de 20/07/2026 não possui achados altos ou críticos. Restam dois moderados no PostCSS empacotado pelo Next 16; o reparo automático propõe downgrade incompatível para Next 9 e foi recusado.

## Resposta

Em incidente: desative o provider/feature flag afetado, revogue a key, bloqueie o Preview, revise logs sem payload sensível, aplique migration corretiva, gere novos tipos e rode advisors + smoke tests antes da reabertura.
