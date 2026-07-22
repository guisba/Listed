"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Contrast, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useI18n } from "@/i18n/client";

const options = [
  { value: "light", label: "theme.light", icon: Sun },
  { value: "dark", label: "theme.dark", icon: Moon },
  { value: "dark-red", label: "theme.darkRed", icon: Contrast },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  async function chooseTheme(value: (typeof options)[number]["value"]) {
    setTheme(value);
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (data.user && !data.user.is_anonymous) await supabase.from("profiles").update({ preferred_theme: value }).eq("id", data.user.id);
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme.choose")}>
          <Contrast className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => chooseTheme(option.value)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent"
              >
                <Icon className="size-4" />
                <span className="flex-1">{t(option.label)}</span>
                {theme === option.value ? <Check className="size-4 text-primary" /> : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
