alter table public.session_settings
  add column game_add_permission text not null default 'everyone'
    check (game_add_permission in ('owner', 'coowners', 'everyone')),
  add column game_remove_permission text not null default 'coowners'
    check (game_remove_permission in ('owner', 'coowners')),
  add column allow_vote_changes boolean not null default true,
  add column max_votes_per_member smallint not null default 0
    check (max_votes_per_member between 0 and 100),
  add column decision_permission text not null default 'everyone'
    check (decision_permission in ('owner', 'coowners', 'everyone')),
  add column allow_anonymous_members boolean not null default true,
  add column coowners_can_kick_members boolean not null default false,
  add column coowners_can_ban_members boolean not null default false,
  add column coowners_can_remove_games boolean not null default true,
  add column coowners_can_lock_voting boolean not null default false;

update public.session_settings
set
  game_add_permission = case
    when games_locked then 'owner'
    when members_can_add_games then 'everyone'
    when coowners_can_manage_games then 'coowners'
    else 'owner'
  end,
  game_remove_permission = case
    when coowners_can_manage_games then 'coowners'
    else 'owner'
  end,
  coowners_can_kick_members = coowners_can_manage_members,
  coowners_can_remove_games = coowners_can_manage_games,
  coowners_can_lock_voting = coowners_can_manage_settings;

create or replace function private.can_perform_session_action(
  target_session_id uuid,
  action_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when sm.role = 'owner' then true
      when sm.role in ('co_owner', 'moderator') then case action_name
        when 'view_admin' then true
        when 'add_game' then not ss.games_locked
          and ss.game_add_permission in ('coowners', 'everyone')
        when 'remove_game' then ss.game_remove_permission = 'coowners'
          and ss.coowners_can_remove_games
        when 'kick_member' then ss.coowners_can_kick_members
        when 'ban_member' then ss.coowners_can_ban_members
        when 'lock_voting' then ss.coowners_can_lock_voting
        when 'start_decision' then ss.decision_permission in ('coowners', 'everyone')
        else false
      end
      when sm.role = 'member' then case action_name
        when 'add_game' then not ss.games_locked
          and ss.game_add_permission = 'everyone'
        when 'start_decision' then ss.decision_permission = 'everyone'
        else false
      end
      else false
    end
    from public.session_members sm
    join public.session_settings ss on ss.session_id = sm.session_id
    where sm.session_id = target_session_id
      and sm.user_id = (select auth.uid())
      and sm.removed_at is null
  ), false);
$$;

revoke all on function private.can_perform_session_action(uuid, text) from public, anon;
grant execute on function private.can_perform_session_action(uuid, text) to authenticated;

create or replace function private.can_manage_session(
  target_session_id uuid,
  capability text default 'session'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case capability
    when 'games' then private.can_perform_session_action(target_session_id, 'remove_game')
    when 'members' then private.can_perform_session_action(target_session_id, 'kick_member')
    when 'settings' then private.can_perform_session_action(target_session_id, 'settings')
    else private.can_perform_session_action(target_session_id, 'view_admin')
  end;
$$;

revoke all on function private.can_manage_session(uuid, text) from public, anon;
grant execute on function private.can_manage_session(uuid, text) to authenticated;

drop policy sessions_update_admin on public.sessions;
create policy sessions_update_owner
on public.sessions for update to authenticated
using (private.has_session_role(id, array['owner']::public.member_role[]))
with check (private.has_session_role(id, array['owner']::public.member_role[]));

drop policy session_games_insert_member on public.session_games;
create policy session_games_insert_member
on public.session_games for insert to authenticated
with check (
  added_by = (select auth.uid())
  and private.can_perform_session_action(session_games.session_id, 'add_game')
  and exists (
    select 1
    from public.sessions s
    where s.id = session_games.session_id
      and s.status = 'open'
      and s.deleted_at is null
  )
);

drop policy session_games_update_admin on public.session_games;
create policy session_games_update_admin
on public.session_games for update to authenticated
using (private.can_perform_session_action(session_games.session_id, 'remove_game'))
with check (private.can_perform_session_action(session_games.session_id, 'remove_game'));
