import { render, screen } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";
import { CreateSessionForm } from "@/components/sessions/create-session-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("CreateSessionForm", () => {
  it("oferece os campos essenciais e os métodos iniciais", () => {
    render(<CreateSessionForm />);
    expect(screen.getByLabelText("Nome da sessão")).toBeInTheDocument();
    expect(screen.getByLabelText("Como devemos chamar você?")).toBeInTheDocument();
    expect(screen.getByText("Votação múltipla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar sessão/ })).toBeEnabled();
  });
});
