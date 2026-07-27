"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Ban, Crown, History, LockKeyhole, Settings2, Shield, Trash2, UserRoundCog, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/dictionaries";
import type {
  MemberRole,
  SessionAuditLog,
  SessionBan,
  SessionGame,
  SessionMember,
  SessionSettings,
} from "@/types/domain";

type PendingAction =
  | { kind: "role"; member: SessionMember; role: "co_owner" | "member" }
  | { kind: "remove"; member: SessionMember; ban: boolean }
  | { kind: "transfer"; member: SessionMember }
  | { kind: "unban"; ban: SessionBan }
  | { kind: "remove-game"; game: SessionGame };

const auditKeys: Record<string, MessageKey> = {
  "session.created": "admin.audit.sessionCreated",
  "member.joined": "admin.audit.memberJoined",
  "member.role_changed": "admin.audit.roleChanged",
  "member.removed": "admin.audit.memberRemoved",
  "member.banned": "admin.audit.memberBanned",
  "member.unbanned": "admin.audit.memberUnbanned",
  "session.ownership_transferred": "admin.audit.ownershipTransferred",
  "session.settings_updated": "admin.audit.settingsUpdated",
  "session.status_updated": "admin.audit.statusUpdated",
  "game.removed": "admin.audit.gameRemoved",
  "decision.drawn": "admin.audit.decisionDrawn",
};

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <span>{label}</span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function SessionAdminDialog({
  sessionId,
  currentUserId,
  currentRole,
  members,
  games,
  settings,
  bans,
  auditLogs,
  onChanged,
  onToast,
}: {
  sessionId: string;
  currentUserId: string;
  currentRole: MemberRole;
  members: SessionMember[];
  games: SessionGame[];
  settings: SessionSettings;
  bans: SessionBan[];
  auditLogs: SessionAuditLog[];
  onChanged: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const { t, formatDate } = useI18n();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(settings);
  const [adminOpen, setAdminOpen] = useState(false);
  const isOwner = currentRole === "owner";
  const canEditSettings = isOwner || settings.coowners_can_manage_settings;

  async function runPending() {
    if (!pending) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    let result: { error: { message: string } | null };
    if (pending.kind === "role") {
      result = await supabase.rpc("set_session_member_role", {
        target_session_id: sessionId,
        target_user_id: pending.member.user_id,
        new_role: pending.role,
      });
    } else if (pending.kind === "remove") {
      result = await supabase.rpc("remove_session_member", {
        target_session_id: sessionId,
        target_user_id: pending.member.user_id,
        should_ban: pending.ban,
        ban_reason: null,
      });
    } else if (pending.kind === "transfer") {
      result = await supabase.rpc("transfer_session_ownership", {
        target_session_id: sessionId,
        target_user_id: pending.member.user_id,
      });
    } else if (pending.kind === "unban") {
      result = await supabase.rpc("unban_session_member", {
        target_session_id: sessionId,
        target_user_id: pending.ban.user_id,
      });
    } else {
      result = await supabase.rpc("remove_session_game", {
        target_session_id: sessionId,
        target_game_id: pending.game.id,
      });
    }
    setBusy(false);
    if (result.error) onToast(t("admin.actionError"));
    else {
      onToast(t(pending.kind === "remove-game" ? "admin.gameRemoved" : "admin.actionDone"));
      setPending(null);
      await onChanged();
    }
  }

  async function saveSettings() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("update_session_settings", {
      target_session_id: sessionId,
      next_games_locked: draft.games_locked,
      next_voting_locked: draft.voting_locked,
      next_members_can_add_games: draft.members_can_add_games,
      next_coowners_can_manage_games: draft.coowners_can_manage_games,
      next_coowners_can_manage_members: draft.coowners_can_manage_members,
      next_coowners_can_manage_settings: draft.coowners_can_manage_settings,
    });
    setBusy(false);
    if (error) onToast(t("admin.actionError"));
    else {
      onToast(t("admin.saved"));
      await onChanged();
    }
  }

  const targetName = pending?.kind === "remove-game"
    ? pending.game.name
    : pending?.kind === "unban"
      ? pending.ban.display_name
      : pending?.member.display_name;

  return (
    <>
      <Dialog
        open={adminOpen}
        onOpenChange={(open) => {
          setAdminOpen(open);
          if (open) setDraft(settings);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="secondary" className="w-full justify-start"><UserRoundCog className="size-4" />{t("admin.open")}</Button>
        </DialogTrigger>
        <DialogContent className="flex h-[min(92dvh,780px)] flex-col overflow-hidden p-0 sm:w-[min(96vw,980px)]">
          <div className="border-b border-border px-5 py-5 pr-14 sm:px-7">
            <p className="listed-eyebrow text-primary">{t("room.admin")}</p>
            <DialogTitle className="mt-2 text-3xl font-semibold tracking-[-.04em]">{t("admin.title")}</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">{t("admin.description")}</DialogDescription>
          </div>
          <Tabs.Root defaultValue="members" className="grid min-h-0 flex-1 grid-rows-[auto_1fr]">
            <Tabs.List className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:px-6">
              {[
                ["members", "admin.members", Users],
                ["permissions", "admin.permissions", Shield],
                ["history", "admin.history", History],
                ["session", "admin.session", Settings2],
              ].map(([value, label, Icon]) => (
                <Tabs.Trigger key={value as string} value={value as string} className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <Icon className="size-4" />{t(label as MessageKey)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
              <Tabs.Content value="members" className="space-y-6 outline-none">
                <div className="space-y-2">
                  {members.map((member) => (
                    <article key={member.id} className="grid gap-3 rounded-xl border border-border bg-background p-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{member.display_name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-primary">{t(member.role === "owner" ? "room.role.owner" : member.role === "co_owner" || member.role === "moderator" ? "room.role.coOwner" : "room.role.member")}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{t("admin.stats", { votes: member.vote_count ?? 0, games: member.owned_games_count ?? 0 })}</p>
                      </div>
                      {member.user_id !== currentUserId ? (
                        <div className="flex flex-wrap gap-2">
                          {isOwner && member.role !== "owner" ? <Button size="sm" variant="ghost" onClick={() => setPending({ kind: "role", member, role: member.role === "co_owner" || member.role === "moderator" ? "member" : "co_owner" })}><Crown className="size-3.5" />{t(member.role === "co_owner" || member.role === "moderator" ? "admin.demote" : "admin.promote")}</Button> : null}
                          {isOwner && member.role !== "owner" ? <Button size="sm" variant="ghost" onClick={() => setPending({ kind: "transfer", member })}>{t("admin.transfer")}</Button> : null}
                          {member.role === "member" && (isOwner || settings.coowners_can_manage_members) ? <Button size="sm" variant="ghost" onClick={() => setPending({ kind: "remove", member, ban: false })}>{t("admin.remove")}</Button> : null}
                          {member.role === "member" && (isOwner || settings.coowners_can_manage_members) ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setPending({ kind: "remove", member, ban: true })}><Ban className="size-3.5" />{t("admin.ban")}</Button> : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
                <section>
                  <h3 className="listed-eyebrow">{t("admin.banned")}</h3>
                  <div className="mt-2 space-y-2">
                    {bans.length ? bans.map((ban) => (
                      <div key={ban.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-3">
                        <div><p className="text-sm font-semibold">{ban.display_name}</p><p className="text-xs text-muted-foreground">{formatDate(ban.created_at, { dateStyle: "medium", timeStyle: "short" })}</p></div>
                        <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "unban", ban })}>{t("admin.unban")}</Button>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">{t("admin.noBans")}</p>}
                  </div>
                </section>
              </Tabs.Content>
              <Tabs.Content value="permissions" className="space-y-3 outline-none">
                <Toggle checked={draft.games_locked} onChange={(value) => setDraft({ ...draft, games_locked: value })} label={t("admin.settings.gamesLocked")} disabled={!canEditSettings} />
                <Toggle checked={draft.voting_locked} onChange={(value) => setDraft({ ...draft, voting_locked: value })} label={t("admin.settings.votingLocked")} disabled={!canEditSettings} />
                <Toggle checked={draft.members_can_add_games} onChange={(value) => setDraft({ ...draft, members_can_add_games: value })} label={t("admin.settings.membersAdd")} disabled={!canEditSettings} />
                <Toggle checked={draft.coowners_can_manage_games} onChange={(value) => setDraft({ ...draft, coowners_can_manage_games: value })} label={t("admin.settings.coownersGames")} disabled={!isOwner} />
                <Toggle checked={draft.coowners_can_manage_members} onChange={(value) => setDraft({ ...draft, coowners_can_manage_members: value })} label={t("admin.settings.coownersMembers")} disabled={!isOwner} />
                <Toggle checked={draft.coowners_can_manage_settings} onChange={(value) => setDraft({ ...draft, coowners_can_manage_settings: value })} label={t("admin.settings.coownersSettings")} disabled={!isOwner} />
                <Button onClick={() => void saveSettings()} disabled={!canEditSettings || busy} className="mt-3"><LockKeyhole className="size-4" />{t("admin.save")}</Button>
                <p className="pt-3 text-xs text-muted-foreground">{t("admin.approvalDeferred")}</p>
              </Tabs.Content>
              <Tabs.Content value="history" className="space-y-2 outline-none">
                {auditLogs.length ? auditLogs.map((log) => (
                  <article key={log.id} className="border-b border-border py-3">
                    <p className="text-sm font-medium">{t(auditKeys[log.action] ?? "admin.audit.other")}</p>
                    <time className="mt-1 block text-xs text-muted-foreground" dateTime={log.created_at}>{formatDate(log.created_at, { dateStyle: "medium", timeStyle: "short" })}</time>
                  </article>
                )) : <p className="text-sm text-muted-foreground">{t("admin.emptyHistory")}</p>}
              </Tabs.Content>
              <Tabs.Content value="session" className="space-y-2 outline-none">
                {games.map((game) => (
                  <div key={game.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
                    <span className="min-w-0 truncate text-sm font-medium">{game.name}</span>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setPending({ kind: "remove-game", game })}><Trash2 className="size-3.5" />{t("admin.removeGame")}</Button>
                  </div>
                ))}
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">{t("admin.confirmTitle")}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">{t("admin.confirmDescription", { name: targetName ?? "" })}</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void runPending()}>{t("admin.confirm")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
