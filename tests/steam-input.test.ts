import { describe, expect, it } from "vitest";
import { parseSteamInput, stripExternalHtml } from "@/lib/steam/input";

describe("parseSteamInput", () => {
  it("aceita AppID", () => expect(parseSteamInput("730")).toEqual({ kind: "appid", appid: 730 }));
  it("extrai AppID de URL oficial", () => expect(parseSteamInput("https://store.steampowered.com/app/730/CounterStrike_2/")).toEqual({ kind: "appid", appid: 730 }));
  it.each([
    ["Terraria", { kind: "name", query: "Terraria" }],
    ["Counter-Strike 2", { kind: "name", query: "Counter-Strike 2" }],
    ["105600", { kind: "appid", appid: 105600 }],
    ["730", { kind: "appid", appid: 730 }],
    ["https://store.steampowered.com/app/105600/Terraria/", { kind: "appid", appid: 105600 }],
    ["https://store.steampowered.com/app/730/CounterStrike_2/?l=brazilian", { kind: "appid", appid: 730 }],
  ])("normaliza o caso obrigatório %s", (input, expected) => expect(parseSteamInput(input as string)).toEqual(expected));
  it("rejeita hosts parecidos", () => expect(() => parseSteamInput("https://store.steampowered.com.evil.test/app/730")).toThrow(/oficial/));
  it("rejeita URL Steam sem AppID", () => expect(() => parseSteamInput("https://store.steampowered.com/about/")).toThrow(/AppID/));
  it("trata texto comum como busca", () => expect(parseSteamInput("counter strik")).toEqual({ kind: "name", query: "counter strik" }));
});

describe("stripExternalHtml", () => {
  it("remove tags e normaliza espaços", () => expect(stripExternalHtml("<b>Coop</b> &amp; ação")).toBe("Coop & ação"));
  it("decodifica entidades numéricas sem preservar HTML", () => expect(stripExternalHtml("<p>A&#231;&#227;o<br>R&#xE1;pida</p>")).toBe("Ação Rápida"));
});
