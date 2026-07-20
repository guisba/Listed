import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-input bg-background/70 px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-4 focus:ring-primary/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
