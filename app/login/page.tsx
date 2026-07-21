import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { FormShell } from "@/components/layout/form-shell";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return <FormShell eyebrow="Conta permanente" title="Suas listas, em qualquer dispositivo." description="Conecte sua identidade temporária a uma conta para manter grupos, votos e histórico."><LoginForm /></FormShell>;
}
