"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { PropsWithChildren } from "react";

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      themes={["light", "dark", "dark-red"]}
      enableSystem
      disableTransitionOnChange
      storageKey="listed-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
