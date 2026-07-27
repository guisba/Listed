"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ensureAnonymousUser, getBrowserSupabase } from "@/lib/supabase/browser";
import type {
  OwnershipStatus,
  SessionAuditLog,
  SessionBan,
  SessionGame,
  SessionMember,
  SessionSettings,
  SessionSummary,
} from "@/types/domain";
import { useI18n } from "@/i18n/client";

export function useRoomData(code: string) {
  const { t } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [games, setGames] = useState<SessionGame[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [bans, setBans] = useState<SessionBan[]>([]);
  const [auditLogs, setAuditLogs] = useState<SessionAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) { setError(t("room.errorDescription")); setLoading(false); return; }
    try {
      const user = await ensureAnonymousUser();
      setUserId(user.id);
      const { data: sessionData, error: sessionError } = await supabase.from("sessions").select("id,title,public_code,status,decision_method,expires_at,owner_id").eq("public_code", code).maybeSingle();
      if (sessionError) throw sessionError;
      if (!sessionData) {
        const { data: accessData } = await supabase.rpc("get_session_access_state", { session_code: code });
        const state = (accessData as { state?: string } | null)?.state;
        if (state === "removed" || state === "banned") {
          router.replace(`/?sessionAccess=${state}`);
        } else {
          router.replace(`/join?code=${code}`);
        }
        return;
      }
      const [memberResult, gameResult, voteResult, ownershipResult, settingsResult, bansResult, auditResult] = await Promise.all([
        supabase.from("session_members").select("id,user_id,display_name,role,joined_at").eq("session_id", sessionData.id).is("removed_at", null).order("joined_at"),
        supabase.from("session_games").select("*").eq("session_id", sessionData.id).is("removed_at", null).order("created_at", { ascending: false }),
        supabase.from("votes").select("session_game_id,user_id").eq("session_id", sessionData.id),
        supabase.from("game_ownership").select("session_game_id,user_id,status").eq("session_id", sessionData.id),
        supabase.from("session_settings").select("*").eq("session_id", sessionData.id).maybeSingle(),
        supabase.from("session_bans").select("id,session_id,user_id,banned_by,display_name,reason,created_at").eq("session_id", sessionData.id).is("revoked_at", null).order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("id,session_id,actor_id,action,entity_type,entity_id,metadata,created_at").eq("session_id", sessionData.id).order("created_at", { ascending: false }).limit(80),
      ]);
      const firstError = memberResult.error ?? gameResult.error ?? voteResult.error ?? ownershipResult.error ?? settingsResult.error;
      if (firstError) throw firstError;
      const votes = voteResult.data ?? [];
      const ownership = ownershipResult.data ?? [];
      const enrichedMembers = (memberResult.data ?? []).map((member) => ({
        ...member,
        vote_count: votes.filter((vote) => vote.user_id === member.user_id).length,
        owned_games_count: ownership.filter((item) =>
          item.user_id === member.user_id && ["owns", "subscription", "free"].includes(item.status),
        ).length,
      }));
      const enriched = (gameResult.data ?? []).map((game) => ({
        ...game,
        vote_count: votes.filter((vote) => vote.session_game_id === game.id).length,
        owner_count: ownership.filter((item) => item.session_game_id === game.id && ["owns", "subscription", "free"].includes(item.status)).length,
        has_voted: votes.some((vote) => vote.session_game_id === game.id && vote.user_id === user.id),
        ownership_status: (ownership.find((item) => item.session_game_id === game.id && item.user_id === user.id)?.status ?? "unknown") as OwnershipStatus,
      })) as SessionGame[];
      setSession(sessionData as SessionSummary);
      setMembers(enrichedMembers as SessionMember[]);
      setGames(enriched);
      setSettings(settingsResult.data as SessionSettings | null);
      setBans((bansResult.data ?? []) as SessionBan[]);
      setAuditLogs((auditResult.data ?? []) as SessionAuditLog[]);
      setError(null);
    } catch { setError(t("room.errorDescription")); }
    finally { setLoading(false); }
  }, [code, router, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!session || !userId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const channel = supabase.channel(`room:${session.id}`, { config: { presence: { key: userId } } });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${session.id}` }, () => void load());
    for (const table of ["session_members", "session_games", "votes", "game_ownership", "decision_results", "session_settings", "session_bans", "audit_logs"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `session_id=eq.${session.id}` }, () => void load());
    }
    channel.on("presence", { event: "sync" }, () => setOnlineUserIds(Object.keys(channel.presenceState())));
    channel.subscribe((status) => { if (status === "SUBSCRIBED") void channel.track({ user_id: userId, online_at: new Date().toISOString() }); });
    return () => { void supabase.removeChannel(channel); };
  }, [load, session, userId]);

  useEffect(() => {
    if (!session || !userId) return;
    let active = true;
    const checkAccess = async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const { data } = await supabase.rpc("get_session_access_state", { session_code: code });
      if (!active) return;
      const state = (data as { state?: string } | null)?.state;
      if (state === "removed" || state === "banned") {
        router.replace(`/?sessionAccess=${state}`);
      }
    };
    const interval = window.setInterval(() => void checkAccess(), 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkAccess();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code, router, session, userId]);

  return { session, members, games, userId, onlineUserIds, settings, bans, auditLogs, loading, error, reload: load };
}
