# Security

[**English**](./security.md) · [Português (Brasil)](./security.pt-BR.md)

## Assets and actors

Assets include identities, memberships, invite codes, votes, library data, external keys, and history. Actors include anonymous visitors, permanent accounts, members, moderators, owners, and server-only services.

## Controls

- RLS is enabled on every public table with explicit grants; operational Steam tables are not client-accessible.
- Authorization is based on persisted membership, never editable metadata.
- Transactional RPCs validate `auth.uid()`, limits, and status; `search_path` is fixed.
- Secret keys stay in server-only modules; the publishable key is the only secret-like value exposed to clients.
- Steam URLs accept HTTPS only and require an exact hostname match.
- External HTML is reduced to text; handlers use timeouts, limited retries, per-identity rate limiting, and responses that omit internal details.
- Security headers prevent framing, MIME sniffing, and unnecessary access to camera, microphone, and geolocation.
- Cron endpoints require a bearer secret, are rate-limited, persist progress, and can resume synchronization from checkpoints.

## Remaining risks

- Anonymous Auth can be abused for storage growth. Enable CAPTCHA/Turnstile and review rate limits before production.
- Short invite codes are not credentials; data remains protected by membership checks and RPC flows.
- Steam Store `appdetails` is undocumented, so it remains disabled by default with cache/manual fallbacks.
- In-memory rate limiting reduces abuse per instance but does not replace a distributed WAF or Upstash-style limiter for high-volume production traffic.
- AI features are disabled. If enabled, they do not receive email addresses, invite codes, or private payloads.
- The advisor flags three `SECURITY DEFINER` RPCs executable by `authenticated`. This is intentional: they are the transactional boundary for creating, joining, and drawing; they fix `search_path`, validate `auth.uid()`/membership, and have `EXECUTE` revoked from `anon` and `public`.
- The July 20, 2026 audit found no high or critical issues. Two moderate PostCSS findings remain in the version bundled by Next 16; the automated fix proposes an incompatible downgrade to Next 9 and was rejected.

## Incident response

If an incident occurs, disable the affected provider or feature flag, revoke the relevant key, block Preview access if needed, review logs without exposing sensitive payloads, apply a corrective migration, regenerate types, and run advisors plus smoke tests before reopening access.
