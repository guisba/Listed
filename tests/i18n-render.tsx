import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n/client";
import ptBR from "@/i18n/dictionaries/pt-BR";

export function renderWithI18n(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(<I18nProvider locale="pt-BR" messages={ptBR}>{ui}</I18nProvider>, options);
}
