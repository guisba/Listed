import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { I18nProvider } from "@/i18n/client";
import { getServerI18n } from "@/i18n/server";
import { getAppUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getServerI18n();
  return {
    metadataBase: getAppUrl(), applicationName: "Listed",
    title: { default: t("meta.title"), template: "%s · Listed" }, description: t("meta.description"),
    openGraph: { title: t("meta.title"), description: t("meta.share"), type: "website", siteName: "Listed", locale: locale.replace("-", "_"), images: [{ url: "/og.png", width: 1733, height: 909, alt: t("meta.ogAlt") }] },
    twitter: { card: "summary_large_image", title: t("meta.title"), description: t("meta.share"), images: ["/og.png"] },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/icon.svg" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, messages } = await getServerI18n();
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <I18nProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <a className="skip-link" href="#main-content">{messages["nav.skip"]}</a>
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
