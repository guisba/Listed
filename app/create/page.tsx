import type { Metadata } from "next";
import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { FormShell } from "@/components/layout/form-shell";

export const metadata: Metadata = { title: "Criar sessão" };

export default function CreatePage() {
  return <FormShell eyebrow="Nova lista" title="Comece pela pergunta certa: o que está em jogo?" description="Dê um nome à lista, escolha como o grupo decide e compartilhe o código. Leva menos de um minuto." wide><CreateSessionForm /></FormShell>;
}
