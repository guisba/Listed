"use client";

import * as Tabs from "@radix-ui/react-tabs";
import {
  Ban,
  Crown,
  History,
  LockKeyhole,
  MoreVertical,
  Settings2,
  Shield,
  Trash2,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { canPerformSessionAction } from "@/features/sessions/permissions";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/dictionaries";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type {
  MemberRole,
  SessionAuditLog,
  SessionBan,
  SessionGame,
  SessionMember,
  SessionPermissionScope,
  SessionSettings,
} from "@/types/domain";

type PendingAction =
  | { kind: "role"; member: SessionMember; role: "co_owner" | "member" }
  | { kind: "remove"; member: SessionMember; ban: boolean }
  | { kind: "transfer"; member: SessionMember }
  | { kind: "unban"; ban: SessionBan }
  | { kind: "remove-game"; game: SessionGame }
  | { kind: "delete-session" };

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
  "session.voting_updated": "admin.audit.votingUpdated",
  "session.deleted": "admin.audit.sessionDeleted",
  "game.removed": "admin.audit.gameRemoved",
  "decision.drawn": "admin.audit.decisionDrawn",
};

function roleKey(role: MemberRole): MessageKey {
  if (role === "owner") return "room.role.owner";
  if (role === "co_owner" || role === "moderator") return "room.role.coOwner";
  return "room.role.member";
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function SelectSetting({
  label,
  description,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-3 rounded-xl border border-border bg-background px-4 py-3 sm:grid-cols-[1fr_14rem] sm:items-center">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function SessionAdminDialog({
  sessionId,
  sessionStatus,
  maxParticipants,
  currentUserId,
  currentRole,
  members,
  onlineUserIds,
  games,
  settings,
  bans,
  auditLogs,
  onChanged,
  onToast,
}: {
  sessionId: string;
  sessionStatus: "open" | "locked" | "deciding" | "closed" | "expired";
  maxParticipants: number;
  currentUserId: string;
  currentRole: MemberRole;
  members: SessionMember[];
  onlineUserIds: string[];
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
  const [sessionOpen, setSessionOpen] = useState(sessionStatus === "open");
  const [participantLimit, setParticipantLimit] = useState(maxParticipants);
  const [banReason, setBanReason] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const isOwner = currentRole === "owner";
  const canRemoveGames = canPerformSessionAction(currentRole, "remove_game", settings);
  const canChangeVoting = isOwner || canPerformSessionAction(currentRole, "lock_voting", settings);

  function queueAction(action: PendingAction) {
    setActionsFor(null);
    setBanReason("");
    setPending(action);
  }

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
        ban_reason: pending.ban ? banReason || null : null,
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
    } else if (pending.kind === "remove-game") {
      result = await supabase.rpc("remove_session_game", {
        target_session_id: sessionId,
        target_game_id: pending.game.id,
      });
    } else {
      result = await supabase.rpc("delete_session", { target_session_id: sessionId });
    }
    setBusy(false);
    if (result.error) {
      onToast(t("admin.actionError"));
      return;
    }
    if (pending.kind === "delete-session") {
      window.location.assign("/");
      return;
    }
    onToast(t(pending.kind === "remove-game" ? "admin.gameRemoved" : "admin.actionDone"));
    setPending(null);
    await onChanged();
  }

  async function saveSettings() {
    if (!isOwner) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("update_session_governance", {
      target_session_id: sessionId,
      next_game_add_permission: draft.game_add_permission,
      next_game_remove_permission: draft.game_remove_permission,
      next_voting_open: !draft.voting_locked,
      next_allow_vote_changes: draft.allow_vote_changes,
      next_max_votes_per_member: draft.max_votes_per_member,
      next_decision_permission: draft.decision_permission,
      next_session_open: sessionOpen,
      next_allow_anonymous_members: draft.allow_anonymous_members,
      next_max_participants: participantLimit,
      next_coowners_can_kick_members: draft.coowners_can_kick_members,
      next_coowners_can_ban_members: draft.coowners_can_ban_members,
      next_coowners_can_remove_games: draft.coowners_can_remove_games,
      next_coowners_can_lock_voting: draft.coowners_can_lock_voting,
    });
    setBusy(false);
    if (error) onToast(t("admin.actionError"));
    else {
      onToast(t("admin.saved"));
      await onChanged();
    }
  }

  async function setVotingOpen(open: boolean) {
    if (!canChangeVoting) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_session_voting_open", {
      target_session_id: sessionId,
      next_voting_open: open,
    });
    setBusy(false);
    if (error) onToast(t("admin.actionError"));
    else {
      setDraft({ ...draft, voting_locked: !open });
      onToast(t("admin.saved"));
      await onChanged();
    }
  }

  const scopeOptions: Array<{ value: SessionPermissionScope; label: string }> = [
    { value: "owner", label: t("admin.scope.owner") },
    { value: "coowners", label: t("admin.scope.coowners") },
    { value: "everyone", label: t("admin.scope.everyone") },
  ];
  const targetName = pending?.kind === "remove-game"
    ? pending.game.name
    : pending?.kind === "unban"
      ? pending.ban.display_name
      : pending && "member" in pending
        ? pending.member.display_name
        : t("admin.session");

  const confirmationKey: MessageKey = pending?.kind === "role"
    ? pending.role === "co_owner" ? "admin.confirm.promote" : "admin.confirm.demote"
    : pending?.kind === "remove"
      ? pending.ban ? "admin.confirm.ban" : "admin.confirm.kick"
      : pending?.kind === "transfer"
        ? "admin.confirm.transfer"
        : pending?.kind === "unban"
          ? "admin.confirm.unban"
          : pending?.kind === "delete-session"
            ? "admin.confirm.delete"
            : "admin.confirm.removeGame";

  return (
    <>
      <Dialog
        open={adminOpen}
        onOpenChange={(open) => {
          setAdminOpen(open);
          setActionsFor(null);
          if (open) {
            setDraft(settings);
            setSessionOpen(sessionStatus === "open");
            setParticipantLimit(maxParticipants);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="secondary" className="w-full justify-start">
            <UserRoundCog className="size-4" />
            {t("admin.open")}
          </Button>
        </DialogTrigger>
        <DialogContent className="inset-0 flex h-dvh max-h-none w-screen max-w-none flex-col overflow-hidden rounded-none p-0 sm:h-[min(92dvh,800px)] sm:w-[min(96vw,1020px)] sm:rounded-xl">
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
                ["session", "admin.session", Settings2],
                ["history", "admin.history", History],
              ].map(([value, label, Icon]) => (
                <Tabs.Trigger
                  key={value as string}
                  value={value as string}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                >
                  <Icon className="size-4" />
                  {t(label as MessageKey)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <div className="min-h-0 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-7">
              <Tabs.Content value="members" className="space-y-7 outline-none">
                <div className="space-y-3">
                  {members.map((member) => {
                    const isSelf = member.user_id === currentUserId;
                    const isTargetCoOwner = member.role === "co_owner" || member.role === "moderator";
                    const canKick = !isSelf && member.role !== "owner"
                      && (isOwner || (!isTargetCoOwner && settings.coowners_can_kick_members));
                    const canBan = !isSelf && member.role !== "owner"
                      && (isOwner || (!isTargetCoOwner && settings.coowners_can_ban_members));
                    const hasActions = isOwner
                      ? !isSelf && member.role !== "owner"
                      : canKick || canBan;
                    const online = onlineUserIds.includes(member.user_id) || isSelf;
                    return (
                      <article
                        key={member.id}
                        className="grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                      >
                        <span className={`grid size-11 place-items-center rounded-full bg-secondary text-sm font-bold ${online ? "ring-2 ring-success/50" : ""}`}>
                          {member.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{member.display_name}</span>
                            <span className="rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">{t(roleKey(member.role))}</span>
                            {isSelf ? <span className="text-[11px] font-semibold text-muted-foreground">{t("admin.you")}</span> : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {online ? t("admin.online") : t("admin.offline")}
                            {" · "}
                            {t("admin.joinedAt", { date: formatDate(member.joined_at, { dateStyle: "medium" }) })}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{t("admin.stats", { votes: member.vote_count ?? 0, games: member.owned_games_count ?? 0 })}</p>
                        </div>
                        {hasActions ? (
                          <div className="relative justify-self-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={t("admin.actionsFor", { name: member.display_name })}
                              aria-expanded={actionsFor === member.id}
                              onClick={() => setActionsFor(actionsFor === member.id ? null : member.id)}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                            {actionsFor === member.id ? (
                              <div className="absolute right-0 top-11 z-20 grid w-56 gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">
                                {isOwner ? (
                                  <Button size="sm" variant="ghost" className="justify-start" onClick={() => queueAction({ kind: "role", member, role: isTargetCoOwner ? "member" : "co_owner" })}>
                                    <Crown className="size-3.5" />
                                    {t(isTargetCoOwner ? "admin.demote" : "admin.promote")}
                                  </Button>
                                ) : null}
                                {isOwner ? <Button size="sm" variant="ghost" className="justify-start" onClick={() => queueAction({ kind: "transfer", member })}>{t("admin.transfer")}</Button> : null}
                                {canKick ? <Button size="sm" variant="ghost" className="justify-start" onClick={() => queueAction({ kind: "remove", member, ban: false })}>{t("admin.remove")}</Button> : null}
                                {canBan ? <Button size="sm" variant="ghost" className="justify-start text-destructive" onClick={() => queueAction({ kind: "remove", member, ban: true })}><Ban className="size-3.5" />{t("admin.ban")}</Button> : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                <section>
                  <h3 className="listed-eyebrow">{t("admin.banned")}</h3>
                  <div className="mt-3 space-y-2">
                    {bans.length ? bans.map((ban) => (
                      <div key={ban.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold">{ban.display_name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(ban.created_at, { dateStyle: "medium", timeStyle: "short" })}</p>
                        </div>
                        {isOwner ? <Button size="sm" variant="secondary" onClick={() => queueAction({ kind: "unban", ban })}>{t("admin.unban")}</Button> : null}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">{t("admin.noBans")}</p>}
                  </div>
                </section>
              </Tabs.Content>

              <Tabs.Content value="permissions" className="space-y-7 outline-none">
                <section className="space-y-3">
                  <div><h3 className="text-lg font-semibold">{t("admin.gamesTitle")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("admin.gamesDescription")}</p></div>
                  <SelectSetting
                    label={t("admin.settings.gameAdd")}
                    description={t("admin.settings.gameAddDescription")}
                    value={draft.game_add_permission}
                    disabled={!isOwner}
                    options={scopeOptions}
                    onChange={(value) => setDraft({ ...draft, game_add_permission: value as SessionPermissionScope })}
                  />
                  <SelectSetting
                    label={t("admin.settings.gameRemove")}
                    description={t("admin.settings.gameRemoveDescription")}
                    value={draft.game_remove_permission}
                    disabled={!isOwner}
                    options={scopeOptions.slice(0, 2)}
                    onChange={(value) => setDraft({ ...draft, game_remove_permission: value as "owner" | "coowners" })}
                  />
                </section>
                <section className="space-y-3">
                  <div><h3 className="text-lg font-semibold">{t("admin.votingTitle")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("admin.votingDescription")}</p></div>
                  <Toggle
                    checked={!draft.voting_locked}
                    onChange={(value) => {
                      if (isOwner) setDraft({ ...draft, voting_locked: !value });
                      else void setVotingOpen(value);
                    }}
                    label={t("admin.settings.votingOpen")}
                    description={t("admin.settings.votingOpenDescription")}
                    disabled={!canChangeVoting}
                  />
                  <Toggle
                    checked={draft.allow_vote_changes}
                    onChange={(value) => setDraft({ ...draft, allow_vote_changes: value })}
                    label={t("admin.settings.voteChanges")}
                    description={t("admin.settings.voteChangesDescription")}
                    disabled={!isOwner}
                  />
                  <label className="grid gap-3 rounded-xl border border-border bg-background px-4 py-3 sm:grid-cols-[1fr_8rem] sm:items-center">
                    <span><span className="block text-sm font-semibold">{t("admin.settings.maxVotes")}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{t("admin.settings.maxVotesDescription")}</span></span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.max_votes_per_member}
                      disabled={!isOwner}
                      onChange={(event) => setDraft({ ...draft, max_votes_per_member: Number(event.target.value) })}
                      className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
                    />
                  </label>
                </section>
                <section className="space-y-3">
                  <div><h3 className="text-lg font-semibold">{t("admin.decisionTitle")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("admin.decisionDescription")}</p></div>
                  <SelectSetting
                    label={t("admin.settings.decision")}
                    description={t("admin.settings.decisionDescription")}
                    value={draft.decision_permission}
                    disabled={!isOwner}
                    options={scopeOptions}
                    onChange={(value) => setDraft({ ...draft, decision_permission: value as SessionPermissionScope })}
                  />
                </section>
                <section className="space-y-3">
                  <div><h3 className="text-lg font-semibold">{t("admin.coownerTitle")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("admin.coownerDescription")}</p></div>
                  <Toggle checked={draft.coowners_can_kick_members} onChange={(value) => setDraft({ ...draft, coowners_can_kick_members: value })} label={t("admin.settings.coownersKick")} disabled={!isOwner} />
                  <Toggle checked={draft.coowners_can_ban_members} onChange={(value) => setDraft({ ...draft, coowners_can_ban_members: value })} label={t("admin.settings.coownersBan")} disabled={!isOwner} />
                  <Toggle checked={draft.coowners_can_remove_games} onChange={(value) => setDraft({ ...draft, coowners_can_remove_games: value })} label={t("admin.settings.coownersRemoveGames")} disabled={!isOwner} />
                  <Toggle checked={draft.coowners_can_lock_voting} onChange={(value) => setDraft({ ...draft, coowners_can_lock_voting: value })} label={t("admin.settings.coownersLockVoting")} disabled={!isOwner} />
                </section>
                {isOwner ? <Button onClick={() => void saveSettings()} disabled={busy}><LockKeyhole className="size-4" />{t("admin.save")}</Button> : <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">{t("admin.ownerOnlySettings")}</p>}
              </Tabs.Content>

              <Tabs.Content value="session" className="space-y-7 outline-none">
                <section className="space-y-3">
                  <div><h3 className="text-lg font-semibold">{t("admin.participationTitle")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("admin.participationDescription")}</p></div>
                  <Toggle checked={sessionOpen} onChange={setSessionOpen} label={t("admin.settings.sessionOpen")} description={t("admin.settings.sessionOpenDescription")} disabled={!isOwner || sessionStatus === "closed" || sessionStatus === "expired"} />
                  <Toggle checked={draft.allow_anonymous_members} onChange={(value) => setDraft({ ...draft, allow_anonymous_members: value })} label={t("admin.settings.anonymous")} description={t("admin.settings.anonymousDescription")} disabled={!isOwner} />
                  <label className="grid gap-3 rounded-xl border border-border bg-background px-4 py-3 sm:grid-cols-[1fr_8rem] sm:items-center">
                    <span><span className="block text-sm font-semibold">{t("admin.settings.participantLimit")}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{t("admin.settings.participantLimitDescription")}</span></span>
                    <input
                      type="number"
                      min={Math.max(2, members.length)}
                      max={100}
                      value={participantLimit}
                      disabled={!isOwner}
                      onChange={(event) => setParticipantLimit(Number(event.target.value))}
                      className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
                    />
                  </label>
                  {isOwner ? <Button onClick={() => void saveSettings()} disabled={busy}><LockKeyhole className="size-4" />{t("admin.save")}</Button> : null}
                </section>
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold">{t("admin.gamesInSession")}</h3>
                  {games.length ? games.map((game) => (
                    <div key={game.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
                      <span className="min-w-0 truncate text-sm font-medium">{game.name}</span>
                      {canRemoveGames ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => queueAction({ kind: "remove-game", game })}><Trash2 className="size-3.5" />{t("admin.removeGame")}</Button> : null}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">{t("admin.noGames")}</p>}
                </section>
                {isOwner ? (
                  <section className="rounded-xl border border-destructive/35 bg-destructive/5 p-4">
                    <h3 className="font-semibold text-destructive">{t("admin.dangerTitle")}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("admin.dangerDescription")}</p>
                    <Button variant="destructive" className="mt-4" onClick={() => queueAction({ kind: "delete-session" })}><Trash2 className="size-4" />{t("admin.deleteSession")}</Button>
                  </section>
                ) : null}
              </Tabs.Content>

              <Tabs.Content value="history" className="space-y-2 outline-none">
                {auditLogs.length ? auditLogs.map((log) => (
                  <article key={log.id} className="border-b border-border py-3">
                    <p className="text-sm font-medium">{t(auditKeys[log.action] ?? "admin.audit.other")}</p>
                    <time className="mt-1 block text-xs text-muted-foreground" dateTime={log.created_at}>{formatDate(log.created_at, { dateStyle: "medium", timeStyle: "short" })}</time>
                  </article>
                )) : <p className="text-sm text-muted-foreground">{t("admin.emptyHistory")}</p>}
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">{t("admin.confirmTitle")}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">{t(confirmationKey, { name: targetName })}</DialogDescription>
          {pending?.kind === "remove" && pending.ban ? (
            <label className="mt-5 block text-sm font-semibold">
              {t("admin.banReason")}
              <input
                value={banReason}
                maxLength={240}
                onChange={(event) => setBanReason(event.target.value)}
                placeholder={t("admin.banReasonPlaceholder")}
                className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-normal outline-none focus:border-primary"
              />
            </label>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>{t("common.cancel")}</Button>
            <Button
              variant={pending?.kind === "role" || pending?.kind === "transfer" || pending?.kind === "unban" ? "default" : "destructive"}
              disabled={busy}
              onClick={() => void runPending()}
            >
              {t("admin.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
