import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SteamGamePicker } from "@/components/games/steam-game-picker";
import { renderWithI18n } from "./i18n-render";

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <span data-testid="next-image" data-src={src} aria-label={alt} /> }));

const preview = {
  id: "catalog-1", appid: 105600, name: "Terraria", type: "game",
  storeUrl: "https://store.steampowered.com/app/105600/", headerImage: null, capsuleImage: null, coverImage: null,
  shortDescription: "Dig, fight, explore.", fullDescription: null, releaseDate: "16 May, 2011", comingSoon: false,
  platforms: ["windows"], genres: ["Ação"], categories: ["Online Co-op"], features: ["coop-online"],
  developers: ["Re-Logic"], publishers: ["Re-Logic"], supportedLanguages: ["Português"],
  price: { currency: "BRL", initial: 3299, final: 3299, discountPercent: 0, formatted: "R$ 32,99" },
  isFree: false, recommendationsTotal: null, metadataStatus: "complete" as const, cacheState: "fresh" as const,
};

describe("SteamGamePicker", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("busca ao digitar, permite teclado, mostra prévia e confirma", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/steam/search/enrich") return new Response(JSON.stringify({ images: [{ appid: 105600, capsuleImageUrl: null, imageStatus: "missing" }] }), { status: 200 });
      if (url.includes("/api/steam/search?q=Terraria")) return new Response(JSON.stringify({ kind: "matches", catalog: { status: "complete", indexedGames: 100000, lastSyncAt: null }, pagination: { hasMore: false }, games: [{ appid: 105600, name: "Terraria", type: "game", id: null, headerImage: null, capsuleImageUrl: null, imageStatus: "unknown", releaseDate: "2011", platforms: ["windows"], relevance: 1500 }] }), { status: 200 });
      if (url.includes("/api/steam/search?q=105600")) return new Response(JSON.stringify({ kind: "preview", games: [preview] }), { status: 200 });
      if (url === "/api/steam/session-game" && init?.method === "POST") return new Response(JSON.stringify({ game: preview }), { status: 201 });
      return new Response("not found", { status: 404 });
    });
    const onAdded = vi.fn();
    renderWithI18n(<SteamGamePicker sessionId="11111111-1111-4111-8111-111111111111" onAdded={onAdded} onCancel={vi.fn()} onManualFallback={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Terraria" } });
    expect(await screen.findByRole("option", { name: /Terraria/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "Terraria" })).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    expect(screen.getByRole("heading", { name: "Terraria" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/steam/search/enrich", expect.objectContaining({ method: "POST" }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar à lista/ }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/steam/session-game", expect.objectContaining({ method: "POST" }));
  });

  it("mostra o texto primeiro e aplica a cápsula enriquecida depois", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/steam/search/enrich") return new Response(JSON.stringify({ images: [{ appid: 400, capsuleImageUrl: "https://shared.akamai.steamstatic.com/portal.jpg", imageStatus: "available" }] }), { status: 200 });
      return new Response(JSON.stringify({ kind: "matches", catalog: { status: "complete", indexedGames: 175476, lastSyncAt: null }, pagination: { hasMore: false }, games: [{ appid: 400, name: "Portal", type: "game", id: null, headerImage: null, capsuleImageUrl: null, imageStatus: "unknown", releaseDate: null, platforms: [], relevance: 1500 }] }), { status: 200 });
    });
    renderWithI18n(<SteamGamePicker sessionId="11111111-1111-4111-8111-111111111111" onAdded={vi.fn()} onCancel={vi.fn()} onManualFallback={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Portal" } });
    expect(await screen.findByRole("option", { name: /Portal/ })).toBeInTheDocument();
    expect(await screen.findByLabelText("Cápsula de Portal")).toHaveAttribute("data-src", "https://shared.akamai.steamstatic.com/portal.jpg");
  });
});
