"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ensureAnonymousUser, getBrowserSupabase } from "@/lib/supabase/browser";
import type { OwnershipStatus, SessionGame, SessionMember, SessionSummary } from "@/types/domain";
import { useI18n } from "@/i18n/client";

export function useRoomData(code: string) {
  const { t } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [games, setGames] = useState<SessionGame[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
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
      if (!sessionData) { router.replace(`/join?code=${code}`); return; }
      const [memberResult, gameResult, voteResult, ownershipResult] = await Promise.all([
        supabase.from("session_members").select("id,user_id,display_name,role,joined_at").eq("session_id", sessionData.id).order("joined_at"),
        supabase.from("session_games").select("*").eq("session_id", sessionData.id).is("removed_at", null).order("created_at", { ascending: false }),
        supabase.from("votes").select("session_game_id,user_id").eq("session_id", sessionData.id),
        supabase.from("game_ownership").select("session_game_id,user_id,status").eq("session_id", sessionData.id),
      ]);
      const firstError = memberResult.error ?? gameResult.error ?? voteResult.error ?? ownershipResult.error;
      if (firstError) throw firstError;
      const votes = voteResult.data ?? [];
      const ownership = ownershipResult.data ?? [];
      const enriched = (gameResult.data ?? []).map((game) => ({
        ...game,
        vote_count: votes.filter((vote) => vote.session_game_id === game.id).length,
        owner_count: ownership.filter((item) => item.session_game_id === game.id && ["owns", "subscription", "free"].includes(item.status)).length,
        has_voted: votes.some((vote) => vote.session_game_id === game.id && vote.user_id === user.id),
        ownership_status: (ownership.find((item) => item.session_game_id === game.id && item.user_id === user.id)?.status ?? "unknown") as OwnershipStatus,
      })) as SessionGame[];
      setSession(sessionData as SessionSummary); setMembers((memberResult.data ?? []) as SessionMember[]); setGames(enriched); setError(null);
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
    for (const table of ["session_members", "session_games", "votes", "game_ownership", "decision_results"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `session_id=eq.${session.id}` }, () => void load());
    }
    channel.on("presence", { event: "sync" }, () => setOnlineUserIds(Object.keys(channel.presenceState())));
    channel.subscribe((status) => { if (status === "SUBSCRIBED") void channel.track({ user_id: userId, online_at: new Date().toISOString() }); });
    return () => { void supabase.removeChannel(channel); };
  }, [load, session, userId]);

  return { session, members, games, userId, onlineUserIds, loading, error, reload: load };
}
