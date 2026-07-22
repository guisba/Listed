import { screen } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";
import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { renderWithI18n } from "./i18n-render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("CreateSessionForm", () => {
  it("oferece os campos essenciais e os métodos iniciais", () => {
    renderWithI18n(<CreateSessionForm />);
    expect(screen.getByLabelText("Nome da lista")).toBeInTheDocument();
    expect(screen.getByLabelText("Como devemos chamar você?")).toBeInTheDocument();
    expect(screen.getByText("Votação múltipla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar lista/ })).toBeEnabled();
  });
});
