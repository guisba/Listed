import { describe, expect, it } from "vitest";
import { parseSteamInput, stripExternalHtml } from "@/lib/steam/input";

describe("parseSteamInput", () => {
  it("aceita AppID", () => expect(parseSteamInput("730")).toEqual({ kind: "appid", appid: 730 }));
  it("extrai AppID de URL oficial", () => expect(parseSteamInput("https://store.steampowered.com/app/730/CounterStrike_2/")).toEqual({ kind: "appid", appid: 730 }));
  it("rejeita hosts parecidos", () => expect(() => parseSteamInput("https://store.steampowered.com.evil.test/app/730")).toThrow(/oficial/));
  it("trata texto comum como busca", () => expect(parseSteamInput("counter strik")).toEqual({ kind: "name", query: "counter strik" }));
});

describe("stripExternalHtml", () => {
  it("remove tags e normaliza espaços", () => expect(stripExternalHtml("<b>Coop</b> &amp; ação")).toBe("Coop & ação"));
});
