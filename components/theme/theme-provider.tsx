"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { PropsWithChildren } from "react";

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      themes={["light", "dark", "dark-red"]}
      enableSystem={false}
      disableTransitionOnChange
      storageKey="jogajunto-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
