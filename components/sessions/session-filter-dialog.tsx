"use client";

import { Check, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  countActiveSessionFilters,
  FILTER_GROUPS,
  type ActiveSessionFilters,
  type FilterGroup,
  type SessionFilterValue,
  toggleSessionFilter,
} from "@/features/sessions/filters";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/dictionaries";

const groups = Object.entries(FILTER_GROUPS) as Array<[FilterGroup, readonly SessionFilterValue[]]>;

export function SessionFilterDialog({
  filters,
  resultCount,
  onChange,
  onClear,
}: {
  filters: ActiveSessionFilters;
  resultCount: number;
  onChange: (filters: ActiveSessionFilters) => void;
  onClear: () => void;
}) {
  const { t, plural } = useI18n();
  const activeCount = countActiveSessionFilters(filters);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="relative shrink-0">
          <SlidersHorizontal className="size-4" />
          {t("room.filter.open")}
          {activeCount ? <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[10px] text-primary-foreground">{activeCount}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:w-[min(94vw,720px)]">
        <div className="pr-10">
          <p className="listed-eyebrow text-primary">{plural("room.filter.active.one", "room.filter.active.other", activeCount)}</p>
          <DialogTitle className="mt-2 text-2xl font-semibold tracking-tight">{t("room.filter.title")}</DialogTitle>
          <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("room.filter.description")}</DialogDescription>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {groups.map(([group, values]) => (
            <fieldset key={group}>
              <legend className="listed-eyebrow mb-2">{t(`room.filter.group.${group}` as MessageKey)}</legend>
              <div className="grid gap-2">
                {values.map((value) => {
                  const selected = filters[group].includes(value);
                  return (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={selected}
                      onClick={() => onChange(toggleSessionFilter(filters, group, value))}
                      className={`flex min-h-11 items-center justify-between rounded-lg border px-3.5 text-left text-sm font-medium transition-colors ${selected ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:border-primary/45"}`}
                    >
                      {t(`room.filter.${value}` as MessageKey)}
                      <span className={`grid size-5 place-items-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input"}`} aria-hidden="true">
                        {selected ? <Check className="size-3" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between gap-3 border-t border-border bg-card px-5 pt-4 sm:-mx-6 sm:px-6">
          <Button variant="ghost" onClick={onClear} disabled={!activeCount}><X className="size-4" />{t("room.filter.clear")}</Button>
          <p className="font-mono text-xs font-semibold text-muted-foreground">{plural("room.filter.results.one", "room.filter.results.other", resultCount)}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
