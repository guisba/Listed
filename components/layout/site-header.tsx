import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-black tracking-tight" aria-label="JogaJunto — início">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Gamepad2 className="size-5" />
          </span>
          <span>Joga<span className="text-primary">Junto</span></span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Navegação principal">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/join">Entrar</Link></Button>
          <ThemeSwitcher />
          <Button asChild size="sm"><Link href="/create">Criar sessão</Link></Button>
        </nav>
      </div>
    </header>
  );
}
