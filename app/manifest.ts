import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Listed — Decida o que jogar",
    short_name: "Listed",
    description: "Listas compartilhadas de jogos, votos e decisões para grupos.",
    start_url: "/",
    display: "standalone",
    background_color: "#101311",
    theme_color: "#df5438",
    lang: "pt-BR",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
