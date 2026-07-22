import { describe, expect, it } from "vitest";
import { parseAuthProviderAvailability } from "@/lib/supabase/auth-providers";

describe("parseAuthProviderAvailability", () => {
  it("expõe somente provedores OAuth habilitados", () => {
    expect(
      parseAuthProviderAvailability({
        external: { google: true, discord: false, email: true },
      }),
    ).toEqual({ google: true, discord: false });
  });

  it("oculta provedores quando o payload é inválido", () => {
    expect(parseAuthProviderAvailability({ external: "invalid" })).toEqual({
      google: false,
      discord: false,
    });
  });

  it("oculta provedores ausentes", () => {
    expect(parseAuthProviderAvailability({})).toEqual({
      google: false,
      discord: false,
    });
  });
});
