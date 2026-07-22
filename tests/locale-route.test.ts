import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/locale/route";

describe("locale route", () => {
  it("persiste somente um locale permitido em cookie restrito", async () => {
    const response = await POST(new Request("http://localhost/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: "en-US" }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("listed_locale=en-US");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("rejeita locale inválido e campos extras", async () => {
    const invalid = await POST(new Request("http://localhost/api/locale", { method: "POST", body: JSON.stringify({ locale: "fr-FR" }) }));
    const extra = await POST(new Request("http://localhost/api/locale", { method: "POST", body: JSON.stringify({ locale: "pt-BR", redirect: "https://example.com" }) }));
    expect(invalid.status).toBe(400);
    expect(extra.status).toBe(400);
  });
});
