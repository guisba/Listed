begin;

create table public.session_settings (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  games_locked boolean not null default false,
  voting_locked boolean not null default false,
  members_can_add_games boolean not null default true,
  coowners_can_manage_games boolean not null default true,
  coowners_can_manage_members boolean not null default false,
  coowners_can_manage_settings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_bans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  banned_by uuid not null references auth.users(id),
  display_name text not null check (char_length(display_name) between 2 and 40),
  reason text check (reason is null or char_length(reason) <= 240),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  check ((revoked_at is null and revoked_by is null) or (revoked_at is not null and revoked_by is not null))
);

create unique index session_members_one_active_owner_idx
  on public.session_members(session_id)
  where role = 'owner' and removed_at is null;
create unique index session_bans_one_active_idx
  on public.session_bans(session_id, user_id)
  where revoked_at is null;
create index session_bans_session_created_idx
  on public.session_bans(session_id, created_at desc);
create index audit_logs_session_action_created_idx
  on public.audit_logs(session_id, action, created_at desc);

insert into public.session_settings(session_id)
select id from public.sessions
on conflict (session_id) do nothing;

create or replace function private.create_session_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.session_settings(session_id) values (new.id)
  on conflict (session_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_session_settings() from public, anon, authenticated;

create trigger sessions_create_settings
after insert on public.sessions
for each row execute function private.create_session_settings();

create trigger session_settings_updated_at
before update on public.session_settings
for each row execute function private.set_updated_at();

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
  select exists (
    select 1
    from public.session_members sm
    left join public.session_settings ss on ss.session_id = sm.session_id
    where sm.session_id = target_session_id
      and sm.user_id = (select auth.uid())
      and sm.removed_at is null
      and (
        sm.role = 'owner'
        or (
          sm.role in ('co_owner', 'moderator')
          and case capability
            when 'games' then coalesce(ss.coowners_can_manage_games, true)
            when 'members' then coalesce(ss.coowners_can_manage_members, false)
            when 'settings' then coalesce(ss.coowners_can_manage_settings, false)
            else true
          end
        )
      )
  );
$$;

revoke all on function private.can_manage_session(uuid, text) from public, anon;
grant execute on function private.can_manage_session(uuid, text) to authenticated;

create or replace function private.protect_session_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.public_code <> old.public_code
    or new.kind <> old.kind
    or new.group_id is distinct from old.group_id then
    raise exception 'Campos de identidade da sessão exigem um fluxo administrativo dedicado';
  end if;
  if new.owner_id <> old.owner_id
    and coalesce(current_setting('listed.allow_owner_transfer', true), '') <> '1' then
    raise exception 'A transferência exige o fluxo administrativo dedicado';
  end if;
  new.last_activity_at := now();
  return new;
end;
$$;

alter table public.session_settings enable row level security;
alter table public.session_bans enable row level security;

create policy session_settings_select_member
on public.session_settings for select to authenticated
using (private.is_session_member(session_id));

create policy session_bans_select_admin
on public.session_bans for select to authenticated
using (private.can_manage_session(session_id, 'members'));

grant select on public.session_settings to authenticated;
grant select on public.session_bans to authenticated;

drop policy sessions_update_admin on public.sessions;
create policy sessions_update_admin
on public.sessions for update to authenticated
using (private.can_manage_session(id, 'session'))
with check (private.can_manage_session(id, 'session'));

drop policy session_games_insert_member on public.session_games;
create policy session_games_insert_member
on public.session_games for insert to authenticated
with check (
  added_by = (select auth.uid())
  and private.is_session_member(session_id)
  and exists (
    select 1
    from public.sessions s
    join public.session_settings ss on ss.session_id = s.id
    where s.id = session_id
      and s.status = 'open'
      and s.deleted_at is null
      and not ss.games_locked
      and (ss.members_can_add_games or private.can_manage_session(session_id, 'games'))
  )
);

drop policy session_games_update_admin on public.session_games;
create policy session_games_update_admin
on public.session_games for update to authenticated
using (private.can_manage_session(session_id, 'games'))
with check (private.can_manage_session(session_id, 'games'));

drop policy audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using (private.can_manage_session(session_id, 'session'));

create or replace function private.enforce_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_method public.decision_method;
  current_status public.session_status;
  is_locked boolean;
begin
  select s.decision_method, s.status, ss.voting_locked
  into current_method, current_status, is_locked
  from public.sessions s
  join public.session_settings ss on ss.session_id = s.id
  where s.id = new.session_id;

  if current_status not in ('open', 'deciding') or is_locked then
    raise exception 'A votação está fechada';
  end if;
  if not exists (
    select 1 from public.session_games
    where id = new.session_game_id
      and session_id = new.session_id
      and removed_at is null
  ) then
    raise exception 'Jogo inválido';
  end if;
  if current_method = 'single_vote' then
    delete from public.votes
    where session_id = new.session_id
      and user_id = new.user_id
      and session_game_id <> new.session_game_id;
  end if;
  return new;
end;
$$;

drop policy votes_delete_own on public.votes;
create policy votes_delete_own
on public.votes for delete to authenticated
using (
  user_id = (select auth.uid())
  and (
    private.can_manage_session(session_id, 'session')
    or exists (
      select 1 from public.session_settings ss
      where ss.session_id = session_id and not ss.voting_locked
    )
  )
);

create or replace function public.join_session(session_code text, member_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target public.sessions;
  clean_name text := btrim(member_display_name);
  current_count integer;
begin
  if uid is null then raise exception 'Autenticação obrigatória'; end if;
  if char_length(clean_name) not between 2 and 40 then raise exception 'Nome inválido'; end if;

  select * into target
  from public.sessions
  where public_code = upper(btrim(session_code)) and deleted_at is null
  for update;

  if target.id is null then raise exception 'Sessão não encontrada'; end if;
  if exists (
    select 1 from public.session_bans
    where session_id = target.id and user_id = uid and revoked_at is null
  ) then
    raise exception 'Acesso bloqueado nesta sessão';
  end if;
  if target.status in ('closed', 'expired', 'locked')
    or (target.expires_at is not null and target.expires_at <= now()) then
    raise exception 'Esta sessão não aceita novas entradas';
  end if;

  select count(*) into current_count
  from public.session_members
  where session_id = target.id and removed_at is null;
  if current_count >= target.max_participants then
    raise exception 'A sessão atingiu o limite de participantes';
  end if;

  insert into public.session_members(session_id, user_id, display_name, role)
  values (target.id, uid, clean_name, 'member')
  on conflict (session_id, user_id) do update
    set display_name = excluded.display_name,
        role = case
          when public.session_members.role = 'owner' then 'owner'::public.member_role
          else 'member'::public.member_role
        end,
        removed_at = null,
        last_seen_at = now();

  update public.sessions set last_activity_at = now() where id = target.id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id)
  values (target.id, uid, 'member.joined', 'session_member', uid);
  return jsonb_build_object('id', target.id, 'public_code', target.public_code);
end;
$$;

create or replace function public.get_session_access_state(session_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target_id uuid;
  member_removed_at timestamptz;
begin
  if uid is null then raise exception 'Autenticação obrigatória'; end if;
  select id into target_id
  from public.sessions
  where public_code = upper(btrim(session_code)) and deleted_at is null;
  if target_id is null then return jsonb_build_object('state', 'not_found'); end if;
  if exists (
    select 1 from public.session_bans
    where session_id = target_id and user_id = uid and revoked_at is null
  ) then
    return jsonb_build_object('state', 'banned');
  end if;
  select removed_at into member_removed_at
  from public.session_members
  where session_id = target_id and user_id = uid;
  if found and member_removed_at is null then
    return jsonb_build_object('state', 'member');
  end if;
  if found then return jsonb_build_object('state', 'removed'); end if;
  return jsonb_build_object('state', 'not_member');
end;
$$;

create or replace function public.set_session_member_role(
  target_session_id uuid,
  target_user_id uuid,
  new_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  previous_role public.member_role;
begin
  if uid is null or not private.has_session_role(target_session_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o dono pode alterar papéis';
  end if;
  if new_role not in ('co_owner', 'member') then raise exception 'Papel inválido'; end if;
  select role into previous_role
  from public.session_members
  where session_id = target_session_id and user_id = target_user_id and removed_at is null
  for update;
  if previous_role is null or previous_role = 'owner' then raise exception 'Participante inválido'; end if;

  update public.session_members set role = new_role
  where session_id = target_session_id and user_id = target_user_id and removed_at is null;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id, uid, 'member.role_changed', 'session_member', target_user_id,
    jsonb_build_object('from', previous_role, 'to', new_role)
  );
end;
$$;

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
begin
  select role into actor_role from public.session_members
  where session_id = target_session_id and user_id = uid and removed_at is null;
  select role, display_name into target_role, target_name from public.session_members
  where session_id = target_session_id and user_id = target_user_id and removed_at is null
  for update;

  if actor_role is null or target_role is null or target_user_id = uid then
    raise exception 'Participante inválido';
  end if;
  if target_role = 'owner' then raise exception 'O dono não pode ser removido'; end if;
  if actor_role in ('co_owner', 'moderator')
    and (target_role <> 'member' or not private.can_manage_session(target_session_id, 'members')) then
    raise exception 'Sem permissão para remover este participante';
  end if;
  if actor_role not in ('owner', 'co_owner', 'moderator') then raise exception 'Sem permissão'; end if;

  update public.session_members set removed_at = now()
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
    target_session_id, uid,
    case when should_ban then 'member.banned' else 'member.removed' end,
    'session_member', target_user_id,
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
  if uid is null or not private.can_manage_session(target_session_id, 'members') then
    raise exception 'Sem permissão';
  end if;
  update public.session_bans
  set revoked_at = now(), revoked_by = uid
  where session_id = target_session_id and user_id = target_user_id and revoked_at is null;
  if not found then raise exception 'Bloqueio não encontrado'; end if;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id)
  values (target_session_id, uid, 'member.unbanned', 'session_member', target_user_id);
end;
$$;

create or replace function public.transfer_session_ownership(
  target_session_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target_role public.member_role;
begin
  if uid is null or not private.has_session_role(target_session_id, array['owner']::public.member_role[]) then
    raise exception 'Somente o dono pode transferir a sessão';
  end if;
  perform 1 from public.sessions where id = target_session_id for update;
  perform 1 from public.session_members where session_id = target_session_id for update;
  select role into target_role
  from public.session_members
  where session_id = target_session_id and user_id = target_user_id and removed_at is null;
  if target_role is null or target_user_id = uid then raise exception 'Participante inválido'; end if;

  update public.session_members set role = 'co_owner'
  where session_id = target_session_id and user_id = uid and role = 'owner' and removed_at is null;
  update public.session_members set role = 'owner'
  where session_id = target_session_id and user_id = target_user_id and removed_at is null;
  perform set_config('listed.allow_owner_transfer', '1', true);
  update public.sessions set owner_id = target_user_id where id = target_session_id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id, uid, 'session.ownership_transferred', 'session_member', target_user_id,
    jsonb_build_object('previous_owner', uid)
  );
end;
$$;

create or replace function public.update_session_settings(
  target_session_id uuid,
  next_games_locked boolean,
  next_voting_locked boolean,
  next_members_can_add_games boolean,
  next_coowners_can_manage_games boolean,
  next_coowners_can_manage_members boolean,
  next_coowners_can_manage_settings boolean
)
returns public.session_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  actor_role public.member_role;
  result public.session_settings;
begin
  select role into actor_role from public.session_members
  where session_id = target_session_id and user_id = uid and removed_at is null;
  if actor_role in ('co_owner', 'moderator') and not private.can_manage_session(target_session_id, 'settings') then
    raise exception 'Sem permissão';
  end if;
  if actor_role not in ('owner', 'co_owner', 'moderator') then raise exception 'Sem permissão'; end if;
  if actor_role <> 'owner' and (
    next_coowners_can_manage_games is distinct from (
      select coowners_can_manage_games from public.session_settings where session_id = target_session_id
    )
    or next_coowners_can_manage_members is distinct from (
      select coowners_can_manage_members from public.session_settings where session_id = target_session_id
    )
    or next_coowners_can_manage_settings is distinct from (
      select coowners_can_manage_settings from public.session_settings where session_id = target_session_id
    )
  ) then
    raise exception 'Somente o dono pode delegar permissões';
  end if;

  update public.session_settings set
    games_locked = next_games_locked,
    voting_locked = next_voting_locked,
    members_can_add_games = next_members_can_add_games,
    coowners_can_manage_games = next_coowners_can_manage_games,
    coowners_can_manage_members = next_coowners_can_manage_members,
    coowners_can_manage_settings = next_coowners_can_manage_settings
  where session_id = target_session_id
  returning * into result;

  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id, uid, 'session.settings_updated', 'session', target_session_id,
    jsonb_build_object(
      'games_locked', next_games_locked,
      'voting_locked', next_voting_locked,
      'members_can_add_games', next_members_can_add_games
    )
  );
  return result;
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
  if uid is null or not private.can_manage_session(target_session_id, 'session') then
    raise exception 'Sem permissão';
  end if;
  if next_status not in ('open', 'locked', 'closed') then raise exception 'Estado inválido'; end if;
  update public.sessions set status = next_status where id = target_session_id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_session_id, uid, 'session.status_updated', 'session', target_session_id,
    jsonb_build_object('status', next_status)
  );
