import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
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

export const metadata: Metadata = {
  metadataBase: getAppUrl(),
  applicationName: "Listed",
  title: { default: "Listed — Decida o que jogar", template: "%s · Listed" },
  description: "Crie uma lista de jogos com seus amigos, importe informações da Steam, vote nas melhores opções e escolha o próximo jogo do grupo.",
  openGraph: { title: "Listed — Decida o que jogar", description: "Liste. Vote. Jogue.", type: "website", siteName: "Listed", locale: "pt_BR", images: [{ url: "/og.png", width: 1733, height: 909, alt: "Listed — Liste. Vote. Jogue." }] },
  twitter: { card: "summary_large_image", title: "Listed — Decida o que jogar", description: "Liste. Vote. Jogue.", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
