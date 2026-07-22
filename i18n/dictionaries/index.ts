import ptBR from "./pt-BR";
import type { Locale } from "../config";

export type Messages = typeof ptBR;
export type MessageKey = keyof Messages;

export async function loadDictionary(locale: Locale): Promise<Messages> {
  if (locale === "en-US") {
    return (await import("./en-US")).default as Messages;
  }
  return ptBR;
}
