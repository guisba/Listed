import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListedGameCard } from "@/components/games/game-card";
import type { SessionGame } from "@/types/domain";

const longName = "Um jogo cooperativo com um nome propositalmente muito longo para validar a composição";
const game: SessionGame = {
  id: "game-1", session_id: "session-1", catalog_game_id: null, source: "manual", name: longName,
  normalized_name: longName.toLowerCase(), image_url: null, store_url: null, platforms: ["PC"], features: ["coop-online"],
  min_players: 2, max_players: 4, added_by: "user-1", created_at: new Date().toISOString(), vote_count: 2,
  owner_count: 1, member_count: 3, has_voted: false, ownership_status: "unknown",
};

describe("ListedGameCard", () => {
  it("mantém nome longo e fallback de imagem acessíveis", () => {
    render(<ListedGameCard game={game} rank={1} onVote={vi.fn().mockResolvedValue(true)} onOwnership={vi.fn().mockResolvedValue(true)} />);
    expect(screen.getByRole("heading", { name: longName })).toBeInTheDocument();
    expect(screen.getByText("Imagem indisponível")).toBeInTheDocument();
  });

  it("aplica voto otimista e reverte quando a gravação falha", async () => {
    const user = userEvent.setup();
    render(<ListedGameCard game={game} rank={2} onVote={vi.fn().mockResolvedValue(false)} onOwnership={vi.fn().mockResolvedValue(true)} />);
    const button = screen.getAllByRole("button", { name: /Votar\s*2/ }).at(-1)!;
    await user.click(button);
    expect(screen.getAllByRole("button", { name: /Votar\s*2/ }).at(-1)).toHaveAttribute("aria-pressed", "false");
  });
});
