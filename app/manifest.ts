import type { MetadataRoute } from "next";

import { getServerI18n } from "@/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { locale, t } = await getServerI18n();
  return {
    name: t("meta.title"),
    short_name: "Listed",
    description: t("meta.description"),
    start_url: "/",
    display: "standalone",
    background_color: "#101311",
    theme_color: "#df5438",
    lang: locale,
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
