begin;

create index session_bans_user_id_idx on public.session_bans(user_id);
create index session_bans_banned_by_idx on public.session_bans(banned_by);
create index session_bans_revoked_by_idx on public.session_bans(revoked_by)
where revoked_by is not null;

commit;
