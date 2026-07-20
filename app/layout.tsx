import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "JogaJunto — escolha o próximo jogo", template: "%s · JogaJunto" },
  description: "Crie listas compartilhadas, compare bibliotecas, vote e escolha o jogo da noite com sua galera.",
  openGraph: { title: "JogaJunto", description: "Menos debate. Mais partida.", type: "website", locale: "pt_BR", images: [{ url: "/og.png", width: 1733, height: 909, alt: "JogaJunto — Menos debate. Mais partida." }] },
  twitter: { card: "summary_large_image", title: "JogaJunto", description: "Menos debate. Mais partida.", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
