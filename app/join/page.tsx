import type { Metadata } from "next";
import Link from "next/link";
import { JoinSessionForm } from "@/components/sessions/join-session-form";
import { FormShell } from "@/components/layout/form-shell";

export const metadata: Metadata = { title: "Entrar em uma sessão" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  return <FormShell eyebrow="Convite recebido" title="Entre na lista do grupo." description="Use o código compartilhado com você. Seu nome aparece para as outras pessoas assim que entrar." footer={<>Ainda não existe uma lista? <Link href="/create" className="font-semibold text-primary hover:underline">Crie a primeira</Link></>}><JoinSessionForm initialCode={code} /></FormShell>;
}
