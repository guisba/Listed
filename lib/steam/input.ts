export type SteamInput =
  | { kind: "appid"; appid: number }
  | { kind: "name"; query: string };

const APP_ID_PATTERN = /^[1-9]\d{0,9}$/;

export function parseSteamInput(raw: string): SteamInput {
  const input = raw.trim();
  if (APP_ID_PATTERN.test(input)) {
    return { kind: "appid", appid: Number(input) };
  }

  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.hostname !== "store.steampowered.com") {
      throw new Error("Use uma URL oficial da Steam.");
    }
    const match = url.pathname.match(/^\/app\/([1-9]\d{0,9})(?:\/|$)/);
    if (!match) throw new Error("A URL da Steam não contém um AppID válido.");
    return { kind: "appid", appid: Number(match[1]) };
  } catch (error) {
    if (/^https?:\/\//i.test(input)) {
      throw error instanceof Error ? error : new Error("URL inválida.");
    }
  }

  if (input.length < 2 || input.length > 120) {
    throw new Error("Digite um nome com 2 a 120 caracteres.");
  }
  return { kind: "name", query: input };
}

export function stripExternalHtml(value: string | undefined) {
  if (!value) return null;
  return value
    .replace(/<(br|\/p|\/div|\/li)>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}
