# Roadmap do player musical

O player musical não faz parte desta entrega. Este documento registra uma rota de produto e segurança sem adicionar SDK, credencial, OAuth, iframe ou reprodução ao runtime atual.

## Princípios

- O player é opt-in por sessão e participante; nunca inicia áudio sem gesto explícito.
- Cada provedor mantém autenticação, marca, controles e limitações próprios.
- Tokens OAuth ficam vinculados ao usuário, criptografados no servidor e revogáveis; não entram em Realtime, logs ou `localStorage`.
- O Listed sincroniza somente a intenção da sala. Áudio não é retransmitido.
- A sala continua funcional sem música, Premium, cookies de terceiros ou autorização.

## Spotify

A Web API exige autorização em todas as chamadas; dados privados e playlists exigem consentimento. O Web Playback SDK cria um dispositivo Spotify Connect no navegador, mas exige Spotify Premium, token renovável e respeito a autoplay/EME. A documentação também restringe broadcasting, sincronização com mídia visual, alteração de conteúdo e integrações comerciais de streaming.

Fontes oficiais:

- [Spotify Web API — API calls](https://developer.spotify.com/documentation/web-api/concepts/api-calls)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [Spotify Web Playback SDK — referência e políticas](https://developer.spotify.com/documentation/web-playback-sdk/reference)
- [Spotify — mudanças do Development Mode em fevereiro de 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

Escopos começam mínimos. Pesquisa/metadados, playlist e controle de reprodução são capacidades independentes; cada uma exige uma revisão dos escopos atuais, distribuição do app e requisitos de Premium.

## YouTube

Pesquisa usa quota e deve ser cacheada; `search.list` custa mais que leituras diretas. Reprodução usa o IFrame Player oficial, preserva controles, branding, anúncios, contexto e `Referer`, e respeita visibilidade/autoplay. O Listed não extrai áudio, contorna anúncios, cobre controles ou retém payloads além dos prazos permitidos.

Fontes oficiais:

- [YouTube Data API — search.list](https://developers.google.com/youtube/v3/docs/search/list)
- [YouTube Data API — quota e auditorias](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube — funcionalidade mínima do player incorporado](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [YouTube API Services — políticas para desenvolvedores](https://developers.google.com/youtube/terms/developer-policies)

## Fases

### 0. Descoberta e conformidade

1. Validar o modelo de negócio contra cada política vigente.
2. Registrar apps, redirects e política de privacidade.
3. Definir exclusão/revogação de tokens e retenção.
4. Modelar `music_dj` sem misturar com `owner`/`co_owner`.

### 1. Links e sugestões, sem player

- Pesquisar metadados server-side com quota, timeout e cache.
- Anexar links oficiais à sessão e votar em sugestões.
- Abrir no app do provedor; nenhuma reprodução incorporada.

### 2. Fila compartilhada

- Fila ordenada e auditável no Supabase.
- Somente o DJ altera reprodução; membros sugerem.
- Realtime transmite IDs e estado lógico mínimo, nunca tokens.
- Rate limit, idempotência e transferência explícita do DJ.

### 3. Reprodução oficial

- Spotify: Authorization Code com PKCE, renovação server-side e Web Playback SDK somente para usuários elegíveis.
- YouTube: IFrame Player oficial, no máximo um autoplay, visível e após consentimento.
- Fallback claro quando Premium, autoplay, cookies ou EME impedirem reprodução.

### 4. Operação

- Métricas agregadas sem histórico de escuta identificável.
- Testes multicontexto, revogação, expiração, reconexão, mobile e acessibilidade.
- Revisão periódica de quotas, termos e Development Mode antes de releases.

## Não objetivos

- Download, proxy ou retransmissão de áudio.
- Scraping de catálogos.
- Reprodução oculta ou não interativa.
- Uma credencial compartilhada para todos os usuários.
- Misturar tokens de música com chaves Steam, Supabase ou cron.
