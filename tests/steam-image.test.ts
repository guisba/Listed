import { describe, expect, it } from "vitest";
import { isImageStatusFresh, safeSteamImageUrl } from "@/lib/steam/image";

describe("Steam result images", () => {
  it("aceita somente o host HTTPS observado da Steam", () => {
    expect(safeSteamImageUrl("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/capsule.jpg?t=1"))
      .toBe("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/capsule.jpg?t=1");
    expect(safeSteamImageUrl("http://shared.akamai.steamstatic.com/image.jpg")).toBeNull();
    expect(safeSteamImageUrl("https://evil.example/image.jpg")).toBeNull();
    expect(safeSteamImageUrl("https://user:pass@shared.akamai.steamstatic.com/image.jpg")).toBeNull();
    expect(safeSteamImageUrl("not-a-url")).toBeNull();
  });

  it("usa TTL distinto para imagem ausente e falha transitória", () => {
    const now = Date.parse("2026-07-21T12:00:00Z");
    expect(isImageStatusFresh("missing", "2026-07-20T12:00:00Z", now)).toBe(true);
    expect(isImageStatusFresh("failed", "2026-07-21T11:45:00Z", now)).toBe(true);
    expect(isImageStatusFresh("failed", "2026-07-21T11:00:00Z", now)).toBe(false);
    expect(isImageStatusFresh("unknown", "2026-07-21T11:59:00Z", now)).toBe(false);
  });
});
