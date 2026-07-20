begin;

revoke all on function public.create_quick_session(text, text, public.decision_method, integer) from anon;
revoke all on function public.join_session(text, text) from anon;
revoke all on function public.search_catalog_games(text, integer) from anon;
revoke all on function public.draw_session_game(uuid, boolean) from anon;

create index if not exists groups_owner_id_idx on public.groups(owner_id);
create index if not exists session_invites_created_by_idx on public.session_invites(created_by);
create index if not exists session_games_catalog_game_id_idx on public.session_games(catalog_game_id) where catalog_game_id is not null;
create index if not exists session_games_added_by_idx on public.session_games(added_by);
create index if not exists decision_runs_initiated_by_idx on public.decision_runs(initiated_by);
create index if not exists decision_results_run_id_idx on public.decision_results(decision_run_id);
create index if not exists decision_results_game_id_idx on public.decision_results(session_game_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id) where actor_id is not null;

commit;
