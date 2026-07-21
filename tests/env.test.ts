import { afterEach, describe, expect, it } from "vitest";
import { getAppUrl } from "@/lib/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getAppUrl", () => {
  it("prefere a URL automática do Preview da Vercel", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "listed-preview.example.vercel.app";
    process.env.NEXT_PUBLIC_APP_URL = "https://listedme.vercel.app";

    expect(getAppUrl().toString()).toBe(
      "https://listed-preview.example.vercel.app/",
    );
  });

  it("usa a URL canônica configurada fora do Preview", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "listed-production.example.vercel.app";
    process.env.NEXT_PUBLIC_APP_URL = "https://listedme.vercel.app";

    expect(getAppUrl().toString()).toBe("https://listedme.vercel.app/");
  });

  it("usa localhost quando a configuração estiver ausente ou inválida", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    process.env.NEXT_PUBLIC_APP_URL = "inválida";

    expect(getAppUrl().toString()).toBe("http://localhost:3000/");
  });
});