end;
$$;

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
  if uid is null or not private.can_manage_session(target_session_id, 'games') then
    raise exception 'Sem permissão';
  end if;
  update public.session_games set removed_at = now()
  where id = target_game_id and session_id = target_session_id and removed_at is null;
  if not found then raise exception 'Jogo não encontrado'; end if;
  delete from public.votes where session_game_id = target_game_id;
  delete from public.game_ownership where session_game_id = target_game_id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id)
  values (target_session_id, uid, 'game.removed', 'session_game', target_game_id);
end;
$$;

revoke all on function public.join_session(text, text) from public, anon;
revoke all on function public.get_session_access_state(text) from public, anon;
revoke all on function public.set_session_member_role(uuid, uuid, public.member_role) from public, anon;
revoke all on function public.remove_session_member(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.unban_session_member(uuid, uuid) from public, anon;
revoke all on function public.transfer_session_ownership(uuid, uuid) from public, anon;
revoke all on function public.update_session_settings(uuid, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.update_session_status(uuid, public.session_status) from public, anon;
revoke all on function public.remove_session_game(uuid, uuid) from public, anon;

grant execute on function public.join_session(text, text) to authenticated;
grant execute on function public.get_session_access_state(text) to authenticated;
grant execute on function public.set_session_member_role(uuid, uuid, public.member_role) to authenticated;
grant execute on function public.remove_session_member(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.unban_session_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_session_ownership(uuid, uuid) to authenticated;
grant execute on function public.update_session_settings(uuid, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.update_session_status(uuid, public.session_status) to authenticated;
grant execute on function public.remove_session_game(uuid, uuid) to authenticated;

-- Repair cached Brazilian/English metadata without guessing from titles.
update public.catalog_games cg
set features = coalesce((
  select array_agg(distinct feature order by feature)
  from unnest(
    coalesce(cg.features, '{}'::text[])
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) in ('um jogador', 'single-player')
    ) then array['singleplayer'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) in ('multijogador', 'multi-player', 'multiplayer')
    ) then array['multiplayer'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) in ('cooperativo', 'co-op')
    ) then array['coop'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) in ('cooperativo on-line', 'cooperativo online', 'online co-op')
    ) then array['coop-online'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) in ('tela dividida/compartilhada', 'shared/split screen', 'shared/split screen co-op')
    ) then array['coop-local'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) in ('jxj', 'pvp')
    ) then array['pvp'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) in ('jxj on-line', 'jxj online', 'online pvp')
    ) then array['pvp-online'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) like '%controle%' or lower(c) like '%controller%'
    ) then array['controller-support'] else '{}'::text[] end
    || case when exists (
      select 1 from unnest(coalesce(cg.categories, '{}'::text[])) c
      where lower(c) like 'remote play%'
    ) then array['remote-play'] else '{}'::text[] end
  ) feature
), '{}'::text[])
where cg.source = 'steam';

update public.session_games sg
set features = cg.features
from public.catalog_games cg
where sg.catalog_game_id = cg.id
  and sg.source = 'steam'
  and sg.removed_at is null
  and sg.features is distinct from cg.features;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_settings'
  ) then
    alter publication supabase_realtime add table public.session_settings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_bans'
  ) then
    alter publication supabase_realtime add table public.session_bans;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end;
$$;

commit;
