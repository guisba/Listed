import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionAdminDialog } from "@/components/sessions/session-admin-dialog";
import { SessionFilterDialog } from "@/components/sessions/session-filter-dialog";
import { ShareSessionDialog } from "@/components/sessions/share-session-dialog";
import { EMPTY_SESSION_FILTERS } from "@/features/sessions/filters";
import type { SessionMember, SessionSettings } from "@/types/domain";
import { renderWithI18n } from "./i18n-render";

const settings: SessionSettings = {
  session_id: "00000000-0000-4000-8000-000000000001",
  games_locked: false,
  voting_locked: false,
  members_can_add_games: true,
  coowners_can_manage_games: true,
  coowners_can_manage_members: false,
  coowners_can_manage_settings: false,
  updated_at: "2026-07-27T00:00:00Z",
};

const members: SessionMember[] = [
  { id: "1", user_id: "owner", display_name: "Lia", role: "owner", joined_at: "2026-07-27T00:00:00Z" },
  { id: "2", user_id: "member", display_name: "Nando", role: "member", joined_at: "2026-07-27T00:01:00Z", vote_count: 2, owned_games_count: 3 },
];

describe("session controls", () => {
  it("combina filtros acessíveis e informa a contagem antes de fechar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithI18n(<SessionFilterDialog filters={EMPTY_SESSION_FILTERS} resultCount={7} onChange={onChange} onClear={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("7 resultados");
    await user.click(screen.getByRole("button", { name: "Cooperativo online" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: ["coop-online"] }));
    await user.keyboard("{Escape}");
  });

  it("gera passe com QR e copia código sem serviço externo", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderWithI18n(<ShareSessionDialog code="4FRAZX" title="Sexta" />);
    await user.click(screen.getByRole("button", { name: "Compartilhar lista" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Passe de entrada");
    expect(screen.getByLabelText("QR code da lista")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /4FRAZX/ }));
    expect(writeText).toHaveBeenCalledWith("4FRAZX");
    await user.keyboard("{Escape}");
  });

  it("mostra ações exclusivas do owner e histórico administrativo", async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <SessionAdminDialog
        sessionId={settings.session_id}
        currentUserId="owner"
        currentRole="owner"
        members={members}
        games={[]}
        settings={settings}
        bans={[]}
        auditLogs={[{
          id: "log",
          session_id: settings.session_id,
          actor_id: "owner",
          action: "member.role_changed",
          entity_type: "session_member",
          entity_id: "member",
          metadata: {},
          created_at: "2026-07-27T00:02:00Z",
        }]}
        onChanged={vi.fn()}
        onToast={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Abrir administração" }));
    expect(screen.getByRole("button", { name: /Tornar co-dono/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transferir propriedade" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByText("Papel de participante alterado")).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });
});
