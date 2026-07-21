import Link from "next/link";
import { ListedLogo } from "@/components/brand/listed-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-md">
      <div className="compact-320 mx-auto flex h-16 max-w-[var(--content-max)] items-center justify-between px-4 sm:px-6">
        <ListedLogo />
        <nav className="flex items-center gap-1" aria-label="Navegação principal">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/join">Usar código</Link></Button>
          <ThemeSwitcher />
          <Button asChild size="sm"><Link href="/create">Criar lista</Link></Button>
        </nav>
      </div>
    </header>
  );
}
