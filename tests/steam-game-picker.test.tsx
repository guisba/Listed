import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SteamGamePicker } from "@/components/games/steam-game-picker";

vi.mock("next/image", () => ({ default: () => <span data-testid="next-image" /> }));

const preview = {
  id: "catalog-1", appid: 105600, name: "Terraria", type: "game",
  storeUrl: "https://store.steampowered.com/app/105600/", headerImage: null, coverImage: null,
  shortDescription: "Dig, fight, explore.", fullDescription: null, releaseDate: "16 May, 2011", comingSoon: false,
  platforms: ["windows"], genres: ["Ação"], categories: ["Online Co-op"], features: ["coop-online"],
  developers: ["Re-Logic"], publishers: ["Re-Logic"], supportedLanguages: ["Português"],
  price: { currency: "BRL", initial: 3299, final: 3299, discountPercent: 0, formatted: "R$ 32,99" },
  isFree: false, metadataStatus: "complete" as const, cacheState: "fresh" as const,
};

describe("SteamGamePicker", () => {
  afterEach(() => vi.restoreAllMocks());

  it("busca ao digitar, permite teclado, mostra prévia e confirma", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "matches", catalog: { status: "complete", indexedGames: 100000, lastSyncAt: null }, pagination: { hasMore: false }, games: [{ appid: 105600, name: "Terraria", type: "game", id: null, headerImage: null, releaseDate: "2011", platforms: ["windows"], relevance: 1 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "preview", games: [preview] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ game: preview }), { status: 201 }));
    const onAdded = vi.fn();
    render(<SteamGamePicker sessionId="11111111-1111-4111-8111-111111111111" onAdded={onAdded} onCancel={vi.fn()} onManualFallback={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Terraria" } });
    expect(await screen.findByRole("option", { name: /Terraria/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "Terraria" })).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    expect(screen.getByRole("heading", { name: "Terraria" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar à lista/ }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/steam/session-game", expect.objectContaining({ method: "POST" }));
  });
});
