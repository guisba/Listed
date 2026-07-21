import { describe, expect, it } from "vitest";
import { normalizeName } from "@/lib/utils";

describe("normalizeName para o catálogo Steam", () => {
  it.each([
    ["Baldur's Gate 3", "baldurs gate 3"],
    ["Don't Starve Together", "dont starve together"],
    ["Counter-Strike 2", "counter strike 2"],
    ["Tom Clancy’s Rainbow Six Siege", "tom clancys rainbow six siege"],
    ["  Pokémon   TCG™  ", "pokemon tcg"],
  ])("normaliza %s sem aliases específicos", (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });
});
