create or replace function public.remove_session_game(
  target_session_id uuid,
  target_game_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null
    or not private.can_perform_session_action(target_session_id, 'remove_game') then
    raise exception 'Sem permissão';
  end if;
  update public.session_games
  set removed_at = now()
  where id = target_game_id and session_id = target_session_id and removed_at is null;
  if not found then raise exception 'Jogo não encontrado'; end if;
  delete from public.votes where session_game_id = target_game_id;
  delete from public.game_ownership where session_game_id = target_game_id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id)
  values (target_session_id, uid, 'game.removed', 'session_game', target_game_id);
end;
$$;

create or replace function public.draw_session_game(
  target_session_id uuid,
  weighted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  selected_game uuid;
  run_id uuid;
  selected_method public.decision_method;
  vote_snapshot jsonb;
begin
  if uid is null
    or not private.can_perform_session_action(target_session_id, 'start_decision') then
    raise exception 'Sem permissão para iniciar a decisão';
  end if;
  select decision_method into selected_method
  from public.sessions
  where id = target_session_id and status in ('open', 'deciding');
  if selected_method is null then raise exception 'Sessão não está aberta'; end if;

  select coalesce(jsonb_object_agg(game_id, vote_count), '{}'::jsonb)
  into vote_snapshot
  from (
    select sg.id game_id, count(v.id) vote_count
    from public.session_games sg
    left join public.votes v on v.session_game_id = sg.id
    where sg.session_id = target_session_id and sg.removed_at is null
    group by sg.id
  ) counts;

  if weighted then
    select sg.id into selected_game
    from public.session_games sg
    left join public.votes v on v.session_game_id = sg.id
    where sg.session_id = target_session_id and sg.removed_at is null
    group by sg.id
    order by -ln(greatest(random(), 0.000001)) / greatest(count(v.id), 1)
    limit 1;
  else
    select sg.id into selected_game
    from public.session_games sg
    where sg.session_id = target_session_id and sg.removed_at is null
    order by random()
    limit 1;
  end if;
  if selected_game is null then raise exception 'Nenhum jogo elegível'; end if;

  insert into public.decision_runs(session_id, method, initiated_by, seed, snapshot, completed_at)
  values (
    target_session_id,
    case when weighted then 'weighted_random' else 'random' end,
    uid,
    gen_random_uuid()::text,
    vote_snapshot,
    now()
  )
  returning id into run_id;
  insert into public.decision_results(session_id, decision_run_id, session_game_id)
  values (target_session_id, run_id, selected_game);
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id,
    uid,
    'decision.drawn',
    'session_game',
    selected_game,
    jsonb_build_object('weighted', weighted)
  );
  return jsonb_build_object('game_id', selected_game, 'run_id', run_id);
end;
$$;

create or replace function public.delete_session(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null
    or not private.has_session_role(target_session_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o owner pode excluir a sessão';
  end if;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id)
  values (target_session_id, uid, 'session.deleted', 'session', target_session_id);
  update public.sessions
  set deleted_at = now(), status = 'closed'
  where id = target_session_id and deleted_at is null;
  update public.session_members
  set removed_at = now()
  where session_id = target_session_id and removed_at is null;
end;
$$;

revoke all on function public.delete_session(uuid) from public, anon;
grant execute on function public.delete_session(uuid) to authenticated;
