import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/steam/cache", () => ({ resolveSteamGame: vi.fn() }));

import { resolveSteamGame } from "@/lib/steam/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/steam/search/enrich/route";

function request(appids: unknown) {
  return new NextRequest("http://localhost/api/steam/search/enrich", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appids }),
  });
}

describe("POST /api/steam/search/enrich", () => {
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const indexRows: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    indexRows.length = 0;
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: crypto.randomUUID() } } })) },
      from: vi.fn(() => ({ select: vi.fn(() => ({ in: vi.fn(async () => ({ data: indexRows, error: null })) })) })),
    } as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);
  });

  it("enriquece em lote, persiste e isola uma falha", async () => {
    vi.mocked(resolveSteamGame)
      .mockResolvedValueOnce({
        appid: 400,
        capsuleImage: "https://shared.akamai.steamstatic.com/portal.jpg",
        coverImage: null,
        headerImage: "https://shared.akamai.steamstatic.com/portal-header.jpg",
      } as never)
      .mockRejectedValueOnce(new Error("upstream detail omitted"));

    const response = await POST(request([400, 620]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ images: [
      { appid: 400, capsuleImageUrl: "https://shared.akamai.steamstatic.com/portal.jpg", imageStatus: "available" },
      { appid: 620, capsuleImageUrl: null, imageStatus: "failed" },
    ] });
    expect(resolveSteamGame).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("retorna cache hit sem chamar a Steam", async () => {
    indexRows.push({
      appid: 730,
      capsule_image_url: "https://shared.akamai.steamstatic.com/cs2.jpg",
      header_image_url: null,
      image_status: "available",
      image_updated_at: new Date().toISOString(),
    });
    const response = await POST(request([730]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ images: [{ appid: 730, imageStatus: "available" }] });
    expect(resolveSteamGame).not.toHaveBeenCalled();
  });

  it("rejeita URL, AppID inválido e lote acima do limite", async () => {
    expect((await POST(request(["https://store.steampowered.com/app/730/"]))).status).toBe(400);
    expect((await POST(request([0]))).status).toBe(400);
    expect((await POST(request(Array.from({ length: 13 }, (_, index) => index + 1)))).status).toBe(400);
    expect(resolveSteamGame).not.toHaveBeenCalled();
  });
});
