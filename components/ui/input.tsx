import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/12 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
