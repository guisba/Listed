"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Moon, Paintbrush, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const options = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "dark-red", label: "Escuro vermelho", icon: Paintbrush },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Escolher tema">
          <Paintbrush className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-52 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => setTheme(option.value)}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none hover:bg-accent focus:bg-accent"
              >
                <Icon className="size-4" />
                <span className="flex-1">{option.label}</span>
                {theme === option.value ? <Check className="size-4 text-primary" /> : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
