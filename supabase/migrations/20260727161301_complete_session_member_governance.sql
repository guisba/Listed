create or replace function public.remove_session_member(
  target_session_id uuid,
  target_user_id uuid,
  should_ban boolean default false,
  ban_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  actor_role public.member_role;
  target_role public.member_role;
  target_name text;
  required_action text := case when should_ban then 'ban_member' else 'kick_member' end;
begin
  select role into actor_role
  from public.session_members
  where session_id = target_session_id and user_id = uid and removed_at is null;
  select role, display_name into target_role, target_name
  from public.session_members
  where session_id = target_session_id and user_id = target_user_id and removed_at is null
  for update;

  if actor_role is null or target_role is null or target_user_id = uid then
    raise exception 'Participante inválido';
  end if;
  if target_role = 'owner' then raise exception 'O dono não pode ser removido'; end if;
  if actor_role in ('co_owner', 'moderator') and target_role <> 'member' then
    raise exception 'Co-owner só pode remover membros';
  end if;
  if not private.can_perform_session_action(target_session_id, required_action) then
    raise exception 'Sem permissão para esta ação';
  end if;

  update public.session_members
  set removed_at = now()
  where session_id = target_session_id and user_id = target_user_id and removed_at is null;
  delete from public.votes where session_id = target_session_id and user_id = target_user_id;
  delete from public.game_ownership where session_id = target_session_id and user_id = target_user_id;

  if should_ban then
    insert into public.session_bans(session_id, user_id, banned_by, display_name, reason)
    values (target_session_id, target_user_id, uid, target_name, nullif(btrim(ban_reason), ''))
    on conflict (session_id, user_id) where revoked_at is null do update
      set banned_by = excluded.banned_by,
          display_name = excluded.display_name,
          reason = excluded.reason,
          created_at = now();
  end if;

  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id,
    uid,
    case when should_ban then 'member.banned' else 'member.removed' end,
    'session_member',
    target_user_id,
    jsonb_build_object('previous_role', target_role)
  );
end;
$$;

create or replace function public.unban_session_member(
  target_session_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null
    or not private.has_session_role(target_session_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o owner pode remover banimentos';
  end if;
  update public.session_bans
  set revoked_at = now(), revoked_by = uid
  where session_id = target_session_id and user_id = target_user_id and revoked_at is null;
  if not found then raise exception 'Bloqueio não encontrado'; end if;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id)
  values (target_session_id, uid, 'member.unbanned', 'session_member', target_user_id);
end;
$$;

create or replace function public.update_session_governance(
  target_session_id uuid,
  next_game_add_permission text,
  next_game_remove_permission text,
  next_voting_open boolean,
  next_allow_vote_changes boolean,
  next_max_votes_per_member integer,
  next_decision_permission text,
  next_session_open boolean,
  next_allow_anonymous_members boolean,
  next_max_participants integer,
  next_coowners_can_kick_members boolean,
  next_coowners_can_ban_members boolean,
  next_coowners_can_remove_games boolean,
  next_coowners_can_lock_voting boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result public.session_settings;
begin
  if uid is null
    or not private.has_session_role(target_session_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o owner pode alterar permissões';
  end if;
  if next_game_add_permission not in ('owner', 'coowners', 'everyone')
    or next_game_remove_permission not in ('owner', 'coowners')
    or next_decision_permission not in ('owner', 'coowners', 'everyone') then
    raise exception 'Política inválida';
  end if;
  if next_max_votes_per_member not between 0 and 100 then
    raise exception 'Limite de votos inválido';
  end if;
  if next_max_participants not between 2 and 100 then
    raise exception 'Limite de participantes inválido';
  end if;
  if next_max_participants < (
    select count(*) from public.session_members
    where session_id = target_session_id and removed_at is null
  ) then
    raise exception 'O limite não pode ser menor que o número atual de participantes';
  end if;

  update public.session_settings
  set
    game_add_permission = next_game_add_permission,
    game_remove_permission = next_game_remove_permission,
    voting_locked = not next_voting_open,
    allow_vote_changes = next_allow_vote_changes,
    max_votes_per_member = next_max_votes_per_member,
    decision_permission = next_decision_permission,
    allow_anonymous_members = next_allow_anonymous_members,
    coowners_can_kick_members = next_coowners_can_kick_members,
    coowners_can_ban_members = next_coowners_can_ban_members,
    coowners_can_remove_games = next_coowners_can_remove_games,
    coowners_can_lock_voting = next_coowners_can_lock_voting,
    games_locked = false,
    members_can_add_games = next_game_add_permission = 'everyone',
    coowners_can_manage_games = next_game_remove_permission = 'coowners',
    coowners_can_manage_members = next_coowners_can_kick_members,
    coowners_can_manage_settings = false
  where session_id = target_session_id
  returning * into result;

  update public.sessions
  set
    status = case
      when status in ('closed', 'expired') then status
      when next_session_open then 'open'::public.session_status
      else 'locked'::public.session_status
    end,
    max_participants = next_max_participants
  where id = target_session_id;

  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id,
    uid,
    'session.settings_updated',
    'session',
    target_session_id,
    jsonb_build_object(
      'game_add_permission', next_game_add_permission,
      'game_remove_permission', next_game_remove_permission,
      'voting_open', next_voting_open,
      'decision_permission', next_decision_permission,
      'session_open', next_session_open
    )
  );
  return jsonb_build_object('session_id', result.session_id, 'updated_at', result.updated_at);
end;
$$;

create or replace function public.update_session_status(
  target_session_id uuid,
  next_status public.session_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null
    or not private.has_session_role(target_session_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o owner pode alterar o estado da sessão';
  end if;
  if next_status not in ('open', 'locked', 'closed') then raise exception 'Estado inválido'; end if;
  update public.sessions set status = next_status where id = target_session_id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id,
    uid,
    'session.status_updated',
    'session',
    target_session_id,
    jsonb_build_object('status', next_status)
  );
end;
$$;

create or replace function public.set_session_voting_open(
  target_session_id uuid,
  next_voting_open boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  actor_role public.member_role;
begin
  select role into actor_role
  from public.session_members
  where session_id = target_session_id and user_id = uid and removed_at is null;
  if actor_role = 'owner' then
    null;
  elsif actor_role in ('co_owner', 'moderator')
    and private.can_perform_session_action(target_session_id, 'lock_voting') then
    null;
  else
    raise exception 'Sem permissão para alterar a votação';
  end if;
  update public.session_settings
  set voting_locked = not next_voting_open
  where session_id = target_session_id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id,
    uid,
    'session.voting_updated',
    'session',
    target_session_id,
    jsonb_build_object('voting_open', next_voting_open)
  );
end;
$$;

revoke all on function public.update_session_governance(
  uuid, text, text, boolean, boolean, integer, text, boolean, boolean,
  integer, boolean, boolean, boolean, boolean
) from public, anon;
revoke all on function public.set_session_voting_open(uuid, boolean) from public, anon;
revoke all on function public.update_session_settings(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean
) from authenticated;

grant execute on function public.update_session_governance(
  uuid, text, text, boolean, boolean, integer, text, boolean, boolean,
  integer, boolean, boolean, boolean, boolean
) to authenticated;
grant execute on function public.set_session_voting_open(uuid, boolean) to authenticated;
