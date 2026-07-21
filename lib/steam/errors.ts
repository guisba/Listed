export type SteamErrorCode =
  | "invalid_input"
  | "not_found"
  | "provider_disabled"
  | "provider_timeout"
  | "provider_auth_rejected"
  | "provider_unavailable"
  | "rate_limited"
  | "cache_unavailable"
  | "sync_not_configured";

const MESSAGES: Record<SteamErrorCode, string> = {
  invalid_input: "Informe um nome, AppID ou link oficial válido da Steam.",
  not_found: "Nenhum jogo da Steam foi encontrado para esse AppID.",
  provider_disabled: "A consulta de detalhes da Steam está temporariamente desativada. Você ainda pode incluir o jogo manualmente.",
  provider_timeout: "A Steam demorou para responder. Tente novamente em instantes ou use a inclusão manual.",
  provider_auth_rejected: "A autenticação do catálogo Steam foi rejeitada.",
  provider_unavailable: "A Steam está indisponível no momento. Tente novamente em instantes ou use a inclusão manual.",
  rate_limited: "Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente.",
  cache_unavailable: "Não foi possível salvar os detalhes no catálogo agora.",
  sync_not_configured: "A sincronização Steam ainda não foi configurada pelo administrador.",
};

export class SteamError extends Error {
  constructor(
    public readonly code: SteamErrorCode,
    public readonly status: number,
    options?: { cause?: unknown },
  ) {
    super(MESSAGES[code], options);
    this.name = "SteamError";
  }
}

export function toSteamError(error: unknown) {
  if (error instanceof SteamError) return error;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new SteamError("provider_timeout", 504, { cause: error });
  }
  return new SteamError("provider_unavailable", 502, { cause: error });
}
